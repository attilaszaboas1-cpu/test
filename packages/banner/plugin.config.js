// Build inputs for tools/build.js (paths relative to this folder).
module.exports = {
  main: 'src/main.js',          // → code.js (Figma main thread)
  ui: 'src/app.js',             // → inlined into ui.html
  template: 'src/ui.template.html',
  styles: ['../core/ui/base.css', 'src/ui.css']
};
