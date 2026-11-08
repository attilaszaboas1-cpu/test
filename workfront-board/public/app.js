'use strict';

// ---------- state ----------
const state = {
  config: null,
  projects: [],
  users: [],
  statuses: [],
  tasks: [],
  board: null,          // project id or 'mine'
  view: localGet('view') || 'table',
  search: '',
  person: '',
  hideDone: localGet('hideDone') === '1',
  collapsed: new Set(),
  pending: 0,           // writes in flight
  lastSync: null,
  syncError: null,
  openTaskId: null,
};

const PRIORITIES = [
  { value: 0, label: 'None', color: '#c4c4c4' },
  { value: 1, label: 'Low', color: '#579bfc' },
  { value: 2, label: 'Normal', color: '#5559df' },
  { value: 3, label: 'High', color: '#fdab3d' },
  { value: 4, label: 'Urgent', color: '#e2445c' },
];
const AVATAR_COLORS = ['#e2445c', '#00c875', '#579bfc', '#a25ddc', '#fdab3d', '#ff642e', '#037f4c', '#9d50dd', '#0086c0'];

// ---------- helpers ----------
function localGet(k) { try { return localStorage.getItem('wfb.' + k); } catch { return null; } }
function localSet(k, v) { try { localStorage.setItem('wfb.' + k, v); } catch { /* ignore */ } }

const $ = (sel) => document.querySelector(sel);

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

function toast(msg, isError) {
  const t = h('div', { className: 'toast' + (isError ? ' error' : '') }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), isError ? 6000 : 2500);
}

const today = () => new Date().toISOString().slice(0, 10);
const statusOf = (v) => state.statuses.find((s) => s.value === v) || { value: v, label: v, color: '#a0a3b5' };
const priorityOf = (v) => PRIORITIES.find((p) => p.value === v) || PRIORITIES[0];
const userOf = (id) => state.users.find((u) => u.id === id);
const isDone = (t) => t.status === 'CPL';
// Known statuses plus any unexpected ones found on tasks, so nothing is hidden.
function allStatuses() {
  const list = state.statuses.slice();
  for (const t of state.tasks) if (!list.some((s) => s.value === t.status)) list.push(statusOf(t.status));
  return list;
}
const isOverdue = (t) => t.dueDate && !isDone(t) && t.dueDate < today();

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
function avatar(id, name) {
  if (!id) return h('span', { className: 'avatar none', title: 'Unassigned' }, '+');
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return h('span', { className: 'avatar', title: name || '', vars: { '--c': AVATAR_COLORS[n % AVATAR_COLORS.length] } }, initials(name));
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function visibleTasks() {
  const q = state.search.toLowerCase();
  return state.tasks.filter((t) =>
    (!q || t.name.toLowerCase().includes(q)) &&
    (!state.person || (state.person === '-' ? !t.assigneeId : t.assigneeId === state.person)) &&
    (!state.hideDone || !isDone(t)));
}

// ---------- data loading ----------
async function loadBoard({ quiet } = {}) {
  if (!state.board) return;
  const board = state.board;
  setSync('busy');
  try {
    const tasks = await api('GET', board === 'mine' ? '/api/my-tasks' : `/api/projects/${board}/tasks`);
    if (board !== state.board) return; // user switched boards meanwhile
    state.tasks = tasks;
    state.lastSync = Date.now();
    state.syncError = null;
    render();
  } catch (e) {
    state.syncError = e.message;
    if (!quiet) toast(e.message, true);
  }
  setSync();
}

async function loadProjects() {
  state.projects = await api('GET', '/api/projects');
  renderSidebar();
}

function selectBoard(id) {
  state.board = id;
  state.tasks = [];
  localSet('board', id);
  $('#sidebar').classList.remove('open');
  closeDrawer();
  renderSidebar();
  render();
  loadBoard();
}

// Optimistic update: change locally, send to Workfront, roll back on failure.
async function updateTask(task, patch) {
  const before = { ...task };
  Object.assign(task, patch);
  if (patch.assigneeId !== undefined) task.assigneeName = (userOf(patch.assigneeId) || {}).name || null;
  if (patch.status === 'CPL') task.percentComplete = 100;
  task._saving = true;
  render();
  state.pending++;
  setSync('busy');
  try {
    const saved = await api('PATCH', `/api/tasks/${task.id}`, patch);
    Object.assign(task, saved);
  } catch (e) {
    Object.assign(task, before);
    toast(`Couldn't save to Workfront: ${e.message}`, true);
  } finally {
    delete task._saving;
    state.pending--;
    setSync();
    render();
    if (state.board !== 'mine') refreshProjectProgress();
  }
}

let progressTimer;
function refreshProjectProgress() {
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => loadProjects().catch(() => {}), 1500);
}

