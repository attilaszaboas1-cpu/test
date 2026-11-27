// Layer tree in the UI: indexing, filtering and the shared layer row component.
const { escapeHtml: esc } = require('../text');
const { icon } = require('./icons');

const VECTOR_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE'];
const CONTAINER_TYPES = ['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'];
const TYPE_LABELS = {
  TEXT: 'Text', GROUP: 'Group', FRAME: 'Frame', COMPONENT: 'Component', INSTANCE: 'Instance',
  RECTANGLE: 'Rectangle', ELLIPSE: 'Ellipse', VECTOR: 'Vector', BOOLEAN_OPERATION: 'Boolean',
  STAR: 'Star', LINE: 'Line', POLYGON: 'Polygon', COMPONENT_SET: 'Variants'
};
const FILTER_KINDS = { all: 'All', text: 'Text', image: 'Images', vector: 'Shapes', container: 'Groups' };

// Adds parent/depth/order to each node of a serialized tree (see core/figma/tree.js).
function indexTree(tree) {
  const index = {};
  const order = [];
  const walk = (nodes, parentNode, depth) => nodes.forEach((n) => {
    n.parent = parentNode;
    n.depth = depth;
    n.order = order.length;
    order.push(n);
    index[n.id] = n;
    walk(n.children, n, depth + 1);
  });
  walk(tree, null, 0);
  return { index, order };
}

// Ids of the descendants of `id` that are in `ids` (a Set), depth-first.
function descendantsIn(index, id, ids) {
  const node = index[id];
  if (!node) return [];
  const out = [];
  const walk = (n) => n.children.forEach((c) => { if (ids.has(c.id)) out.push(c.id); walk(c); });
  walk(node);
  return out;
}

function typeLabel(n) {
  return TYPE_LABELS[n.type] || (n.type.charAt(0) + n.type.slice(1).toLowerCase().replace(/_/g, ' '));
}

function typeIcon(n) {
  if (!n) return 'shape';
  if (n.isMask) return 'mask';
  if (n.type === 'TEXT') return 'text';
  if (n.img) return 'image';
  if (n.type === 'GROUP') return 'group';
  if (CONTAINER_TYPES.indexOf(n.type) !== -1) return 'frame';
  return 'shape';
}

/*
 * view: { search, filter:{ kind, inHtml, hidden }, expanded:{[id]:bool} }
 * isAdded(id): whether the layer is in the output.
 */
function matchesFilter(n, view, isAdded) {
  const f = view.filter;
  if (!f.hidden && !n.visible) return false;
  if (f.inHtml && !isAdded(n.id)) return false;
  const k = f.kind;
  if (k === 'text' && n.type !== 'TEXT') return false;
  if (k === 'image' && !n.img) return false;
  if (k === 'vector' && (n.img || VECTOR_TYPES.indexOf(n.type) === -1)) return false;
  if (k === 'container' && CONTAINER_TYPES.indexOf(n.type) === -1) return false;
  if (view.search && n.name.toLowerCase().indexOf(view.search.toLowerCase()) === -1) return false;
  return true;
}

// Rows to show: a flat filtered list while searching/filtering, otherwise the expanded tree.
function visibleRows(tree, order, view, isAdded) {
  const rows = [];
  const flat = !!view.search || view.filter.kind !== 'all' || view.filter.inHtml;
  if (flat) {
    order.forEach((n) => { if (matchesFilter(n, view, isAdded)) rows.push({ n: n, depth: 0, flat: true }); });
  } else {
    const walk = (nodes) => nodes.forEach((n) => {
      if (!view.filter.hidden && !n.visible) return;
      rows.push({ n: n, depth: n.depth });
      if (view.expanded[n.id]) walk(n.children);
    });
    walk(tree);
  }
  return rows;
}

