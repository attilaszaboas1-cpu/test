// Tiny CommonJS bundler. Figma needs one file for the main thread (code.js) and one
// HTML file for the UI, so each plugin's entry points are bundled with this.
// Only relative require('./x') / require('../x') calls with string literals are allowed;
// the bundle has no dependencies and runs in the Figma sandbox and in browsers.
const fs = require('fs');
const path = require('path');

const REQUIRE_RE = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;

function resolveFile(from, spec) {
  if (!spec.startsWith('.')) throw new Error('Only relative requires can be bundled: "' + spec + '" in ' + from);
  const base = path.resolve(path.dirname(from), spec);
  for (const f of [base, base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  throw new Error('Cannot resolve "' + spec + '" from ' + from);
}

// Returns the bundled source of `entry` (an absolute or cwd-relative path).
// root: ids in the bundle are paths relative to it (stable across machines).
function bundle(entry, opts) {
  const root = path.resolve((opts && opts.root) || process.cwd());
  const modules = new Map();
  const idOf = (file) => path.relative(root, file).split(path.sep).join('/');

  const visit = (file) => {
    const id = idOf(file);
    if (modules.has(id)) return id;
    modules.set(id, null);
    const src = fs.readFileSync(file, 'utf8').replace(REQUIRE_RE, (m, q, spec) => 'require(' + JSON.stringify(visit(resolveFile(file, spec))) + ')');
    modules.set(id, src);
    return id;
  };
  const entryId = visit(path.resolve(entry));

  const parts = ['(function () {', 'var __defs = {}, __cache = {};',
    'function __require(id) { var c = __cache[id]; if (c) return c.exports; c = __cache[id] = { exports: {} }; __defs[id].call(c.exports, c, c.exports, __require); return c.exports; }'];
  for (const [id, src] of modules) {
    parts.push('__defs[' + JSON.stringify(id) + '] = function (module, exports, require) {\n' + src + '\n};');
  }
  parts.push('__require(' + JSON.stringify(entryId) + ');', '})();');
  return parts.join('\n');
}

module.exports = { bundle, resolveFile };
