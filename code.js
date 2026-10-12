// Banner Automation — Figma main thread.
// Serves the layer tree of a banner frame, persists sessions as plugin data and
// exports the layers the user added to the HTML as images.

figma.showUI(__html__, { width: 1120, height: 800, themeColors: true, title: 'Banner Automation' });

const SESSION_KEY = 'ba.session';
const SNAPSHOT_KEY = 'ba.snapshot';
const PACKAGE_KEY = 'ba.package';
const FRAME_TYPES = ['FRAME', 'COMPONENT', 'INSTANCE'];
const MAX_NODES = 4000;

function parseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function round(n) {
  return Math.round(n * 100) / 100;
}

async function getNode(id) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.removed) throw new Error('Layer not found — it may have been deleted.');
  return node;
}

function isTopLevel(node) {
  return node.parent && (node.parent.type === 'PAGE' || node.parent.type === 'SECTION');
}

// The banner a node belongs to is its top-level frame on the page.
function bannerOf(node) {
  let n = node;
  while (n && n.parent && !isTopLevel(n)) n = n.parent;
  return n && isTopLevel(n) && FRAME_TYPES.indexOf(n.type) !== -1 ? n : null;
}

function listBanners() {
  const out = [];
  const visit = (parent) => {
    for (const n of parent.children) {
      if (FRAME_TYPES.indexOf(n.type) !== -1) out.push(n);
      else if (n.type === 'SECTION') visit(n);
    }
  };
  visit(figma.currentPage);
  return out.map((f) => {
    const session = parseJSON(f.getPluginData(SESSION_KEY));
    return {
      id: f.id,
      name: f.name,
      width: Math.round(f.width),
      height: Math.round(f.height),
      elements: session && session.elements ? session.elements.length : 0
    };
  });
}

function hasImageFill(node) {
  const fills = node.fills;
  return Array.isArray(fills) && fills.some((f) => f.type === 'IMAGE' || f.type === 'VIDEO');
}

// Masks clip the siblings stacked above them, so look below the node and below each ancestor.
function maskFor(node, frame) {
  let n = node;
  while (n && n !== frame && n.parent) {
    const siblings = n.parent.children;
    for (let i = siblings.indexOf(n) - 1; i >= 0; i--) {
      if (siblings[i].isMask) return siblings[i];
    }
    if (n.parent === frame) break;
    n = n.parent;
  }
  return null;
}

function serializeTree(frame) {
  let count = 0;
  const walk = (node) => {
    count++;
    const box = node.absoluteBoundingBox;
    const mask = node.isMask ? null : maskFor(node, frame);
    const item = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
      w: box ? Math.round(box.width) : 0,
      h: box ? Math.round(box.height) : 0,
      isMask: !!node.isMask,
      img: hasImageFill(node),
      maskId: mask ? mask.id : null,
      maskName: mask ? mask.name : null,
      children: []
    };
    if ('children' in node && count < MAX_NODES) {
      for (const child of node.children) {
        if (count >= MAX_NODES) break;
        item.children.push(walk(child));
      }
    }
    return item;
  };
  return frame.children.map(walk);
}

function solidFillCss(fills) {
  if (!Array.isArray(fills)) return null;
  const visible = fills.filter((f) => f.visible !== false);
  if (visible.length === 0) return 'transparent';
  if (visible.length === 1 && visible[0].type === 'SOLID') {
    const c = visible[0].color;
    const a = visible[0].opacity === undefined ? 1 : visible[0].opacity;
    return 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',' + round(a) + ')';
  }
  return null;
}

async function exportBackground(frame, scale) {
  const css = solidFillCss(frame.fills);
  if (css) return { css: css };
  const rect = figma.createRectangle();
  try {
    rect.resize(frame.width, frame.height);
    rect.fills = frame.fills;
    const bytes = await rect.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
    return { css: 'transparent', bytes: bytes, ext: 'png' };
  } finally {
    rect.remove();
  }
}

function exportSettings(format, scale) {
  if (format === 'svg') return { format: 'SVG' };
  if (format === 'jpg') return { format: 'JPG', constraint: { type: 'SCALE', value: scale } };
  return { format: 'PNG', constraint: { type: 'SCALE', value: scale } };
}

