const test = require('node:test');
const assert = require('node:assert');
const { keyName, isTyping, handleKey } = require('../ui/keys');
const { tipHtml, labelTips } = require('../ui/tooltip');

const ev = (key, extra) => Object.assign({ key, target: { tagName: 'BODY' }, prevented: false, preventDefault() { this.prevented = true; } }, extra);

test('key names', () => {
  assert.strictEqual(keyName(ev(' ')), 'Space');
  assert.strictEqual(keyName(ev('a')), 'A');
  assert.strictEqual(keyName(ev('ArrowLeft', { shiftKey: true })), 'Shift+ArrowLeft');
  assert.strictEqual(keyName(ev('?', { shiftKey: true })), '?');
  assert.strictEqual(keyName(ev('s', { metaKey: true })), 'Mod+S');
  assert.strictEqual(keyName(ev('s', { ctrlKey: true })), 'Mod+S');
});

test('typing in fields does not trigger shortcuts', () => {
  assert.ok(isTyping({ tagName: 'INPUT', type: 'text' }));
  assert.ok(isTyping({ tagName: 'INPUT', type: 'number' }));
  assert.ok(isTyping({ tagName: 'SELECT' }));
  assert.ok(!isTyping({ tagName: 'INPUT', type: 'checkbox' }));
  assert.ok(!isTyping({ tagName: 'BUTTON' }));
  const calls = [];
  const map = { 'Space': () => calls.push('play'), 'A': () => false, 'ArrowLeft': () => calls.push('prev') };
  assert.ok(handleKey(map, ev(' ')));
  assert.ok(!handleKey(map, ev(' ', { target: { tagName: 'INPUT', type: 'text' } })), 'space types a space in a field');
  assert.ok(!handleKey(map, ev('ArrowLeft', { target: { tagName: 'INPUT', type: 'range' } })), 'arrows still move a slider');
  const passed = ev('a');
  assert.ok(!handleKey(map, passed), 'handler returning false lets the event through');
  assert.ok(!passed.prevented);
  assert.ok(!handleKey(map, ev('x')));
  assert.deepStrictEqual(calls, ['play']);
});

test('tooltips show the shortcut and label icon-only controls', () => {
  const el = (attrs, text) => ({ getAttribute: (k) => attrs[k] || null, setAttribute(k, v) { attrs[k] = v; }, textContent: text || '', attrs });
  assert.strictEqual(tipHtml(el({ 'data-tip': 'Play <now>', 'data-key': 'Space' })), 'Play &lt;now&gt;<kbd>Space</kbd>');
  const iconOnly = el({ 'data-tip': 'Zoom in' });
  const withText = el({ 'data-tip': 'Preview every size' }, 'Preview all');
  labelTips({ querySelectorAll: () => [iconOnly, withText] });
  assert.strictEqual(iconOnly.attrs['aria-label'], 'Zoom in');
  assert.strictEqual(withText.attrs['aria-label'], undefined, 'visible text is the accessible name');
});
