/* Banner Automation — plugin UI.
 * Three steps: 1 Layers (pick what goes in the banner) → 2 Animate → 3 Export.
 * Shared pieces (RPC, icons, layer tree, images, zip, tooltips, shortcuts) come from core. */
(function () {
  'use strict';

  const G = require('./generator');
  const Steps = require('./steps');
  const Zip = require('../../core/zip');
  const { escapeHtml: esc } = require('../../core/text');
  const { createRpc } = require('../../core/ui/rpc');
  const { clone, merge } = require('../../core/ui/state');
  const { icon, hydrateIcons } = require('../../core/ui/icons');
  const Layers = require('../../core/ui/layers');
  const Images = require('../../core/ui/images');
  const { $, download } = require('../../core/ui/dom');
  const { attachTooltips } = require('../../core/ui/tooltip');
  const { bindShortcuts } = require('../../core/ui/keys');
  const { typeIcon, options } = Layers;

  const rpc = createRpc(parent);
  const call = rpc.call;

  // -------------------------------------------------------------------------
  // Defaults & state
  // -------------------------------------------------------------------------
  function defaultScene(on) {
    return {
      on: !!on,
      in: { p: 'fade', d: 0, t: 0.5, e: 'ease-out', dist: 30 },
      out: { p: 'fade', d: -0.5, t: 0.5, e: 'ease-in', dist: 30 },
      loop: { p: 'none', t: 0.6, d: 0, r: 2 },
      motion: { p: 'none', x: 0, y: 0, s: 1.1, r: 0, d: 0, e: 'linear' }
    };
  }

  function newSession() {
    return { v: 1, scenes: [{ dur: 4 }, { dur: 6 }], plays: 1, endOnLast: true, elements: [], exportOpts: {} };
  }

  function defaultPackage() {
    return { border: true, borderColor: '#000000', compress: true, channel: '', exits: [{ name: 'Main exit', url: '' }], exclude: {} };
  }

  function normalizeSession(raw) {
    const s = merge(newSession(), raw);
    if (!Array.isArray(s.scenes) || !s.scenes.length) s.scenes = [{ dur: 4 }];
    s.elements = (s.elements || []).map((el) => {
      const e = merge({ id: '', name: '', type: '', exit: -1, clip: true, maskId: null, maskName: null, scenes: [] }, el);
      e.scenes = s.scenes.map((_, i) => merge(defaultScene(false), e.scenes[i]));
      return e;
    });
    return s;
  }

  const S = {
    banners: [],
    ctx: null,
    loading: false,        // reading the layer tree
    treeError: null,
    previewError: null,
    exporting: false,      // exporting layer images for the preview
    pkg: defaultPackage(),
    zipSizes: {},
    step: 'layers',
    scene: 0,
    open: null,            // element whose editor is expanded
    selEls: new Set(),     // selected elements (Animate)
    selNodes: new Set(),   // selected layers (Layers)
    anchor: null,
    extraTab: 'loop',
    adv: false,
    follow: true,
    outline: false,
    expanded: {},
    search: '',
    showFilters: false,
    filter: { kind: 'all', inHtml: false, hidden: true },
    canvasSel: [],
    zoom: 'fit',
    playing: true,
    time: 0,
    playLen: 0,
    resume: null,
    ignoreTicksUntil: 0,
    scrubbing: false
  };

  const ctxs = {};

  function makeCtx(data, oldCache) {
    const idx = Layers.indexTree(data.tree);
    const ctx = {
      id: data.info.id,
      info: data.info,
      tree: data.tree,
      session: normalizeSession(data.session),
      index: idx.index,
      order: idx.order,
      cache: oldCache || { items: {}, masks: {}, bg: null, processed: {}, warnings: [], pending: null }
    };
    ctx.session.elements.forEach((el) => {
      const n = ctx.index[el.id];
      if (!n) return;
      el.name = n.name;
      el.type = n.type;
      el.maskId = n.maskId;
      el.maskName = n.maskName;
    });
    return ctx;
  }

  async function loadCtx(id, fresh) {
    if (!fresh && ctxs[id]) return ctxs[id];
    const data = await call('getBanner', { id });
    const old = ctxs[id];
    const ctx = makeCtx(data, old && old.cache);
    ctxs[id] = ctx;
    return ctx;
  }

  const sess = () => S.ctx && S.ctx.session;
  const elById = (id) => sess() && sess().elements.find((e) => e.id === id);
  const isAdded = (id) => !!sess() && sess().elements.some((e) => e.id === id);
  const expOf = (ctx, id) => Images.exportOptions(ctx.session.exportOpts[id]);
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  function addedDescendants(ctx, id) {
    return Layers.descendantsIn(ctx.index, id, new Set(ctx.session.elements.map((e) => e.id)));
  }

  // -------------------------------------------------------------------------
  // Persistence & messages
  // -------------------------------------------------------------------------
  let saveTimer = null;
  function persist() {
    const ctx = S.ctx;
    if (!ctx) return;
    const b = S.banners.find((x) => x.id === ctx.id);
    if (b) b.elements = ctx.session.elements.length;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => call('saveSession', { id: ctx.id, session: ctx.session }).catch(showError), 300);
    renderStepper();
  }

  let pkgTimer = null;
  function persistPkg() {
    clearTimeout(pkgTimer);
    pkgTimer = setTimeout(() => call('savePackage', { pkg: S.pkg }).catch(showError), 300);
    renderStepper();
  }

  let toastTimer = null;
  // A short message at the bottom. kind: '' | 'danger'. action: { label, act }.
  function toast(text, kind, action) {
    const t = $('toast');
    clearTimeout(toastTimer);
    t.className = kind || '';
    t.innerHTML = (kind === 'danger' ? icon('error') : '') + '<span>' + esc(text) + '</span>' +
      (action ? '<button class="link" data-act="' + action.act + '">' + esc(action.label) + '</button>' : '') +
      (kind === 'danger' ? '<button class="icon-btn" data-act="close-toast" data-tip="Dismiss" style="color:#fff">' + icon('close') + '</button>' : '');
    t.hidden = false;
    if (kind !== 'danger') toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  const setStatus = (text, warn) => toast(text, warn ? 'danger' : '');

  function showError(e) {
    toast(String(e && e.message || e), 'danger');
  }

  // -------------------------------------------------------------------------
  // Header: frame picker, stepper, more menu
  // -------------------------------------------------------------------------
  function status() {
    return Steps.stepStatus({
      ctx: S.ctx,
      pkg: S.pkg,
      included: includedBanners(),
      zipSizes: S.zipSizes,
      sizeLimit: G.sizeLimit
    });
  }

  function renderStepper() {
    const st = status();
    $('stepper').innerHTML = st.map((s, i) => {
      // Animate counts as done once it has been looked at (new layers get a default fade).
      if (s.id === 'animate' && !S.seenAnimate) s = Object.assign({}, s, { done: false });
      const errors = s.issues.filter((x) => x.level === 'error').length;
      const cls = 'step-tab' + (S.step === s.id ? ' current' : '') + (s.done ? ' done' : '');
      const tip = s.issues.length ? s.issues.map((x) => x.text).join(' · ') : s.done ? s.label + ' is complete' : '';
      const badge = s.issues.length ? '<span class="badge ' + (errors ? 'danger' : 'warning') + '">' + s.issues.length + '</span>' : '';
      return (i ? '<span class="step-sep"></span>' : '') +
        '<button class="' + cls + '" role="tab" aria-selected="' + (S.step === s.id) + '" data-act="go-' + s.id + '" data-key="' + s.n + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' +
        '<span class="num">' + (s.done && S.step !== s.id ? icon('check') : s.n) + '</span>' + s.label + badge + '</button>';
    }).join('');
  }

  function renderFrameButton() {
    const ctx = S.ctx;
    $('frameLabel').textContent = ctx ? ctx.info.width + '×' + ctx.info.height + ' · ' + ctx.info.name : S.banners.length ? 'Choose a frame' : 'No frames on this page';
  }

  function renderFrameMenu() {
    const cur = S.ctx && S.ctx.id;
    $('frameMenu').innerHTML = S.banners.length
      ? '<div class="menu-label">Frames on this page</div>' + S.banners.map((b) =>
        '<button data-act="pick-frame" data-id="' + esc(b.id) + '"><span class="check-mark">' + (b.id === cur ? icon('check') : '') + '</span>' +
        '<span class="size">' + b.width + '×' + b.height + '</span>' + esc(b.name) + (b.elements ? '<small>' + plural(b.elements, 'layer') + '</small>' : '') + '</button>').join('')
      : '<div class="menu-empty">This page has no frames. Draw a frame at a banner size (for example 300×250) and select it.</div>';
  }

  function renderMoreMenu() {
    $('moreMenu').innerHTML =
      '<button data-act="open-sync"' + (S.ctx ? '' : ' disabled') + '>Copy animation to other sizes…</button>' +
      '<button data-act="refresh"' + (S.ctx ? '' : ' disabled') + '>Re-export layers from Figma</button>' +
      '<hr>' +
      '<button data-act="save-session"' + (S.ctx ? '' : ' disabled') + '>Save snapshot</button>' +
      '<button data-act="restore-session"' + (S.ctx ? '' : ' disabled') + '>Restore last snapshot</button>' +
      '<hr>' +
      '<button data-act="toggle-follow"><span class="check-mark">' + (S.follow ? icon('check') : '') + '</span>Follow canvas selection</button>' +
      '<button data-act="open-keys">Keyboard shortcuts<small>?</small></button>';
  }

  function closeMenus(except) {
    ['frameMenu', 'moreMenu'].forEach((id) => { if (id !== except) $(id).hidden = true; });
    $('frameBtn').classList.toggle('open', except === 'frameMenu' && !$('frameMenu').hidden);
  }

  function goStep(id) {
    S.step = id;
    if (id !== 'layers' && S.ctx) S.seenAnimate = true;
    ['layers', 'animate', 'export'].forEach((k) => { $('step-' + k).hidden = k !== id; });
    renderStepper();
    if (id === 'layers') { renderTree(); renderInspector(); }
    if (id === 'animate') { renderTimeline(); renderElements(); }
    if (id === 'export') { renderExport(); scheduleMeasure(0); }
  }

  // -------------------------------------------------------------------------
  // Step 1 · Layers
  // -------------------------------------------------------------------------
  function frameChoices() {
    return '<div class="frame-choices">' + S.banners.map((b) =>
      '<button class="frame-choice" data-act="pick-frame" data-id="' + esc(b.id) + '"><span class="size">' + b.width + '×' + b.height + '</span><span class="name">' + esc(b.name) + '</span>' +
      (b.elements ? '<span class="muted">' + plural(b.elements, 'layer') + '</span>' : '') + '</button>').join('') + '</div>';
  }

  function emptyState(ic, title, text, extra) {
    return '<div class="empty">' + icon(ic).replace('class="ic"', 'class="ic ic-lg"') + '<h4>' + esc(title) + '</h4>' + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div>';
  }

  function renderTree() {
    const box = $('tree');
    const ctx = S.ctx;
    $('layersCount').textContent = ctx ? plural(ctx.session.elements.length, 'layer') + ' in banner' : '';
    const next = document.querySelector('#step-layers [data-act="go-animate"]');
    next.disabled = !ctx || !ctx.session.elements.length;
    if (next.disabled) next.dataset.tip = ctx ? 'Add at least one layer first' : 'Choose a banner frame first'; else delete next.dataset.tip;
    if (S.loading) {
      box.innerHTML = '<div class="skeleton-rows">' + [70, 55, 80, 45, 65, 50].map((w) => '<div class="skeleton" style="width:' + w + '%"></div>').join('') + '</div>';
      return;
    }
    if (S.treeError) {
      box.innerHTML = emptyState('error', 'Couldn’t read the layers', esc(S.treeError), '<button class="btn" data-act="refresh">Try again</button>');
      return;
    }
    if (!ctx) {
      box.innerHTML = S.banners.length
        ? emptyState('cursor', 'Choose a banner frame', 'Select a frame on the canvas, or pick one here.', frameChoices())
        : emptyState('frame', 'No frames on this page', 'Draw a frame at a banner size, for example 300×250, then select it.');
      return;
    }
    if (!ctx.tree.length) {
      box.innerHTML = emptyState('frame', 'This frame is empty', 'Add artwork to “' + esc(ctx.info.name) + '” in Figma, then re-export the layers.', '<button class="btn" data-act="refresh">Re-export layers</button>');
      return;
    }
    const rows = Layers.visibleRows(ctx.tree, ctx.order, S, isAdded);
    if (!rows.length) {
      box.innerHTML = emptyState('search', 'No layers match', S.search ? 'Nothing is called “' + esc(S.search) + '”.' : 'No layers match these filters.', '<button class="btn" data-act="clear-filters">Clear search and filters</button>');
      return;
    }
    box.innerHTML = rows.map((row) => {
      const n = row.n;
      const el = elById(n.id);
      return Layers.layerRow(row, {
        added: !!el,
        addedLabel: 'In banner',
        selected: S.selNodes.has(n.id),
        expanded: !!S.expanded[n.id],
        canvasSel: S.canvasSel.indexOf(n.id) !== -1,
        clip: el && n.maskId ? { on: el.clip, maskName: n.maskName } : null
      });
    }).join('');
  }

  function renderFilters() {
    const f = $('filters');
    f.hidden = !S.showFilters;
    $('filtersBtn').classList.toggle('on', S.showFilters || S.filter.kind !== 'all' || S.filter.inHtml || !S.filter.hidden);
    if (S.showFilters) f.innerHTML = Layers.filterControls(S.filter, 'banner');
  }

  function exportFields(id) {
    const x = expOf(S.ctx, id);
    return '<div class="grid3">' +
      field('Crop', '<select data-xf="mode" data-tip="Framed crops to the banner. Full keeps the whole layer, for layers that move in from outside.">' + options({ framed: 'Framed', full: 'Full' }, x.mode) + '</select>') +
      field('Scale', '<select data-xf="scale">' + options({ 1: '1x', 2: '2x', 3: '3x' }, x.scale) + '</select>') +
      field('Format', '<select data-xf="format">' + options({ png: 'PNG', jpg: 'JPG', svg: 'SVG' }, x.format) + '</select>') +
    '</div>';
  }

  // Details of the selected layer(s) under the tree.
  function renderInspector() {
    const box = $('inspector');
    const ctx = S.ctx;
    const ids = ctx ? Array.from(S.selNodes).filter((id) => ctx.index[id]) : [];
    if (!ids.length) { box.innerHTML = ''; return; }
    if (ids.length > 1) {
      const addable = ids.filter((id) => !isAdded(id) && !Layers.unsupportedReason(ctx.index[id]));
      const removable = ids.filter(isAdded);
      box.innerHTML = '<div class="section"><div class="insp-title"><span class="name">' + plural(ids.length, 'layer') + ' selected</span></div><div class="grid2">' +
        '<button class="btn primary" data-act="bulk-add"' + (addable.length ? '' : ' disabled') + '>Add ' + addable.length + ' to banner</button>' +
        '<button class="btn" data-act="bulk-remove"' + (removable.length ? '' : ' disabled') + '>Remove ' + removable.length + '</button></div></div>';
      return;
    }
    const n = ctx.index[ids[0]];
    const el = elById(n.id);
    const reason = Layers.unsupportedReason(n);
    let body;
    if (reason) {
      body = '<div class="callout">' + icon('info') + '<span>' + esc(reason) + '. It can’t be added to the banner.</span></div>';
    } else if (!el) {
      body = '<button class="btn primary lg" data-act="add-node" style="width:100%">' + icon('plus') + 'Add to banner</button>' +
        (!n.visible ? '<div class="muted">Hidden in Figma — it will be shown in the banner.</div>' : '');
    } else {
      body = exportFields(n.id) +
        (n.maskId ? '<label class="check"><input type="checkbox" data-ef="clip"' + (el.clip ? ' checked' : '') + '>Clip to mask “' + esc(n.maskName || '') + '”</label>' : '') +
        '<div class="grid2"><button class="btn" data-act="animate-this">Animate</button><button class="btn" data-act="remove-node">Remove from banner</button></div>';
    }
    box.innerHTML = '<div class="section" data-node="' + esc(n.id) + '"><div class="insp-title"><span class="type">' + icon(typeIcon(n)) + '</span><span class="name">' + esc(n.name) + '</span>' +
      '<span class="muted num">' + n.w + '×' + n.h + '</span></div><div class="stack">' + body + '</div></div>';
  }

  function addElements(ids) {
    const ctx = S.ctx;
    if (!ctx) return;
    const added = [];
    const skipped = [];
    ids.forEach((id) => {
      const n = ctx.index[id];
      if (!n || isAdded(id)) return;
      if (Layers.unsupportedReason(n)) { skipped.push(n.name); return; }
      const el = {
        id: id, name: n.name, type: n.type, exit: -1,
        clip: !!n.maskId, maskId: n.maskId, maskName: n.maskName,
        scenes: ctx.session.scenes.map((_, i) => defaultScene(i === S.scene))
      };
      // Keep Figma's stacking order: the list runs front → back.
      const list = ctx.session.elements;
      let pos = list.findIndex((e) => (ctx.index[e.id] ? ctx.index[e.id].order : -1) < n.order);
      if (pos === -1) pos = list.length;
      list.splice(pos, 0, el);
      added.push(el);
    });
    if (skipped.length && !added.length) { toast('“' + skipped[0] + '” can’t be added: ' + Layers.unsupportedReason(ctx.index[ids[0]] || {}).toLowerCase() + '.', 'danger'); return; }
    if (!added.length) return;
    S.open = added[added.length - 1].id;
    persist();
    renderTree();
    renderInspector();
    schedulePreview();
    toast(added.length === 1 ? '“' + added[0].name + '” added to the banner.' : added.length + ' layers added to the banner.', '', { label: 'Animate', act: 'go-animate' });
  }

  function removeElements(ids) {
    const s = sess();
    if (!s) return;
    const before = s.elements.length;
    s.elements = s.elements.filter((e) => ids.indexOf(e.id) === -1);
    ids.forEach((id) => S.selEls.delete(id));
    if (ids.indexOf(S.open) !== -1) S.open = null;
    if (s.elements.length === before) return;
    persist();
    renderTree();
    renderInspector();
    renderElements();
    schedulePreview();
    toast(plural(before - s.elements.length, 'layer') + ' removed from the banner.');
  }

  // Click on a tree row: select it here and on the canvas (Shift = range, Cmd/Ctrl = toggle).
  function selectNode(id, e) {
    const ctx = S.ctx;
    if (!ctx) return;
    if (e && e.shiftKey && S.anchor) {
      const rows = Layers.visibleRows(ctx.tree, ctx.order, S, isAdded).map((r) => r.n.id);
      const a = rows.indexOf(S.anchor), b = rows.indexOf(id);
      if (a !== -1 && b !== -1) S.selNodes = new Set(rows.slice(Math.min(a, b), Math.max(a, b) + 1));
    } else if (e && (e.metaKey || e.ctrlKey)) {
      if (S.selNodes.has(id)) S.selNodes.delete(id); else S.selNodes.add(id);
      S.anchor = id;
    } else {
      S.selNodes = new Set([id]);
      S.anchor = id;
    }
    S.ignoreCanvasUntil = Date.now() + 400;
    call('select', { ids: Array.from(S.selNodes) }).catch(() => {});
    renderTree();
    renderInspector();
  }

  // -------------------------------------------------------------------------
  // Step 2 · Animate
  // -------------------------------------------------------------------------
  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function renderTimeline() {
    const s = sess();
    const box = $('timelineSection');
    if (!s) { box.innerHTML = ''; return; }
    const max = Math.max.apply(null, s.scenes.map((sc) => sc.dur));
    const len = G.timeline(s).playLen;
    box.innerHTML =
      '<div class="section-head"><h3>Frames</h3><span class="muted num">' + round1(len) + ' s' + (s.plays > 1 ? ' × ' + s.plays : s.plays === 0 ? ', loops' : '') + '</span>' +
        '<button class="icon-btn" data-act="scene-add" data-tip="Add frame">' + icon('plus') + '</button></div>' +
      '<div class="frames">' + s.scenes.map((sc, i) =>
        '<div class="frame-row' + (i === S.scene ? ' cur' : '') + '" data-act="pick-scene" data-i="' + i + '">' +
          '<span class="fname">F' + (i + 1) + '</span><span class="bar"><i style="width:' + Math.round(sc.dur / max * 100) + '%"></i></span>' +
          '<span class="unit" data-unit="s"><input type="number" min="0.5" step="0.5" data-scene-dur="' + i + '" value="' + sc.dur + '" aria-label="Duration of F' + (i + 1) + ' in seconds"></span>' +
          '<button class="icon-btn secondary" data-act="scene-remove" data-i="' + i + '" data-tip="Remove F' + (i + 1) + '"' + (s.scenes.length < 2 ? ' disabled' : '') + '>' + icon('minus') + '</button>' +
        '</div>').join('') + '</div>' +
      '<div class="timeline-opts">' +
        '<label data-tip="How many times the banner plays">Plays <select id="playsSelect">' + options({ 1: '1×', 2: '2×', 3: '3×', 0: 'Loop' }, s.plays) + '</select></label>' +
        '<label class="check" data-tip="On the last play, the last frame stays on screen instead of playing its exits"><input type="checkbox" id="endOnLast"' + (s.endOnLast !== false ? ' checked' : '') + (s.plays === 0 ? ' disabled' : '') + '>End on last frame</label>' +
      '</div>';
    S.playLen = len;
    renderScenes();
  }

  // Scene markers on the scrubber and the frame label in the transport bar.
  function renderScenes() {
    const s = sess();
    $('sceneLabel').textContent = 'F' + (S.scene + 1);
    $('sceneMarks').innerHTML = s ? s.scenes.map((sc, i) => '<i class="' + (i === S.scene ? 'cur' : '') + '" style="flex:' + sc.dur + '"></i>').join('') : '';
    $('scrubber').max = String(S.playLen || 0);
    updateTransport();
  }

  function updateTransport() {
    const live = !!S.ctx && !$('frameBox').hidden;
    document.querySelectorAll('.transport button, #scrubber').forEach((b) => { b.disabled = !live; });
    $('playBtn').innerHTML = icon(S.playing ? 'pause' : 'play');
    $('playBtn').dataset.tip = S.playing ? 'Pause' : 'Play';
    const t = S.playLen ? Math.min(S.time % (S.playLen + 1e-9), S.playLen) : 0;
    if (!S.scrubbing) $('scrubber').value = String(t);
    $('timeLabel').textContent = t.toFixed(1) + ' / ' + round1(S.playLen || 0).toFixed(1) + ' s';
    $('outlineBtn').classList.toggle('on', S.outline);
    $('outlineBtn').dataset.tip = S.outline ? 'Hide layer outlines' : 'Show layer outlines';
  }

  function sceneStart(i) {
    return G.sceneStarts(sess())[i] || 0;
  }

  function selectScene(i, seek) {
    const s = sess();
    if (!s) return;
    S.scene = Math.max(0, Math.min(s.scenes.length - 1, i));
    if (seek) {
      S.time = sceneStart(S.scene) + s.scenes[S.scene].dur * 0.6;
      S.playing = false;
      sendPreview({ bannerCmd: 'seek', t: S.time });
    }
    if (S.step === 'animate') { renderTimeline(); renderElements(); } else renderScenes();
  }

  function exitLabel(i) {
    const x = S.pkg.exits[i];
    return x ? (x.name || 'Exit ' + (i + 1)) : 'Main exit';
  }

  function renderElements() {
    const box = $('elements');
    const s = sess();
    $('elsHint').textContent = s && s.elements.length ? 'Front to back' : '';
    if (!s) { box.innerHTML = emptyState('cursor', 'Choose a banner frame', 'Pick a frame in the header to animate it.'); renderBulkEls(); return; }
    if (!s.elements.length) {
      box.innerHTML = emptyState('image', 'No layers in the banner yet', 'Add the layers you want to animate in step 1.', '<button class="btn" data-act="go-layers">Go to Layers</button>');
      renderBulkEls();
      return;
    }
    box.innerHTML = s.elements.map(elementCard).join('');
    renderBulkEls();
  }

  function elementCard(el) {
    const sc = el.scenes[S.scene];
    const n = S.ctx.index[el.id];
    const open = S.open === el.id;
    const cls = 'el' + (open ? ' open' : '') + (S.selEls.has(el.id) ? ' selected' : '') + (sc.on ? '' : ' off-scene') + (n ? '' : ' missing');
    return '<div class="' + cls + '" data-id="' + esc(el.id) + '">' +
      '<div class="el-head" data-act="select-el">' +
        '<div class="order"><button data-act="el-up" data-tip="Bring forward">' + icon('chevron-up') + '</button><button data-act="el-down" data-tip="Send backward">' + icon('chevron-down') + '</button></div>' +
        '<span class="type">' + icon(n ? typeIcon(n) : 'warning') + '</span>' +
        '<span class="name">' + esc(el.name) + (n ? '' : '<small>deleted in Figma</small>') + (sc.on && !open ? '<small>' + esc(shortSummary(el)) + '</small>' : '') + '</span>' +
        '<span class="dots" data-tip="Frames it appears in">' + el.scenes.map((x, i) => '<i class="' + (x.on ? 'on' : '') + (i === S.scene ? ' cur' : '') + '"></i>').join('') + '</span>' +
        (el.exit >= 0 ? '<span class="type" data-tip="Clicks open “' + esc(exitLabel(el.exit)) + '”">' + icon('link') + '</span>' : '') +
        '<button class="icon-btn secondary on-hover" data-act="remove-el" data-tip="Remove from banner">' + icon('trash') + '</button>' +
        '<button class="icon-btn secondary" data-act="toggle-el" data-tip="' + (open ? 'Collapse' : 'Edit animation') + '">' + icon(open ? 'chevron-up' : 'chevron-down') + '</button>' +
      '</div>' +
      (open ? '<div class="el-body">' + elementBody(el) + '</div>' : '') +
    '</div>';
  }

  function unitInput(fieldName, value, step, unit, min, label) {
    return '<span class="unit" data-unit="' + unit + '"><input type="number" step="' + step + '"' + (min !== undefined ? ' min="' + min + '"' : '') + ' data-f="' + fieldName + '" value="' + value + '" aria-label="' + esc(label || fieldName) + '"></span>';
  }

  function field(label, control) {
    return '<label class="field"><span>' + label + '</span>' + control + '</label>';
  }

  function ioRow(kind, sc) {
    const p = sc[kind];
    const presets = kind === 'in' ? G.IN_PRESETS : G.OUT_PRESETS;
    return '<div class="sub"><div class="sub-head">' + icon(kind) + '<b>' + (kind === 'in' ? 'Entrance' : 'Exit') + '</b>' +
      (kind === 'out' ? '<span class="grow"></span><span data-tip="A negative delay starts the exit before the frame ends. −0.5 s with a 0.5 s duration ends exactly at the frame’s end.">' + icon('info') + '</span>' : '') + '</div>' +
      '<div class="io-row">' +
        field('Effect', '<select data-f="' + kind + '.p">' + options(presets, p.p) + '</select>') +
        field('Delay', unitInput(kind + '.d', p.d, 0.1, 's', kind === 'in' ? 0 : undefined, (kind === 'in' ? 'Entrance' : 'Exit') + ' delay')) +
        field('Duration', unitInput(kind + '.t', p.t, 0.1, 's', 0.05, (kind === 'in' ? 'Entrance' : 'Exit') + ' duration')) +
      '</div>' +
      (S.adv ? '<div class="grid2">' +
        field('Easing', '<select data-f="' + kind + '.e">' + options(G.EASE_LABELS, p.e) + '</select>') +
        field('Distance', unitInput(kind + '.dist', p.dist, 5, 'px', undefined, 'Distance')) + '</div>' : '') +
    '</div>';
  }

  function elementBody(el) {
    const s = sess();
    const sc = el.scenes[S.scene];
    const frames = '<div class="sub"><div class="sub-head"><b>Shown in</b></div><div class="frame-toggles">' + s.scenes.map((_, i) =>
      '<button class="frame-toggle' + (el.scenes[i].on ? ' on' : '') + (i === S.scene ? ' cur' : '') + '" data-act="toggle-scene" data-i="' + i + '" aria-pressed="' + el.scenes[i].on + '" data-tip="' +
      (el.scenes[i].on ? 'Shown' : 'Hidden') + ' in F' + (i + 1) + '. Click to ' + (el.scenes[i].on ? 'hide' : 'show') + '.">F' + (i + 1) + '</button>').join('') + '</div></div>';
    if (!sc.on) {
      return frames + '<div class="callout">' + icon('info') + '<span class="grow">Not shown in F' + (S.scene + 1) + ', the frame you’re editing.</span><button class="btn" data-act="toggle-scene" data-i="' + S.scene + '">Show in F' + (S.scene + 1) + '</button></div>';
    }
    let extra = '';
    if (S.extraTab === 'loop') {
      const on = sc.loop.p !== 'none';
      extra = '<div class="grid2">' +
        field('Effect', '<select data-f="loop.p">' + options(G.LOOP_EFFECTS, sc.loop.p) + '</select>') +
        (on ? field('Repeat', '<select data-f="loop.r">' + options({ 1: '1×', 2: '2×', 3: '3×', 4: '4×', 5: '5×', inf: 'Until exit' }, sc.loop.r) + '</select>') +
          field('Duration', unitInput('loop.t', sc.loop.t, 0.1, 's', 0.1, 'Loop duration')) +
          field('Delay', unitInput('loop.d', sc.loop.d, 0.1, 's', 0, 'Loop delay')) : '') + '</div>' +
        (on ? '' : '<div class="muted">Repeats an effect such as a pulse while the layer is on screen.</div>');
    } else if (S.extraTab === 'motion') {
      const on = sc.motion.p !== 'none';
      extra = '<div class="grid2">' +
        field('Motion', '<select data-f="motion.p">' + options(G.MOTION_PRESETS, sc.motion.p) + '</select>') +
        (on ? field('Delay', unitInput('motion.d', sc.motion.d, 0.1, 's', 0, 'Motion delay')) : '') +
        (on && S.adv ? field('Easing', '<select data-f="motion.e">' + options(G.EASE_LABELS, sc.motion.e) + '</select>') : '') + '</div>' +
        (sc.motion.p === 'custom' ? '<div class="grid2">' +
          field('Move X', unitInput('motion.x', sc.motion.x, 1, 'px', undefined, 'Move X')) +
          field('Move Y', unitInput('motion.y', sc.motion.y, 1, 'px', undefined, 'Move Y')) +
          field('Scale', unitInput('motion.s', sc.motion.s, 0.05, '×', undefined, 'Scale')) +
          field('Rotate', unitInput('motion.r', sc.motion.r, 1, '°', undefined, 'Rotate')) + '</div>' : '') +
        '<div class="muted">Runs while the layer is on screen, from entrance to exit.</div>';
    } else {
      const exits = { '-1': 'Main exit (whole banner)' };
      S.pkg.exits.forEach((e, i) => { if (i > 0) exits[i] = e.name || 'Exit ' + (i + 1); });
      extra = field('Click opens', '<select data-ef="exit">' + options(exits, el.exit <= 0 ? -1 : el.exit) + '</select>') +
        '<div class="muted">Add more exits in step 3.</div>' + exportFields(el.id) +
        (el.maskId ? '<label class="check"><input type="checkbox" data-ef="clip"' + (el.clip ? ' checked' : '') + '>Clip to mask “' + esc(el.maskName || '') + '”</label>' : '');
    }
    const dot = (on) => on ? ' •' : '';
    return frames + ioRow('in', sc) + ioRow('out', sc) +
      '<div class="sub"><div class="seg" role="tablist">' +
        '<button class="' + (S.extraTab === 'loop' ? 'on' : '') + '" data-act="tab" data-tab="loop">Loop' + dot(sc.loop.p !== 'none') + '</button>' +
        '<button class="' + (S.extraTab === 'motion' ? 'on' : '') + '" data-act="tab" data-tab="motion">Motion' + dot(sc.motion.p !== 'none') + '</button>' +
        '<button class="' + (S.extraTab === 'click' ? 'on' : '') + '" data-act="tab" data-tab="click">Click & export' + dot(el.exit > 0) + '</button>' +
      '</div>' + extra + '</div>' +
      '<button class="disclosure' + (S.adv ? '' : ' closed') + '" data-act="toggle-adv" aria-expanded="' + S.adv + '">' + icon('chevron-down') + 'Advanced: easing and distance</button>' +
      '<div class="summary" data-summary>' + esc(summary(el)) + '</div>';
  }

  function shortSummary(el) {
    const sc = el.scenes[S.scene];
    const parts = [];
    if (sc.in.p !== 'none') parts.push(G.IN_PRESETS[sc.in.p]);
    if (sc.loop.p !== 'none') parts.push(G.LOOP_EFFECTS[sc.loop.p].label);
    return parts.join(', ');
  }

  function summary(el) {
    const sc = el.scenes[S.scene];
    if (!sc.on) return '';
    const parts = ['F' + (S.scene + 1) + ': ' + G.IN_PRESETS[sc.in.p] + (sc.in.p !== 'none' ? ' ' + sc.in.t + ' s' : ''), G.OUT_PRESETS[sc.out.p] + (sc.out.p !== 'none' ? ' ' + sc.out.t + ' s' : '')];
    if (sc.loop.p !== 'none') parts.push(G.LOOP_EFFECTS[sc.loop.p].label + ' ' + (sc.loop.r === 'inf' ? 'until exit' : sc.loop.r + '×'));
    if (sc.motion.p !== 'none') parts.push(G.MOTION_PRESETS[sc.motion.p].label);
    if (el.exit > 0) parts.push('opens ' + exitLabel(el.exit));
    return parts.join(' · ');
  }

  function renderBulkEls() {
    const bar = $('bulkEls');
    const n = S.selEls.size;
    bar.hidden = n < 2;
    if (n < 2) return;
    const src = S.open && elById(S.open);
    bar.innerHTML = '<b>' + n + ' selected</b><span class="grow"></span>' +
      (src ? '<button class="btn" data-act="bulk-copy" data-tip="Copy entrance, exit, loop and motion of every frame">Copy animation of “' + esc(src.name) + '”</button>' : '') +
      '<button class="btn" data-act="bulk-delete">Remove</button>';
  }

  // Click on an element row: open it (Shift/Cmd/Ctrl adds to the selection instead).
  function selectElement(id, e) {
    if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      if (S.selEls.has(id)) S.selEls.delete(id); else S.selEls.add(id);
    } else {
      S.selEls = new Set([id]);
      S.open = S.open === id ? null : id;
      const n = S.ctx.index[id];
      if (n) { S.ignoreCanvasUntil = Date.now() + 400; call('select', { ids: [id] }).catch(() => {}); }
    }
    renderElements();
  }

  // -------------------------------------------------------------------------
  // Assets
  // -------------------------------------------------------------------------
  function itemKey(ctx, el) {
    const x = expOf(ctx, el.id);
    return [el.id, x.scale, x.format, addedDescendants(ctx, el.id).join(',')].join('|');
  }

  async function ensureAssets(ctx) {
    const c = ctx.cache;
    if (c.pending) {
      await c.pending.catch(() => {});
      return ensureAssets(ctx);
    }
    const items = [];
    const masks = [];
    const seenMasks = {};
    ctx.session.elements.forEach((el) => {
      if (!ctx.index[el.id] || !el.scenes.some((sc) => sc.on)) return;
      const x = expOf(ctx, el.id);
      const key = itemKey(ctx, el);
      if (!(key in c.items)) items.push({ id: el.id, key: key, scale: x.scale, format: x.format, hide: addedDescendants(ctx, el.id) });
      if (el.clip && el.maskId) {
        const mk = el.maskId + '|2';
        if (!(mk in c.masks) && !seenMasks[mk]) {
          seenMasks[mk] = true;
          masks.push({ id: el.maskId, key: mk, scale: 2 });
        }
      }
    });
    const needBg = !c.bg;
    if (!items.length && !masks.length && !needBg) return;
    if (ctx === S.ctx) { S.exporting = true; renderStage(); }
    c.pending = call('exportAssets', { id: ctx.id, items: items, masks: masks, background: needBg }).then((res) => {
      items.forEach((it) => { c.items[it.key] = res.items[it.key] || null; });
      masks.forEach((m) => { c.masks[m.key] = res.masks[m.key] || null; });
      if (needBg) c.bg = { background: res.background, radius: res.radius };
      c.warnings = res.warnings || [];
    });
    try {
      await c.pending;
    } finally {
      c.pending = null;
      if (ctx === S.ctx) S.exporting = false;
    }
  }

  async function assembleAssets(ctx, compress) {
    const c = ctx.cache;
    const frame = { W: ctx.info.width, H: ctx.info.height };
    const items = {};
    const masks = {};
    for (const el of ctx.session.elements) {
      const key = itemKey(ctx, el);
      const raw = c.items[key];
      if (!raw) continue;
      const x = expOf(ctx, el.id);
      const pk = key + '|' + x.mode + '|' + (compress ? 1 : 0);
      if (!c.processed[pk]) c.processed[pk] = Images.processImage(raw, x.mode === 'framed' ? frame : null, compress);
      const img = await c.processed[pk];
      if (img) items[el.id] = img;
      if (el.clip && el.maskId && c.masks[el.maskId + '|2']) masks[el.maskId] = c.masks[el.maskId + '|2'];
    }
    return {
      background: c.bg ? c.bg.background : { css: '#ffffff' },
      radius: c.bg ? c.bg.radius : 0,
      items: items,
      masks: masks,
      warnings: c.warnings || []
    };
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------
  let previewTimer = null;
  let previewToken = 0;

  function schedulePreview(delay) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, delay === undefined ? 160 : delay);
  }

  // The message over the preview area for every non-playing state.
  function renderStage() {
    const ctx = S.ctx;
    let msg = '';
    if (!ctx && !S.loading) {
      msg = S.banners.length
        ? emptyState('cursor', 'Select a banner frame', 'Select a frame on the canvas or choose one in the header.')
        : emptyState('frame', 'No frames on this page', 'Banners are frames at an ad size, for example 300×250.');
    } else if (S.previewError) {
      msg = '<div class="card">' + emptyState('error', 'Couldn’t export the layers', esc(S.previewError), '<button class="btn" data-act="retry-preview">Try again</button>') + '</div>';
    } else if (S.loading || (S.exporting && $('frameBox').hidden)) {
      msg = '<div class="empty"><div class="spinner"></div><p>' + (S.loading ? 'Reading layers…' : 'Exporting layers from Figma…') + '</p></div>';
    } else if (ctx && !ctx.session.elements.length) {
      msg = emptyState('image', 'Nothing to preview yet', 'Add layers to the banner in step 1. They appear here as you add them.');
    }
    $('stageMsg').innerHTML = msg;
    if (msg) $('frameBox').hidden = true;
    $('zoomBar').hidden = !!msg;
    updateTransport();
  }

  function layoutStage() {
    const ctx = S.ctx;
    if (!ctx) return;
    const stage = $('stage');
    const w = ctx.info.width, h = ctx.info.height;
    const fit = Math.min(2, (stage.clientWidth - 48) / w, (stage.clientHeight - 64) / h);
    const scale = S.zoom === 'fit' ? fit : S.zoom;
    const iframe = $('preview');
    iframe.width = w;
    iframe.height = h;
    iframe.style.transform = 'scale(' + scale + ')';
    $('frameBox').style.width = w * scale + 'px';
    $('frameBox').style.height = h * scale + 'px';
    $('zoomLabel').textContent = Math.round(scale * 100) + '%';
    S.currentScale = scale;
  }

  function sendPreview(msg) {
    const win = $('preview').contentWindow;
    if (win) win.postMessage(msg, '*');
  }

  async function updatePreview() {
    const ctx = S.ctx;
    const token = ++previewToken;
    if (!ctx) { renderStage(); return; }
    try {
      S.previewError = null;
      if (!ctx.session.elements.length) { renderStage(); return; }
      renderStage();
      await ensureAssets(ctx);
      if (token !== previewToken || ctx !== S.ctx) return;
      const assets = await assembleAssets(ctx, false);
      if (token !== previewToken || ctx !== S.ctx) return;
      const opts = { name: ctx.info.name, width: ctx.info.width, height: ctx.info.height, session: ctx.session, assets: assets, pkg: S.pkg };
      const out = G.buildBanner(Object.assign({ inline: true, preview: true, outline: S.outline }, opts));
      $('frameBox').hidden = false;
      renderStage();
      layoutStage();
      S.resume = { t: S.time, playing: S.playing };
      S.ignoreTicksUntil = Date.now() + 1e9;
      $('preview').srcdoc = out.html;
      if (assets.warnings && assets.warnings.length) toast(assets.warnings.join(' '), 'danger');
    } catch (e) {
      if (token !== previewToken) return;
      S.exporting = false;
      S.previewError = String(e && e.message || e);
      renderStage();
    }
  }

  function onPreviewLoaded() {
    const r = S.resume || { t: 0, playing: true };
    S.resume = null;
    sendPreview({ bannerCmd: 'outline', on: S.outline });
    if (r.playing) sendPreview({ bannerCmd: 'play', t: r.t });
    else sendPreview({ bannerCmd: 'seek', t: r.t });
    S.ignoreTicksUntil = Date.now() + 150;
  }

  function onPreviewTick(d) {
    if (Date.now() < S.ignoreTicksUntil || S.scrubbing) return;
    if (d.playing === null) return; // nothing animated yet
    S.time = d.t;
    S.playing = d.playing;
    updateTransport();
  }

  function togglePlay() {
    if (!S.ctx) return;
    if (S.playing) {
      S.playing = false;
      sendPreview({ bannerCmd: 'pause' });
    } else {
      const atEnd = S.time >= G.timeline(sess() || newSession()).total - 0.05;
      S.playing = true;
      sendPreview({ bannerCmd: 'play', t: atEnd ? 0 : S.time });
    }
    updateTransport();
  }

  // -------------------------------------------------------------------------
  // Banner switching
  // -------------------------------------------------------------------------
  async function openBanner(id, fresh) {
    if (!id) return;
    const switched = !S.ctx || S.ctx.id !== id;
    if (switched) {
      S.loading = true;
      S.treeError = null;
      renderTree();
      renderStage();
    }
    try {
      const ctx = await loadCtx(id, fresh !== false);
      S.ctx = ctx;
      S.loading = false;
      S.treeError = null;
      if (switched) {
        S.scene = 0;
        S.open = null;
        S.selNodes.clear();
        S.selEls.clear();
        S.time = 0;
        S.playing = true;
        S.zoom = 'fit';
        S.expanded = {};
        $('frameBox').hidden = true;
      }
      S.scene = Math.min(S.scene, ctx.session.scenes.length - 1);
      if (switched) S.seenAnimate = ctx.session.elements.length > 0;
      renderAll();
      schedulePreview(0);
    } catch (e) {
      S.loading = false;
      S.treeError = String(e && e.message || e);
      renderAll();
    }
  }

  function revealNode(id) {
    const ctx = S.ctx;
    const n = ctx && ctx.index[id];
    if (!n) return;
    for (let p = n.parent; p; p = p.parent) S.expanded[p.id] = true;
    renderTree();
    const row = document.querySelector('.layer[data-node="' + CSS.escape(id) + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  function onCanvasSelection(m) {
    S.canvasSel = m.ids || [];
    if (Date.now() < (S.ignoreCanvasUntil || 0)) { renderTree(); return; }
    if (S.follow && m.bannerId && (!S.ctx || S.ctx.id !== m.bannerId)) {
      openBanner(m.bannerId);
      return;
    }
    if (S.follow && S.ctx && S.canvasSel.length && S.ctx.index[S.canvasSel[0]]) {
      S.selNodes = new Set(S.canvasSel.filter((id) => S.ctx.index[id]));
      S.anchor = S.canvasSel[0];
      revealNode(S.canvasSel[0]);
      renderInspector();
    } else renderTree();
  }

  function renderAll() {
    renderFrameButton();
    renderStepper();
    renderFilters();
    renderStage();
    goStep(S.step);
    renderScenes();
  }

  // -------------------------------------------------------------------------
  // Step 3 · Export
  // -------------------------------------------------------------------------
  function packageBanners() {
    return S.banners.filter((b) => b.elements > 0);
  }

  function includedBanners() {
    return packageBanners().filter((b) => !S.pkg.exclude[b.id]);
  }

  function kb(bytes) {
    return (Math.round(bytes / 100) / 10).toFixed(1) + ' KB'; // 1 KB = 1000 bytes
  }

  function zipSizeHtml(b) {
    const z = S.zipSizes[b.id];
    const limit = G.sizeLimit(b.width, b.height);
    const lim = kb(limit).replace('.0 KB', ' KB');
    if (S.pkg.exclude[b.id]) return '<span class="zip-size muted" data-zipsize="' + esc(b.id) + '">Not included</span>';
    if (z && z.error) return '<span class="zip-size over" data-zipsize="' + esc(b.id) + '" data-tip="' + esc(z.error) + '">' + icon('error') + 'Export failed</span>';
    if (z && z.bytes) {
      const over = z.bytes > limit;
      return '<span class="zip-size ' + (over ? 'over' : 'ok') + '" data-zipsize="' + esc(b.id) + '" data-tip="Zipped size' + (S.pkg.compress ? ', images compressed' : '') + '. Limit ' + lim + '.">' +
        (over ? icon('warning') : '') + kb(z.bytes) + ' / ' + lim + '</span>';
    }
    return '<span class="zip-size muted" data-zipsize="' + esc(b.id) + '"><span class="spinner"></span>Measuring…</span>';
  }

  // What still needs attention before downloading, with a Fix link for each item.
  function checklistHtml() {
    const issues = Steps.allIssues(status());
    const errors = issues.filter((i) => i.level === 'error');
    const n = includedBanners().length;
    const ch = G.CHANNELS[S.pkg.channel];
    return issues.length
      ? '<div class="callout ' + (errors.length ? 'danger' : 'warning') + '">' + icon(errors.length ? 'error' : 'warning') + '<div class="grow"><div class="strong" style="margin-bottom:4px">' +
        (errors.length ? 'Before you can download' : 'Check before you download') + '</div><ul class="checklist">' +
        issues.map((i) => '<li class="' + i.level + '">' + icon(i.level === 'error' ? 'error' : 'warning') + '<span>' + esc(i.text) + '</span>' +
          (i.fix ? '<button class="link" data-act="' + esc(i.fix) + '">Fix</button>' : '') + '</li>').join('') + '</ul></div></div>'
      : '<div class="callout success">' + icon('check-circle') + '<span>Ready: ' + plural(n, 'banner') + ' for ' + esc(ch ? ch.label : '') + '.</span></div>';
  }

  function renderExport() {
    const p = S.pkg;
    const sizes = packageBanners();
    const ch = G.CHANNELS[p.channel];
    const visibleChannels = {};
    Object.keys(G.CHANNELS).forEach((k) => { if (!G.CHANNELS[k].hidden || k === p.channel) visibleChannels[k] = G.CHANNELS[k]; });

    $('exportBody').innerHTML =
      '<div class="section" id="checkSection">' + checklistHtml() + '</div>' +
      '<div class="section" id="channelSection"><div class="section-head"><h3>Channel</h3></div>' +
        '<select id="channelSelect" style="width:100%" aria-label="Channel"><option value=""' + (p.channel ? '' : ' selected') + ' disabled>Choose where the banners will run…</option>' +
        Object.keys(visibleChannels).map((k) => '<option value="' + k + '"' + (p.channel === k ? ' selected' : '') + '>' + esc(G.CHANNELS[k].label) + '</option>').join('') + '</select>' +
        (ch ? '<div class="channel-desc">' + esc(ch.desc) + '</div>' : '') + '</div>' +
      '<div class="section" id="exitsSection"><div class="section-head"><h3>Click-through</h3><button class="icon-btn" data-act="add-exit" data-tip="Add an exit for a single layer">' + icon('plus') + '</button></div>' +
        p.exits.map((x, i) => {
          const bad = x.url && !Steps.validUrl(x.url);
          return '<div class="exit-row" data-exit="' + i + '"><div class="stack">' +
            (i === 0 ? '<span class="muted">Whole banner (main exit)</span>' : '<input type="text" class="name-input" data-exf="name" value="' + esc(x.name) + '" placeholder="Exit name" aria-label="Exit name">') +
            '<input type="url" data-exf="url" value="' + esc(x.url) + '" placeholder="https://www.example.com/landing-page" aria-label="' + (i === 0 ? 'Main click-through URL' : 'URL for ' + esc(x.name)) + '"' + (bad ? ' class="invalid"' : '') + '></div>' +
            (i === 0 ? '<span></span>' : '<button class="icon-btn secondary" data-act="remove-exit" data-tip="Remove exit">' + icon('minus') + '</button>') + '</div>';
        }).join('') +
        (p.exits.length > 1 ? '<div class="muted" style="margin-top:8px">Link a layer to an exit in Animate › Click & export.</div>' : '') + '</div>' +
      '<div class="section" id="sizesSection"><div class="section-head"><h3>Sizes</h3><span class="muted">Zipped size / limit</span></div><div class="sizes">' +
        (sizes.length
          ? sizes.map((b) => '<label class="size-row"><input type="checkbox" data-size="' + esc(b.id) + '"' + (p.exclude[b.id] ? '' : ' checked') + '>' +
              '<span class="dim">' + b.width + '×' + b.height + '</span><span class="name">' + esc(b.name) + '</span>' + zipSizeHtml(b) + '</label>').join('')
          : '<div class="muted">No frame on this page has layers in a banner yet.</div>') +
        '</div>' + (sizes.length < S.banners.length && S.ctx && S.ctx.session.elements.length ? '<button class="link" data-act="open-sync" style="margin-top:8px">Copy this animation to other sizes…</button>' : '') + '</div>' +
      '<div class="section"><div class="section-head"><h3>Options</h3></div><div class="stack">' +
        '<label class="check" data-tip="Re-encodes opaque images as JPG when that makes them smaller"><input type="checkbox" data-pf="compress"' + (p.compress ? ' checked' : '') + '>Compress images</label>' +
        '<div class="color-input"><label class="check"><input type="checkbox" data-pf="border"' + (p.border ? ' checked' : '') + '>1 px border</label><span class="grow"></span>' +
          '<input type="color" data-pf="borderColor" value="' + esc(p.borderColor) + '" aria-label="Border colour"' + (p.border ? '' : ' disabled') + '><input type="text" data-pf="borderColor" value="' + esc(p.borderColor) + '" aria-label="Border colour hex"' + (p.border ? '' : ' disabled') + '></div>' +
      '</div></div>';
    renderExportFoot();
  }

  function renderExportFoot() {
    const st = status();
    const errors = Steps.blockers(st);
    const n = includedBanners().length;
    const btn = $('downloadAllBtn');
    btn.disabled = !!errors.length || S.downloading;
    $('downloadLabel').textContent = S.downloading ? 'Packaging…' : n > 1 ? 'Download ' + n + ' banners' : 'Download banner';
    if (errors.length) btn.dataset.tip = errors[0].text; else delete btn.dataset.tip;
  }

  // Re-renders the export step without losing focus in a text field.
  function refreshExport() {
    renderStepper();
    if (S.step !== 'export') return;
    const active = document.activeElement;
    if (active && active.closest && active.closest('#exportBody') && active.tagName === 'INPUT' && active.type !== 'checkbox') {
      $('checkSection').innerHTML = checklistHtml();
      renderExportFoot();
      return;
    }
    renderExport();
  }

  function updateZipSizes() {
    packageBanners().forEach((b) => {
      const span = document.querySelector('[data-zipsize="' + CSS.escape(b.id) + '"]');
      if (span) span.outerHTML = zipSizeHtml(b);
    });
    refreshExport();
  }

  let measureTimer = null;
  let measureToken = 0;

  function scheduleMeasure(delay) {
    clearTimeout(measureTimer);
    if (S.step !== 'export') return;
    measureTimer = setTimeout(measurePackage, delay === undefined ? 400 : delay);
  }

  async function measurePackage() {
    const token = ++measureToken;
    S.zipSizes = {};
    updateZipSizes();
    for (const b of includedBanners()) {
      try {
        const r = await buildPackageBanner(b.id, false);
        const zip = await Zip.makeZip(r.out.files);
        if (token !== measureToken) return;
        S.zipSizes[b.id] = { bytes: zip.length };
      } catch (e) {
        if (token !== measureToken) return;
        S.zipSizes[b.id] = { error: String(e && e.message || e) };
      }
      updateZipSizes();
    }
  }

  async function buildPackageBanner(id, preview) {
    const ctx = id === (S.ctx && S.ctx.id) ? S.ctx : await loadCtx(id);
    await ensureAssets(ctx);
    const assets = await assembleAssets(ctx, preview ? false : S.pkg.compress);
    const out = G.buildBanner({
      name: ctx.info.name, width: ctx.info.width, height: ctx.info.height, session: ctx.session,
      assets: assets, pkg: S.pkg, channel: S.pkg.channel, inline: !!preview, preview: !!preview
    });
    return { ctx: ctx, out: out };
  }

  async function downloadAll() {
    const list = includedBanners();
    const channel = S.pkg.channel;
    if (!list.length || !channel || S.downloading) return;
    S.downloading = true;
    renderExportFoot();
    try {
      const zips = [];
      const over = [];
      for (const b of list) {
        $('downloadLabel').textContent = 'Packaging ' + b.width + '×' + b.height + '…';
        const r = await buildPackageBanner(b.id, false);
        const data = await Zip.makeZip(r.out.files);
        S.zipSizes[b.id] = { bytes: data.length };
        if (data.length > G.sizeLimit(b.width, b.height)) over.push(b.width + '×' + b.height + ' (' + kb(data.length) + ')');
        zips.push({ name: G.slug(r.ctx.info.name) + '_' + r.ctx.info.width + 'x' + r.ctx.info.height + '_' + channel + '.zip', data: data });
      }
      if (zips.length === 1) download(zips[0].data, zips[0].name);
      else download(await Zip.makeZip(zips, { store: true }), 'banners_' + channel + '.zip');
      call('notify', { text: 'Packaged ' + plural(zips.length, 'banner') + ' for ' + G.CHANNELS[channel].label });
      if (over.length) toast('Downloaded, but over the size limit: ' + over.join(', ') + '.', 'danger');
      else toast('Downloaded ' + plural(zips.length, 'banner') + '.');
    } catch (e) {
      toast('Export failed: ' + (e && e.message || e), 'danger', { label: 'Try again', act: 'download-all' });
    } finally {
      S.downloading = false;
      updateZipSizes();
    }
  }

  async function openPackagePreview() {
    const list = includedBanners();
    $('previewSheet').hidden = false;
    const body = $('previewBody');
    if (!list.length) {
      body.innerHTML = emptyState('image', 'Nothing to preview', 'Include at least one size in the export.');
      return;
    }
    body.innerHTML = '<div class="empty"><div class="spinner"></div><p>Building previews…</p></div>';
    const maxW = body.clientWidth - 40;
    const figures = [];
    for (const b of list) {
      try {
        const r = await buildPackageBanner(b.id, true);
        const w = r.ctx.info.width, h = r.ctx.info.height;
        const scale = Math.min(1, maxW / w);
        figures.push({ html: r.out.html, w: w, h: h, scale: scale, label: w + '×' + h + ' · ' + r.ctx.info.name });
      } catch (e) {
        figures.push({ error: e.message, label: b.width + '×' + b.height });
      }
    }
    body.innerHTML = figures.map((f, i) => f.error
      ? '<figure><div class="callout danger">' + icon('error') + '<span>' + esc(f.label) + ': ' + esc(f.error) + '</span></div></figure>'
      : '<figure><div style="width:' + f.w * f.scale + 'px;height:' + f.h * f.scale + 'px;box-shadow:0 0 0 1px var(--border)"><iframe data-pv="' + i + '" width="' + f.w + '" height="' + f.h + '" sandbox="allow-scripts" style="transform:scale(' + f.scale + ')"></iframe></div><figcaption>' + esc(f.label) + '</figcaption></figure>').join('');
    S.previewDocs = figures;
    body.querySelectorAll('iframe[data-pv]').forEach((fr) => { fr.srcdoc = figures[Number(fr.dataset.pv)].html; });
  }

  // -------------------------------------------------------------------------
  // Copy animation to other sizes (matched by layer name)
  // -------------------------------------------------------------------------
  function renderSync() {
    const others = S.banners.filter((b) => !S.ctx || b.id !== S.ctx.id);
    $('syncBody').innerHTML = others.length
      ? '<div class="size-list">' + others.map((b) => '<label class="check"><input type="checkbox" data-sync="' + esc(b.id) + '" checked><span class="strong num">' + b.width + '×' + b.height + '</span><span class="muted">' + esc(b.name) + (b.elements ? ' · has ' + plural(b.elements, 'layer') : '') + '</span></label>').join('') + '</div>'
      : emptyState('frame', 'No other sizes', 'Duplicate this frame and resize it to make another size.');
  }

  async function applySync() {
    const src = S.ctx;
    if (!src) return;
    const ids = Array.from(document.querySelectorAll('[data-sync]')).filter((c) => c.checked).map((c) => c.dataset.sync);
    let done = 0;
    const report = [];
    for (const id of ids) {
      try {
        const target = await loadCtx(id, true);
        const byName = {};
        target.order.forEach((n) => { if (!byName[n.name]) byName[n.name] = n; });
        const elements = [];
        const exportOpts = {};
        src.session.elements.forEach((el) => {
          const n = byName[el.name];
          if (!n) return;
          elements.push(Object.assign(clone(el), { id: n.id, type: n.type, maskId: n.maskId, maskName: n.maskName, clip: el.clip && !!n.maskId }));
          if (src.session.exportOpts[el.id]) exportOpts[n.id] = clone(src.session.exportOpts[el.id]);
        });
        const session = clone(src.session);
        session.elements = elements;
        session.exportOpts = exportOpts;
        target.session = normalizeSession(session);
        await call('saveSession', { id: id, session: target.session });
        const b = S.banners.find((x) => x.id === id);
        if (b) b.elements = elements.length;
        report.push(target.info.width + '×' + target.info.height + ' ' + elements.length + '/' + src.session.elements.length);
        done++;
      } catch (e) {
        report.push(id + ': ' + e.message);
      }
    }
    $('syncSheet').hidden = true;
    renderFrameMenu();
    refreshExport();
    scheduleMeasure(0);
    toast('Copied to ' + plural(done, 'size') + ' (layers matched: ' + report.join(', ') + ').');
  }

  // -------------------------------------------------------------------------
  // Shortcuts
  // -------------------------------------------------------------------------
  const SHORTCUTS = [
    ['Space', 'Play / pause'],
    ['←  →', 'Previous / next frame'],
    ['A', 'Add the layers selected on the canvas'],
    ['1  2  3', 'Go to Layers, Animate, Export'],
    ['O', 'Show / hide layer outlines'],
    ['+  −  0', 'Zoom in, out, to fit'],
    ['Esc', 'Close menus and dialogs'],
    ['?', 'Show this list']
  ];

  function renderKeys() {
    $('keysBody').innerHTML = '<div class="keys">' + SHORTCUTS.map((k) => '<span>' + esc(k[1]) + '</span><span>' + k[0].split(/\s{2,}/).map((x) => '<kbd>' + esc(x) + '</kbd>').join('') + '</span>').join('') + '</div>';
  }

  function closeTopLayer() {
    if (!$('frameMenu').hidden || !$('moreMenu').hidden) { closeMenus(); return true; }
    for (const id of ['keysSheet', 'syncSheet', 'previewSheet']) {
      if (!$(id).hidden) { ACTIONS[{ keysSheet: 'close-keys', syncSheet: 'close-sync', previewSheet: 'close-preview' }[id]](); return true; }
    }
    if (!$('toast').hidden) { $('toast').hidden = true; return true; }
    return false;
  }

  const dialogOpen = () => !$('keysSheet').hidden || !$('syncSheet').hidden || !$('previewSheet').hidden;

  bindShortcuts(document, {
    'Space': () => { if (dialogOpen()) return false; togglePlay(); },
    'ArrowLeft': () => { if (dialogOpen() || !sess()) return false; selectScene(S.scene - 1, true); },
    'ArrowRight': () => { if (dialogOpen() || !sess()) return false; selectScene(S.scene + 1, true); },
    'A': () => { if (dialogOpen()) return false; ACTIONS['add-selection'](); },
    '1': () => { if (dialogOpen()) return false; goStep('layers'); },
    '2': () => { if (dialogOpen()) return false; goStep('animate'); },
    '3': () => { if (dialogOpen()) return false; goStep('export'); },
    'O': () => { if (dialogOpen()) return false; ACTIONS['toggle-outline'](); },
    '+': () => ACTIONS['zoom-in'](),
    '=': () => ACTIONS['zoom-in'](),
    '-': () => ACTIONS['zoom-out'](),
    '0': () => ACTIONS['zoom-fit'](),
    '?': () => ACTIONS['open-keys'](),
    'Escape': () => closeTopLayer() ? undefined : false
  });

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  function nodeIdOf(t) {
    const host = t.closest('[data-node]') || t.closest('[data-id]');
    return host && (host.dataset.node || host.dataset.id);
  }

  function focusIn(sectionId, selector) {
    goStep('export');
    const sec = $(sectionId);
    if (!sec) return;
    sec.scrollIntoView({ block: 'nearest' });
    const el = sec.querySelector(selector);
    if (el) el.focus();
  }

  const ACTIONS = {
    // header
    'toggle-frames': () => { renderFrameMenu(); $('frameMenu').hidden = !$('frameMenu').hidden; closeMenus('frameMenu'); },
    'toggle-more': () => { renderMoreMenu(); $('moreMenu').hidden = !$('moreMenu').hidden; closeMenus('moreMenu'); },
    'pick-frame': (t) => { closeMenus(); openBanner(t.dataset.id); call('locate', { id: t.dataset.id }).catch(() => {}); },
    'choose-frame': () => { goStep('layers'); ACTIONS['toggle-frames'](); },
    'go-layers': () => goStep('layers'),
    'go-animate': () => goStep('animate'),
    'go-export': () => goStep('export'),
    'focus-channel': () => focusIn('channelSection', 'select'),
    'focus-exit': () => focusIn('exitsSection', 'input.invalid, input[type=url]'),
    'focus-sizes': () => focusIn('sizesSection', 'input'),
    'close-toast': () => { $('toast').hidden = true; },

    // layers
    'select-node': (t, e) => { if (!e.target.closest('button')) selectNode(nodeIdOf(t), e); },
    'toggle-node': (t) => { const id = nodeIdOf(t); S.expanded[id] = !S.expanded[id]; renderTree(); },
    'add-node': (t) => addElements([nodeIdOf(t)]),
    'remove-node': (t) => removeElements([nodeIdOf(t)]),
    'locate': (t) => call('locate', { id: nodeIdOf(t) }).catch(showError),
    'bulk-add': () => addElements(Array.from(S.selNodes)),
    'bulk-remove': () => removeElements(Array.from(S.selNodes)),
    'animate-this': (t) => { const id = nodeIdOf(t); S.open = id; S.selEls = new Set([id]); goStep('animate'); },
    'toggle-filters': () => { S.showFilters = !S.showFilters; renderFilters(); },
    'filter-kind': (t) => { S.filter.kind = t.dataset.kind; renderFilters(); renderTree(); },
    'clear-filters': () => { S.search = ''; $('search').value = ''; S.filter = { kind: 'all', inHtml: false, hidden: true }; renderFilters(); renderTree(); },
    'select-parent': () => call('selectParent').then((id) => { if (!id) toast('Nothing above this layer — it’s the frame itself.'); }, showError),
    'add-selection': () => {
      if (!S.ctx) { toast('Choose a banner frame first.', 'danger'); return; }
      const ids = S.canvasSel.filter((id) => S.ctx.index[id]);
      if (!ids.length) toast('Select layers of this banner on the canvas first, then press A.');
      else addElements(ids);
    },
    'toggle-follow': () => { S.follow = !S.follow; closeMenus(); toast(S.follow ? 'Following the canvas selection.' : 'No longer following the canvas selection.'); },
    'save-session': () => {
      closeMenus();
      if (!S.ctx) return;
      call('saveSnapshot', { id: S.ctx.id, session: S.ctx.session }).then(() => toast('Snapshot saved. Restore it from this menu.'), showError);
    },
    'restore-session': async () => {
      closeMenus();
      if (!S.ctx) return;
      try {
        const snap = await call('loadSnapshot', { id: S.ctx.id });
        if (!snap) { toast('No snapshot for this frame yet. Use “Save snapshot” first.'); return; }
        S.ctx.session = normalizeSession(snap.session);
        S.ctx.session.elements.forEach((el) => {
          const n = S.ctx.index[el.id];
          if (n) Object.assign(el, { name: n.name, type: n.type, maskId: n.maskId, maskName: n.maskName });
        });
        S.scene = 0;
        S.open = null;
        persist();
        renderAll();
        schedulePreview();
        toast('Restored the snapshot from ' + new Date(snap.at).toLocaleString() + '.');
      } catch (e) {
        showError(e);
      }
    },
    'refresh': async () => {
      closeMenus();
      const id = (S.ctx && S.ctx.id) || null;
      if (!id) return;
      S.ctx.cache = { items: {}, masks: {}, bg: null, processed: {}, warnings: [], pending: null };
      S.previewError = null;
      await openBanner(id, true);
      toast('Layers re-exported from Figma.');
    },
    'retry-preview': () => ACTIONS.refresh(),
    'open-sync': () => { closeMenus(); if (S.ctx) { renderSync(); $('syncSheet').hidden = false; } },
    'close-sync': () => { $('syncSheet').hidden = true; },
    'apply-sync': () => applySync(),
    'open-keys': () => { closeMenus(); renderKeys(); $('keysSheet').hidden = false; },
    'close-keys': () => { $('keysSheet').hidden = true; },

    // timeline & transport
    'pick-scene': (t, e) => { if (e.target.closest('input, button')) return; selectScene(Number(t.dataset.i), true); },
    'scene-add': () => {
      const s = sess();
      if (!s) return;
      s.scenes.push({ dur: 3 });
      s.elements.forEach((el) => el.scenes.push(defaultScene(false)));
      persist();
      selectScene(s.scenes.length - 1, true);
      schedulePreview();
      toast('F' + s.scenes.length + ' added. Choose which layers it shows under “Shown in”.');
    },
    'scene-remove': (t) => {
      const s = sess();
      if (!s || s.scenes.length < 2) return;
      const i = Number(t.dataset.i);
      s.scenes.splice(i, 1);
      s.elements.forEach((el) => el.scenes.splice(i, 1));
      persist();
      selectScene(Math.min(S.scene, s.scenes.length - 1), false);
      schedulePreview();
    },
    'scene-prev': () => selectScene(S.scene - 1, true),
    'scene-next': () => selectScene(S.scene + 1, true),
    'play': () => togglePlay(),
    'restart': () => { if (!S.ctx) return; S.playing = true; S.time = 0; sendPreview({ bannerCmd: 'play', t: 0 }); updateTransport(); },
    'toggle-outline': () => { S.outline = !S.outline; sendPreview({ bannerCmd: 'outline', on: S.outline }); updateTransport(); },
    'zoom-in': () => { S.zoom = Math.min(4, (S.currentScale || 1) * 1.25); layoutStage(); },
    'zoom-out': () => { S.zoom = Math.max(0.1, (S.currentScale || 1) / 1.25); layoutStage(); },
    'zoom-fit': () => { S.zoom = 'fit'; layoutStage(); },

    // elements
    'select-el': (t, e) => { if (e.target.closest('button')) return; selectElement(nodeIdOf(t), e); },
    'toggle-el': (t) => { const id = nodeIdOf(t); S.open = S.open === id ? null : id; S.selEls = new Set([id]); renderElements(); },
    'el-up': (t) => moveElement(nodeIdOf(t), -1),
    'el-down': (t) => moveElement(nodeIdOf(t), 1),
    'remove-el': (t) => removeElements([nodeIdOf(t)]),
    'toggle-scene': (t) => {
      const el = elById(nodeIdOf(t));
      const i = Number(t.dataset.i);
      if (!el) return;
      el.scenes[i].on = !el.scenes[i].on;
      persist();
      renderElements();
      schedulePreview();
    },
    'tab': (t) => { S.extraTab = t.dataset.tab; renderElements(); },
    'toggle-adv': () => { S.adv = !S.adv; try { localStorage.setItem('ba.adv', S.adv ? '1' : ''); } catch (e) { /* storage unavailable */ } renderElements(); },
    'bulk-copy': () => {
      const src = S.open && elById(S.open);
      if (!src) return;
      let n = 0;
      sess().elements.forEach((el) => { if (el !== src && S.selEls.has(el.id)) { el.scenes = clone(src.scenes); n++; } });
      persist();
      renderElements();
      schedulePreview();
      toast('Animation copied to ' + plural(n, 'layer') + '.');
    },
    'bulk-delete': () => removeElements(Array.from(S.selEls)),

    // export
    'add-exit': () => { S.pkg.exits.push({ name: 'Exit ' + (S.pkg.exits.length + 1), url: '' }); persistPkg(); renderExport(); },
    'remove-exit': (t) => {
      const i = Number(t.closest('[data-exit]').dataset.exit);
      S.pkg.exits.splice(i, 1);
      Object.values(ctxs).forEach((ctx) => ctx.session.elements.forEach((el) => {
        if (el.exit === i) el.exit = -1;
        else if (el.exit > i) el.exit--;
      }));
      persist();
      persistPkg();
      renderExport();
    },
    'package-preview': () => openPackagePreview(),
    'download-all': () => downloadAll(),
    'close-preview': () => { $('previewSheet').hidden = true; $('previewBody').innerHTML = ''; },
    'replay-all': () => {
      document.querySelectorAll('#previewBody iframe[data-pv]').forEach((fr) => { fr.srcdoc = S.previewDocs[Number(fr.dataset.pv)].html; });
    }
  };

  function moveElement(id, dir) {
    const list = sess().elements;
    const i = list.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= list.length) return;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    persist();
    renderElements();
    schedulePreview();
  }

  function setPath(obj, path, value) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'search') { S.search = t.value.trim(); renderTree(); return; }
    if (t.id === 'scrubber') {
      S.scrubbing = true;
      S.playing = false;
      S.time = Number(t.value);
      sendPreview({ bannerCmd: 'seek', t: S.time });
      updateTransport();
      return;
    }
    if (t.dataset.f) {
      const el = elById(nodeIdOf(t));
      if (!el) return;
      let v = t.value;
      if (t.type === 'number') {
        v = Number(v);
        if (t.value === '' || !isFinite(v)) return;
      } else if (t.dataset.f === 'loop.r' && v !== 'inf') {
        v = Number(v);
      }
      setPath(el.scenes[S.scene], t.dataset.f, v);
      persist();
      const sum = t.closest('.el').querySelector('[data-summary]');
      if (sum) sum.textContent = summary(el);
      schedulePreview(250);
      return;
    }
    if (t.dataset.sceneDur !== undefined) {
      const v = Number(t.value);
      if (!isFinite(v) || v < 0.1) return;
      sess().scenes[Number(t.dataset.sceneDur)].dur = v;
      S.playLen = G.timeline(sess()).playLen;
      renderScenes();
      persist();
      schedulePreview(300);
      return;
    }
    if (t.dataset.pf) {
      S.pkg[t.dataset.pf] = t.type === 'checkbox' ? t.checked : t.value;
      if (t.dataset.pf === 'borderColor') document.querySelectorAll('[data-pf="borderColor"]').forEach((o) => { if (o !== t) o.value = t.value; });
      if (t.dataset.pf === 'compress') Object.values(ctxs).forEach((c) => { c.cache.processed = {}; });
      persistPkg();
      schedulePreview(300);
      scheduleMeasure();
      return;
    }
    if (t.dataset.exf) {
      S.pkg.exits[Number(t.closest('[data-exit]').dataset.exit)][t.dataset.exf] = t.value;
      if (t.dataset.exf === 'url') t.classList.toggle('invalid', !!t.value && !Steps.validUrl(t.value));
      persistPkg();
      refreshExport();
      scheduleMeasure(800);
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.id === 'scrubber') { S.scrubbing = false; return; }
    if (t.id === 'playsSelect') { sess().plays = Number(t.value); persist(); renderTimeline(); schedulePreview(); return; }
    if (t.id === 'endOnLast') { sess().endOnLast = t.checked; persist(); schedulePreview(); return; }
    if (t.id === 'channelSelect') { S.pkg.channel = t.value; persistPkg(); renderExport(); schedulePreview(); scheduleMeasure(0); return; }
    if (t.dataset.f && t.tagName === 'SELECT') { renderElements(); return; }
    if (t.dataset.f && t.type === 'number' && t.value === '') { renderElements(); return; }
    if (t.dataset.sceneDur !== undefined) { renderTimeline(); return; }
    if (t.dataset.filter) { S.filter[t.dataset.filter] = t.checked; renderFilters(); renderTree(); return; }
    if (t.dataset.xf) {
      const id = nodeIdOf(t);
      const ctx = S.ctx;
      const x = expOf(ctx, id);
      x[t.dataset.xf] = t.dataset.xf === 'scale' ? Number(t.value) : t.value;
      ctx.session.exportOpts[id] = x;
      persist();
      if (isAdded(id)) schedulePreview();
      return;
    }
    if (t.dataset.ef) {
      const el = elById(nodeIdOf(t));
      if (!el) return;
      el[t.dataset.ef] = t.dataset.ef === 'clip' ? t.checked : Number(t.value);
      persist();
      renderTree();
      if (S.step === 'animate') renderElements();
      schedulePreview();
      return;
    }
    if (t.dataset.size) {
      if (t.checked) delete S.pkg.exclude[t.dataset.size];
      else S.pkg.exclude[t.dataset.size] = true;
      persistPkg();
      renderExport();
      scheduleMeasure(0);
      return;
    }
    if (t.dataset.pf === 'border') renderExport();
    if (t.dataset.exf === 'name') renderElements();
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.bannerPreview) {
      if (ev.source === $('preview').contentWindow) onPreviewTick(d);
      return;
    }
    const m = d.pluginMessage;
    if (!m) return;
    if (rpc.handle(m)) return;
    if (m.type === 'selection') {
      onCanvasSelection(m);
    } else if (m.type === 'banners') {
      S.banners = m.banners;
      renderFrameButton();
      if (!S.ctx) renderAll();
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!e.target.closest('.pop-anchor')) closeMenus();
    if (!t || t.disabled) return;
    const fn = ACTIONS[t.dataset.act];
    if (fn) fn(t, e);
  });
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  // Clicking the dimmed backdrop closes a dialog.
  document.querySelectorAll('.dialog-wrap').forEach((w) => w.addEventListener('mousedown', (e) => { if (e.target === w) closeTopLayer(); }));
  $('preview').addEventListener('load', onPreviewLoaded);
  window.addEventListener('resize', () => layoutStage());

  async function init() {
    hydrateIcons(document);
    attachTooltips(document);
    try { S.adv = localStorage.getItem('ba.adv') === '1'; } catch (e) { /* storage unavailable */ }
    S.loading = true;
    renderAll();
    try {
      const r = await call('init');
      S.banners = r.banners || [];
      S.pkg = merge(defaultPackage(), r.pkg);
      S.pkg.channel = G.channelId(S.pkg.channel);
      if (!S.pkg.exits.length) S.pkg.exits = defaultPackage().exits;
      S.canvasSel = r.selection || [];
      const configured = S.banners.find((b) => b.elements > 0);
      const id = r.current || (configured && configured.id);
      S.loading = false;
      if (id) {
        if (configured && configured.id === id) S.step = 'animate';
        await openBanner(id);
      } else renderAll();
    } catch (e) {
      S.loading = false;
      S.treeError = String(e && e.message || e);
      renderAll();
    }
  }

  init();
})();
