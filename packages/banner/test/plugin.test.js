// The built plugin: files are up to date, the manifest points at them, and code.js
// works against a fake Figma API.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildPlugin } = require('../../../tools/build');
const { fixture } = require('../../core/test/fake-figma');

const DIR = path.join(__dirname, '..');

test('manifest is importable on its own', () => {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  assert.strictEqual(m.name, 'Banner Automation');
  assert.strictEqual(m.id, 'banner-automation');
  assert.ok(fs.existsSync(path.join(DIR, m.main)), m.main);
  assert.ok(fs.existsSync(path.join(DIR, m.ui)), m.ui);
});

test('committed code.js and ui.html match the sources (run npm run build)', () => {
  const out = buildPlugin(DIR);
  assert.ok(out.code === fs.readFileSync(path.join(DIR, 'code.js'), 'utf8'), 'code.js is stale');
  assert.ok(out.html === fs.readFileSync(path.join(DIR, 'ui.html'), 'utf8'), 'ui.html is stale');
  assert.match(out.html, /--figma-color-bg/, 'core styles inlined');
  assert.match(out.html, /\.step-tab/, 'banner styles inlined');
  assert.doesNotMatch(out.html, /__STYLES__|__UI__/);
});

async function runMain() {
  const f = fixture();
  const code = fs.readFileSync(path.join(DIR, 'code.js'), 'utf8');
  vm.runInNewContext(code, { figma: f.figma, __html__: '<html>', console, Date, JSON, Math, Promise, String, Number, Error, Object, Array, Uint8Array });
  const call = async (method, params) => {
    await f.figma.ui.onmessage({ type: 'call', id: method, method, params });
    // Objects from the vm realm are normalized so deepStrictEqual compares plain data.
    return JSON.parse(JSON.stringify(f.figma.posted.find((m) => m.type === 'response' && m.id === method)));
  };
  return Object.assign(f, { call });
}

test('code.js opens the UI and serves the banner tree', async () => {
  const f = await runMain();
  assert.strictEqual(f.figma.uiOptions.title, 'Banner Automation');
  f.page.selection = [f.label];
  const init = (await f.call('init')).result;
  assert.deepStrictEqual(init.banners.map((b) => b.name + ' ' + b.width + 'x' + b.height), ['MPU 300x250', 'HPA 300x600']);
  assert.strictEqual(init.current, f.frame.id);
  assert.deepStrictEqual(init.selection, [f.label.id]);

  const banner = (await f.call('getBanner', { id: f.frame.id })).result;
  assert.strictEqual(banner.info.name, 'MPU');
  assert.strictEqual(banner.tree[0].children[1].maskId, f.mask.id);
  assert.strictEqual(banner.session, null);
});

test('code.js saves sessions, snapshots and package settings', async () => {
  const f = await runMain();
  await f.call('saveSession', { id: f.frame.id, session: { elements: [{ id: 'x' }] } });
  assert.strictEqual((await f.call('listBanners')).result[0].elements, 1);
  await f.call('saveSnapshot', { id: f.frame.id, session: { v: 2 } });
  assert.deepStrictEqual((await f.call('loadSnapshot', { id: f.frame.id })).result.session, { v: 2 });
  await f.call('savePackage', { pkg: { channel: 'ae' } });
  assert.strictEqual((await f.call('init')).result.pkg.channel, 'ae');
  assert.match((await f.call('getBanner', { id: 'nope' })).error, /Layer not found/);
});

test('code.js exports assets and follows the selection', async () => {
  const f = await runMain();
  f.frame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }];
  const res = (await f.call('exportAssets', { id: f.frame.id, items: [{ id: f.photo.id, key: 'k', scale: 2, format: 'png' }], background: true })).result;
  assert.deepStrictEqual(Object.keys(res.items), ['k']);
  assert.strictEqual(res.background.css, 'rgba(0,0,255,1)');

  f.page.selection = [f.line];
  f.figma.events.selectionchange();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(f.figma.posted.pop())), { type: 'selection', ids: [f.line.id], bannerId: f.frame.id });
  assert.strictEqual((await f.call('selectParent')).result, f.group.id);
  assert.strictEqual((await f.call('locate', { id: f.photo.id })).result, true);
  assert.strictEqual((await f.call('select', { ids: [f.label.id] })).result, 1);
  assert.strictEqual(f.page.selection.map((n) => n.id).join(), f.label.id);
  await f.call('notify', { text: 'hi' });
  assert.strictEqual(f.figma.notified[0].text, 'hi');
});

test('every icon-only button in the static markup has a tooltip', () => {
  const html = fs.readFileSync(path.join(DIR, 'src/ui.template.html'), 'utf8');
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g);
  assert.ok(buttons.length > 15);
  const iconOnly = buttons.filter((b) => !b.replace(/<[^>]+>/g, '').trim());
  assert.ok(iconOnly.length > 8);
  iconOnly.forEach((b) => assert.match(b, /data-tip="[^"]+"/, b));
});
