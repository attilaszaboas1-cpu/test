// Plain-data helpers for saved sessions.
const clone = (v) => JSON.parse(JSON.stringify(v));

// Deep-merges saved data over defaults: missing keys get defaults, extra keys are kept,
// arrays and primitives in `val` win.
function merge(def, val) {
  if (val === undefined || val === null) return clone(def);
  if (typeof def !== 'object' || def === null || Array.isArray(def)) return val;
  const out = {};
  Object.keys(def).forEach((k) => { out[k] = merge(def[k], val[k]); });
  Object.keys(val).forEach((k) => { if (!(k in out)) out[k] = val[k]; });
  return out;
}

module.exports = { clone, merge };
