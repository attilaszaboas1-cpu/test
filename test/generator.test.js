const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/generator.js');

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
  assert.deepStrictEqual(out.files.map((f) => f.name), ['index.html', 'images/01-headline.png', 'images/mask-mask.png', 'images/02-cta.png']);
});

test('masked elements are wrapped in a mask container', () => {
  const out = sampleBanner('html5');
  assert.match(out.html, /\.k1\{left:5px;top:5px;width:80px;height:40px;-webkit-mask:url\("images\/mask-mask.png"\)/);
  assert.match(out.html, /\.l1\{left:5px;top:5px;/);
  const unclipped = sampleBanner('html5', { clip: false });
  assert.doesNotMatch(unclipped.html, /class="k /);
});

test('channel adapters', () => {
  const gwd = sampleBanner('gwd');
  assert.match(gwd.html, /Enabler\.js/);
  assert.match(gwd.html, /Enabler\.exit\(x\.name,x\.url\)/);

  const adform = sampleBanner('adform');
  assert.match(adform.html, /Adform\.DHTML\.js/);
  const manifest = adform.files.find((f) => f.name === 'manifest.json');
  assert.ok(manifest);
  assert.deepStrictEqual(JSON.parse(manifest.data).clicktags, { clickTAG: 'https://a.example', clickTAG2: 'https://b.example' });

  const xandr = sampleBanner('xandr');
  assert.match(xandr.html, /APPNEXUS\.getClickTag\(\)/);
});

test('makeZip writes a valid archive', () => {
  const zip = G.makeZip([{ name: 'index.html', data: '<p>hi</p>' }, { name: 'images/a.png', data: new Uint8Array([1, 2, 3]) }]);
  const dv = new DataView(zip.buffer);
  assert.strictEqual(dv.getUint32(0, true), 0x04034b50);
  assert.strictEqual(dv.getUint32(zip.length - 22, true), 0x06054b50);
  assert.strictEqual(dv.getUint16(zip.length - 12, true), 2);
});
