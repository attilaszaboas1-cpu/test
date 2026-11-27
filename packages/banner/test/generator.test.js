const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/generator.js');
const Zip = require('../../core/zip.js');

function scene(on, over) {
  return Object.assign({
    on: on,
    in: { p: 'fade', d: 0, t: 0.5, e: 'ease-out', dist: 30 },
    out: { p: 'fade', d: -0.5, t: 0.5, e: 'ease-in', dist: 30 },
    loop: { p: 'none', t: 0.6, d: 0, r: 2 },
    motion: { p: 'none', x: 0, y: 0, s: 1.1, r: 0, d: 0, e: 'linear' }
  }, over || {});
}

// State of a track during a hold (the last point at or before t).
function stateAt(track, t) {
  let s = null;
  track.pts.forEach((p) => { if (p.t <= t + 1e-9) s = p.state; });
  return s;
}
const isHidden = (s) => s && (s.opacity === '0' || /scale\(0\)/.test(s.transform || ''));

test('timeline unrolls plays and marks the final frame', () => {
  const tl = G.timeline({ scenes: [{ dur: 4 }, { dur: 6 }], plays: 2, endOnLast: true });
  assert.strictEqual(tl.total, 20);
  assert.strictEqual(tl.playLen, 10);
  assert.strictEqual(tl.iterations, '1');
  assert.deepStrictEqual(tl.seq.map((s) => s.final), [false, false, false, true]);

  const forever = G.timeline({ scenes: [{ dur: 4 }, { dur: 6 }], plays: 0 });
  assert.strictEqual(forever.total, 10);
  assert.strictEqual(forever.iterations, 'infinite');
  assert.ok(forever.seq.every((s) => !s.final));
});

test('element in the first frame fades in and out within it', () => {
  const tl = G.timeline({ scenes: [{ dur: 4 }, { dur: 6 }], plays: 1 });
  const c = G.compileElement({ scenes: [scene(true), scene(false)] }, tl);
  assert.ok(isHidden(stateAt(c.outer, 0)));
  assert.deepStrictEqual(stateAt(c.outer, 2), {});
  assert.ok(isHidden(stateAt(c.outer, 5)));
  assert.match(c.outer.css('o0', {}), /@keyframes o0/);
});

test('last frame skips its exit on the final play', () => {
  const tl = G.timeline({ scenes: [{ dur: 4 }, { dur: 6 }], plays: 1, endOnLast: true });
  const c = G.compileElement({ scenes: [scene(false), scene(true)] }, tl);
  assert.ok(isHidden(stateAt(c.outer, 3)));
  assert.deepStrictEqual(stateAt(c.outer, 9.9), {});
  assert.deepStrictEqual(c.outer.pts[c.outer.pts.length - 1].state, {});
});

test('cut transitions between frames keep the element on screen', () => {
  const tl = G.timeline({ scenes: [{ dur: 2 }, { dur: 2 }], plays: 1 });
  const a = scene(true, { out: { p: 'none', d: 0, t: 0.5, e: 'ease-in', dist: 30 } });
  const b = scene(true, { in: { p: 'none', d: 0, t: 0.5, e: 'ease-out', dist: 30 } });
  const c = G.compileElement({ scenes: [a, b] }, tl);
  const hiddenPoints = c.outer.pts.filter((p) => p.t > 0.6 && isHidden(p.state));
  assert.strictEqual(hiddenPoints.length, 0);
});

test('negative exit delay ends the exit at the end of the frame', () => {
  const tl = G.timeline({ scenes: [{ dur: 4 }, { dur: 4 }], plays: 1 });
  const c = G.compileElement({ scenes: [scene(true), scene(false)] }, tl);
  const outStart = c.outer.pts.find((p) => p.t > 1 && p.ease === 'ease-in');
  assert.ok(outStart, 'exit transition present');
  assert.ok(Math.abs(outStart.t - 3.5) < 1e-6);
});

test('loop repeats the requested number of cycles', () => {
  const tl = G.timeline({ scenes: [{ dur: 6 }], plays: 1 });
  const c = G.compileElement({ scenes: [scene(true, { loop: { p: 'pulse', t: 1, d: 0, r: 2 } })] }, tl);
  const peaks = c.loop.pts.filter((p) => p.state.transform === 'scale(1.08)');
  assert.strictEqual(peaks.length, 2);
});

