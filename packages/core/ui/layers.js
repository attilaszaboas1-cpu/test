// Layer tree in the UI: indexing, filtering and the shared layer row component.
const { escapeHtml: esc } = require('../text');
const { icon } = require('./icons');
const { DEFAULT_EXPORT } = require('./images');

const VECTOR_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE'];
const CONTAINER_TYPES = ['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'];
const TYPE_LABELS = {
  TEXT: 'Text', GROUP: 'Group', FRAME: 'Frame', COMPONENT: 'Component', INSTANCE: 'Instance',
  RECTANGLE: 'Rectangle', ELLIPSE: 'Ellipse', VECTOR: 'Vector', BOOLEAN_OPERATION: 'Boolean',
  STAR: 'Star', LINE: 'Line', POLYGON: 'Polygon', COMPONENT_SET: 'Variants'
};
const FILTER_KINDS = { all: 'All', text: 'Text', image: 'Images', vector: 'Shapes', container: 'Groups & frames' };

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

/*
 * One layer card. s (row state):
 *   added, addedLabel ('In HTML'), checked, expanded, canvasSel,
 *   exp: { mode, scale, format }, clip: null | { on, maskName }
 */
function layerRow(row, s) {
  const n = row.n;
  const x = Object.assign({}, DEFAULT_EXPORT, s.exp);
  const hasKids = n.children.length && !row.flat;
  const meta = (s.added ? '<span class="ok">✓ ' + esc(s.addedLabel || 'Added') + '</span> · ' : '') + n.w + ' × ' + n.h + ' · ' + typeLabel(n) +
    (n.isMask ? ' · mask' : '') + (!n.visible ? ' · <span class="hid">hidden</span>' : '') +
    (row.flat && n.parent ? ' · in ' + esc(n.parent.name) : '');
  return '<div class="node' + (s.added ? ' in-html' : '') + (s.canvasSel ? ' canvas-sel' : '') + '" data-node="' + n.id + '" style="margin-left:' + Math.min(row.depth, 6) * 18 + 'px">' +
    '<div class="row">' +
      (hasKids ? '<button class="caret' + (s.expanded ? '' : ' closed') + '" data-act="toggle-node" title="Expand">' + icon('chevron-down') + '</button>' : '<span class="caret-space"></span>') +
      '<input type="checkbox" class="cb" data-act="check-node"' + (s.checked ? ' checked' : '') + '>' +
      '<span class="type-ic">' + icon(typeIcon(n)) + '</span>' +
      '<div class="info"><div class="name">' + esc(n.name) + '</div><div class="meta">' + meta + '</div></div>' +
      '<button class="icon-btn ghost sm" data-act="locate" title="Select in Figma">' + icon('locate') + '</button>' +
      '<button class="btn add-btn' + (s.added ? ' remove' : '') + '" data-act="' + (s.added ? 'remove-node' : 'add-node') + '">' + (s.added ? 'Remove' : '+ Add') + '</button>' +
    '</div>' +
    '<div class="row2">' +
      '<select data-xf="mode" title="Framed: crop to the banner · Full: keep the whole layer">' + options({ framed: 'Framed', full: 'Full' }, x.mode) + '</select>' +
      '<select data-xf="scale" title="Export scale">' + options({ 1: '1x', 2: '2x', 3: '3x' }, x.scale) + '</select>' +
      '<select data-xf="format" title="Image format">' + options({ png: 'PNG', jpg: 'JPG', svg: 'SVG' }, x.format) + '</select>' +
      '<span class="grow"></span>' +
      (s.clip ? '<button class="icon-btn sm clip-btn' + (s.clip.on ? ' on' : '') + '" data-act="toggle-clip" title="Clip to mask “' + esc(s.clip.maskName || '') + '”">' + icon('mask') + '</button>' : '') +
    '</div>' +
  '</div>';
}

// Chips and toggles for the filter panel.
function filterControls(filter) {
  return Object.keys(FILTER_KINDS).map((k) => '<button class="chip' + (filter.kind === k ? ' on' : '') + '" data-act="filter-kind" data-kind="' + k + '">' + FILTER_KINDS[k] + '</button>').join('') +
    '<span class="grow"></span>' +
    '<label class="inline-check"><input type="checkbox" data-filter="inHtml"' + (filter.inHtml ? ' checked' : '') + '>In HTML only</label>' +
    '<label class="inline-check"><input type="checkbox" data-filter="hidden"' + (filter.hidden ? ' checked' : '') + '>Show hidden</label>';
}

module.exports = {
  VECTOR_TYPES, CONTAINER_TYPES, TYPE_LABELS, FILTER_KINDS,
  indexTree, descendantsIn, typeLabel, typeIcon, matchesFilter, visibleRows, options, layerRow, filterControls
};