async function createTask(name, extra = {}) {
  if (!name.trim() || state.board === 'mine') return;
  state.pending++;
  setSync('busy');
  try {
    const t = await api('POST', `/api/projects/${state.board}/tasks`, { name: name.trim(), ...extra });
    state.tasks.push(t);
    render();
    toast('Task created in Workfront');
  } catch (e) {
    toast(`Couldn't create task: ${e.message}`, true);
  } finally {
    state.pending--;
    setSync();
  }
}

async function deleteTask(task) {
  if (!confirm(`Delete "${task.name}" in Workfront? This can't be undone here.`)) return;
  try {
    await api('DELETE', `/api/tasks/${task.id}`);
    state.tasks = state.tasks.filter((t) => t !== task);
    closeDrawer();
    render();
  } catch (e) {
    toast(`Couldn't delete: ${e.message}`, true);
  }
}

// ---------- sync indicator ----------
function setSync(forced) {
  const el = $('#sync');
  el.className = 'sync';
  let text;
  if (forced === 'busy' || state.pending) { el.classList.add('busy'); text = 'Syncing…'; }
  else if (state.syncError) { el.classList.add('error'); text = 'Sync problem'; el.title = state.syncError; }
  else if (state.lastSync) {
    const s = Math.round((Date.now() - state.lastSync) / 1000);
    text = s < 5 ? 'Synced just now' : s < 60 ? `Synced ${s}s ago` : `Synced ${Math.round(s / 60)}m ago`;
    el.title = 'Data is in sync with Workfront';
  } else text = '';
  el.replaceChildren(h('span', null, text));
}

// ---------- popover (status / priority pickers) ----------
function openPicker(anchor, options, current, onPick) {
  const pop = $('#popover');
  pop.replaceChildren(...options.map((o) => h('button', {
    className: 'opt' + (o.value === current ? ' sel' : ''),
    vars: { '--c': o.color },
    onclick: () => { closePicker(); if (o.value !== current) onPick(o.value); },
  }, o.label)));
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left + r.width / 2 - pr.width / 2, innerWidth - pr.width - 8)) + 'px';
  pop.style.top = (r.bottom + pr.height + 8 > innerHeight ? r.top - pr.height - 4 : r.bottom + 4) + 'px';
  pop.querySelector('button').focus();
}
function closePicker() { $('#popover').hidden = true; }
document.addEventListener('mousedown', (e) => { if (!e.target.closest('#popover, .pill')) closePicker(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePicker(); closeDrawer(); } });

