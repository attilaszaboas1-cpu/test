const test = require('node:test');
const assert = require('node:assert');
const Layers = require('../ui/layers');
const Images = require('../ui/images');
const { clone, merge } = require('../ui/state');
const { icon, ICONS } = require('../ui/icons');
const { escapeHtml, slug } = require('../text');

function sampleTree() {
  const n = (id, name, type, extra, children) => Object.assign({ id, name, type, visible: true, w: 10, h: 10, isMask: false, img: false, maskId: null, maskName: null, children: children || [] }, extra);
  return [
    n('g', 'line-group', 'GROUP', {}, [n('m', 'mask', 'RECTANGLE', { isMask: true }), n('l', 'line-1', 'RECTANGLE', { maskId: 'm', maskName: 'mask' })]),
    n('p', 'photo', 'RECTANGLE', { img: true, visible: false }),
    n('b', 'button', 'FRAME', {}, [n('t', 'Get started', 'TEXT')])
  ];
}

const view = (over) => Object.assign({ search: '', filter: { kind: 'all', inHtml: false, hidden: true }, expanded: {} }, over);

test('indexTree adds parent, depth and order', () => {
  const t = sampleTree();
  const { index, order } = Layers.indexTree(t);
  assert.deepStrictEqual(order.map((n) => n.id), ['g', 'm', 'l', 'p', 'b', 't']);
  assert.strictEqual(index.l.parent, index.g);
  assert.strictEqual(index.t.depth, 1);
  assert.strictEqual(index.p.order, 3);
});

test('descendantsIn lists nested added layers', () => {
  const { index } = Layers.indexTree(sampleTree());
  assert.deepStrictEqual(Layers.descendantsIn(index, 'g', new Set(['l', 'p'])), ['l']);
  assert.deepStrictEqual(Layers.descendantsIn(index, 'nope', new Set(['l'])), []);
});

test('visibleRows: expanded tree, hidden filter, search and kind filters', () => {
  const t = sampleTree();
  const { order } = Layers.indexTree(t);
  const none = () => false;
  assert.deepStrictEqual(Layers.visibleRows(t, order, view(), none).map((r) => r.n.id), ['g', 'p', 'b']);
  assert.deepStrictEqual(Layers.visibleRows(t, order, view({ expanded: { g: true } }), none).map((r) => r.n.id), ['g', 'm', 'l', 'p', 'b']);
  assert.deepStrictEqual(Layers.visibleRows(t, order, view({ filter: { kind: 'all', inHtml: false, hidden: false } }), none).map((r) => r.n.id), ['g', 'b']);
  const found = Layers.visibleRows(t, order, view({ search: 'LINE' }), none);
  assert.deepStrictEqual(found.map((r) => r.n.id), ['g', 'l']);
  assert.ok(found.every((r) => r.flat));
  assert.deepStrictEqual(Layers.visibleRows(t, order, view({ filter: { kind: 'text', inHtml: false, hidden: true } }), none).map((r) => r.n.id), ['t']);
  assert.deepStrictEqual(Layers.visibleRows(t, order, view({ filter: { kind: 'image', inHtml: false, hidden: true } }), none).map((r) => r.n.id), ['p']);
  assert.deepStrictEqual(Layers.visibleRows(t, order, view({ filter: { kind: 'vector', inHtml: false, hidden: true } }), none).map((r) => r.n.id), ['m', 'l']);
  assert.deepStrictEqual(Layers.visibleRows(t, order, view({ filter: { kind: 'container', inHtml: false, hidden: true } }), none).map((r) => r.n.id), ['g', 'b']);
  assert.deepStrictEqual(Layers.visibleRows(t, order, view({ filter: { kind: 'all', inHtml: true, hidden: true } }), (id) => id === 'b').map((r) => r.n.id), ['b']);
});

