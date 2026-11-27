// Keyboard shortcuts for plugin UIs. Keys are ignored while typing in a field.

// Normalised name for a keydown event: "Space", "ArrowLeft", "A", "Shift+A", "Mod+S"…
function keyName(e) {
  let k = e.key === ' ' ? 'Space' : e.key;
  if (k.length === 1) k = k.toUpperCase();
  const mods = [];
  if (e.metaKey || e.ctrlKey) mods.push('Mod');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey && k.length > 1) mods.push('Shift'); // "?" already implies Shift
  return mods.concat(k).join('+');
}

function isTyping(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true;
  if (tag !== 'INPUT') return false;
  return ['checkbox', 'radio', 'range', 'button'].indexOf(target.type) === -1;
}

/*
 * map: { "Space": fn, "ArrowLeft": fn, … }. A handler returning false lets the event
 * through; anything else prevents the default action.
 */
function handleKey(map, e) {
  if (isTyping(e.target)) return false;
  if (e.target && e.target.type === 'range' && /^Arrow/.test(e.key)) return false;
  const fn = map[keyName(e)];
  if (!fn) return false;
  if (fn(e) === false) return false;
  e.preventDefault();
  return true;
}

function bindShortcuts(doc, map) {
  doc.addEventListener('keydown', (e) => handleKey(map, e));
}

module.exports = { keyName, isTyping, handleKey, bindShortcuts };
