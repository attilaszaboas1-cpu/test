// UI side of the UI ↔ Figma RPC (see core/figma/rpc.js).
// target: where calls are posted (window.parent inside Figma).
function createRpc(target) {
  let seq = 0;
  const waiting = {};
  return {
    call(method, params) {
      return new Promise((resolve, reject) => {
        const id = ++seq;
        waiting[id] = { resolve, reject };
        target.postMessage({ pluginMessage: { type: 'call', id, method, params: params || {} } }, '*');
      });
    },
    // Settles the pending call for a { type:'response' } message; returns true if it was one.
    handle(m) {
      if (!m || m.type !== 'response') return false;
      const w = waiting[m.id];
      if (!w) return true;
      delete waiting[m.id];
      if (m.error) w.reject(new Error(m.error));
      else w.resolve(m.result);
      return true;
    },
    pending() {
      return Object.keys(waiting).length;
    }
  };
}

module.exports = { createRpc };
