const test = require('node:test');
const assert = require('node:assert');
const ex = require('../figma/export');
const { fixture } = require('./fake-figma');

test('export settings per format', () => {
  assert.deepStrictEqual(ex.exportSettings('svg', 2), { format: 'SVG' });
  assert.deepStrictEqual(ex.exportSettings('jpg', 3), { format: 'JPG', constraint: { type: 'SCALE', value: 3 } });
  assert.deepStrictEqual(ex.exportSettings('png', 1), { format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
});

test('exportNode positions the image relative to the frame', async () => {
  const f = fixture();
  const out = await ex.exportNode(f.photo, { x: 0, y: 0 }, { format: 'jpg', scale: 3 });
  assert.deepStrictEqual([out.x, out.y, out.width, out.height, out.ext], [150, 30, 120, 200, 'jpg']);
  assert.deepStrictEqual(f.photo.exports[0].settings, { format: 'JPG', constraint: { type: 'SCALE', value: 3 } });
  const shifted = await ex.exportNode(f.photo, { x: 100, y: 10 }, {});
  assert.deepStrictEqual([shifted.x, shifted.y, shifted.ext], [50, 20, 'png']);
});

test('a hidden layer is shown for its export and hidden again', async () => {
  const f = fixture();
  f.photo.visible = false;
  await ex.exportNode(f.photo, { x: 0, y: 0 }, {});
  assert.strictEqual(f.photo.exports[0].visible, true);
  assert.strictEqual(f.photo.visible, false);
});

test('separately animated children are hidden for the group export and restored', async () => {
  const f = fixture();
  await ex.exportNode(f.cta, { x: 0, y: 0 }, { hide: [f.label.id] });
  assert.deepStrictEqual(f.cta.exports[0].children, [false], 'label hidden during export');
  assert.strictEqual(f.label.visible, true, 'label visible again');
});

test('visibility is restored even when the export fails', async () => {
  const f = fixture();
  f.label.visible = true;
  f.cta.visible = false;
  f.cta.exportAsync = async () => { throw new Error('boom'); };
  await assert.rejects(ex.exportNode(f.cta, { x: 0, y: 0 }, { hide: [f.label.id] }), /boom/);
  assert.strictEqual(f.cta.visible, false);
  assert.strictEqual(f.label.visible, true);
});

test('empty layers export as null', async () => {
  const f = fixture();
  f.photo.absoluteRenderBounds = null;
  assert.strictEqual(await ex.exportNode(f.photo, { x: 0, y: 0 }, {}), null);
});

test('solid fills become CSS; gradients and images do not', () => {
  assert.strictEqual(ex.solidFillCss([{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0 }, opacity: 0.5 }]), 'rgba(255,128,0,0.5)');
  assert.strictEqual(ex.solidFillCss([]), 'transparent');
  assert.strictEqual(ex.solidFillCss([{ type: 'SOLID', visible: false, color: { r: 0, g: 0, b: 0 } }]), 'transparent');
  assert.strictEqual(ex.solidFillCss([{ type: 'GRADIENT_LINEAR' }]), null);
  assert.strictEqual(ex.solidFillCss(Symbol('mixed')), null);
});

test('non-solid backgrounds render through a temporary rectangle that is removed', async () => {
  const f = fixture();
  f.frame.fills = [{ type: 'GRADIENT_LINEAR' }];
  const bg = await ex.exportBackground(f.frame, 2);
  assert.strictEqual(bg.css, 'transparent');
  assert.strictEqual(bg.ext, 'png');
  assert.strictEqual(f.figma.created.length, 1);
  assert.ok(f.figma.created[0].removed);
  assert.ok(!f.page.children.includes(f.figma.created[0]));
  assert.deepStrictEqual([f.figma.created[0].width, f.figma.created[0].height], [300, 250]);

  f.figma.created[0].exportAsync = null;
  const failing = f.figma.createRectangle;
  f.figma.createRectangle = function () { const r = failing.call(this); r.exportAsync = async () => { throw new Error('x'); }; return r; };
  await assert.rejects(ex.exportBackground(f.frame, 2));
  assert.ok(f.figma.created[1].removed, 'removed after a failed export too');
});

test('exportAssets collects items, masks, background and warnings', async () => {
  const f = fixture();
  f.frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  f.frame.cornerRadius = 8;
  f.label.absoluteRenderBounds = null;
  const res = await ex.exportAssets(f.frame, {
    items: [
      { id: f.photo.id, key: 'p', scale: 2, format: 'png' },
      { id: f.label.id, key: 'l' },
      { id: 'gone', key: 'g' }
    ],
    masks: [{ id: f.mask.id, key: 'm', scale: 2 }],
    background: true
  });
  assert.deepStrictEqual(Object.keys(res.items), ['p']);
  assert.deepStrictEqual(Object.keys(res.masks), ['m']);
  assert.deepStrictEqual(res.background, { css: 'rgba(255,255,255,1)' });
  assert.strictEqual(res.radius, 8);
  assert.strictEqual(res.warnings.length, 2);
  assert.match(res.warnings.join(' '), /no longer exists/);
  assert.match(res.warnings.join(' '), /"Get started" is empty/);
});
