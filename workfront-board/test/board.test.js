'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const M = require('../lib/mapping');
const { WorkfrontClient } = require('../lib/workfront');
const { MockWorkfront } = require('../lib/mock');
const { createApp, createBackend } = require('../server');

test('maps a Workfront task to the board model', () => {
  const t = M.taskFromWorkfront({
    ID: 'abc123', projectID: 'p1', name: 'Design', status: 'INP', percentComplete: 40.0, priority: 3,
    plannedStartDate: '2026-11-01T09:00:00:000-0500', plannedCompletionDate: '2026-11-10T17:00:00:000-0500',
    assignedToID: 'u1', assignedTo: { name: 'Ann' }, numberOfChildren: 2,
  });
  assert.deepStrictEqual(
    { id: t.id, start: t.startDate, due: t.dueDate, who: t.assigneeName, pct: t.percentComplete, parent: t.isParent },
    { id: 'abc123', start: '2026-11-01', due: '2026-11-10', who: 'Ann', pct: 40, parent: true });
});

test('translates and validates patches', () => {
  assert.deepStrictEqual(M.patchToWorkfront({ dueDate: '2026-12-01', assigneeId: 'U9', name: '  Hi ' }),
    { plannedCompletionDate: '2026-12-01', assignedToID: 'U9', name: 'Hi' });
  assert.throws(() => M.patchToWorkfront({ projectID: 'x' }), /cannot be edited/);
  assert.throws(() => M.patchToWorkfront({ percentComplete: 140 }), /0–100/);
  assert.throws(() => M.patchToWorkfront({ status: 'in progress' }), /Invalid status/);
  assert.throws(() => M.patchToWorkfront({ dueDate: 'tomorrow' }), /YYYY-MM-DD/);
  assert.throws(() => M.patchToWorkfront({}), /Nothing to update/);
});

test('falls back to demo mode without credentials', () => {
  assert.strictEqual(createBackend({}).mode, 'mock');
  assert.strictEqual(createBackend({ WF_DOMAIN: 'x.my.workfront.com', WF_API_KEY: 'k' }).mode, 'live');
});

test('WorkfrontClient sends the right requests', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    const data = init.method === 'PUT'
      ? { ID: 't1', projectID: 'p1', name: 'Renamed', status: 'CPL', percentComplete: 100 }
      : [{ ID: 't1', projectID: 'p1', name: 'A', status: 'NEW' }];
    return { ok: true, status: 200, json: async () => ({ data }) };
  };
  const wf = new WorkfrontClient({ domain: 'https://acme.my.workfront.com/', apiKey: 'secret', fetchImpl: fakeFetch });

  const tasks = await wf.listTasks('p1');
  assert.strictEqual(tasks[0].name, 'A');
  assert.strictEqual(calls[0].url.origin + calls[0].url.pathname, 'https://acme.my.workfront.com/attask/api/v15.0/task/search');
  assert.strictEqual(calls[0].url.searchParams.get('projectID'), 'p1');
  assert.strictEqual(calls[0].init.headers.apiKey, 'secret');
  assert.ok(!calls[0].url.search.includes('secret'), 'API key must not be in the URL');

  await wf.listProjects();
  assert.deepStrictEqual(calls[1].url.searchParams.getAll('status'), ['CPL', 'DED']);
  assert.strictEqual(calls[1].url.searchParams.get('status_Mod'), 'notin');

  const saved = await wf.updateTask('t1', { name: 'Renamed', status: 'CPL' });
  assert.strictEqual(saved.status, 'CPL');
  assert.strictEqual(calls[2].init.method, 'PUT');
  assert.strictEqual(calls[2].url.pathname, '/attask/api/v15.0/task/t1');
  const body = new URLSearchParams(calls[2].init.body);
  assert.deepStrictEqual(JSON.parse(body.get('updates')), { name: 'Renamed', status: 'CPL' });
});

test('WorkfrontClient surfaces Workfront errors', async () => {
  const wf = new WorkfrontClient({
    domain: 'acme.my.workfront.com', apiKey: 'k',
    fetchImpl: async () => ({ ok: false, status: 422, json: async () => ({ error: { message: 'Task is locked' } }) }),
  });
  await assert.rejects(wf.updateTask('t1', { name: 'x' }), (e) => e.message === 'Task is locked' && e.status === 422);
});

test('HTTP API round trip in demo mode', async (t) => {
  const server = http.createServer(createApp(new MockWorkfront()));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };

  const projects = (await call('GET', '/api/projects')).body;
  assert.ok(projects.length >= 1);
  const pid = projects[0].id;
  const tasks = (await call('GET', `/api/projects/${pid}/tasks`)).body;

  const upd = await call('PATCH', `/api/tasks/${tasks[0].id}`, { status: 'INP', assigneeId: 'U3' });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.body.assigneeName, 'Chris Diaz');

  const created = await call('POST', `/api/projects/${pid}/tasks`, { name: 'New thing', dueDate: '2026-12-24' });
  assert.strictEqual(created.body.dueDate, '2026-12-24');
  assert.strictEqual((await call('DELETE', `/api/tasks/${created.body.id}`)).status, 204);

  assert.strictEqual((await call('PATCH', `/api/tasks/${tasks[0].id}`, { projectId: 'P2' })).status, 400);
  assert.strictEqual((await call('PATCH', '/api/tasks/NOPE', { name: 'x' })).status, 404);
  assert.strictEqual((await call('GET', '/api/whatever')).status, 404);

  const page = await fetch(base + '/');
  assert.match(await page.text(), /Workfront Board/);
  const traversal = await fetch(base + '/..%2fserver.js');
  assert.notStrictEqual(traversal.status, 200);
});