test('elements never shown are left out', () => {
  const tl = G.timeline({ scenes: [{ dur: 3 }], plays: 1 });
  assert.strictEqual(G.compileElement({ scenes: [scene(false)] }, tl), null);
});

function sampleBanner(channel, extra) {
  const session = {
    scenes: [{ dur: 3 }, { dur: 3 }],
    plays: 1,
    endOnLast: true,
    elements: [
      Object.assign({ id: 'a', name: 'CTA', exit: 1, clip: true, maskId: 'm', maskName: 'mask', scenes: [scene(false), scene(true)] }, extra || {}),
      { id: 'b', name: 'Headline', exit: -1, scenes: [scene(true), scene(false)] }
    ]
  };
  const png = new Uint8Array([137, 80, 78, 71]);
  const assets = {
    radius: 0,
    background: { css: '#fff' },
    items: {
      a: { x: 10, y: 10, width: 50, height: 20, ext: 'png', bytes: png },
      b: { x: 0, y: 0, width: 100, height: 20, ext: 'png', bytes: png }
    },
    masks: { m: { x: 5, y: 5, width: 80, height: 40, ext: 'png', bytes: png } }
  };
  return G.buildBanner({
    name: 'Test <banner>', width: 300, height: 250, session, assets, channel,
    pkg: { border: true, borderColor: '#000', exits: [{ name: 'Main exit', url: 'https://a.example' }, { name: 'CTA', url: 'https://b.example' }] }
  });
}

test('html5 output uses the clickTag convention and per-element exits', () => {
  const out = sampleBanner('html5');
  assert.match(out.html, /<meta name="ad.size" content="width=300,height=250">/);
  assert.match(out.html, /var clickTag = "https:\/\/a.example"/);
  assert.match(out.html, /var clickTag2 = "https:\/\/b.example"/);
  assert.match(out.html, /href="javascript:window.open\(window.clickTag\)"/);
  assert.match(out.html, /onclick="return bannerExit\(event,1\)"/);
  assert.match(out.html, /<title>Test &lt;banner&gt;<\/title>/);
  assert.deepStrictEqual(out.files.map((f) => f.name), ['index.html', 'images/01-headline.png', 'images/02-cta.png']);
});