// ---------- shared cell builders ----------
function statusPill(t) {
  const s = statusOf(t.status);
  return h('button', {
    className: 'pill', vars: { '--c': s.color }, title: 'Change status',
    onclick: (e) => openPicker(e.currentTarget, state.statuses, t.status, (v) => updateTask(t, { status: v })),
  }, s.label);
}
function priorityPill(t) {
  const p = priorityOf(t.priority);
  return h('button', {
    className: 'pill', vars: { '--c': p.color }, title: 'Change priority',
    onclick: (e) => openPicker(e.currentTarget, PRIORITIES, t.priority, (v) => updateTask(t, { priority: v })),
  }, p.label);
}
function ownerSelect(t) {
  const sel = h('select', {
    className: 'cell-input', 'aria-label': 'Owner',
    onchange: () => updateTask(t, { assigneeId: sel.value || null }),
  }, h('option', { value: '' }, 'Unassigned'),
  state.users.map((u) => h('option', { value: u.id, selected: u.id === t.assigneeId }, u.name)));
  return h('div', { className: 'owner' }, avatar(t.assigneeId, t.assigneeName), sel);
}
function dateInput(t, field) {
  const inp = h('input', {
    type: 'date', className: 'cell-input' + (field === 'dueDate' && isOverdue(t) ? ' overdue' : ''),
    value: t[field] || '', disabled: t.isParent, title: t.isParent ? 'Rolled up from subtasks in Workfront' : '',
    onchange: () => { if ((inp.value || null) !== t[field]) updateTask(t, { [field]: inp.value || null }); },
  });
  return inp;
}
function progressCell(t) {
  const wrap = h('div', { className: 'progress', title: t.isParent ? 'Rolled up from subtasks' : 'Click to change' },
    h('div', { className: 'track' }, h('div', { className: 'fill', style: { width: t.percentComplete + '%' } })),
    h('span', null, t.percentComplete + '%'));
  if (!t.isParent) {
    wrap.addEventListener('click', () => {
      const r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: t.percentComplete });
      const commit = () => { const v = Number(r.value); if (v !== t.percentComplete) updateTask(t, { percentComplete: v }); else render(); };
      r.addEventListener('change', commit);
      r.addEventListener('blur', () => { if (Number(r.value) === t.percentComplete) render(); });
      wrap.replaceChildren(r);
      r.focus();
    }, { once: true });
  }
  return wrap;
}

// ---------- views ----------
function render() {
  const board = state.board === 'mine'
    ? { name: 'My work', sub: 'Open tasks assigned to you across all projects' }
    : (() => {
      const p = state.projects.find((x) => x.id === state.board);
      return p ? { name: p.name, sub: [p.ownerName && `Owner: ${p.ownerName}`, p.dueDate && `Due ${fmtDate(p.dueDate)}`, `${p.percentComplete}% complete`].filter(Boolean).join(' · ') } : { name: '', sub: '' };
    })();
  $('#board-title').textContent = board.name || 'Select a project';
  $('#board-sub').textContent = board.sub;
  document.title = (board.name ? board.name + ' · ' : '') + 'Workfront Board';
  $('#new-task').hidden = state.board === 'mine';
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));

  // Don't rebuild the view while someone is typing in it (an empty
  // "+ Add task" box is fine: we put the cursor back afterwards).
  const active = document.activeElement;
  const inView = active && $('#view').contains(active) && active.matches('input[type=text], input:not([type])');
  const addBox = inView && active.closest('.add-row') ? active.getAttribute('aria-label') : null;
  if (inView && !(addBox && !active.value)) return;

  const view = $('#view');
  if (!state.board) { view.replaceChildren(h('div', { className: 'empty' }, 'Pick a project on the left.')); return; }
  const tasks = visibleTasks();
  const builder = { table: renderTable, kanban: renderKanban, timeline: renderTimeline }[state.view] || renderTable;
  view.replaceChildren(builder(tasks));
  if (addBox) {
    const again = [...view.querySelectorAll('.add-row input')].find((i) => i.getAttribute('aria-label') === addBox);
    if (again) again.focus();
  }
  if (state.openTaskId) renderDrawer();
}

