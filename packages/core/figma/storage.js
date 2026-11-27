// Saved sessions: JSON stored as plugin data on a node (a frame, or figma.root).
function parseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function readJSON(node, key) {
  return parseJSON(node.getPluginData(key));
}

function writeJSON(node, key, value) {
  node.setPluginData(key, JSON.stringify(value));
}

// A snapshot is a timestamped copy the user can restore later.
function writeSnapshot(node, key, session, now) {
  writeJSON(node, key, { at: now === undefined ? Date.now() : now, session: session });
}

module.exports = { parseJSON, readJSON, writeJSON, writeSnapshot, readSnapshot: readJSON };
