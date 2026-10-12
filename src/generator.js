/*
 * Banner Automation — HTML5 generator.
 * Pure functions shared by the plugin UI (inlined into ui.html) and the Node tests.
 *
 * Session model (stored per banner frame):
 *   scenes:   [{ dur }]                       the banner timeline is split into "frames"
 *   plays:    1..3, or 0 for forever
 *   endOnLast true → on the final play the last frame skips its exits and stays on screen
 *   elements: front → back; each has per-scene { on, in, out, loop, motion }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BannerGen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EASINGS = {
    'linear': 'linear',
    'ease': 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
    'expo-out': 'cubic-bezier(.16,1,.3,1)',
    'expo-in': 'cubic-bezier(.7,0,.84,0)',
    'back-out': 'cubic-bezier(.34,1.56,.64,1)',
    'back-in': 'cubic-bezier(.36,0,.66,-.56)'
  };

  const EASE_LABELS = {
    'linear': 'Linear', 'ease': 'Ease', 'ease-in': 'Ease in', 'ease-out': 'Ease out', 'ease-in-out': 'Ease in-out',
    'expo-out': 'Expo out', 'expo-in': 'Expo in', 'back-out': 'Back out', 'back-in': 'Back in'
  };

  // Directional presets name the direction of travel.
  const IN_PRESETS = {
    'none': 'None (cut)',
    'fade': 'Fade in',
    'slide-up': 'Slide in ↑',
    'slide-down': 'Slide in ↓',
    'slide-left': 'Slide in ←',
    'slide-right': 'Slide in →',
    'fly-up': 'Fly in ↑',
    'fly-down': 'Fly in ↓',
    'fly-left': 'Fly in ←',
    'fly-right': 'Fly in →',
    'zoom-in': 'Zoom in',
    'zoom-out': 'Zoom out',
    'pop': 'Pop in',
    'blur': 'Blur in',
    'wipe-right': 'Wipe →',
    'wipe-left': 'Wipe ←',
    'wipe-down': 'Wipe ↓',
    'wipe-up': 'Wipe ↑'
  };

  const OUT_PRESETS = {
    'none': 'None (cut)',
    'fade': 'Fade out',
    'slide-up': 'Slide out ↑',
    'slide-down': 'Slide out ↓',
    'slide-left': 'Slide out ←',
    'slide-right': 'Slide out →',
    'fly-up': 'Fly out ↑',
    'fly-down': 'Fly out ↓',
    'fly-left': 'Fly out ←',
    'fly-right': 'Fly out →',
    'zoom-in': 'Zoom in',
    'zoom-out': 'Zoom out',
    'pop': 'Pop out',
    'blur': 'Blur out',
    'wipe-right': 'Wipe →',
    'wipe-left': 'Wipe ←',
    'wipe-down': 'Wipe ↓',
    'wipe-up': 'Wipe ↑'
  };

  const LOOP_EFFECTS = {
    'none': { label: 'None' },
    'pulse': { label: 'Pulse', steps: [[0, { transform: 'scale(1)' }], [0.5, { transform: 'scale(1.08)' }], [1, { transform: 'scale(1)' }]] },
    'heartbeat': { label: 'Heartbeat', steps: [[0, { transform: 'scale(1)' }], [0.15, { transform: 'scale(1.12)' }], [0.3, { transform: 'scale(1)' }], [0.45, { transform: 'scale(1.12)' }], [0.6, { transform: 'scale(1)' }], [1, { transform: 'scale(1)' }]] },
    'float': { label: 'Float', steps: [[0, { transform: 'translateY(0px)' }], [0.5, { transform: 'translateY(-6px)' }], [1, { transform: 'translateY(0px)' }]] },
    'bounce': { label: 'Bounce', steps: [[0, { transform: 'translateY(0px)' }], [0.3, { transform: 'translateY(-10px)' }], [0.5, { transform: 'translateY(0px)' }], [0.7, { transform: 'translateY(-4px)' }], [1, { transform: 'translateY(0px)' }]] },
    'shake': { label: 'Shake', steps: [[0, { transform: 'rotate(0deg)' }], [0.25, { transform: 'rotate(-5deg)' }], [0.75, { transform: 'rotate(5deg)' }], [1, { transform: 'rotate(0deg)' }]] },
    'wiggle': { label: 'Wiggle', steps: [[0, { transform: 'translateX(0px)' }], [0.2, { transform: 'translateX(-4px)' }], [0.4, { transform: 'translateX(4px)' }], [0.6, { transform: 'translateX(-4px)' }], [0.8, { transform: 'translateX(4px)' }], [1, { transform: 'translateX(0px)' }]] },
    'blink': { label: 'Blink', steps: [[0, { opacity: '1' }], [0.5, { opacity: '0.35' }], [1, { opacity: '1' }]] }
  };

  // Motion runs continuously while the element is on screen (e.g. a slow Ken Burns zoom).
  const MOTION_PRESETS = {
    'none': { label: 'None' },
    'zoom-in': { label: 'Slow zoom in', x: 0, y: 0, s: 1.1, r: 0 },
    'zoom-out': { label: 'Slow zoom out', x: 0, y: 0, s: 0.9, r: 0 },
    'pan-left': { label: 'Drift left', x: -20, y: 0, s: 1, r: 0 },
    'pan-right': { label: 'Drift right', x: 20, y: 0, s: 1, r: 0 },
    'pan-up': { label: 'Drift up', x: 0, y: -20, s: 1, r: 0 },
    'pan-down': { label: 'Drift down', x: 0, y: 20, s: 1, r: 0 },
    'custom': { label: 'Custom' }
  };

  const CHANNELS = {
    'html5': { label: 'HTML5', desc: 'Standard clickTag — Google Ads, DV360, most DSPs' },
    'gwd': { label: 'GWD', desc: 'Google Studio / CM360 — Enabler.js exits' },
    'adform': { label: 'Adform', desc: 'Adform DHTML clickTAG + manifest.json' },
    'xandr': { label: 'Xandr', desc: 'Xandr (AppNexus) HTML5 library click tag' }
  };

  const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const WIPES = {
    'wipe-right': ['inset(0 100% 0 0)', 'inset(0 0 0 100%)'],
    'wipe-left': ['inset(0 0 0 100%)', 'inset(0 100% 0 0)'],
    'wipe-down': ['inset(0 0 100% 0)', 'inset(100% 0 0 0)'],
    'wipe-up': ['inset(100% 0 0 0)', 'inset(0 0 100% 0)']
  };

  const VISIBLE = {};
  const HIDDEN = { opacity: '0' };
  const OUTER_DEFAULTS = { 'opacity': '1', 'transform': 'none', 'filter': 'none', 'clip-path': 'inset(0 0 0 0)' };
  const IDENTITY = { transform: 'translate(0px,0px) scale(1) rotate(0deg)' };
  const MOTION_DEFAULTS = { transform: 'translate(0px,0px) scale(1) rotate(0deg)' };
  const LOOP_DEFAULTS = { transform: 'none', opacity: '1' };
  const EPS = 0.002;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' };

  function num(v, fallback) {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function dur(v, fallback) {
    return Math.max(0.05, num(v, fallback === undefined ? 0.5 : fallback));
  }

  function easing(name, fallback) {
    return EASINGS[name] || EASINGS[fallback] || 'ease';
  }

  // The hidden state an element comes from (phase 'in') or leaves to (phase 'out').
  function presetState(type, distance, phase) {
    const d = num(distance, 30);
    const sign = phase === 'in' ? -1 : 1;
    const m = /^(slide|fly)-(up|down|left|right)$/.exec(type);
    if (m) {
      const v = DIRECTIONS[m[2]];
      const state = { transform: 'translate(' + (sign * v[0] * d) + 'px,' + (sign * v[1] * d) + 'px)' };
      if (m[1] === 'slide') state.opacity = '0';
      return state;
    }
    if (WIPES[type]) return { 'clip-path': WIPES[type][phase === 'in' ? 0 : 1] };
    switch (type) {
      case 'fade': return { opacity: '0' };
      case 'zoom-in': return { opacity: '0', transform: phase === 'in' ? 'scale(.6)' : 'scale(1.4)' };
      case 'zoom-out': return { opacity: '0', transform: phase === 'in' ? 'scale(1.4)' : 'scale(.6)' };
      case 'pop': return { transform: 'scale(0)' };
      case 'blur': return { opacity: '0', filter: 'blur(12px)' };
    }
    return HIDDEN;
  }

  function motionTarget(m) {
    const p = MOTION_PRESETS[m.p] && m.p !== 'custom' ? MOTION_PRESETS[m.p] : m;
    return {
      transform: 'translate(' + num(p.x, 0) + 'px,' + num(p.y, 0) + 'px) scale(' + num(p.s, 1) + ') rotate(' + num(p.r, 0) + 'deg)'
    };
  }

  function sameState(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /*
   * A keyframe track. Each point holds a state and the timing function of the
   * segment that follows it; holds use step-end so states never blend through gaps.
   */
  function makeTrack(total) {
    const pts = [];
    return {
      pts: pts,
      last: function () { return pts.length ? pts[pts.length - 1].state : null; },
      add: function (t, state, ease) {
        t = Math.min(Math.max(t, 0), total);
        const last = pts[pts.length - 1];
        if (last) {
          if (t < last.t) t = last.t;
          if (t - last.t < 1e-6) {
            if (sameState(last.state, state)) {
              if (ease) last.ease = ease;
              return;
            }
            if (last.t + EPS > total) {
              last.state = state;
              if (ease) last.ease = ease;
              return;
            }
            t = last.t + EPS;
            last.ease = 'step-end';
          }
        }
        pts.push({ t: t, state: state, ease: ease || 'step-end' });
      },
      css: function (name, defaults) {
        const distinct = {};
        pts.forEach(function (p) { distinct[JSON.stringify(p.state)] = true; });
        const keys = {};
        pts.forEach(function (p) { Object.keys(p.state).forEach(function (k) { keys[k] = true; }); });
        const props = Object.keys(keys);
        if (!props.length || Object.keys(distinct).length < 2) return '';
        const body = pts.map(function (p) {
          const decls = props.map(function (k) { return k + ':' + (p.state[k] !== undefined ? p.state[k] : defaults[k]); });
          decls.push('animation-timing-function:' + p.ease);
          return pct(p.t, total) + '{' + decls.join(';') + '}';
        });
        if (pts[pts.length - 1].t < total) {
          const lastState = pts[pts.length - 1].state;
          body.push('100%{' + props.map(function (k) { return k + ':' + (lastState[k] !== undefined ? lastState[k] : defaults[k]); }).join(';') + '}');
        }
        return '@keyframes ' + name + '{' + body.join('') + '}';
      }
    };
  }

  function pct(t, total) {
    return String(Math.round((t / total) * 1000000) / 10000) + '%';
  }

  /*
   * Unrolls the scenes for every play so the final play can end on the last frame.
   * Forever-looping banners use one pass with an infinite iteration count.
   */
  function timeline(session) {
    const scenes = session.scenes && session.scenes.length ? session.scenes : [{ dur: 5 }];
    const plays = Math.max(0, Math.floor(num(session.plays, 1)));
    const passes = plays > 0 ? plays : 1;
    const playLen = scenes.reduce(function (s, sc) { return s + Math.max(0.1, num(sc.dur, 3)); }, 0);
    const seq = [];
    let t = 0;
    for (let p = 0; p < passes; p++) {
      scenes.forEach(function (sc, i) {
        const d = Math.max(0.1, num(sc.dur, 3));
        seq.push({
          i: i,
          start: t,
          end: t + d,
          final: plays > 0 && session.endOnLast !== false && p === passes - 1 && i === scenes.length - 1
        });
        t += d;
      });
    }
    return { seq: seq, total: t, playLen: playLen, iterations: plays > 0 ? '1' : 'infinite' };
  }

  function sceneStarts(session) {
    const out = [];
    let t = 0;
    (session.scenes || []).forEach(function (sc) {
      out.push(t);
      t += Math.max(0.1, num(sc.dur, 3));
    });
    return out;
  }

  /*
   * Compiles one element into three tracks:
   *   outer  — entrance / exit per scene (opacity, transform, filter, clip-path)
   *   motion — continuous move/scale while visible
   *   loop   — repeating emphasis effect
   * Returns null when the element is never visible.
   */
  function compileElement(el, tl) {
    const total = tl.total;
    const seq = tl.seq;
    const cfg = function (k) { return el.scenes && el.scenes[seq[k].i]; };
    const on = function (k) { return k >= 0 && k < seq.length && !!cfg(k) && !!cfg(k).on; };

    let first = -1;
    for (let k = 0; k < seq.length; k++) if (on(k)) { first = k; break; }
    if (first === -1) return null;

    const outer = makeTrack(total);
    const motion = makeTrack(total);
    const loop = makeTrack(total);

    const c0 = cfg(first);
    const startsVisible = seq[first].start === 0 && c0.in.p === 'none' && num(c0.in.d, 0) <= 0;
    outer.add(0, startsVisible ? VISIBLE : (c0.in.p === 'none' ? HIDDEN : presetState(c0.in.p, c0.in.dist, 'in')));
    motion.add(0, IDENTITY);
    loop.add(0, {});

    for (let k = 0; k < seq.length; k++) {
      if (!on(k)) continue;
      const c = cfg(k);
      const sc = seq[k];
      const contIn = on(k - 1) && !seq[k - 1].final && cfg(k - 1).out.p === 'none' && c.in.p === 'none';
      const contOut = !sc.final && on(k + 1) && c.out.p === 'none' && cfg(k + 1).in.p === 'none';

      // Entrance
      let appear = sc.start;
      let inEnd = sc.start;
      if (!contIn) {
        appear = sc.start + Math.max(0, num(c.in.d, 0));
        if (c.in.p === 'none') {
          outer.add(appear, VISIBLE);
          inEnd = appear;
        } else {
          outer.add(appear, presetState(c.in.p, c.in.dist, 'in'), easing(c.in.e, 'ease-out'));
          inEnd = appear + dur(c.in.t);
          outer.add(inEnd, VISIBLE);
        }
      }

      // Exit
      let visEnd = sc.end;
      let goneAt = sc.end;
      let hides = false;
      if (sc.final) {
        visEnd = goneAt = total;
      } else if (!contOut) {
        hides = true;
        if (c.out.p === 'none') {
          outer.add(sc.end, HIDDEN);
        } else {
          const t0 = Math.max(inEnd, sc.end + num(c.out.d, 0));
          outer.add(t0, VISIBLE, easing(c.out.e, 'ease-in'));
          goneAt = t0 + dur(c.out.t);
          outer.add(goneAt, presetState(c.out.p, c.out.dist, 'out'));
          visEnd = t0;
        }
      }

      // Motion
      if (c.motion && c.motion.p && c.motion.p !== 'none') {
        const m0 = (contIn ? sc.start : appear) + Math.max(0, num(c.motion.d, 0));
        motion.add(m0, motion.last(), easing(c.motion.e, 'linear'));
        motion.add(Math.max(m0, goneAt), motionTarget(c.motion));
      }
      if (hides && !sameState(motion.last(), IDENTITY)) motion.add(goneAt, IDENTITY);

      // Loop
      const fx = c.loop && LOOP_EFFECTS[c.loop.p];
      if (fx && fx.steps) {
        const period = Math.max(0.1, num(c.loop.t, 0.6));
        const start = inEnd + Math.max(0, num(c.loop.d, 0));
        const fits = Math.floor((visEnd - start) / period + 1e-6);
        const wanted = c.loop.r === 'inf' ? fits : Math.max(1, Math.floor(num(c.loop.r, 1)));
        const cycles = Math.max(0, Math.min(fits, wanted));
        for (let i = 0; i < cycles; i++) {
          fx.steps.forEach(function (step, j) {
            if (i > 0 && j === 0) return;
            const lastStep = i === cycles - 1 && j === fx.steps.length - 1;
            loop.add(start + (i + step[0]) * period, step[1], lastStep ? undefined : 'ease-in-out');
          });
        }
        if (cycles > 0) loop.add(start + cycles * period, {});
      }
    }

    outer.add(total, outer.last());
    return { outer: outer, motion: motion, loop: loop };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function jsString(s) {
    return JSON.stringify(String(s || '')).replace(/</g, '\\u003c');
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'layer';
  }

  function bytesToBase64(bytes) {
    if (typeof btoa !== 'function') return Buffer.from(bytes).toString('base64');
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function r2(n) {
    return Math.round(n * 100) / 100;
  }

  const EXIT_PREAMBLE = 'if(e){e.preventDefault();e.stopPropagation();}';

  // Click-through implementation for each ad channel.
  function channelCode(channel, exits, name, W, H) {
    const urls = exits.map(function (x) { return x.url || ''; });
    const lines = [];
    const files = [];
    let root = '<div id="banner" onclick="return bannerExit(event,0)">';
    let rootClose = '</div>';

    switch (channel) {
      case 'gwd':
        lines.push('<script src="https://s0.2mdn.net/ads/studio/Enabler.js"><\/script>');
        lines.push('<script>var EXITS=' + JSON.stringify(exits.map(function (x, i) { return { name: x.name || ('Exit ' + (i + 1)), url: x.url || '' }; })).replace(/</g, '\\u003c') + ';' +
          'function bannerExit(e,i){' + EXIT_PREAMBLE + 'var x=EXITS[i]||EXITS[0];Enabler.exit(x.name,x.url);return false;}<\/script>');
        break;
      case 'adform': {
        lines.push('<script>document.write(\'<script src="\'+(window.API_URL||\'https://s1.adform.net/banners/scripts/rmb/Adform.DHTML.js?bv=\'+Math.random())+\'"><\\/script>\');<\/script>');
        lines.push('<script>var EXITS=' + JSON.stringify(urls).replace(/</g, '\\u003c') + ';' +
          'function bannerExit(e,i){' + EXIT_PREAMBLE + 'var n=\'clickTAG\'+(i?i+1:\'\');' +
          'window.open(dhtml.getVar(n,EXITS[i]),dhtml.getVar(\'landingPageTarget\',\'_blank\'));return false;}<\/script>');
        const clicktags = {};
        urls.forEach(function (u, i) { clicktags['clickTAG' + (i ? i + 1 : '')] = u; });
        files.push({
          name: 'manifest.json',
          data: JSON.stringify({
            version: '1.0', title: name, description: '', width: String(W), height: String(H),
            events: { enabled: 1, list: {} }, clicktags: clicktags, source: 'index.html'
          }, null, 2)
        });
        break;
      }
      case 'xandr':
        lines.push('<script src="https://acdn.adnxs.com/html5-lib/1.3.0/appnexus-html5-lib.min.js"><\/script>');
        lines.push('<script>function bannerExit(e,i){' + EXIT_PREAMBLE + 'window.open(APPNEXUS.getClickTag(),\'_blank\');return false;}<\/script>');
        break;
      case 'preview':
        lines.push('<script>function bannerExit(e,i){' + EXIT_PREAMBLE + 'return false;}<\/script>');
        break;
      default: // html5
        lines.push('<script>' + urls.map(function (u, i) { return 'var clickTag' + (i ? i + 1 : '') + ' = ' + jsString(u) + ';'; }).join('\n') + '\n' +
          'function bannerExit(e,i){' + EXIT_PREAMBLE + 'window.open(window[\'clickTag\'+(i?i+1:\'\')]);return false;}<\/script>');
        root = '<a id="banner" href="javascript:window.open(window.clickTag)">';
        rootClose = '</a>';
    }
    return { head: lines.join('\n'), root: root, rootClose: rootClose, files: files };
  }

  function previewControls(playLen) {
    return '<script>(function(){' +
      'function A(){return document.getAnimations?document.getAnimations():[];}' +
      'window.addEventListener("message",function(e){var d=e.data||{};if(!d.bannerCmd)return;' +
      'if(d.bannerCmd==="seek"){A().forEach(function(a){a.pause();a.currentTime=d.t*1000;});}' +
      'else if(d.bannerCmd==="play"){A().forEach(function(a){if(typeof d.t==="number")a.currentTime=d.t*1000;a.play();});}' +
      'else if(d.bannerCmd==="pause"){A().forEach(function(a){a.pause();});}' +
      'else if(d.bannerCmd==="outline"){document.documentElement.classList.toggle("outline",!!d.on);}});' +
      'function tick(){var a=A()[0];parent.postMessage({bannerPreview:true,t:a?(a.currentTime||0)/1000:0,playLen:' + playLen + ',playing:a?a.playState==="running":null},"*");setTimeout(tick,60);}' +
      'tick();})();<\/script>';
  }

  /*
   * opts: { name, width, height, session, assets, pkg, channel, inline, preview, outline }
   * assets: { radius, background:{css, bytes?, ext?},
   *           items:{ [id]: {x,y,width,height,ext,bytes} }, masks:{ [id]: {...} } }
   * Returns { html, files:[{name,data}], total }
   */
  function buildBanner(opts) {
    const W = opts.width, H = opts.height;
    const session = opts.session;
    const assets = opts.assets;
    const pkg = opts.pkg || {};
    const exits = pkg.exits && pkg.exits.length ? pkg.exits : [{ name: 'Main exit', url: '' }];
    const tl = timeline(session);
    const total = r2(tl.total * 1000) / 1000;
    const files = [];
    const usedNames = {};
    const css = [];
    const keyframes = [];
    const markup = [];

    const src = function (bytes, ext, base) {
      if (opts.inline) return 'data:' + MIME[ext] + ';base64,' + bytesToBase64(bytes);
      let name = 'images/' + base + '.' + ext;
      for (let n = 2; usedNames[name]; n++) name = 'images/' + base + '-' + n + '.' + ext;
      usedNames[name] = true;
      files.push({ name: name, data: bytes });
      return name;
    };
    const anim = function (name) {
      return 'animation:' + name + ' ' + total + 's linear 0s ' + tl.iterations + ' both';
    };

    let bg = (assets.background && assets.background.css) || '#ffffff';
    if (assets.background && assets.background.bytes) {
      bg += ' url("' + src(assets.background.bytes, assets.background.ext, 'background') + '") 0 0/100% 100% no-repeat';
    }

    const maskFiles = {};
    const elements = (session.elements || []).slice().reverse(); // back → front
    let index = 0;
    elements.forEach(function (el) {
      const a = assets.items && assets.items[el.id];
      if (!a) return;
      const compiled = compileElement(el, tl);
      if (!compiled) return;
      const i = index++;
      const base = String(i + 1).padStart(2, '0') + '-' + slug(el.name);

      let ox = 0, oy = 0, open = '', close = '';
      const mask = el.clip && el.maskId && assets.masks && assets.masks[el.maskId];
      if (mask) {
        if (!maskFiles[el.maskId]) maskFiles[el.maskId] = src(mask.bytes, mask.ext, 'mask-' + slug(el.maskName || 'shape'));
        const url = 'url("' + maskFiles[el.maskId] + '") 0 0/100% 100% no-repeat';
        ox = mask.x;
        oy = mask.y;
        css.push('.k' + i + '{left:' + r2(mask.x) + 'px;top:' + r2(mask.y) + 'px;width:' + r2(mask.width) + 'px;height:' + r2(mask.height) + 'px;-webkit-mask:' + url + ';mask:' + url + '}');
        open = '<div class="k k' + i + '">';
        close = '</div>';
      }

      const outerCss = compiled.outer.css('o' + i, OUTER_DEFAULTS);
      const motionCss = compiled.motion.css('m' + i, MOTION_DEFAULTS);
      const loopCss = compiled.loop.css('e' + i, LOOP_DEFAULTS);
      css.push('.l' + i + '{left:' + r2(a.x - ox) + 'px;top:' + r2(a.y - oy) + 'px;width:' + r2(a.width) + 'px;height:' + r2(a.height) + 'px' +
        (outerCss ? ';' + anim('o' + i) : '') + '}');
      if (motionCss) css.push('.l' + i + '>.m{' + anim('m' + i) + '}');
      if (loopCss) css.push('.l' + i + ' .e{' + anim('e' + i) + '}');
      [outerCss, motionCss, loopCss].forEach(function (k) { if (k) keyframes.push(k); });

      const exitIndex = num(el.exit, -1);
      const click = exitIndex >= 0 && exitIndex < exits.length ? ' onclick="return bannerExit(event,' + exitIndex + ')" style="cursor:pointer"' : '';
      markup.push(open + '<div class="l l' + i + '"' + click + '><div class="m"><div class="e"><img src="' +
        escapeHtml(src(a.bytes, a.ext, base)) + '" alt="' + escapeHtml(el.name) + '"></div></div></div>' + close);
    });

    const channel = opts.preview ? 'preview' : (opts.channel || 'html5');
    const ch = channelCode(channel, exits, opts.name, W, H);
    const radius = assets.radius ? 'border-radius:' + assets.radius + 'px;' : '';
    const border = pkg.border !== false
      ? '<div id="border" style="border-color:' + escapeHtml(pkg.borderColor || '#000000') + '"></div>'
      : '';

    const html = [
      '<!DOCTYPE html>',
      '<html lang="en"' + (opts.preview && opts.outline ? ' class="outline"' : '') + '>',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="ad.size" content="width=' + W + ',height=' + H + '">',
      '<title>' + escapeHtml(opts.name) + '</title>',
      ch.head,
      '<style>',
      '*{margin:0;padding:0;box-sizing:border-box}',
      'html,body{width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:transparent}',
      '#banner{position:relative;display:block;width:' + W + 'px;height:' + H + 'px;overflow:hidden;cursor:pointer;' + radius + 'background:' + bg + '}',
      '#banner .k,#banner .l{position:absolute}',
      '#banner .l{will-change:transform,opacity}',
      '#banner .m,#banner .e,#banner img{display:block;width:100%;height:100%}',
      '#border{position:absolute;left:0;top:0;width:100%;height:100%;border:1px solid #000;pointer-events:none;' + radius + '}',
      '.outline #banner .l{outline:1px dashed rgba(236,72,153,.9);outline-offset:-1px}',
      css.join('\n'),
      keyframes.join('\n'),
      '@media (prefers-reduced-motion:reduce){#banner *{animation-delay:0s!important;animation-duration:1ms!important;animation-iteration-count:1!important}}',
      '</style>',
      '</head>',
      '<body>',
      ch.root,
      markup.join('\n'),
      border,
      ch.rootClose,
      opts.preview ? previewControls(tl.playLen) : '',
      '</body>',
      '</html>'
    ].join('\n');

    files.unshift({ name: 'index.html', data: html });
    ch.files.forEach(function (f) { files.push(f); });
    return { html: html, files: files, total: tl.total, playLen: tl.playLen };
  }

  // ---------------------------------------------------------------------------
  // Minimal ZIP writer (STORE — images are already compressed).
  // ---------------------------------------------------------------------------
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function makeZip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;

    files.forEach(function (f) {
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const name = enc.encode(f.name);
      const crc = crc32(data);

      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(10, time, true);
      lv.setUint16(12, date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      local.set(name, 30);

      const cen = new Uint8Array(46 + name.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      cen.set(name, 46);

      parts.push(local, data);
      central.push(cen);
      offset += local.length + data.length;
    });

    const cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    const all = parts.concat(central, [end]);
    const out = new Uint8Array(all.reduce(function (s, p) { return s + p.length; }, 0));
    let pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  return {
    EASINGS: EASINGS,
    EASE_LABELS: EASE_LABELS,
    IN_PRESETS: IN_PRESETS,
    OUT_PRESETS: OUT_PRESETS,
    LOOP_EFFECTS: LOOP_EFFECTS,
    MOTION_PRESETS: MOTION_PRESETS,
    CHANNELS: CHANNELS,
    MIME: MIME,
    timeline: timeline,
    sceneStarts: sceneStarts,
    compileElement: compileElement,
    buildBanner: buildBanner,
    makeZip: makeZip,
    escapeHtml: escapeHtml,
    slug: slug
  };
});