function options(map, value) {
  return Object.keys(map).map((k) => {
    const label = typeof map[k] === 'string' ? map[k] : map[k].label;
    return '<option value="' + esc(k) + '"' + (String(k) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
}

// Layer types that can't be exported as images, with the reason shown to the user.
const UNSUPPORTED = {
  SLICE: 'Slices are export areas, not artwork',
  CONNECTOR: 'Connectors are FigJam-only',
  STICKY: 'Stickies are FigJam-only',
  SHAPE_WITH_TEXT: 'FigJam shapes can’t be exported',
  CODE_BLOCK: 'Code blocks can’t be exported',
  WIDGET: 'Widgets can’t be exported',
  EMBED: 'Embeds can’t be exported',
  LINK_UNFURL: 'Link previews can’t be exported'
};

// Why a layer can't go into the output, or '' when it can.
function unsupportedReason(n) {
  if (UNSUPPORTED[n.type]) return UNSUPPORTED[n.type];
  if (n.isMask) return 'Masks clip other layers; add the layers they mask';
  if (!n.w || !n.h) return 'This layer has no size';
  return '';
}

/*
 * One row of the layer tree, styled like Figma's layers panel.
 * s (row state): added, addedLabel ('In banner'), selected, expanded, canvasSel,
 *   clip: null | { on, maskName }
 * Actions: toggle-node, select-node (row click), add-node / remove-node, locate.
 */
function layerRow(row, s) {
  const n = row.n;
  const reason = unsupportedReason(n);
  const hasKids = n.children.length && !row.flat;
  const cls = ['layer'];
  if (s.added) cls.push('added');
  if (s.selected) cls.push('selected');
  if (s.canvasSel) cls.push('canvas-sel');
  if (reason) cls.push('unsupported');
  if (!n.visible) cls.push('hidden-layer');
  const tip = reason ? ' data-tip="' + esc(reason) + '"' : '';
  return '<div class="' + cls.join(' ') + '" data-node="' + esc(n.id) + '" data-act="select-node" role="treeitem" aria-selected="' + (s.selected ? 'true' : 'false') + '"' +
      (hasKids ? ' aria-expanded="' + (s.expanded ? 'true' : 'false') + '"' : '') + ' style="padding-left:' + (4 + Math.min(row.depth, 8) * 16) + 'px">' +
    (hasKids ? '<button class="caret' + (s.expanded ? '' : ' closed') + '" data-act="toggle-node" data-tip="' + (s.expanded ? 'Collapse' : 'Expand') + '">' + icon('chevron-down') + '</button>' : '<span class="caret-space"></span>') +
    '<span class="type"' + tip + '>' + icon(typeIcon(n)) + '</span>' +
    '<span class="name">' + esc(n.name) + '</span>' +
    (s.clip ? '<span class="mask-ic' + (s.clip.on ? ' on' : '') + '" data-tip="' + (s.clip.on ? 'Clipped to mask “' : 'Not clipped to mask “') + esc(s.clip.maskName || '') + '”">' + icon('mask') + '</span>' : '') +
    (row.flat && n.parent ? '<span class="meta">in ' + esc(n.parent.name) + '</span>' : '') +
    (s.added ? '<span class="tag">' + esc(s.addedLabel || 'Added') + '</span>' : '') +
    '<span class="acts">' +
      '<button class="icon-btn secondary on-hover" data-act="locate" data-tip="Select on canvas">' + icon('locate') + '</button>' +
      (reason ? '' : s.added
        ? '<button class="icon-btn secondary on-hover" data-act="remove-node" data-tip="Remove from banner">' + icon('minus') + '</button>'
        : '<button class="icon-btn on-hover" data-act="add-node" data-tip="Add to banner">' + icon('plus') + '</button>') +
    '</span>' +
  '</div>';
}

// Chips and toggles for the filter panel.
// addedLabel names the output ("banner") in "Only layers in banner".
function filterControls(filter, addedLabel) {
  return '<div class="seg">' + Object.keys(FILTER_KINDS).map((k) => '<button class="' + (filter.kind === k ? 'on' : '') + '" data-act="filter-kind" data-kind="' + k + '">' + FILTER_KINDS[k] + '</button>').join('') + '</div>' +
    '<label class="check"><input type="checkbox" data-filter="inHtml"' + (filter.inHtml ? ' checked' : '') + '>Only layers in ' + esc(addedLabel || 'output') + '</label>' +
    '<label class="check"><input type="checkbox" data-filter="hidden"' + (filter.hidden ? ' checked' : '') + '>Show hidden layers</label>';
}

module.exports = {
  VECTOR_TYPES, CONTAINER_TYPES, TYPE_LABELS, FILTER_KINDS,
  UNSUPPORTED, unsupportedReason,
  indexTree, descendantsIn, typeLabel, typeIcon, matchesFilter, visibleRows, options, layerRow, filterControls
};
