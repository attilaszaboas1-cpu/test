// Inlines src/ into ui.html — Figma plugins need a single HTML file for the UI.
// Usage: node build.js
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const guard = (code, name) => {
  if (/<\/script/i.test(code)) throw new Error(name + ' contains a literal </script> — escape it as <\\/script>');
  return code;
};

const html = read('ui.template.html')
  .replace('/*__STYLES__*/', () => read('ui.css'))
  .replace('//__GENERATOR__', () => guard(read('generator.js'), 'generator.js'))
  .replace('//__APP__', () => guard(read('app.js'), 'app.js'));

fs.writeFileSync(path.join(__dirname, 'ui.html'), html);
console.log('ui.html written (' + Math.round(html.length / 1024) + ' KB)');
