const test = require('node:test');
const assert = require('node:assert');
const Steps = require('../src/steps');
const { sizeLimit } = require('../src/generator');

const el = (id, scenes) => ({ id, name: id, scenes: scenes.map((on) => ({ on })) });
function input(over) {
  const ctx = { info: { width: 300, height: 250 }, index: { a: {}, b: {} }, session: { elements: [el('a', [true, false]), el('b', [false, true])] } };
  return Object.assign({
    ctx,
    pkg: { channel: 'html5', exits: [{ name: 'Main exit', url: 'https://www.example.com/x' }], exclude: {} },
    included: [{ id: 'b1', width: 300, height: 250 }, { id: 'b2', width: 300, height: 600 }],
    zipSizes: { b1: { bytes: 90000 }, b2: { bytes: 180000 } },
    sizeLimit
  }, over);
}
const byId = (st) => Object.fromEntries(st.map((s) => [s.id, s]));

test('a complete banner has every step done and nothing blocking', () => {
  const st = Steps.stepStatus(input());
  assert.deepStrictEqual(st.map((s) => [s.id, s.n, s.done]), [['layers', 1, true], ['animate', 2, true], ['export', 3, true]]);
  assert.deepStrictEqual(Steps.allIssues(st), []);
});

test('no frame chosen blocks everything', () => {
  const st = byId(Steps.stepStatus(input({ ctx: null })));
  assert.strictEqual(st.layers.issues[0].fix, 'choose-frame');
  assert.ok(!st.layers.done && !st.animate.done && !st.export.done);
  assert.strictEqual(Steps.blockers(Object.values(st))[0].level, 'error');
});

test('layers and animate issues', () => {
  const i = input();
  i.ctx.session.elements = [];
  let st = byId(Steps.stepStatus(i));
  assert.match(st.layers.issues[0].text, /Add at least one layer/);
  assert.strictEqual(st.layers.issues[0].level, 'error');

  const j = input();
  j.ctx.session.elements.push(el('gone', [true, true]), el('c', [false, false]));
  j.ctx.index.c = {};
  st = byId(Steps.stepStatus(j));
  assert.match(st.layers.issues[0].text, /“gone” was deleted in Figma/);
  assert.strictEqual(st.layers.issues[0].level, 'warning');
  assert.match(st.animate.issues[0].text, /“c” isn’t shown in any frame/);
  assert.ok(!st.animate.done);
});

test('export issues: channel, URLs, sizes', () => {
  const i = input({ pkg: { channel: '', exits: [{ name: 'Main', url: '' }, { name: 'CTA', url: 'www.x.com' }], exclude: {} } });
  const st = byId(Steps.stepStatus(i));
  assert.deepStrictEqual(st.export.issues.map((x) => x.level + ': ' + x.text), [
    'error: Choose a channel',
    'warning: Add the click-through URL',
    'warning: “CTA” needs a valid URL'
  ]);
  assert.match(Steps.stepStatus(input({ pkg: { channel: 'gwd', exits: [{ url: 'accu-chek.com' }], exclude: {} } }))[2].issues[0].text, /must start with https/);
  assert.match(Steps.stepStatus(input({ included: [] }))[2].issues[0].text, /Include at least one size/);
});

test('size limits: 150 KB, 200 KB for 300x600, export errors block', () => {
  let st = Steps.stepStatus(input({ zipSizes: { b1: { bytes: 151000 }, b2: { bytes: 199000 } } }));
  assert.deepStrictEqual(st[2].issues.map((x) => x.text), ['300×250 is 151 KB, over the 150 KB limit']);
  assert.strictEqual(st[2].issues[0].level, 'warning');
  st = Steps.stepStatus(input({ zipSizes: { b1: { bytes: 1000 }, b2: { error: 'boom' } } }));
  assert.deepStrictEqual(Steps.blockers(st).map((x) => x.text), ['300×600 could not be exported: boom']);
});