function renderTable(tasks) {
  const frag = document.createDocumentFragment();
  if (!tasks.length && state.board === 'mine') return h('div', { className: 'empty' }, 'Nothing assigned to you. 🎉');
  const showProject = state.board === 'mine';
  for (const s of allStatuses()) {
    const rows = tasks.filter((t) => t.status === s.value);
    if (!rows.length && (state.hideDone && s.value === 'CPL')) continue;
    if (!rows.length && showProject) continue;
    const key = s.value;
    const group = h('div', { className: 'group' + (state.collapsed.has(key) ? ' collapsed' : ''), vars: { '--group': s.color } });
    group.append(h('div', { className: 'group-head', style: { color: s.color } },
      h('button', { 'aria-label': 'Collapse', onclick: () => { state.collapsed.has(key) ? state.collapsed.delete(key) : state.collapsed.add(key); render(); } }, '▼'),
      s.label, h('span', { className: 'count' }, `${rows.length} ${rows.length === 1 ? 'task' : 'tasks'}`)));

    const table = h('table', null,
      h('colgroup', null, ['name', 'owner', 'status', 'prio', 'date', 'prog', 'act'].map((c) => h('col', { className: 'c-' + c }))),
      h('thead', null, h('tr', null, h('th', null, showProject ? 'Task / project' : 'Task'), h('th', null, 'Owner'), h('th', null, 'Status'),
        h('th', null, 'Priority'), h('th', null, 'Due date'), h('th', null, 'Progress'), h('th', null, ''))));
    const tbody = h('tbody');
    for (const t of rows) {
      const name = h('input', {
        value: t.name, 'aria-label': 'Task name',
        onkeydown: (e) => { if (e.key === 'Enter') name.blur(); if (e.key === 'Escape') { name.value = t.name; name.blur(); } },
        onblur: () => { const v = name.value.trim(); if (v && v !== t.name) updateTask(t, { name: v }); else { name.value = t.name; render(); } },
      });
      const proj = showProject ? state.projects.find((p) => p.id === t.projectId) : null;
      tbody.append(h('tr', { className: t._saving ? 'saving' : '' },
        h('td', null, h('div', { className: 'name-cell' }, name,
          proj ? h('span', { className: 'parent-tag', title: 'Project' }, proj.name) : null,
          t.isParent ? h('span', { className: 'parent-tag' }, 'parent') : null,
          h('button', { className: 'open-btn', onclick: () => openDrawer(t.id) }, 'Open'))),
        h('td', null, ownerSelect(t)),
        h('td', null, statusPill(t)),
        h('td', null, priorityPill(t)),
        h('td', null, dateInput(t, 'dueDate')),
        h('td', null, progressCell(t)),
        h('td', null, h('button', { className: 'del-btn', title: 'Delete task', onclick: () => deleteTask(t) }, '×'))));
    }
    if (!showProject) {
      const add = h('input', {
        placeholder: '+ Add task', 'aria-label': `Add task to ${s.label}`,
        onkeydown: (e) => { if (e.key === 'Enter' && add.value.trim()) { const v = add.value; add.value = ''; createTask(v, s.value !== 'NEW' ? { status: s.value } : {}); } },
      });
      tbody.append(h('tr', { className: 'add-row' }, h('td', { colSpan: 7 }, add)));
    }
    table.append(tbody);
    group.append(table);
    frag.append(group);
  }
  return frag;
}

function renderKanban(tasks) {
  const wrap = h('div', { className: 'kanban' });
  for (const s of allStatuses()) {
    if (state.hideDone && s.value === 'CPL') continue;
    const rows = tasks.filter((t) => t.status === s.value);
    const cards = h('div', { className: 'cards' });
    const col = h('div', { className: 'column', vars: { '--c': s.color } },
      h('h3', null, s.label, h('span', null, rows.length)), cards);
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drop');
      const t = state.tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'));
      if (t && t.status !== s.value) updateTask(t, { status: s.value });
    });
    for (const t of rows) {
      const card = h('div', { className: 'card', draggable: true, onclick: () => openDrawer(t.id) },
        h('div', { className: 't' }, t.name),
        h('div', { className: 'meta' },
          avatar(t.assigneeId, t.assigneeName),
          h('span', { className: 'chip', vars: { '--c': priorityOf(t.priority).color } }, priorityOf(t.priority).label),
          h('span', null, `${t.percentComplete}%`),
          t.dueDate ? h('span', { className: 'due' + (isOverdue(t) ? ' overdue' : '') }, fmtDate(t.dueDate)) : null));
      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', t.id); card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      cards.append(card);
    }
    wrap.append(col);
  }
  return wrap;
}

