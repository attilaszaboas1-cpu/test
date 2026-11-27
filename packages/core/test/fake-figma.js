// Minimal stand-in for the Figma plugin API, enough for core/figma and plugin main threads.
let seq = 0;

function node(type, props, children) {
  const n = Object.assign({
    id: String(++seq) + ':' + type.toLowerCase(),
    type: type,
    name: type.toLowerCase(),
    visible: true,
    isMask: false,
    removed: false,
    parent: null,
    plugin: {},
    exports: [],
    getPluginData(k) { return this.plugin[k] || ''; },
    setPluginData(k, v) { this.plugin[k] = v; },
    async exportAsync(settings) {
      // Record what was visible at export time, so tests can check hidden-layer handling.
      this.exports.push({ settings: settings, visible: this.visible, children: (this.children || []).map((c) => c.visible) });
      return new Uint8Array([1, 2, 3]);
    },
    remove() { this.removed = true; if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
  }, props || {});
  if (children) {
    n.children = children;
    children.forEach((c) => { c.parent = n; });
  }
  return n;
}

// A box at (x, y) with size w×h, used for both bounding and render bounds.
function box(x, y, w, h) {
  return { absoluteBoundingBox: { x, y, width: w, height: h }, absoluteRenderBounds: { x, y, width: w, height: h }, width: w, height: h };
}

function install(page) {
  const posted = [];
  const events = {};
  const all = () => {
    const out = [];
    const walk = (n) => { out.push(n); (n.children || []).forEach(walk); };
    walk(page);
    return out;
  };
  const figma = {
    root: node('DOCUMENT', {}, [page]),
    currentPage: page,
    created: [],
    notified: [],
    viewport: { scrollAndZoomIntoView() {} },
    async getNodeByIdAsync(id) { return all().find((n) => n.id === id) || null; },
    createRectangle() {
      const r = node('RECTANGLE', { resize(w, h) { this.width = w; this.height = h; } });
      r.parent = page;
      page.children.push(r);
      this.created.push(r);
      return r;
    },
    showUI(html, opts) { this.uiOptions = opts; },
    notify(text, opts) { this.notified.push({ text, opts }); },
    on(ev, fn) { events[ev] = fn; },
    ui: { postMessage(m) { posted.push(m); }, onmessage: null },
    posted: posted,
    events: events
  };
  page.selection = [];
  global.figma = figma;
  return figma;
}

// Banner frame: background, a masked group (mask + line), and a CTA frame with text.
function fixture() {
  const mask = node('RECTANGLE', Object.assign({ name: 'mask', isMask: true }, box(10, 10, 50, 100)));
  const line = node('RECTANGLE', Object.assign({ name: 'line-1' }, box(0, 0, 480, 120)));
  const group = node('GROUP', Object.assign({ name: 'line-group' }, box(10, 10, 50, 100)), [mask, line]);
  const label = node('TEXT', Object.assign({ name: 'Get started' }, box(30, 200, 80, 20)));
  const cta = node('FRAME', Object.assign({ name: 'button', fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }] }, box(20, 190, 120, 40)), [label]);
  const photo = node('RECTANGLE', Object.assign({ name: 'photo', fills: [{ type: 'IMAGE' }] }, box(150, 30, 120, 200)));
  const frame = node('FRAME', Object.assign({ name: 'MPU' }, box(0, 0, 300, 250)), [group, photo, cta]);
  const section = node('SECTION', { name: 'sizes' }, [node('FRAME', Object.assign({ name: 'HPA' }, box(400, 0, 300, 600)), [])]);
  const page = node('PAGE', { name: 'Page' }, [frame, section, node('TEXT', { name: 'note' })]);
  const figma = install(page);
  return { figma, page, frame, group, mask, line, cta, label, photo, section };
}

module.exports = { node, box, install, fixture };
