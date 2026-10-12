// HTML5 Banner Animator — Figma main thread.
// Reads the selected banner frame(s), stores animation settings as plugin data
// and exports every top-level layer as an image for the UI to assemble into HTML.

figma.showUI(__html__, { width: 880, height: 660, themeColors: true, title: 'HTML5 Banner Animator' });

const ANIM_KEY = 'bannerAnim';
const BANNER_KEY = 'bannerSettings';
const FALLBACK_KEY = 'bannerAnimFallback'; // per-frame map for layers that can't hold plugin data

const DEFAULT_ANIM = {
  in: 'none', delay: 0, dur: 0.6, ease: 'expo-out', dist: 40,
  out: 'none', outAt: 4, outDur: 0.4, outEase: 'ease-in',
  emph: 'none', emphPeriod: 1.2
};

const DEFAULT_BANNER = {
  duration: 6, loops: 1, clickTag: 'https://www.example.com',
  scale: 2, svg: false, border: true, borderColor: '#000000'
};

const FRAME_TYPES = ['FRAME', 'COMPONENT', 'INSTANCE'];
const VECTOR_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE'];

function parseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function readBanner(frame) {
  return Object.assign({}, DEFAULT_BANNER, parseJSON(frame.getPluginData(BANNER_KEY)));
}

function readAnim(node, frame) {
  let saved = parseJSON(node.getPluginData(ANIM_KEY));
  if (!saved) {
    const map = parseJSON(frame.getPluginData(FALLBACK_KEY)) || {};
    saved = map[node.id] || null;
  }
  return { anim: Object.assign({}, DEFAULT_ANIM, saved), saved: !!saved };
}

function writeAnim(node, frame, anim) {
  try {
    node.setPluginData(ANIM_KEY, JSON.stringify(anim));
  } catch (e) {
    // Layers inside instances may be read-only; keep their settings on the frame.
    const map = parseJSON(frame.getPluginData(FALLBACK_KEY)) || {};
    map[node.id] = anim;
    frame.setPluginData(FALLBACK_KEY, JSON.stringify(map));
  }
}

// A selected frame is used as-is; any other selected layer resolves to its top-level frame.
function bannerFrameOf(node) {
  if (FRAME_TYPES.indexOf(node.type) !== -1) return node;
  let n = node;
  while (n.parent && n.parent.type !== 'PAGE' && n.parent.type !== 'SECTION') n = n.parent;
  return FRAME_TYPES.indexOf(n.type) !== -1 ? n : null;
}

function selectedFrames() {
  const seen = {};
  const frames = [];
  for (const node of figma.currentPage.selection) {
    const frame = bannerFrameOf(node);
    if (frame && !seen[frame.id]) {
      seen[frame.id] = true;
      frames.push(frame);
    }
  }
  return frames;
}

function describeFrame(frame) {
  const area = frame.width * frame.height;
  const layers = frame.children.filter((c) => c.visible).map((c) => {
    const data = readAnim(c, frame);
    const box = c.absoluteBoundingBox;
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      cover: !!box && (box.width * box.height) >= area * 0.9,
      anim: data.anim,
      saved: data.saved
    };
  });
  return {
    id: frame.id,
    name: frame.name,
    width: Math.round(frame.width),
    height: Math.round(frame.height),
    banner: readBanner(frame),
    layers: layers
  };
}

function sendSelection() {
  figma.ui.postMessage({ type: 'selection', frames: selectedFrames().map(describeFrame) });
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function hasImageFill(node) {
  const fills = node.fills;
  return Array.isArray(fills) && fills.some((f) => f.type === 'IMAGE' || f.type === 'VIDEO');
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
  // Gradients / images: render the frame's fills alone on a temporary rectangle.
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

async function exportFrame(frame, options) {
  const scale = Number(options.scale) || 2;
  const origin = frame.absoluteBoundingBox;
  const layers = [];
  const warnings = [];

  for (const node of frame.children) {
    if (!node.visible) continue;
    if (node.isMask) {
      warnings.push('"' + node.name + '" is a mask — group it with the layers it masks.');
      continue;
    }
    const bounds = node.absoluteRenderBounds;
    if (!bounds || bounds.width < 0.01 || bounds.height < 0.01) continue;

    const useSvg = !!options.svg && VECTOR_TYPES.indexOf(node.type) !== -1 && !hasImageFill(node);
    let bytes;
    try {
      bytes = useSvg
        ? await node.exportAsync({ format: 'SVG' })
        : await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
    } catch (e) {
      warnings.push('Could not export "' + node.name + '": ' + e.message);
      continue;
    }
    layers.push({
      id: node.id,
      name: node.name,
      x: round(bounds.x - origin.x),
      y: round(bounds.y - origin.y),
      width: round(bounds.width),
      height: round(bounds.height),
      ext: useSvg ? 'svg' : 'png',
      bytes: bytes
    });
  }

  return {
    id: frame.id,
    radius: typeof frame.cornerRadius === 'number' ? frame.cornerRadius : 0,
    background: await exportBackground(frame, scale),
    layers: layers,
    warnings: warnings
  };
}

figma.on('selectionchange', sendSelection);
figma.on('currentpagechange', sendSelection);

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'ready':
      sendSelection();
      break;

    case 'save-anims': {
      const frame = await figma.getNodeByIdAsync(msg.frameId);
      if (!frame) break;
      for (const item of msg.items) {
        const node = await figma.getNodeByIdAsync(item.id);
        if (node) writeAnim(node, frame, item.anim);
      }
      break;
    }

    case 'save-banner': {
      const frame = await figma.getNodeByIdAsync(msg.frameId);
      if (frame) frame.setPluginData(BANNER_KEY, JSON.stringify(msg.banner));
      break;
    }

    case 'export': {
      try {
        const frames = [];
        for (const req of msg.frames) {
          const frame = await figma.getNodeByIdAsync(req.id);
          if (frame) frames.push(await exportFrame(frame, req));
        }
        figma.ui.postMessage({ type: 'assets', requestId: msg.requestId, frames: frames });
      } catch (e) {
        figma.ui.postMessage({ type: 'assets', requestId: msg.requestId, error: String(e && e.message || e) });
      }
      break;
    }

    case 'notify':
      figma.notify(msg.text, { error: !!msg.error });
      break;
  }
};