test('URL check', () => {
  assert.ok(Steps.validUrl('https://www.accu-chek.com/smartguide?utm=1'));
  assert.ok(Steps.validUrl(' http://a.co '));
  assert.ok(!Steps.validUrl('www.accu-chek.com'));
  assert.ok(!Steps.validUrl('https://localhost'));
  assert.ok(!Steps.validUrl('javascript:alert(1)'));
  assert.ok(!Steps.validUrl(''));
});

const okChecks = { b1: { length: 10, audit: { clickTag: true, targets: 0, hardcoded: [] }, staticBytes: 20000 }, b2: { length: 10, audit: { clickTag: true, targets: 0, hardcoded: [] }, staticBytes: 30000 } };
const naming = { brand: 'AccuChek', audience: 'HCP', asset: 'Launch', vvpm: 'MC-1' };
const pharma = (over) => input(Object.assign({ checks: okChecks, animationLimit: 15, namingMissing: G.namingMissing, pkg: { channel: 'html5', exits: [{ url: 'https://www.example.com' }], exclude: {}, naming } }, over));
const G = require('../src/generator');

test('pharma rules all pass for a compliant package', () => {
  const st = Steps.stepStatus(pharma());
  assert.deepStrictEqual(Steps.allIssues(st), []);
  assert.deepStrictEqual(Steps.pharmaChecks(st, true).map((r) => r.id + ':' + r.state), ['size:ok', 'length:ok', 'static:ok', 'clicktag:ok', 'naming:ok']);
  assert.deepStrictEqual(Steps.pharmaChecks(st, false).map((r) => r.state), ['pending', 'pending', 'pending', 'pending', 'ok'], 'unmeasured rules are pending');
});

test('pharma rule failures', () => {
  const checks = {
    b1: { length: 20, audit: { clickTag: true, targets: 2, hardcoded: ['https://x.example'] }, staticError: 'decode failed' },
    b2: { length: Infinity, audit: { clickTag: true, targets: 0, hardcoded: [] }, staticBytes: 1 }
  };
  const st = Steps.stepStatus(pharma({ checks, zipSizes: { b1: { bytes: 160000 }, b2: { bytes: 100 } }, pkg: { channel: 'html5', exits: [{ url: 'https://www.example.com' }], exclude: {}, naming: { brand: 'A' } } }));
  const rules = Object.fromEntries(Steps.pharmaChecks(st, true).map((r) => [r.id, r]));
  assert.strictEqual(rules.size.state, 'warning');
  assert.strictEqual(rules.length.state, 'warning');
  assert.deepStrictEqual(rules.length.issues.map((i) => i.text), [
    '300×250 animates for 20 s, over the 15 s limit before the ISI',
    '300×600 loops forever; it must stop within 15 s, before the ISI'
  ]);
  assert.strictEqual(rules.static.state, 'error');
  assert.strictEqual(rules.clicktag.state, 'error');
  assert.deepStrictEqual(rules.clicktag.issues.map((i) => i.text), ['300×250 has 2 target attributes', '300×250 links to https://x.example directly instead of through clickTag']);
  assert.strictEqual(rules.naming.state, 'error');
  assert.match(rules.naming.issues[0].text, /Audience, Asset name, VVPM code/);
  assert.ok(Steps.blockers(st).some((i) => i.rule === 'naming'), 'missing names block the download');
});

test('GWD gets a clickTag warning', () => {
  const gwdChecks = { b1: Object.assign({}, okChecks.b1, { audit: { clickTag: false, targets: 0, hardcoded: [] } }), b2: okChecks.b2 };
  const st = Steps.stepStatus(pharma({ checks: gwdChecks, pkg: { channel: 'gwd', exits: [{ url: 'https://www.example.com' }], exclude: {}, naming } }));
  const issues = Steps.allIssues(st);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].rule, 'clicktag');
  assert.strictEqual(issues[0].level, 'warning');
});