function renderTimeline(tasks) {
  const dated = tasks.filter((t) => t.startDate || t.dueDate)
    .sort((a, b) => (a.startDate || a.dueDate).localeCompare(b.startDate || b.dueDate));
  if (!dated.length) return h('div', { className: 'empty' }, 'No tasks with dates yet.');
  const DAY = 86400000;
  const parse = (d) => new Date(d + 'T00:00:00').getTime();
  const min = Math.min(...dated.map((t) => parse(t.startDate || t.dueDate)), parse(today()) - 3 * DAY);
  const max = Math.max(...dated.map((t) => parse(t.dueDate || t.startDate)), parse(today()) + 7 * DAY);
  const days = Math.min(Math.round((max - min) / DAY) + 2, 120);
  const pct = (ms) => ((ms - min) / DAY / days) * 100;

  const head = h('div', { className: 'tl-head' });
  for (let i = 0; i < days; i++) {
    const d = new Date(min + i * DAY);
    const iso = d.toISOString().slice(0, 10);
    head.append(h('div', {
      className: 'tl-day' + (d.getDay() % 6 === 0 ? ' weekend' : '') + (iso === today() ? ' today' : ''),
      title: iso,
    }, d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : d.getDate()));
  }
  const grid = h('div', { className: 'tl-grid' }, h('div', { className: 'tl-name', style: { fontWeight: 600 } }, 'Task'), head);
  const todayLeft = pct(parse(today()));
  for (const t of dated) {
    const start = parse(t.startDate || t.dueDate);
    const end = parse(t.dueDate || t.startDate) + DAY;
    const row = h('div', { className: 'tl-row' },
      h('div', { className: 'tl-today', style: { left: todayLeft + '%' } }),
      h('div', {
        className: 'tl-bar', title: `${t.name}: ${t.startDate || '?'} → ${t.dueDate || '?'}`,
        vars: { '--c': statusOf(t.status).color },
        style: { left: pct(start) + '%', width: Math.max(pct(end) - pct(start), 1) + '%' },
      }, t.assigneeName || ''));
    grid.append(h('div', { className: 'tl-name', onclick: () => openDrawer(t.id), title: t.name }, t.name), row);
  }
  return h('div', { className: 'timeline' }, grid);
}

// ---------- detail drawer ----------
function openDrawer(id) { state.openTaskId = id; renderDrawer(); }
function closeDrawer() {
  state.openTaskId = null;
  const d = $('#drawer');
  d.classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
}
function renderDrawer() {
  const d = $('#drawer');
  const t = state.tasks.find((x) => x.id === state.openTaskId);
  if (!t) return closeDrawer();
  if (d.classList.contains('open') && d.dataset.id === t.id && d.contains(document.activeElement)) return;
  d.dataset.id = t.id;
  const desc = h('textarea', { value: t.description, placeholder: 'Add a description…' });
  desc.addEventListener('blur', () => { if (desc.value !== t.description) updateTask(t, { description: desc.value }); });
  const wfLink = state.config.domain ? `https://${state.config.domain}/task/${encodeURIComponent(t.id)}/overview` : null;
  d.replaceChildren(
    h('button', { className: 'close', 'aria-label': 'Close', onclick: closeDrawer }, '×'),
    h('h2', null, t.name),
    h('div', { className: 'row' },
      h('label', null, 'Status', statusPill(t)),
      h('label', null, 'Priority', priorityPill(t))),
    h('label', null, 'Owner', ownerSelect(t)),
    h('div', { className: 'row' },
      h('label', null, 'Start date', dateInput(t, 'startDate')),
      h('label', null, 'Due date', dateInput(t, 'dueDate'))),
    h('label', null, 'Progress', progressCell(t)),
    h('label', null, 'Description', desc),
    wfLink ? h('a', { href: wfLink, target: '_blank', rel: 'noopener' }, 'Open in Workfront ↗') : h('small', { style: { color: 'var(--muted)' } }, 'Demo mode — no Workfront link'),
    h('button', { className: 'icon-btn', style: { color: '#e2445c', alignSelf: 'flex-start' }, onclick: () => deleteTask(t) }, 'Delete task'));
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
}

