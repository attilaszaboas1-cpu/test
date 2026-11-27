// Builds every plugin in packages/*/ that has a plugin.config.js:
//   code.js  ← bundled Figma main-thread entry
//   ui.html  ← template with the bundled UI script and the CSS files inlined
// Usage: node tools/build.js [package…]   (all plugins when none given)
const fs = require('fs');
const path = require('path');
const { bundle } = require('./bundle');

const ROOT = path.resolve(__dirname, '..');

function guard(code, name) {
  if (/<\/script/i.test(code)) throw new Error(name + ' contains a literal </script> — escape it as <\\/script>');
  return code;
}

function buildPlugin(dir) {
  const cfg = require(path.join(dir, 'plugin.config.js'));
  const rel = (f) => path.join(dir, f);
  const code = bundle(rel(cfg.main), { root: ROOT });
  const css = cfg.styles.map((f) => fs.readFileSync(rel(f), 'utf8')).join('\n');
  const ui = guard(bundle(rel(cfg.ui), { root: ROOT }), cfg.ui);
  const html = fs.readFileSync(rel(cfg.template), 'utf8')
    .replace('/*__STYLES__*/', () => css)
    .replace('//__UI__', () => ui);
  return { code, html };
}

function plugins(names) {
  const dirs = fs.readdirSync(path.join(ROOT, 'packages'))
    .filter((d) => !names.length || names.includes(d))
    .map((d) => path.join(ROOT, 'packages', d))
    .filter((d) => fs.existsSync(path.join(d, 'plugin.config.js')));
  return dirs;
}

if (require.main === module) {
  for (const dir of plugins(process.argv.slice(2))) {
    const out = buildPlugin(dir);
    fs.writeFileSync(path.join(dir, 'code.js'), out.code);
    fs.writeFileSync(path.join(dir, 'ui.html'), out.html);
    console.log(path.relative(ROOT, dir) + ': code.js ' + Math.round(out.code.length / 1024) + ' KB, ui.html ' + Math.round(out.html.length / 1024) + ' KB');
  }
}

module.exports = { buildPlugin, plugins, ROOT };