test('layerRow renders the shared layer card', () => {
  const t = sampleTree();
  const { index } = Layers.indexTree(t);
  const html = Layers.layerRow({ n: index.l, depth: 1 }, { added: true, addedLabel: 'In HTML', exp: { format: 'jpg' }, clip: { on: true, maskName: 'mask' } });
  assert.match(html, /class="node in-html"/);
  assert.match(html, /✓ In HTML/);
  assert.match(html, /data-act="remove-node">Remove/);
  assert.match(html, /<option value="jpg" selected>JPG/);
  assert.match(html, /<option value="2" selected>2x/);
  assert.match(html, /clip-btn on/);
  assert.match(html, /margin-left:18px/);
  const plain = Layers.layerRow({ n: index.g, depth: 0 }, { expanded: false });
  assert.match(plain, /caret closed/);
  assert.match(plain, /\+ Add/);
  assert.doesNotMatch(plain, /clip-btn/);
  const evil = Layers.layerRow({ n: Object.assign({}, index.p, { name: '<img onerror=x>' }), depth: 0 }, {});
  assert.doesNotMatch(evil, /<img onerror/);
  assert.match(Layers.filterControls({ kind: 'text', inHtml: true, hidden: false }), /chip on" data-act="filter-kind" data-kind="text"/);
});

test('type labels and icons', () => {
  assert.strictEqual(Layers.typeLabel({ type: 'BOOLEAN_OPERATION' }), 'Boolean');
  assert.strictEqual(Layers.typeLabel({ type: 'SHAPE_WITH_TEXT' }), 'Shape with text');
  assert.strictEqual(Layers.typeIcon({ type: 'TEXT' }), 'text');
  assert.strictEqual(Layers.typeIcon({ type: 'RECTANGLE', img: true }), 'image');
  assert.strictEqual(Layers.typeIcon({ type: 'INSTANCE' }), 'frame');
  assert.strictEqual(Layers.typeIcon(null), 'shape');
});

test('cropBox keeps the part inside the frame', () => {
  const frame = { W: 300, H: 250 };
  assert.deepStrictEqual(Images.cropBox({ x: 10, y: 10, width: 50, height: 50 }, frame), { x0: 10, y0: 10, x1: 60, y1: 60, cropped: false });
  assert.deepStrictEqual(Images.cropBox({ x: -20, y: 200, width: 100, height: 100 }, frame), { x0: 0, y0: 200, x1: 80, y1: 250, cropped: true });
  assert.strictEqual(Images.cropBox({ x: 400, y: 0, width: 10, height: 10 }, frame), null);
});

test('export options default to Framed, 2x, PNG', () => {
  assert.deepStrictEqual(Images.exportOptions(undefined), { mode: 'framed', scale: 2, format: 'png' });
  assert.deepStrictEqual(Images.exportOptions({ format: 'svg' }), { mode: 'framed', scale: 2, format: 'svg' });
});

test('processImage passes SVG through and drops layers outside the frame', async () => {
  const svg = { ext: 'svg', x: 0, y: 0, width: 1, height: 1, bytes: new Uint8Array(1) };
  assert.strictEqual(await Images.processImage(svg, { W: 10, H: 10 }, true), svg);
  assert.strictEqual(await Images.processImage({ ext: 'png', x: 50, y: 50, width: 5, height: 5 }, { W: 10, H: 10 }, false), null);
  const inside = { ext: 'png', x: 1, y: 1, width: 5, height: 5, bytes: new Uint8Array(1) };
  assert.strictEqual(await Images.processImage(inside, { W: 10, H: 10 }, false), inside, 'nothing to crop or compress');
});

test('merge fills defaults and keeps saved values', () => {
  const def = { a: 1, b: { c: 2, d: 3 }, list: [1] };
  assert.deepStrictEqual(merge(def, { b: { c: 9 }, extra: true, list: [] }), { a: 1, b: { c: 9, d: 3 }, list: [], extra: true });
  const m = merge(def, null);
  m.b.c = 5;
  assert.strictEqual(def.b.c, 2, 'defaults are cloned');
  assert.deepStrictEqual(clone({ x: [1] }), { x: [1] });
});

test('icons, escaping and slugs', () => {
  assert.match(icon('play'), /^<svg class="ic"/);
  assert.ok(Object.keys(ICONS).length > 30);
  assert.strictEqual(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.strictEqual(slug('Accu-Chek  Guide (v2)!'), 'accu-chek-guide-v2');
  assert.strictEqual(slug('***'), 'layer');
});
