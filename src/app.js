/* Banner Automation — plugin UI. */
(function () {
  'use strict';

  const G = window.BannerGen;
  const esc = G.escapeHtml;
  const $ = (id) => document.getElementById(id);
  const clone = (v) => JSON.parse(JSON.stringify(v));

  // -------------------------------------------------------------------------
  // Icons (24px stroke icons)
  // -------------------------------------------------------------------------
  const ICONS = {
    'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
    'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    'select': '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M4 15v4a1 1 0 0 0 1 1h4"/><path d="M13 13l8 3-3.5 1.5L16 21z"/>',
    'history': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    'save': '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>',
    'search': '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    'filter': '<path d="M4 6h16M7 12h10M10 18h4"/>',
    'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    'package': '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    'layout': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M9 12h12"/>',
    'refresh': '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    'play': '<path d="M7 4l13 8-13 8z"/>',
    'pause': '<path d="M8 5v14M16 5v14"/>',
    'restart': '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 3v6h6"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'close': '<path d="M6 6l12 12M18 6L6 18"/>',
    'external': '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    'download': '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
    'files': '<path d="M9 3h7l4 4v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M16 3v4h4M5 7v13a1 1 0 0 0 1 1h9"/>',
    'locate': '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    'mask': '<path d="M9 4H5v16h4M15 4h4v16h-4M12 2v20"/>',
    'trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    'text': '<path d="M4 7V5h11v2M9.5 5v14M7.5 19h4M14 12v-1h7v1M17.5 11v8M16 19h3"/>',
    'frame': '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
    'group': '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    'image': '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/>',
    'shape': '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    'settings': '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    'loop': '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    'motion': '<path d="M3 17c3-7 6-7 9 0s6 7 9 0"/><path d="M18 6l3 0 0 3"/>',
    'star': '<path d="M12 3l2.8 6 6.2.6-4.8 4.2 1.4 6.2-5.6-3.2-5.6 3.2 1.4-6.2L3 9.6 9.2 9z"/>',
    'in': '<path d="M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/>',
    'out': '<path d="M15 17l5-5-5-5M20 12H8M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5"/>'
  };

  function icon(name) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach((i) => { i.outerHTML = icon(i.dataset.icon); });
  }

  // -------------------------------------------------------------------------
  // RPC with the Figma main thread
  // -------------------------------------------------------------------------
  let rpcSeq = 0;
  const waiting = {};

  function call(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++rpcSeq;
      waiting[id] = { resolve, reject };
      parent.postMessage({ pluginMessage: { type: 'call', id, method, params: params || {} } }, '*');
    });
  }

  // -------------------------------------------------------------------------
  // Defaults & state
  // -------------------------------------------------------------------------
  const DEFAULT_EXPORT = { mode: 'framed', scale: 2, format: 'png' };
  const VECTOR_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON', 'RECTANGLE'];
  const CONTAINER_TYPES = ['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'];

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

  function merge(def, val) {
    if (val === undefined || val === null) return clone(def);
    if (typeof def !== 'object' || def === null || Array.isArray(def)) return val;
    const out = {};
    Object.keys(def).forEach((k) => { out[k] = merge(def[k], val[k]); });
    Object.keys(val).forEach((k) => { if (!(k in out)) out[k] = val[k]; });
    return out;
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
    pkg: defaultPackage(),
    scene: 0,
    open: null,
    tab: 'loop',
    follow: true,
    outline: false,
    expanded: {},
    search: '',
    filter: { kind: 'all', inHtml: false, hidden: true },
    checkedNodes: new Set(),
    checkedEls: new Set(),
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
    const ctx = {
      id: data.info.id,
      info: data.info,
      tree: data.tree,
      session: normalizeSession(data.session),
      index: {},
      order: [],
      cache: oldCache || { items: {}, masks: {}, bg: null, processed: {}, warnings: [], pending: null }
    };
    const walk = (nodes, parentNode, depth) => nodes.forEach((n) => {
      n.parent = parentNode;
      n.depth = depth;
      n.order = ctx.order.length;
      ctx.order.push(n);
      ctx.index[n.id] = n;
      walk(n.children, n, depth + 1);
    });
    walk(ctx.tree, null, 0);
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
  const expOf = (ctx, id) => Object.assign({}, DEFAULT_EXPORT, ctx.session.exportOpts[id]);

  function addedDescendants(ctx, id) {
    const node = ctx.index[id];
    if (!node) return [];
    const ids = new Set(ctx.session.elements.map((e) => e.id));
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (ids.has(c.id)) out.push(c.id); walk(c); });
    walk(node);
    return out;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------
  let saveTimer = null;
  function persist() {
    const ctx = S.ctx;
    if (!ctx) return;
    const b = S.banners.find((x) => x.id === ctx.id);
    if (b) b.elements = ctx.session.elements.length;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => call('saveSession', { id: ctx.id, session: ctx.session }).catch(showError), 300);
  }

  let pkgTimer = null;
  function persistPkg() {
    clearTimeout(pkgTimer);
    pkgTimer = setTimeout(() => call('savePackage', { pkg: S.pkg }).catch(showError), 300);
  }

  function setStatus(text, warn) {
    const el = $('status');
    el.innerHTML = icon('info') + '<span>' + esc(text) + '</span>';
    el.style.color = warn ? 'var(--warn)' : '';
  }

  function showError(e) {
    setStatus('Error: ' + (e && e.message || e), true);
  }

  // -------------------------------------------------------------------------
  // Labels
  // -------------------------------------------------------------------------
  const TYPE_LABELS = {
    TEXT: 'Text', GROUP: 'Group', FRAME: 'Frame', COMPONENT: 'Component', INSTANCE: 'Instance',
    RECTANGLE: 'Rectangle', ELLIPSE: 'Ellipse', VECTOR: 'Vector', BOOLEAN_OPERATION: 'Boolean',
    STAR: 'Star', LINE: 'Line', POLYGON: 'Polygon', COMPONENT_SET: 'Variants'
  };

  function typeLabel(n) {
    return TYPE_LABELS[n.type] || (n.type.charAt(0) + n.type.slice(1).toLowerCase().replace(/_/g, ' '));
  }

  function typeIcon(n) {
    if (!n) return 'shape';
    if (n.type === 'TEXT') return 'text';
    if (n.img) return 'image';
    if (n.type === 'GROUP') return 'group';
    if (CONTAINER_TYPES.indexOf(n.type) !== -1) return 'frame';
    return 'shape';
  }

  function options(map, value) {
    return Object.keys(map).map((k) => {
      const label = typeof map[k] === 'string' ? map[k] : map[k].label;
      return '<option value="' + esc(k) + '"' + (String(k) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  // -------------------------------------------------------------------------
  // Left panel — layer tree
  // -------------------------------------------------------------------------
  function matchesFilter(n) {
    if (!S.filter.hidden && !n.visible) return false;
    if (S.filter.inHtml && !isAdded(n.id)) return false;
    const k = S.filter.kind;
    if (k === 'text' && n.type !== 'TEXT') return false;
    if (k === 'image' && !n.img) return false;
    if (k === 'vector' && (n.img || VECTOR_TYPES.indexOf(n.type) === -1)) return false;
    if (k === 'container' && CONTAINER_TYPES.indexOf(n.type) === -1) return false;
    if (S.search && n.name.toLowerCase().indexOf(S.search.toLowerCase()) === -1) return false;
    return true;
  }

  function renderTree() {
    const ctx = S.ctx;
    const box = $('tree');
    if (!ctx) {
      box.innerHTML = '<div class="empty">Select a banner frame in Figma (e.g. 300×250).<br>Its layers appear here — add the ones you want to animate.</div>';
      return;
    }
    const rows = [];
    const flat = !!S.search || S.filter.kind !== 'all' || S.filter.inHtml;
    if (flat) {
      ctx.order.forEach((n) => { if (matchesFilter(n)) rows.push({ n: n, depth: 0, flat: true }); });
    } else {
      const walk = (nodes) => nodes.forEach((n) => {
        if (!S.filter.hidden && !n.visible) return;
        rows.push({ n: n, depth: n.depth });
        if (S.expanded[n.id]) walk(n.children);
      });
      walk(ctx.tree);
    }
    box.innerHTML = rows.length ? rows.map(nodeCard).join('') : '<div class="empty">No layers match.</div>';
    renderBulkNodes();
  }

  function nodeCard(row) {
    const n = row.n;
    const ctx = S.ctx;
    const added = isAdded(n.id);
    const el = added ? elById(n.id) : null;
    const x = expOf(ctx, n.id);
    const hasKids = n.children.length && !row.flat;
    const meta = (added ? '<span class="ok">✓ In HTML</span> · ' : '') + n.w + ' × ' + n.h + ' · ' + typeLabel(n) +
      (n.isMask ? ' · mask' : '') + (!n.visible ? ' · <span class="hid">hidden</span>' : '') +
      (row.flat && n.parent ? ' · in ' + esc(n.parent.name) : '');
    return '<div class="node' + (added ? ' in-html' : '') + (S.canvasSel.indexOf(n.id) !== -1 ? ' canvas-sel' : '') + '" data-node="' + n.id + '" style="margin-left:' + Math.min(row.depth, 6) * 18 + 'px">' +
      '<div class="row">' +
        (hasKids ? '<button class="caret' + (S.expanded[n.id] ? '' : ' closed') + '" data-act="toggle-node" title="Expand">' + icon('chevron-down') + '</button>' : '<span class="caret-space"></span>') +
        '<input type="checkbox" class="cb" data-act="check-node"' + (S.checkedNodes.has(n.id) ? ' checked' : '') + '>' +
        '<span class="type-ic">' + icon(typeIcon(n)) + '</span>' +
        '<div class="info"><div class="name">' + esc(n.name) + '</div><div class="meta">' + meta + '</div></div>' +
        '<button class="icon-btn ghost sm" data-act="locate" title="Select in Figma">' + icon('locate') + '</button>' +
        '<button class="btn add-btn' + (added ? ' remove' : '') + '" data-act="' + (added ? 'remove-node' : 'add-node') + '">' + (added ? 'Remove' : '+ Add') + '</button>' +
      '</div>' +
      '<div class="row2">' +
        '<select data-xf="mode" title="Framed: crop to the banner · Full: keep the whole layer">' + options({ framed: 'Framed', full: 'Full' }, x.mode) + '</select>' +
        '<select data-xf="scale" title="Export scale">' + options({ 1: '1x', 2: '2x', 3: '3x' }, x.scale) + '</select>' +
        '<select data-xf="format" title="Image format">' + options({ png: 'PNG', jpg: 'JPG', svg: 'SVG' }, x.format) + '</select>' +
        '<span class="grow"></span>' +
        (el && n.maskId ? '<button class="icon-btn sm clip-btn' + (el.clip ? ' on' : '') + '" data-act="toggle-clip" title="Clip to mask “' + esc(n.maskName || '') + '”">' + icon('mask') + '</button>' : '') +
      '</div>' +
    '</div>';
  }

  function renderBulkNodes() {
    const bar = $('bulkNodes');
    const n = S.checkedNodes.size;
    bar.hidden = !n;
    if (!n) return;
    bar.innerHTML = '<b>' + n + ' selected</b><span class="grow"></span>' +
      '<button class="btn" data-act="bulk-add">+ Add</button><button class="btn" data-act="bulk-remove">Remove</button>' +
      '<button class="text-btn" data-act="bulk-clear-nodes">Clear</button>';
  }

  function renderFilters() {
    const f = $('filters');
    f.hidden = !S.showFilters;
    $('filtersBtn').classList.toggle('on', S.filter.kind !== 'all' || S.filter.inHtml || !S.filter.hidden);
    if (!S.showFilters) return;
    const kinds = { all: 'All', text: 'Text', image: 'Images', vector: 'Shapes', container: 'Groups & frames' };
    f.innerHTML = Object.keys(kinds).map((k) => '<button class="chip' + (S.filter.kind === k ? ' on' : '') + '" data-act="filter-kind" data-kind="' + k + '">' + kinds[k] + '</button>').join('') +
      '<span class="grow"></span>' +
      '<label class="inline-check"><input type="checkbox" data-filter="inHtml"' + (S.filter.inHtml ? ' checked' : '') + '>In HTML only</label>' +
      '<label class="inline-check"><input type="checkbox" data-filter="hidden"' + (S.filter.hidden ? ' checked' : '') + '>Show hidden</label>';
  }

  function addElements(ids) {
    const ctx = S.ctx;
    if (!ctx) return;
    const added = [];
    ids.forEach((id) => {
      const n = ctx.index[id];
      if (!n || isAdded(id)) return;
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
    if (!added.length) return;
    S.open = added[added.length - 1].id;
    persist();
    renderTree();
    renderElements();
    schedulePreview();
    setStatus(added.length === 1 ? '“' + added[0].name + '” added as ' + added[0].type + '.' : added.length + ' elements added.');
  }

  function removeElements(ids) {
    const s = sess();
    if (!s) return;
    const before = s.elements.length;
    s.elements = s.elements.filter((e) => ids.indexOf(e.id) === -1);
    ids.forEach((id) => S.checkedEls.delete(id));
    if (ids.indexOf(S.open) !== -1) S.open = null;
    if (s.elements.length === before) return;
    persist();
    renderTree();
    renderElements();
    schedulePreview();
    setStatus((before - s.elements.length) + ' element' + (before - s.elements.length > 1 ? 's' : '') + ' removed.');
  }

  // -------------------------------------------------------------------------
  // Right panel — banner select, frames, transport
  // -------------------------------------------------------------------------
  function renderTop() {
    const sel = $('bannerSelect');
    const cur = S.ctx && S.ctx.id;
    sel.innerHTML = S.banners.length
      ? S.banners.map((b) => '<option value="' + b.id + '"' + (b.id === cur ? ' selected' : '') + '>' + b.width + '×' + b.height + ' · ' + esc(b.name) + (b.elements ? ' ●' : '') + '</option>').join('')
      : '<option>No frames on this page</option>';
    if (!cur && S.banners.length) sel.insertAdjacentHTML('afterbegin', '<option value="" selected>Choose banner…</option>');
  }

  function renderTimeline() {
    const s = sess();
    const scenes = s ? s.scenes : [];
    $('sceneCount').textContent = scenes.length;
    $('sceneDurations').innerHTML = scenes.map((sc, i) =>
      '<label class="scene-dur' + (i === S.scene ? ' cur' : '') + '" style="flex:' + Math.max(0.5, sc.dur) + '"><span class="tag">F' + (i + 1) + '</span>' +
      '<input type="number" min="0.5" step="0.5" data-scene-dur="' + i + '" value="' + sc.dur + '"></label>').join('');
    if (s) {
      $('playsSelect').value = String(s.plays);
      $('endOnLast').checked = s.endOnLast !== false;
      $('endOnLast').disabled = s.plays === 0;
      const len = G.timeline(s).playLen;
      S.playLen = len;
      $('scrubber').max = String(len);
      $('totalTime').textContent = round1(len) + 's' + (s.plays > 1 ? ' × ' + s.plays : s.plays === 0 ? ' · loops' : '');
    }
    $('sceneLabel').textContent = 'F' + (S.scene + 1);
    updateTransport();
  }

  function round1(n) {
    return Math.round(n * 100) / 100;
  }

  function updateTransport() {
    $('playBtn').innerHTML = icon(S.playing ? 'pause' : 'play');
    const t = S.playLen ? Math.min(S.time % (S.playLen + 1e-9), S.playLen) : 0;
    if (!S.scrubbing) $('scrubber').value = String(t);
    $('timeLabel').textContent = t.toFixed(2) + 's';
    $('outlineBtn').classList.toggle('on', S.outline);
    $('followBtn').classList.toggle('on', S.follow);
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
    renderTimeline();
    renderElements();
  }

  // -------------------------------------------------------------------------
  // Right panel — element cards
  // -------------------------------------------------------------------------
  function renderElements() {
    const box = $('elements');
    const s = sess();
    if (!s) { box.innerHTML = ''; renderBulkEls(); return; }
    if (!s.elements.length) {
      box.innerHTML = '<div class="empty">No elements in the HTML yet.<br>Click <b>+ Add</b> on the layers you want to animate.</div>';
      renderBulkEls();
      return;
    }
    box.innerHTML = s.elements.map(elementCard).join('');
    renderBulkEls();
  }

  function exitLabel(i) {
    const x = S.pkg.exits[i];
    return x ? (x.name || 'Exit ' + (i + 1)) : 'Banner click (main exit)';
  }

  function elementCard(el) {
    const sc = el.scenes[S.scene];
    const n = S.ctx.index[el.id];
    const open = S.open === el.id;
    return '<div class="el' + (open ? ' open' : '') + (sc.on ? '' : ' off-scene') + '" data-id="' + el.id + '">' +
      '<div class="el-head" data-act="toggle-el">' +
        '<div class="order"><button data-act="el-up" title="Bring forward">' + icon('chevron-up') + '</button><button data-act="el-down" title="Send backward">' + icon('chevron-down') + '</button></div>' +
        '<input type="checkbox" class="cb" data-act="check-el"' + (S.checkedEls.has(el.id) ? ' checked' : '') + '>' +
        '<span class="type-ic">' + icon(typeIcon(n || el)) + '</span>' +
        '<span class="name">' + esc(el.name) + (!n ? ' <span class="muted">(layer missing)</span>' : '') + '</span>' +
        '<button class="icon-btn sm ghost link-btn' + (el.exit >= 0 ? ' on' : '') + '" data-act="cycle-exit" title="Click target: ' + esc(el.exit >= 0 ? exitLabel(el.exit) : 'banner click (main exit)') + '">' + icon('link') + '</button>' +
        (el.maskId ? '<button class="icon-btn sm ghost clip-btn' + (el.clip ? ' on' : '') + '" data-act="toggle-clip" title="Clip to mask “' + esc(el.maskName || '') + '”">' + icon('mask') + '</button>' : '') +
        '<button class="icon-btn sm ghost danger" data-act="remove-el" title="Remove from HTML">' + icon('trash') + '</button>' +
      '</div>' +
      (open ? '<div class="el-body">' + elementBody(el) + '</div>' : '') +
    '</div>';
  }

  function unitInput(field, value, step, unit, min) {
    return '<span class="unit" data-unit="' + unit + '"><input type="number" step="' + step + '"' + (min !== undefined ? ' min="' + min + '"' : '') + ' data-f="' + field + '" value="' + value + '"></span>';
  }

  function field(label, control, cls) {
    return '<label class="field' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span>' + control + '</label>';
  }

  function elementBody(el) {
    const s = sess();
    const sc = el.scenes[S.scene];
    const bars = '<div class="scene-bars">' + s.scenes.map((_, i) =>
      '<div class="scene-bar' + (el.scenes[i].on ? ' on' : '') + (i === S.scene ? ' cur' : '') + '" data-act="toggle-scene" data-i="' + i + '" title="' +
      (el.scenes[i].on ? 'Visible' : 'Hidden') + ' in F' + (i + 1) + ' — click to toggle">F' + (i + 1) + '</div>').join('') + '</div>';
    if (!sc.on) {
      return bars + '<div class="not-in-scene">Not visible in F' + (S.scene + 1) + '.<br><button class="btn" data-act="toggle-scene" data-i="' + S.scene + '">Show in F' + (S.scene + 1) + '</button></div>';
    }
    const io = '<div class="io">' +
      '<div><h4>' + icon('in') + 'In</h4><div class="fields">' +
        field('Delay', unitInput('in.d', sc.in.d, 0.1, 's', 0)) +
        field('Preset', '<select data-f="in.p">' + options(G.IN_PRESETS, sc.in.p) + '</select>') +
        field('Duration', unitInput('in.t', sc.in.t, 0.1, 's', 0.05)) +
      '</div><div class="fields two adv-only" style="margin-top:6px">' +
        field('Easing', '<select data-f="in.e">' + options(G.EASE_LABELS, sc.in.e) + '</select>') +
        field('Distance', unitInput('in.dist', sc.in.dist, 5, 'px')) +
      '</div></div>' +
      '<div><h4>' + icon('out') + 'Out</h4><div class="fields">' +
        field('Delay', unitInput('out.d', sc.out.d, 0.1, 's')) +
        field('Preset', '<select data-f="out.p">' + options(G.OUT_PRESETS, sc.out.p) + '</select>') +
        field('Duration', unitInput('out.t', sc.out.t, 0.1, 's', 0.05)) +
      '</div><div class="fields two adv-only" style="margin-top:6px">' +
        field('Easing', '<select data-f="out.e">' + options(G.EASE_LABELS, sc.out.e) + '</select>') +
        field('Distance', unitInput('out.dist', sc.out.dist, 5, 'px')) +
      '</div></div>' +
    '</div>';

    const badge = '<span class="badge"></span>';
    const tabs = '<div class="tabs">' +
      '<button class="tab' + (S.tab === 'settings' ? ' on' : '') + '" data-act="tab" data-tab="settings">' + icon('settings') + 'Settings' + (el.exit >= 0 ? badge : '') + '</button>' +
      '<button class="tab' + (S.tab === 'loop' ? ' on' : '') + '" data-act="tab" data-tab="loop">' + icon('loop') + 'Loop' + (sc.loop.p !== 'none' ? badge : '') + '</button>' +
      '<button class="tab' + (S.tab === 'motion' ? ' on' : '') + '" data-act="tab" data-tab="motion">' + icon('motion') + 'Motion' + (sc.motion.p !== 'none' ? badge : '') + '</button>' +
    '</div>';

    let pane = '';
    if (S.tab === 'settings') {
      const x = expOf(S.ctx, el.id);
      const exits = { '-1': 'Banner click (main exit)' };
      S.pkg.exits.forEach((e, i) => { exits[i] = e.name || 'Exit ' + (i + 1); });
      pane = '<div class="fields four">' +
        field('Click target', '<select data-ef="exit">' + options(exits, el.exit) + '</select>', '') +
        field('Crop', '<select data-xf="mode">' + options({ framed: 'Framed', full: 'Full' }, x.mode) + '</select>') +
        field('Scale', '<select data-xf="scale">' + options({ 1: '1x', 2: '2x', 3: '3x' }, x.scale) + '</select>') +
        field('Format', '<select data-xf="format">' + options({ png: 'PNG', jpg: 'JPG', svg: 'SVG' }, x.format) + '</select>') +
      '</div>' +
      (el.maskId ? '<label class="check"><input type="checkbox" class="cb" data-ef="clip"' + (el.clip ? ' checked' : '') + '>Clip to mask “' + esc(el.maskName || '') + '”</label>' : '');
    } else if (S.tab === 'loop') {
      pane = '<div class="fields four">' +
        field('Effect', '<select data-f="loop.p">' + options(G.LOOP_EFFECTS, sc.loop.p) + '</select>') +
        field('Duration', unitInput('loop.t', sc.loop.t, 0.1, 's', 0.1)) +
        field('Delay', unitInput('loop.d', sc.loop.d, 0.1, 's', 0)) +
        field('Repeat', '<select data-f="loop.r">' + options({ 1: '1×', 2: '2×', 3: '3×', 4: '4×', 5: '5×', inf: 'Until exit' }, sc.loop.r) + '</select>') +
      '</div>';
    } else {
      pane = '<div class="fields four">' +
        field('Motion', '<select data-f="motion.p">' + options(G.MOTION_PRESETS, sc.motion.p) + '</select>') +
        field('Delay', unitInput('motion.d', sc.motion.d, 0.1, 's', 0)) +
        field('Easing', '<select data-f="motion.e">' + options(G.EASE_LABELS, sc.motion.e) + '</select>') +
        '<span></span>' +
      '</div>' +
      (sc.motion.p === 'custom' ? '<div class="fields four" style="margin-top:6px">' +
        field('Move X', unitInput('motion.x', sc.motion.x, 1, 'px')) +
        field('Move Y', unitInput('motion.y', sc.motion.y, 1, 'px')) +
        field('Scale', unitInput('motion.s', sc.motion.s, 0.05, '×')) +
        field('Rotate', unitInput('motion.r', sc.motion.r, 1, '°')) +
      '</div>' : '') +
      '<div class="summary">Motion runs from the moment the element appears until it has left.</div>';
    }
    return bars + io + tabs + pane + '<div class="summary" data-summary>' + esc(summary(el)) + '</div>';
  }

  function summary(el) {
    const sc = el.scenes[S.scene];
    if (!sc.on) return '';
    const parts = [G.IN_PRESETS[sc.in.p] + (sc.in.p !== 'none' ? ' ' + sc.in.t + 's' : ''), G.OUT_PRESETS[sc.out.p] + (sc.out.p !== 'none' ? ' ' + sc.out.t + 's' : '')];
    if (sc.loop.p !== 'none') parts.push(G.LOOP_EFFECTS[sc.loop.p].label + ' · ' + (sc.loop.r === 'inf' ? 'until exit' : sc.loop.r + '×'));
    if (sc.motion.p !== 'none') parts.push(G.MOTION_PRESETS[sc.motion.p].label);
    if (el.exit >= 0) parts.push('→ ' + exitLabel(el.exit));
    return parts.join(' · ');
  }

  function renderBulkEls() {
    const bar = $('bulkEls');
    const n = S.checkedEls.size;
    bar.hidden = !n;
    if (!n) return;
    const src = S.open && elById(S.open);
    bar.innerHTML = '<b>' + n + ' selected</b><span class="grow"></span>' +
      (src ? '<button class="btn" data-act="bulk-copy" title="Copy every frame’s In/Out/Loop/Motion">Copy animation from “' + esc(src.name) + '”</button>' : '<span class="muted">Open an element to copy its animation</span>') +
      '<button class="btn" data-act="bulk-delete">Remove</button><button class="text-btn" data-act="bulk-clear-els">Clear</button>';
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
    if (ctx === S.ctx) $('sizeInfo').textContent = 'Exporting ' + (items.length || 'background') + (items.length ? ' layer' + (items.length > 1 ? 's' : '') : '') + '…';
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
      if (!c.processed[pk]) c.processed[pk] = processImage(raw, x.mode === 'framed' ? frame : null, compress);
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

  function canvasBytes(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Image encoding failed'));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      }, type, quality);
    });
  }

  async function decode(img) {
    return createImageBitmap(new Blob([img.bytes], { type: G.MIME[img.ext] }));
  }

  // Crops to the banner ("Framed") and optionally re-encodes opaque images as JPG.
  async function processImage(raw, frame, compress) {
    if (raw.ext === 'svg') return raw;
    let img = raw;
    try {
      if (frame) {
        const x0 = Math.max(0, raw.x), y0 = Math.max(0, raw.y);
        const x1 = Math.min(frame.W, raw.x + raw.width), y1 = Math.min(frame.H, raw.y + raw.height);
        if (x1 <= x0 || y1 <= y0) return null;
        const cropped = x0 > raw.x + 0.5 || y0 > raw.y + 0.5 || x1 < raw.x + raw.width - 0.5 || y1 < raw.y + raw.height - 0.5;
        if (cropped) {
          const bmp = await decode(raw);
          const sx = bmp.width / raw.width, sy = bmp.height / raw.height;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((x1 - x0) * sx));
          canvas.height = Math.max(1, Math.round((y1 - y0) * sy));
          canvas.getContext('2d').drawImage(bmp, Math.round((x0 - raw.x) * sx), Math.round((y0 - raw.y) * sy), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          img = Object.assign({}, raw, { x: x0, y: y0, width: x1 - x0, height: y1 - y0, bytes: await canvasBytes(canvas, G.MIME[raw.ext], 0.9) });
        }
      }
      if (compress) img = await compressImage(img);
    } catch (e) {
      console.warn('Image processing failed', e);
    }
    return img;
  }

  async function compressImage(img) {
    const bmp = await decode(img);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const g = canvas.getContext('2d');
    g.drawImage(bmp, 0, 0);
    if (img.ext === 'png') {
      const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return img; // keep transparency
    }
    const jpg = await canvasBytes(canvas, 'image/jpeg', 0.82);
    return jpg.length < img.bytes.length ? Object.assign({}, img, { ext: 'jpg', bytes: jpg }) : img;
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

  function stageMessage(text) {
    $('stageMsg').hidden = !text;
    $('stageMsg').textContent = text || '';
    $('frameBox').hidden = !!text;
  }

  function layoutStage() {
    const ctx = S.ctx;
    if (!ctx) return;
    const stage = $('stage');
    const w = ctx.info.width, h = ctx.info.height;
    const fit = Math.min(2, (stage.clientWidth - 40) / w, (stage.clientHeight - 64) / h);
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
    if (!ctx) { stageMessage('Select a banner frame in Figma.'); return; }
    try {
      if (!ctx.cache.bg) stageMessage('Exporting layers from Figma…');
      await ensureAssets(ctx);
      if (token !== previewToken || ctx !== S.ctx) return;
      const assets = await assembleAssets(ctx, false);
      if (token !== previewToken || ctx !== S.ctx) return;
      const opts = { name: ctx.info.name, width: ctx.info.width, height: ctx.info.height, session: ctx.session, assets: assets, pkg: S.pkg };
      const out = G.buildBanner(Object.assign({ inline: true, preview: true, outline: S.outline }, opts));
      stageMessage('');
      layoutStage();
      S.resume = { t: S.time, playing: S.playing };
      S.ignoreTicksUntil = Date.now() + 1e9;
      $('preview').srcdoc = out.html;

      const files = G.buildBanner(Object.assign({ inline: false, channel: S.pkg.channel || 'html5' }, opts)).files;
      const enc = new TextEncoder();
      const bytes = files.reduce((sum, f) => sum + (typeof f.data === 'string' ? enc.encode(f.data).length : f.data.length), 0);
      const kb = Math.round(bytes / 102.4) / 10;
      $('sizeInfo').textContent = ctx.session.elements.length + ' elements · ' + files.length + ' files · ≈ ' + kb + ' KB' + (S.pkg.compress ? ' before compression' : '');
      $('warnings').textContent = (assets.warnings || []).join(' ');
    } catch (e) {
      if (token === previewToken) stageMessage('Export failed: ' + e.message);
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

  // -------------------------------------------------------------------------
  // Banner switching
  // -------------------------------------------------------------------------
  async function openBanner(id, fresh) {
    if (!id) return;
    try {
      const ctx = await loadCtx(id, fresh !== false);
      const switched = !S.ctx || S.ctx.id !== id;
      S.ctx = ctx;
      if (switched) {
        S.scene = 0;
        S.open = null;
        S.checkedNodes.clear();
        S.checkedEls.clear();
        S.time = 0;
        S.playing = true;
        S.zoom = 'fit';
        S.expanded = {};
      }
      S.scene = Math.min(S.scene, ctx.session.scenes.length - 1);
      renderAll();
      schedulePreview(0);
      setStatus('Editing ' + ctx.info.width + '×' + ctx.info.height + ' “' + ctx.info.name + '”.');
    } catch (e) {
      showError(e);
    }
  }

  function revealNode(id) {
    const ctx = S.ctx;
    const n = ctx && ctx.index[id];
    if (!n) return;
    for (let p = n.parent; p; p = p.parent) S.expanded[p.id] = true;
    renderTree();
    const card = document.querySelector('.node[data-node="' + CSS.escape(id) + '"]');
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function onCanvasSelection(m) {
    S.canvasSel = m.ids || [];
    if (S.follow && m.bannerId && (!S.ctx || S.ctx.id !== m.bannerId)) {
      openBanner(m.bannerId);
      return;
    }
    if (S.follow && S.ctx && S.canvasSel.length && S.ctx.index[S.canvasSel[0]]) revealNode(S.canvasSel[0]);
    else renderTree();
  }

  function renderAll() {
    renderTop();
    renderFilters();
    renderTree();
    renderTimeline();
    renderElements();
    if (!S.ctx) stageMessage('Select a banner frame in Figma.');
  }

  // -------------------------------------------------------------------------
  // Package
  // -------------------------------------------------------------------------
  function packageBanners() {
    return S.banners.filter((b) => b.elements > 0);
  }

  function includedBanners() {
    return packageBanners().filter((b) => !S.pkg.exclude[b.id]);
  }

  function renderPackage() {
    const p = S.pkg;
    const sizes = packageBanners();
    $('packageBody').innerHTML =
      '<div class="sec"><div class="sec-title">' + icon('settings') + 'Package settings</div><div class="pkg-grid">' +
        '<div class="field"><span>Border color</span><div class="color-field"><input type="color" data-pf="borderColor" value="' + esc(p.borderColor) + '"><input type="text" data-pf="borderColor" value="' + esc(p.borderColor) + '"></div></div>' +
        '<div class="field"><span>Optimization</span>' +
          '<label class="check"><input type="checkbox" class="cb" data-pf="compress"' + (p.compress ? ' checked' : '') + '>Compress images</label>' +
          '<label class="check"><input type="checkbox" class="cb" data-pf="border"' + (p.border ? ' checked' : '') + '>Show border</label>' +
        '</div>' +
      '</div></div>' +
      '<div class="sec"><div class="sec-title">' + icon('link') + 'Exits<span class="grow"></span><span class="muted">' + p.exits.length + ' exit' + (p.exits.length > 1 ? 's' : '') + '</span></div>' +
        p.exits.map((x, i) =>
          '<div class="exit" data-exit="' + i + '"><div class="exit-head">' + icon('star') +
            '<input type="text" data-exf="name" value="' + esc(x.name) + '" placeholder="Exit name">' +
            (i === 0 ? '<span class="primary">Primary</span>' : '<button class="icon-btn sm ghost danger" data-act="remove-exit" title="Remove exit">' + icon('trash') + '</button>') +
          '</div><input type="url" data-exf="url" value="' + esc(x.url) + '" placeholder="https://..."></div>').join('') +
        '<button class="btn" data-act="add-exit">+ Add exit</button>' +
      '</div>' +
      '<div class="sec"><div class="sec-title">' + icon('files') + 'Sizes</div><div class="size-list">' +
        (sizes.length
          ? sizes.map((b) => '<label><input type="checkbox" class="cb" data-size="' + b.id + '"' + (p.exclude[b.id] ? '' : ' checked') + '>' + b.width + '×' + b.height + ' <span class="muted">' + esc(b.name) + ' · ' + b.elements + ' elements</span></label>').join('')
          : '<span class="muted">No banner on this page has elements yet.</span>') +
      '</div></div>';
    renderPackageFoot();
  }

  function renderPackageFoot() {
    const p = S.pkg;
    const ch = G.CHANNELS[p.channel];
    $('channelLabel').textContent = ch ? ch.label : 'Channel';
    $('channelMenu').innerHTML = Object.keys(G.CHANNELS).map((k) =>
      '<button class="' + (p.channel === k ? 'on' : '') + '" data-act="set-channel" data-channel="' + k + '"><b>' + esc(G.CHANNELS[k].label) + '</b><small>' + esc(G.CHANNELS[k].desc) + '</small></button>').join('');
    const n = includedBanners().length;
    $('filesCount').textContent = n + ' file' + (n === 1 ? '' : 's');
    const btn = $('downloadAllBtn');
    btn.disabled = !p.channel || !n;
    btn.title = !p.channel ? 'Choose a channel first' : !n ? 'No sizes to export' : '';
  }

  function download(data, name, type) {
    const url = URL.createObjectURL(new Blob([data], { type: type || 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
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
    if (!list.length || !channel) return;
    const btn = $('downloadAllBtn');
    btn.disabled = true;
    try {
      if (!S.pkg.exits[0].url) setStatus('Main exit URL is empty — the click-through will open a blank page.', true);
      const zips = [];
      for (const b of list) {
        $('filesCount').textContent = 'Packaging ' + b.width + '×' + b.height + '…';
        const r = await buildPackageBanner(b.id, false);
        zips.push({ name: G.slug(r.ctx.info.name) + '_' + r.ctx.info.width + 'x' + r.ctx.info.height + '_' + channel + '.zip', data: G.makeZip(r.out.files) });
      }
      if (zips.length === 1) download(zips[0].data, zips[0].name);
      else download(G.makeZip(zips), 'banners_' + channel + '.zip');
      call('notify', { text: 'Packaged ' + zips.length + ' banner' + (zips.length > 1 ? 's' : '') + ' for ' + G.CHANNELS[channel].label });
      if (S.pkg.exits[0].url) setStatus('Downloaded ' + zips.length + ' banner' + (zips.length > 1 ? 's' : '') + '.');
    } catch (e) {
      showError(e);
    } finally {
      renderPackageFoot();
    }
  }

  async function openPackagePreview() {
    const list = includedBanners();
    $('previewSheet').hidden = false;
    const body = $('previewBody');
    if (!list.length) {
      body.innerHTML = '<div class="empty">Nothing to preview yet.</div>';
      return;
    }
    body.innerHTML = '<div class="empty">Building previews…</div>';
    const maxW = body.clientWidth - 40;
    const figures = [];
    for (const b of list) {
      try {
        const r = await buildPackageBanner(b.id, true);
        const w = r.ctx.info.width, h = r.ctx.info.height;
        const scale = Math.min(1, maxW / w);
        figures.push({ html: r.out.html, w: w, h: h, scale: scale, label: w + '×' + h + ' · ' + r.ctx.info.name });
      } catch (e) {
        figures.push({ error: e.message, label: b.name });
      }
    }
    body.innerHTML = figures.map((f, i) => f.error
      ? '<figure><div class="muted">' + esc(f.label) + ': ' + esc(f.error) + '</div></figure>'
      : '<figure><div style="width:' + f.w * f.scale + 'px;height:' + f.h * f.scale + 'px;box-shadow:0 0 0 1px var(--border-strong)"><iframe data-pv="' + i + '" width="' + f.w + '" height="' + f.h + '" sandbox="allow-scripts" style="transform:scale(' + f.scale + ')"></iframe></div><figcaption>' + esc(f.label) + '</figcaption></figure>').join('');
    S.previewDocs = figures;
    body.querySelectorAll('iframe[data-pv]').forEach((fr) => { fr.srcdoc = figures[Number(fr.dataset.pv)].html; });
  }

  // -------------------------------------------------------------------------
  // Copy animation to other sizes (matched by layer name)
  // -------------------------------------------------------------------------
  function renderSync() {
    const others = S.banners.filter((b) => !S.ctx || b.id !== S.ctx.id);
    $('syncBody').innerHTML = others.length
      ? '<div class="sec"><div class="size-list">' + others.map((b) => '<label><input type="checkbox" class="cb" data-sync="' + b.id + '" checked>' + b.width + '×' + b.height + ' <span class="muted">' + esc(b.name) + (b.elements ? ' · has ' + b.elements + ' elements' : '') + '</span></label>').join('') + '</div></div>'
      : '<div class="empty">There are no other frames on this page.</div>';
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
        report.push(target.info.width + '×' + target.info.height + ': ' + elements.length + '/' + src.session.elements.length);
        done++;
      } catch (e) {
        report.push(id + ': ' + e.message);
      }
    }
    $('syncSheet').hidden = true;
    renderTop();
    setStatus('Copied to ' + done + ' size' + (done === 1 ? '' : 's') + ' (matched layers ' + report.join(', ') + ').');
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  function nodeIdOf(t) {
    const host = t.closest('[data-node]') || t.closest('[data-id]');
    return host && (host.dataset.node || host.dataset.id);
  }

  const ACTIONS = {
    'toggle-node': (t) => { const id = nodeIdOf(t); S.expanded[id] = !S.expanded[id]; renderTree(); },
    'check-node': (t) => { const id = nodeIdOf(t); if (t.checked) S.checkedNodes.add(id); else S.checkedNodes.delete(id); renderBulkNodes(); },
    'add-node': (t) => addElements([nodeIdOf(t)]),
    'remove-node': (t) => removeElements([nodeIdOf(t)]),
    'locate': (t) => call('locate', { id: nodeIdOf(t) }).catch(showError),
    'bulk-add': () => { addElements(Array.from(S.checkedNodes)); S.checkedNodes.clear(); renderTree(); },
    'bulk-remove': () => { removeElements(Array.from(S.checkedNodes)); S.checkedNodes.clear(); renderTree(); },
    'bulk-clear-nodes': () => { S.checkedNodes.clear(); renderTree(); },
    'toggle-clip': (t) => {
      const el = elById(nodeIdOf(t));
      if (!el) return;
      el.clip = !el.clip;
      persist();
      renderTree();
      renderElements();
      schedulePreview();
      setStatus('“' + el.name + '” ' + (el.clip ? 'clipped to' : 'no longer clipped to') + ' mask “' + (el.maskName || '') + '”.');
    },
    'toggle-filters': () => { S.showFilters = !S.showFilters; renderFilters(); },
    'filter-kind': (t) => { S.filter.kind = t.dataset.kind; renderFilters(); renderTree(); },

    'select-parent': () => call('selectParent').then((id) => { if (!id) setStatus('Nothing to go up to.'); }, showError),
    'add-selection': () => {
      const ids = S.canvasSel.filter((id) => S.ctx && S.ctx.index[id]);
      if (!ids.length) setStatus('Select layers of this banner in Figma first.', true);
      else addElements(ids);
    },
    'toggle-follow': () => { S.follow = !S.follow; updateTransport(); setStatus(S.follow ? 'Following the Figma selection.' : 'No longer following the Figma selection.'); },
    'save-session': () => {
      if (!S.ctx) return;
      call('saveSnapshot', { id: S.ctx.id, session: S.ctx.session }).then(() => setStatus('Session saved. Use “Restore session” to come back to this point.'), showError);
    },
    'restore-session': async () => {
      if (!S.ctx) return;
      try {
        const snap = await call('loadSnapshot', { id: S.ctx.id });
        if (!snap) { setStatus('No saved session for this banner yet — use the save button first.', true); return; }
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
        setStatus('Session restored from ' + new Date(snap.at).toLocaleString() + '.');
      } catch (e) {
        showError(e);
      }
    },
    'refresh': async () => {
      if (!S.ctx) return;
      S.ctx.cache = { items: {}, masks: {}, bg: null, processed: {}, warnings: [], pending: null };
      await openBanner(S.ctx.id, true);
      setStatus('Layers re-exported from Figma.');
    },
    'open-sync': () => { if (S.ctx) { renderSync(); $('syncSheet').hidden = false; } },
    'close-sync': () => { $('syncSheet').hidden = true; },
    'apply-sync': () => applySync(),

    'scene-add': () => {
      const s = sess();
      if (!s) return;
      s.scenes.push({ dur: 3 });
      s.elements.forEach((el) => el.scenes.push(defaultScene(false)));
      persist();
      selectScene(s.scenes.length - 1, true);
      schedulePreview();
      setStatus('Frame F' + s.scenes.length + ' added. Turn elements on for it with the frame bars.');
    },
    'scene-remove': () => {
      const s = sess();
      if (!s || s.scenes.length < 2) return;
      s.scenes.pop();
      s.elements.forEach((el) => el.scenes.pop());
      persist();
      selectScene(Math.min(S.scene, s.scenes.length - 1), false);
      schedulePreview();
    },
    'scene-prev': () => selectScene(S.scene - 1, true),
    'scene-next': () => selectScene(S.scene + 1, true),
    'play': () => {
      if (S.playing) {
        S.playing = false;
        sendPreview({ bannerCmd: 'pause' });
      } else {
        const atEnd = S.time >= G.timeline(sess() || newSession()).total - 0.05;
        S.playing = true;
        sendPreview({ bannerCmd: 'play', t: atEnd ? 0 : S.time });
      }
      updateTransport();
    },
    'restart': () => { S.playing = true; S.time = 0; sendPreview({ bannerCmd: 'play', t: 0 }); updateTransport(); },
    'toggle-outline': () => { S.outline = !S.outline; sendPreview({ bannerCmd: 'outline', on: S.outline }); updateTransport(); },
    'zoom-in': () => { S.zoom = Math.min(4, (S.currentScale || 1) * 1.25); layoutStage(); },
    'zoom-out': () => { S.zoom = Math.max(0.1, (S.currentScale || 1) / 1.25); layoutStage(); },
    'zoom-fit': () => { S.zoom = 'fit'; layoutStage(); },
    'mode': (t) => {
      document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b === t));
      document.body.classList.toggle('adv', t.dataset.mode === 'adv');
    },

    'toggle-el': (t) => { const id = nodeIdOf(t); S.open = S.open === id ? null : id; renderElements(); },
    'check-el': (t) => { const id = nodeIdOf(t); if (t.checked) S.checkedEls.add(id); else S.checkedEls.delete(id); renderBulkEls(); },
    'el-up': (t) => moveElement(nodeIdOf(t), -1),
    'el-down': (t) => moveElement(nodeIdOf(t), 1),
    'remove-el': (t) => removeElements([nodeIdOf(t)]),
    'cycle-exit': (t) => {
      const el = elById(nodeIdOf(t));
      if (!el) return;
      el.exit = el.exit + 1 >= S.pkg.exits.length ? -1 : el.exit + 1;
      persist();
      renderElements();
      schedulePreview();
      setStatus('“' + el.name + '” click target: ' + (el.exit >= 0 ? exitLabel(el.exit) : 'banner click (main exit)') + '.');
    },
    'toggle-scene': (t) => {
      const el = elById(nodeIdOf(t));
      const i = Number(t.dataset.i);
      if (!el) return;
      el.scenes[i].on = !el.scenes[i].on;
      persist();
      renderElements();
      schedulePreview();
      setStatus('“' + el.name + '” ' + (el.scenes[i].on ? 'shown' : 'hidden') + ' in F' + (i + 1) + '.');
    },
    'tab': (t) => { S.tab = t.dataset.tab; renderElements(); },
    'bulk-copy': () => {
      const src = S.open && elById(S.open);
      if (!src) return;
      let n = 0;
      sess().elements.forEach((el) => { if (el !== src && S.checkedEls.has(el.id)) { el.scenes = clone(src.scenes); n++; } });
      persist();
      renderElements();
      schedulePreview();
      setStatus('Animation copied to ' + n + ' element' + (n === 1 ? '' : 's') + '.');
    },
    'bulk-delete': () => removeElements(Array.from(S.checkedEls)),
    'bulk-clear-els': () => { S.checkedEls.clear(); renderElements(); },

    'open-package': () => { renderPackage(); $('packageSheet').hidden = false; },
    'close-package': () => { $('packageSheet').hidden = true; $('channelMenu').hidden = true; },
    'toggle-channel': () => { $('channelMenu').hidden = !$('channelMenu').hidden; },
    'set-channel': (t) => { S.pkg.channel = t.dataset.channel; $('channelMenu').hidden = true; persistPkg(); renderPackageFoot(); schedulePreview(); },
    'add-exit': () => { S.pkg.exits.push({ name: 'Exit ' + (S.pkg.exits.length + 1), url: '' }); persistPkg(); renderPackage(); },
    'remove-exit': (t) => {
      const i = Number(t.closest('[data-exit]').dataset.exit);
      S.pkg.exits.splice(i, 1);
      Object.values(ctxs).forEach((ctx) => ctx.session.elements.forEach((el) => {
        if (el.exit === i) el.exit = -1;
        else if (el.exit > i) el.exit--;
      }));
      persist();
      persistPkg();
      renderPackage();
      renderElements();
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
      t.parentElement.style.flex = String(Math.max(0.5, v));
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
      return;
    }
    if (t.dataset.exf) {
      S.pkg.exits[Number(t.closest('[data-exit]').dataset.exit)][t.dataset.exf] = t.value;
      persistPkg();
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.id === 'scrubber') { S.scrubbing = false; return; }
    if (t.id === 'bannerSelect') { openBanner(t.value); return; }
    if (t.id === 'playsSelect') { sess().plays = Number(t.value); persist(); renderTimeline(); schedulePreview(); return; }
    if (t.id === 'endOnLast') { sess().endOnLast = t.checked; persist(); schedulePreview(); return; }
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
      renderTree();
      renderElements();
      if (isAdded(id)) schedulePreview();
      return;
    }
    if (t.dataset.ef) {
      const el = elById(nodeIdOf(t));
      if (!el) return;
      el[t.dataset.ef] = t.dataset.ef === 'clip' ? t.checked : Number(t.value);
      persist();
      renderTree();
      renderElements();
      schedulePreview();
      return;
    }
    if (t.dataset.size) {
      if (t.checked) delete S.pkg.exclude[t.dataset.size];
      else S.pkg.exclude[t.dataset.size] = true;
      persistPkg();
      renderPackageFoot();
      return;
    }
    if (t.dataset.exf || t.dataset.pf) {
      if (t.dataset.exf === 'name') renderElements();
    }
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
    if (m.type === 'response') {
      const w = waiting[m.id];
      if (!w) return;
      delete waiting[m.id];
      if (m.error) w.reject(new Error(m.error));
      else w.resolve(m.result);
    } else if (m.type === 'selection') {
      onCanvasSelection(m);
    } else if (m.type === 'banners') {
      S.banners = m.banners;
      renderTop();
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!e.target.closest('#channelDrop')) $('channelMenu').hidden = true;
    if (!t) return;
    const fn = ACTIONS[t.dataset.act];
    if (fn) fn(t, e);
  });
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  $('preview').addEventListener('load', onPreviewLoaded);
  window.addEventListener('resize', () => layoutStage());

  async function init() {
    hydrateIcons();
    renderAll();
    try {
      const r = await call('init');
      S.banners = r.banners || [];
      S.pkg = merge(defaultPackage(), r.pkg);
      if (!S.pkg.exits.length) S.pkg.exits = defaultPackage().exits;
      S.canvasSel = r.selection || [];
      const configured = S.banners.find((b) => b.elements > 0);
      const id = r.current || (configured && configured.id);
      if (id) await openBanner(id);
      else renderAll();
    } catch (e) {
      showError(e);
    }
  }

  init();
})();
