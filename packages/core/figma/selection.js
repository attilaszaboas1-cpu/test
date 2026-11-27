// Selection sync between the Figma canvas and the plugin UI.
const { topFrameOf } = require('./tree');

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

// Selects the parent of the first selected layer; null when there is none to go up to.
function selectParent() {
  const sel = figma.currentPage.selection;
  if (!sel.length) return null;
  const parent = sel[0].parent;
  if (!parent || parent.type === 'PAGE' || parent.type === 'SECTION') return null;
  figma.currentPage.selection = [parent];
  return parent.id;
}

module.exports = { getNode, selectionInfo, locate, selectParent };
