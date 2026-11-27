const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { bundle } = require('../bundle');

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-'));
  for (const [name, src] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), src);
  }
  return dir;
}

test('bundles relative requires into one self-running script', () => {
  const dir = project({
    'app/main.js': "const a = require('../lib/a'); const b = require('../lib/b.js'); out.push(a.name, b(), require('../lib').idx);",
    'lib/a.js': "module.exports = { name: 'a' };",
    'lib/b.js': "const a = require('./a'); module.exports = () => 'b+' + a.name;",
    'lib/index.js': "exports.idx = 'index';"
  });
  try {
    const code = bundle(path.join(dir, 'app/main.js'), { root: dir });
    const ctx = { out: [] };
    vm.runInNewContext(code, ctx);
    assert.deepStrictEqual(ctx.out, ['a', 'b+a', 'index']);
    assert.strictEqual((code.match(/__defs\["lib\/a.js"\] =/g) || []).length, 1, 'shared module included once');
    assert.doesNotMatch(code, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'no absolute paths in the output');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('handles require cycles like Node', () => {
  const dir = project({
    'a.js': "exports.early = 1; const b = require('./b'); out.push(b.seen);",
    'b.js': "const a = require('./a'); exports.seen = a.early;"
  });
  try {
    const ctx = { out: [] };
    vm.runInNewContext(bundle(path.join(dir, 'a.js'), { root: dir }), ctx);
    assert.deepStrictEqual(ctx.out, [1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects package and missing requires', () => {
  const dir = project({ 'a.js': "require('fs');", 'b.js': "require('./missing');" });
  try {
    assert.throws(() => bundle(path.join(dir, 'a.js'), { root: dir }), /Only relative requires/);
    assert.throws(() => bundle(path.join(dir, 'b.js'), { root: dir }), /Cannot resolve/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
