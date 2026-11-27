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