// ---------- sidebar ----------
function renderSidebar() {
  const q = ($('#project-filter').value || '').toLowerCase();
  $('#nav-mine').classList.toggle('active', state.board === 'mine');
  $('#project-list').replaceChildren(...state.projects.filter((p) => p.name.toLowerCase().includes(q)).map((p) =>
    h('button', { className: 'nav-item' + (p.id === state.board ? ' active' : ''), onclick: () => selectBoard(p.id), title: p.name },
      p.name, h('div', { className: 'bar' }, h('span', { style: { width: p.percentComplete + '%' } })))));
}

function renderPeopleFilter() {
  const sel = $('#person-filter');
  sel.replaceChildren(h('option', { value: '' }, 'Everyone'), h('option', { value: '-' }, 'Unassigned'),
    ...state.users.map((u) => h('option', { value: u.id }, u.name)));
  sel.value = state.person;
}

// ---------- wiring ----------
$('#nav-mine').addEventListener('click', () => selectBoard('mine'));
$('#project-filter').addEventListener('input', renderSidebar);
$('#search').addEventListener('input', (e) => { state.search = e.target.value; render(); });
$('#person-filter').addEventListener('change', (e) => { state.person = e.target.value; render(); });
$('#hide-done').checked = state.hideDone;
$('#hide-done').addEventListener('change', (e) => { state.hideDone = e.target.checked; localSet('hideDone', state.hideDone ? '1' : '0'); render(); });
$('#refresh').addEventListener('click', () => { loadProjects().catch(() => {}); loadBoard(); });
$('#menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#new-task').addEventListener('click', () => {
  const name = prompt('Task name');
  if (name) createTask(name);
});
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  localSet('view', state.view);
  render();
}));

// Pull fresh data from Workfront periodically, unless the user is mid-edit.
function startPolling(seconds) {
  setInterval(() => {
    if (document.hidden || state.pending) return;
    const a = document.activeElement;
    if (a && a.closest && a.closest('#view, #drawer') && a.matches('input, textarea, select')) return;
    if (!$('#popover').hidden) return;
    loadBoard({ quiet: true });
  }, seconds * 1000);
  setInterval(() => setSync(), 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadBoard({ quiet: true }); });
}

(async function init() {
  try {
    const [config, statuses, users] = await Promise.all([api('GET', '/api/config'), api('GET', '/api/statuses'), api('GET', '/api/users')]);
    state.config = config;
    state.statuses = statuses;
    state.users = users;
    $('#mode').replaceChildren(config.mode === 'live'
      ? h('span', null, 'Connected to ', h('b', null, config.domain))
      : h('span', null, h('b', null, 'Demo mode'), ' — sample data. Add WF_DOMAIN and WF_API_KEY to .env to connect Workfront.'));
    renderPeopleFilter();
    await loadProjects();
    const saved = localGet('board');
    const valid = saved === 'mine' || state.projects.some((p) => p.id === saved);
    selectBoard(valid ? saved : (state.projects[0] ? state.projects[0].id : 'mine'));
    startPolling(config.pollSeconds || 30);
  } catch (e) {
    $('#board-title').textContent = 'Could not reach Workfront';
    $('#view').replaceChildren(h('div', { className: 'empty' }, e.message));
    state.syncError = e.message;
    setSync();
  }
})();