// Exports one node relative to the banner. Layers listed in `hide` (elements nested
// inside this one that are animated separately) are hidden so they aren't baked in twice.
async function exportNode(node, origin, opts) {
  const restore = [];
  try {
    if (!node.visible) {
      node.visible = true;
      restore.push(node);
    }
    for (const id of opts.hide || []) {
      const child = await figma.getNodeByIdAsync(id);
      if (child && child.visible) {
        child.visible = false;
        restore.push(child);
      }
    }
    const bounds = node.absoluteRenderBounds;
    if (!bounds || bounds.width < 0.01 || bounds.height < 0.01) return null;
    const format = opts.format || 'png';
    const bytes = await node.exportAsync(exportSettings(format, Number(opts.scale) || 2));
    return {
      x: round(bounds.x - origin.x),
      y: round(bounds.y - origin.y),
      width: round(bounds.width),
      height: round(bounds.height),
      ext: format,
      bytes: bytes
    };
  } finally {
    for (const n of restore) n.visible = !n.visible;
  }
}

function sendSelection() {
  const sel = figma.currentPage.selection;
  const banner = sel.length ? bannerOf(sel[0]) : null;
  figma.ui.postMessage({ type: 'selection', ids: sel.map((n) => n.id), bannerId: banner ? banner.id : null });
}

const handlers = {
  async init() {
    const sel = figma.currentPage.selection;
    const banner = sel.length ? bannerOf(sel[0]) : null;
    return {
      banners: listBanners(),
      current: banner ? banner.id : null,
      pkg: parseJSON(figma.root.getPluginData(PACKAGE_KEY)),
      selection: sel.map((n) => n.id)
    };
  },

  async listBanners() {
    return listBanners();
  },

  async getBanner(p) {
    const frame = await getNode(p.id);
    return {
      info: { id: frame.id, name: frame.name, width: Math.round(frame.width), height: Math.round(frame.height) },
      tree: serializeTree(frame),
      session: parseJSON(frame.getPluginData(SESSION_KEY))
    };
  },

  async saveSession(p) {
    const frame = await getNode(p.id);
    frame.setPluginData(SESSION_KEY, JSON.stringify(p.session));
    return true;
  },

  async saveSnapshot(p) {
    const frame = await getNode(p.id);
    frame.setPluginData(SNAPSHOT_KEY, JSON.stringify({ at: Date.now(), session: p.session }));
    return true;
  },

  async loadSnapshot(p) {
    const frame = await getNode(p.id);
    return parseJSON(frame.getPluginData(SNAPSHOT_KEY));
  },

  async savePackage(p) {
    figma.root.setPluginData(PACKAGE_KEY, JSON.stringify(p.pkg));
    return true;
  },

  async exportAssets(p) {
    const frame = await getNode(p.id);
    const origin = frame.absoluteBoundingBox;
    const result = { items: {}, masks: {}, warnings: [] };

    for (const item of p.items || []) {
      const node = await figma.getNodeByIdAsync(item.id);
      if (!node || node.removed) {
        result.warnings.push('A layer in the HTML no longer exists.');
        continue;
      }
      try {
        const out = await exportNode(node, origin, item);
        if (out) result.items[item.key] = out;
        else result.warnings.push('"' + node.name + '" is empty and was skipped.');
      } catch (e) {
        result.warnings.push('Could not export "' + node.name + '": ' + e.message);
      }
    }

    for (const mask of p.masks || []) {
      const node = await figma.getNodeByIdAsync(mask.id);
      if (!node) continue;
      try {
        const out = await exportNode(node, origin, { format: 'png', scale: mask.scale });
        if (out) result.masks[mask.key] = out;
      } catch (e) {
        result.warnings.push('Could not export mask "' + node.name + '": ' + e.message);
      }
    }

    if (p.background) {
      result.background = await exportBackground(frame, 2);
      result.radius = typeof frame.cornerRadius === 'number' ? frame.cornerRadius : 0;
    }
    return result;
  },

  async locate(p) {
    const node = await getNode(p.id);
    if (node.type === 'PAGE' || node.type === 'DOCUMENT') return false;
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    return true;
  },

  async selectParent() {
    const sel = figma.currentPage.selection;
    if (!sel.length) return null;
    const parent = sel[0].parent;
    if (!parent || parent.type === 'PAGE' || parent.type === 'SECTION') return null;
    figma.currentPage.selection = [parent];
    return parent.id;
  },

  async notify(p) {
    figma.notify(p.text, { error: !!p.error });
    return true;
  }
};

figma.on('selectionchange', sendSelection);
figma.on('currentpagechange', async () => {
  figma.ui.postMessage({ type: 'banners', banners: listBanners() });
  sendSelection();
});

figma.ui.onmessage = async (msg) => {
  if (!msg || msg.type !== 'call') return;
  try {
    const handler = handlers[msg.method];
    if (!handler) throw new Error('Unknown method ' + msg.method);
    const result = await handler(msg.params || {});
    figma.ui.postMessage({ type: 'response', id: msg.id, result: result });
  } catch (e) {
    figma.ui.postMessage({ type: 'response', id: msg.id, error: String(e && e.message || e) });
  }
};
