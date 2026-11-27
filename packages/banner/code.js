(function () {
var __defs = {}, __cache = {};
function __require(id) { var c = __cache[id]; if (c) return c.exports; c = __cache[id] = { exports: {} }; __defs[id].call(c.exports, c, c.exports, __require); return c.exports; }
__defs["packages/banner/src/main.js"] = function (module, exports, require) {
// GDH Cast Banner — Figma main thread.
// Serves the layer tree of a banner frame, persists sessions as plugin data and
// exports the layers the user added to the HTML as images. Generic pieces live in core.
const tree = require("packages/core/figma/tree.js");
const storage = require("packages/core/figma/storage.js");
const imageExport = require("packages/core/figma/export.js");
const selection = require("packages/core/figma/selection.js");
const { serve } = require("packages/core/figma/rpc.js");

figma.showUI(__html__, { width: 1040, height: 720, themeColors: true, title: 'GDH Cast Banner' });

// Storage keys keep their original 'ba.' prefix so sessions saved before the rename still load.
const SESSION_KEY = 'ba.session';
const SNAPSHOT_KEY = 'ba.snapshot';
const PACKAGE_KEY = 'ba.package';

function listBanners() {
  return tree.listTopFrames(figma.currentPage).map((f) => {
    const session = storage.readJSON(f, SESSION_KEY);
    return Object.assign(tree.frameInfo(f), { elements: session && session.elements ? session.elements.length : 0 });
  });
}

function sendSelection() {
  const s = selection.selectionInfo();
  figma.ui.postMessage({ type: 'selection', ids: s.ids, bannerId: s.frameId });
}

serve({
  async init() {
    const s = selection.selectionInfo();
    return {
      banners: listBanners(),
      current: s.frameId,
      pkg: storage.readJSON(figma.root, PACKAGE_KEY),
      selection: s.ids
    };
  },

  async listBanners() {
    return listBanners();
  },

  async getBanner(p) {
    const frame = await selection.getNode(p.id);
    return {
      info: tree.frameInfo(frame),
      tree: tree.serializeTree(frame),
      session: storage.readJSON(frame, SESSION_KEY)
    };
  },

  async saveSession(p) {
    storage.writeJSON(await selection.getNode(p.id), SESSION_KEY, p.session);
    return true;
  },

  async saveSnapshot(p) {
    storage.writeSnapshot(await selection.getNode(p.id), SNAPSHOT_KEY, p.session);
    return true;
  },

  async loadSnapshot(p) {
    return storage.readSnapshot(await selection.getNode(p.id), SNAPSHOT_KEY);
  },

  async savePackage(p) {
    storage.writeJSON(figma.root, PACKAGE_KEY, p.pkg);
    return true;
  },

  async exportAssets(p) {
    return imageExport.exportAssets(await selection.getNode(p.id), p);
  },

  async locate(p) {
    return selection.locate(p.id);
  },

  async select(p) {
    return selection.select(p.ids);
  },

  async selectParent() {
    return selection.selectParent();
  },

  async notify(p) {
    figma.notify(p.text, { error: !!p.error });
    return true;
  }
});

figma.on('selectionchange', sendSelection);
figma.on('currentpagechange', async () => {
  figma.ui.postMessage({ type: 'banners', banners: listBanners() });
  sendSelection();
});

};
__defs["packages/core/figma/tree.js"] = function (module, exports, require) {
// Layer tree of a top-level frame, for the plugin UI. Main thread only (uses `figma` nodes).
const FRAME_TYPES = ['FRAME', 'COMPONENT', 'INSTANCE'];
const MAX_NODES = 4000;

function isTopLevel(node) {
  return !!node.parent && (node.parent.type === 'PAGE' || node.parent.type === 'SECTION');
}

// The top-level frame on the page that a node belongs to (the banner / email frame).
function topFrameOf(node) {
  let n = node;
  while (n && n.parent && !isTopLevel(n)) n = n.parent;
  return n && isTopLevel(n) && FRAME_TYPES.indexOf(n.type) !== -1 ? n : null;
}

// Top-level frames on a page, looking inside sections.
function listTopFrames(page) {
  const out = [];
  const visit = (parent) => {
    for (const n of parent.children) {
      if (FRAME_TYPES.indexOf(n.type) !== -1) out.push(n);
      else if (n.type === 'SECTION') visit(n);
    }
  };
  visit(page);
  return out;
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

// Plain-object tree of the frame's children (front-most last, as in Figma).
function serializeTree(frame, maxNodes) {
  const limit = maxNodes || MAX_NODES;
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
    if ('children' in node && count < limit) {
      for (const child of node.children) {
        if (count >= limit) break;
        item.children.push(walk(child));
      }
    }
    return item;
  };
  return frame.children.map(walk);
}

function frameInfo(frame) {
  return { id: frame.id, name: frame.name, width: Math.round(frame.width), height: Math.round(frame.height) };
}

module.exports = { FRAME_TYPES, MAX_NODES, isTopLevel, topFrameOf, listTopFrames, hasImageFill, maskFor, serializeTree, frameInfo };

};
__defs["packages/core/figma/storage.js"] = function (module, exports, require) {
// Saved sessions: JSON stored as plugin data on a node (a frame, or figma.root).
function parseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function readJSON(node, key) {
  return parseJSON(node.getPluginData(key));
}

function writeJSON(node, key, value) {
  node.setPluginData(key, JSON.stringify(value));
}

// A snapshot is a timestamped copy the user can restore later.
function writeSnapshot(node, key, session, now) {
  writeJSON(node, key, { at: now === undefined ? Date.now() : now, session: session });
}

module.exports = { parseJSON, readJSON, writeJSON, writeSnapshot, readSnapshot: readJSON };

};
__defs["packages/core/figma/export.js"] = function (module, exports, require) {
// Image export of layers relative to their frame: scale (1x/2x/3x) and format (PNG/JPG/SVG).
// Cropping ("Framed") and compression happen in the UI (see core/ui/images.js).

function round(n) {
  return Math.round(n * 100) / 100;
}

function exportSettings(format, scale) {
  if (format === 'svg') return { format: 'SVG' };
  if (format === 'jpg') return { format: 'JPG', constraint: { type: 'SCALE', value: scale } };
  return { format: 'PNG', constraint: { type: 'SCALE', value: scale } };
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

// A frame's own fill: CSS when it is a single solid colour, otherwise a PNG of the fill
// rendered through a temporary rectangle (removed again even if the export fails).
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

// Exports one node relative to `origin` (the frame's top-left). A hidden node is shown for
// the export; layers listed in opts.hide (elements nested inside this one that are animated
// separately) are hidden so they aren't baked in twice. Visibility is always restored.
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

/*
 * Exports layers and masks of a frame.
 * params: { items:[{id,key,scale,format,hide}], masks:[{id,key,scale}], background:bool }
 * Returns { items:{[key]:image}, masks:{[key]:image}, warnings:[], background?, radius? }
 */
async function exportAssets(frame, params) {
  const origin = frame.absoluteBoundingBox;
  const result = { items: {}, masks: {}, warnings: [] };

  for (const item of params.items || []) {
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

  for (const mask of params.masks || []) {
    const node = await figma.getNodeByIdAsync(mask.id);
    if (!node) continue;
    try {
      const out = await exportNode(node, origin, { format: 'png', scale: mask.scale });
      if (out) result.masks[mask.key] = out;
    } catch (e) {
      result.warnings.push('Could not export mask "' + node.name + '": ' + e.message);
    }
  }

  if (params.background) {
    result.background = await exportBackground(frame, 2);
    result.radius = typeof frame.cornerRadius === 'number' ? frame.cornerRadius : 0;
  }
  return result;
}

module.exports = { round, exportSettings, solidFillCss, exportBackground, exportNode, exportAssets };

};
__defs["packages/core/figma/selection.js"] = function (module, exports, require) {
// Selection sync between the Figma canvas and the plugin UI.
const { topFrameOf } = require("packages/core/figma/tree.js");

async function getNode(id) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.removed) throw new Error('Layer not found — it may have been deleted.');
  return node;
}

// What the UI needs to follow the canvas: selected ids and the frame they belong to.
function selectionInfo() {
  const sel = figma.currentPage.selection;
  const frame = sel.length ? topFrameOf(sel[0]) : null;
  return { ids: sel.map((n) => n.id), frameId: frame ? frame.id : null };
}

async function locate(id) {
  const node = await getNode(id);
  if (node.type === 'PAGE' || node.type === 'DOCUMENT') return false;
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
  return true;
}

// Selects layers on the canvas without moving the viewport (like clicking in the layers panel).
async function select(ids) {
  const nodes = [];
  for (const id of ids || []) {
    const n = await figma.getNodeByIdAsync(id);
    if (n && !n.removed && n.type !== 'PAGE' && n.type !== 'DOCUMENT') nodes.push(n);
  }
  figma.currentPage.selection = nodes;
  return nodes.length;
}

// Selects the parent of the first selected layer; null when there is none to go up to.
function selectParent() {
  const sel = figma.currentPage.selection;
  if (!sel.length) return null;
  const parent = sel[0].parent;
  if (!parent || parent.type === 'PAGE' || parent.type === 'SECTION') return null;
  figma.currentPage.selection = [parent];
  return parent.id;
}

module.exports = { getNode, selectionInfo, locate, select, selectParent };

};
__defs["packages/core/figma/rpc.js"] = function (module, exports, require) {
// Main-thread side of the UI ↔ Figma RPC. The UI sends { type:'call', id, method, params };
// each call gets { type:'response', id, result } or { type:'response', id, error }.
function serve(handlers) {
  const onMessage = async (msg) => {
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
  figma.ui.onmessage = onMessage;
  return onMessage;
}

module.exports = { serve };

};
__require("packages/banner/src/main.js");
})();