test('masked elements are wrapped in a mask container', () => {
  const out = sampleBanner('html5');
  assert.match(out.html, /\.k1\{left:5px;top:5px;width:80px;height:40px;-webkit-mask:url\("data:image\/png;base64,iVBORw=="\)/, 'mask embedded so it works from file://');
  assert.match(out.html, /\.l1\{left:5px;top:5px;/);
  const unclipped = sampleBanner('html5', { clip: false });
  assert.doesNotMatch(unclipped.html, /class="k /);
});

// Script bodies of a banner, for checking the click-through wiring.
const scripts = (html) => (html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || []).join('\n');

test('channel menu matches the reference order and hides Xandr', () => {
  const visible = Object.keys(G.CHANNELS).filter((k) => !G.CHANNELS[k].hidden).map((k) => G.CHANNELS[k].label);
  assert.deepStrictEqual(visible, ['GWD', 'HTML5', 'AE', 'WPPP', 'BAN']);
  assert.ok(G.CHANNELS.xandr.hidden);
  assert.strictEqual(G.channelId('adform'), 'ae', 'old saved Adform packages map to AE');
  assert.strictEqual(G.channelId('nope'), '');
});

test('GWD waits for Enabler INIT before exiting and holds the animation until PAGE_LOADED', () => {
  const out = sampleBanner('gwd');
  const js = scripts(out.html);
  assert.match(out.html, /<html lang="en" class="ba-hold">/);
  assert.match(out.html, /\.ba-hold #banner \*\{animation-play-state:paused!important\}/);
  assert.match(js, /s0\.2mdn\.net\/ads\/studio\/Enabler\.js/);
  assert.match(js, /Enabler\.isInitialized\(\)/);
  assert.match(js, /studio\.events\.StudioEvent\.INIT/);
  assert.match(js, /Enabler\.isPageLoaded\(\)/);
  assert.match(js, /studio\.events\.StudioEvent\.PAGE_LOADED/);
  assert.match(js, /if\(exitsReady\)Enabler\.exit\(x\.name,x\.url\)/);
  assert.match(js, /"name":"CTA","url":"https:\/\/b.example"/);
  assert.doesNotMatch(js, /clickTag/);
});

test('GWD exit wiring runs correctly against a fake Enabler', () => {
  const vm = require('node:vm');
  const js = scripts(sampleBanner('gwd').html).split('\n').filter((l) => !/src=/.test(l))
    .map((l) => l.replace(/<\/?script[^>]*>/g, '')).join('\n');
  const listeners = {};
  const exits = [];
  const classes = new Set(['ba-hold']);
  const enabler = {
    inited: false, loaded: false,
    isInitialized() { return this.inited; },
    isPageLoaded() { return this.loaded; },
    addEventListener(ev, fn) { listeners[ev] = fn; },
    exit(name, url) { exits.push([name, url]); }
  };
  const ctx = {
    Enabler: enabler,
    studio: { events: { StudioEvent: { INIT: 'init', PAGE_LOADED: 'page' } } },
    document: { documentElement: { classList: { remove: (c) => classes.delete(c) } } },
    window: null
  };
  ctx.window = ctx;
  vm.runInNewContext(js + ';this.exitFn=bannerExit;', ctx);
  const click = (i) => ctx.exitFn({ preventDefault() {}, stopPropagation() {} }, i);

  click(1);
  assert.deepStrictEqual(exits, [], 'no exit before INIT');
  enabler.inited = true;
  listeners.init();
  assert.ok(classes.has('ba-hold'), 'still held until the page has loaded');
  click(1);
  assert.deepStrictEqual(exits, [['CTA', 'https://b.example']]);
  listeners.page();
  assert.ok(!classes.has('ba-hold'), 'animation starts on PAGE_LOADED');
});

test('AE uses the Adform DHTML build with a manifest', () => {
  const ae = sampleBanner('ae');
  const js = scripts(ae.html);
  assert.match(js, /document\.write\('<script src="'\+\(window\.API_URL\|\|'https:\/\/s1\.adform\.net\/banners\/scripts\/rmb\/Adform\.DHTML\.js\?bv='\+Math\.random\(\)\)/);
  assert.match(js, /dhtml\.getVar\(n,EXITS\[i\]\)/);
  assert.match(js, /dhtml\.getVar\('landingPageTarget','_blank'\)/);
  const manifest = ae.files.find((f) => f.name === 'manifest.json');
  assert.ok(manifest);
  const m = JSON.parse(manifest.data);
  assert.deepStrictEqual(m.clicktags, { clickTAG: 'https://a.example', clickTAG2: 'https://b.example' });
  assert.strictEqual(m.width, '300');
  assert.strictEqual(m.height, '250');
  assert.strictEqual(m.source, 'index.html');
  assert.strictEqual(sampleBanner('adform').html, ae.html, 'legacy "adform" id builds the same banner');
});

test('WPPP and BAN produce the HTML5 clickTag build', () => {
  const html5 = sampleBanner('html5');
  for (const ch of ['wppp', 'ban']) {
    const out = sampleBanner(ch);
    assert.strictEqual(out.html, html5.html, ch + ' html');
    assert.deepStrictEqual(out.files.map((f) => f.name), html5.files.map((f) => f.name), ch + ' files');
    assert.ok(!out.files.some((f) => f.name === 'manifest.json'));
  }
  assert.doesNotMatch(html5.html, /Enabler|Adform|APPNEXUS|ba-hold/);
});

test('hidden Xandr build still works', () => {
  const xandr = sampleBanner('xandr');
  assert.match(xandr.html, /appnexus-html5-lib\.min\.js/);
  assert.match(xandr.html, /APPNEXUS\.getClickTag\(\)/);
});

test('size limits: 150 KB, 200 KB for 300x600', () => {
  assert.strictEqual(G.sizeLimit(300, 250), 150000);
  assert.strictEqual(G.sizeLimit(728, 90), 150000);
  assert.strictEqual(G.sizeLimit(300, 600), 200000);
});

test('a packaged banner zip passes unzip -t', async (t) => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch (e) { t.skip('unzip not installed'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-zip-'));
  try {
    for (const ch of Object.keys(G.CHANNELS)) {
      const file = path.join(dir, ch + '.zip');
      fs.writeFileSync(file, await Zip.makeZip(sampleBanner(ch).files));
      const log = execFileSync('unzip', ['-t', file]).toString();
      assert.match(log, /No errors detected/, ch);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Pharma rules
// ---------------------------------------------------------------------------
test('animation length counts every play; looping is infinite', () => {
  const s = { scenes: [{ dur: 4 }, { dur: 6 }], plays: 1, elements: [] };
  assert.strictEqual(G.animationLength(s), 10);
  assert.strictEqual(G.animationLength(Object.assign({}, s, { plays: 2 })), 20);
  assert.strictEqual(G.animationLength(Object.assign({}, s, { plays: 0 })), Infinity);
  assert.strictEqual(G.ANIMATION_LIMIT, 15);
});

test('static backup layers are the last frame at rest, back to front', () => {
  const img = (x) => ({ x, y: 0, width: 10, height: 10, ext: 'png', bytes: new Uint8Array(1) });
  const session = {
    scenes: [{ dur: 3 }, { dur: 3 }],
    elements: [
      { id: 'cta', name: 'CTA', clip: true, maskId: 'm', scenes: [scene(false), scene(true, { motion: { p: 'zoom-in' } })] },
      { id: 'head', name: 'Headline', scenes: [scene(true), scene(false)] },
      { id: 'logo', name: 'Logo', clip: false, maskId: 'm', scenes: [scene(true), scene(true, { motion: { p: 'custom', x: 5, y: -2, s: 1.2, r: 3 } })] },
      { id: 'noimg', name: 'Missing', scenes: [scene(true), scene(true)] }
    ]
  };
  const assets = { items: { cta: img(1), head: img(2), logo: img(3) }, masks: { m: img(9) } };
  const layers = G.staticLayers(session, assets);
  assert.deepStrictEqual(layers.map((l) => l.id), ['logo', 'cta'], 'last-frame layers only, back → front, skipping ones without an image');
  assert.deepStrictEqual(layers[0].motion, { x: 5, y: -2, s: 1.2, r: 3 });
  assert.ok(!layers[0].mask, 'clip off → no mask');
  assert.strictEqual(layers[1].mask, assets.masks.m);
  assert.deepStrictEqual(layers[1].motion, { x: 0, y: 0, s: 1.1, r: 0 }, 'slow zoom ends at 1.1');
});

test('every channel output has no target attributes; clickTag channels pass the audit', () => {
  for (const ch of Object.keys(G.CHANNELS)) {
    const a = G.auditHtml(sampleBanner(ch).html);
    assert.strictEqual(a.targets, 0, ch + ' target attributes');
    assert.deepStrictEqual(a.hardcoded, [], ch + ' hard-coded URLs');
  }
  for (const ch of ['html5', 'wppp', 'ban', 'ae']) assert.ok(G.auditHtml(sampleBanner(ch).html).clickTag, ch + ' uses clickTag');
  assert.ok(!G.auditHtml(sampleBanner('gwd').html).clickTag, 'GWD exits use Enabler.exit');
});

test('audit catches target attributes and hard-coded landing URLs', () => {
  const bad = '<a href="https://evil.example/x" target="_blank">x</a><div onclick="window.open(\'https://b.example\')"></div><script>var clickTag = "https://ok.example";</script>';
  const a = G.auditHtml(bad);
  assert.strictEqual(a.targets, 1);
  assert.deepStrictEqual(a.hardcoded, ['https://evil.example/x', 'https://b.example']);
});

test('file naming: Brand-Audience-AssetName-HTML5|Static-VVPM-WxH', () => {
  const naming = { brand: 'Accu-Chek', audience: 'HCP', asset: 'Smart Guide Launch', vvpm: 'US-CGM-2400123' };
  assert.strictEqual(G.assetName(naming, 'HTML5', 300, 250), 'Accu-Chek-HCP-SmartGuideLaunch-HTML5-US-CGM-2400123-300x250');
  assert.strictEqual(G.assetName(naming, 'Static', 300, 600), 'Accu-Chek-HCP-SmartGuideLaunch-Static-US-CGM-2400123-300x600');
  assert.strictEqual(G.packageName(naming), 'Accu-Chek-HCP-SmartGuideLaunch-US-CGM-2400123');
  assert.strictEqual(G.namePart(' a/b:c*d?"e<f>g|h \\ '), 'abcdefgh');
  assert.strictEqual(G.namePart('-x-'), 'x', 'no separator at the ends');
  assert.deepStrictEqual(G.namingMissing({ brand: 'X', audience: '  ', asset: '***' }), ['Audience', 'Asset name', 'VVPM code']);
  assert.deepStrictEqual(G.namingMissing(naming), []);
  assert.strictEqual(G.assetName({}, 'HTML5', 728, 90), '[Brand]-[Audience]-[AssetName]-HTML5-[VVPM]-728x90');
  assert.strictEqual(G.packageName({}), 'banners');
});
