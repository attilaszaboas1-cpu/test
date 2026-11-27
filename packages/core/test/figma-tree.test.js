const test = require('node:test');
const assert = require('node:assert');
const { fixture } = require('./fake-figma');
const tree = require('../figma/tree');
const selection = require('../figma/selection');

test('top-level frames include frames inside sections and skip other nodes', () => {
  const f = fixture();
  assert.deepStrictEqual(tree.listTopFrames(f.page).map((n) => n.name), ['MPU', 'HPA']);
});

test('topFrameOf finds the banner of a nested layer', () => {
  const f = fixture();
  assert.strictEqual(tree.topFrameOf(f.label), f.frame);
  assert.strictEqual(tree.topFrameOf(f.frame), f.frame);
  assert.strictEqual(tree.topFrameOf(f.section.children[0]).name, 'HPA');
  assert.strictEqual(tree.topFrameOf(f.page.children[2]), null, 'a text on the page is not a frame');
});

test('maskFor finds the mask below a layer and below its ancestors', () => {
  const f = fixture();
  assert.strictEqual(tree.maskFor(f.line, f.frame), f.mask);
  assert.strictEqual(tree.maskFor(f.photo, f.frame), null);
  assert.strictEqual(tree.maskFor(f.label, f.frame), null);
});

test('serializeTree describes every layer for the UI', () => {
  const f = fixture();
  f.photo.visible = false;
  const t = tree.serializeTree(f.frame);
  assert.deepStrictEqual(t.map((n) => n.name), ['line-group', 'photo', 'button']);
  const line = t[0].children[1];
  assert.strictEqual(line.maskId, f.mask.id);
  assert.strictEqual(line.maskName, 'mask');
  assert.strictEqual(t[0].children[0].isMask, true);
  assert.strictEqual(t[0].children[0].maskId, null, 'a mask is not masked by itself');
  assert.strictEqual(t[1].img, true);
  assert.strictEqual(t[1].visible, false);
  assert.deepStrictEqual([t[2].w, t[2].h], [120, 40]);
  assert.strictEqual(t[2].children[0].type, 'TEXT');
});

test('serializeTree stops at the node limit', () => {
  const f = fixture();
  const t = tree.serializeTree(f.frame, 3);
  const count = (nodes) => nodes.reduce((s, n) => s + 1 + count(n.children), 0);
  // Top-level layers are always listed; nesting stops once the limit is reached.
  assert.deepStrictEqual(t.map((n) => n.name), ['line-group', 'photo', 'button']);
  assert.strictEqual(t[2].children.length, 0);
  assert.strictEqual(count(t), 5);
});

test('selection info, locate and select parent', async () => {
  const f = fixture();
  f.page.selection = [f.label];
  assert.deepStrictEqual(selection.selectionInfo(), { ids: [f.label.id], frameId: f.frame.id });
  assert.strictEqual(selection.selectParent(), f.cta.id);
  assert.deepStrictEqual(f.page.selection, [f.cta]);
  f.page.selection = [f.frame];
  assert.strictEqual(selection.selectParent(), null, 'nothing above a top-level frame');
  assert.strictEqual(await selection.locate(f.photo.id), true);
  assert.deepStrictEqual(f.page.selection, [f.photo]);
  await assert.rejects(selection.getNode('nope'), /Layer not found/);
  f.page.selection = [];
  assert.deepStrictEqual(selection.selectionInfo(), { ids: [], frameId: null });
});

