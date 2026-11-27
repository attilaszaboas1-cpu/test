const test = require('node:test');
const assert = require('node:assert');
const { node, install } = require('./fake-figma');
const storage = require('../figma/storage');
const { serve } = require('../figma/rpc');
const { createRpc } = require('../ui/rpc');

test('sessions round-trip as plugin data; bad data reads as null', () => {
  const n = node('FRAME');
  assert.strictEqual(storage.readJSON(n, 'k'), null);
  storage.writeJSON(n, 'k', { a: [1, 2] });
  assert.deepStrictEqual(storage.readJSON(n, 'k'), { a: [1, 2] });
  n.setPluginData('bad', '{oops');
  assert.strictEqual(storage.readJSON(n, 'bad'), null);
  storage.writeSnapshot(n, 'snap', { v: 1 }, 1234);
  assert.deepStrictEqual(storage.readSnapshot(n, 'snap'), { at: 1234, session: { v: 1 } });
});

test('UI and main-thread RPC talk to each other', async () => {
  const figma = install(node('PAGE', {}, []));
  const handle = serve({
    async add(p) { return p.a + p.b; },
    async fail() { throw new Error('nope'); }
  });
  // Wire the UI side to the fake main thread and back.
  const ui = createRpc({ postMessage: (m) => { handle(m.pluginMessage).then(() => ui.handle(figma.posted.shift())); } });
  assert.strictEqual(await ui.call('add', { a: 2, b: 3 }), 5);
  await assert.rejects(ui.call('fail'), /nope/);
  await assert.rejects(ui.call('missing'), /Unknown method missing/);
  assert.strictEqual(ui.pending(), 0);
  assert.strictEqual(ui.handle({ type: 'selection' }), false, 'other messages are not RPC responses');
});
