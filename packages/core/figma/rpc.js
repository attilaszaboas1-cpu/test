// Main-thread side of the UI ↔ Figma RPC. The UI sends { type:'call', id, method, params };
// each call gets { type:'response', id, result } or { type:'response', id, error }.
function serve(handlers) {
  const onMessage = async (msg) => {
    if (!msg || msg.type !== 'call') return;
    try {
      const handler = handlers[msg.method];
      if (!handler) throw new Error('Unknown method ' + msg.method);
      const result = await handler(msg.params || {});
      figma.ui.postMessage({ type: 'response', id: msg.id, result: result });
    } catch (e) {
      figma.ui.postMessage({ type: 'response', id: msg.id, error: String(e && e.message || e) });
    }
  };
  figma.ui.onmessage = onMessage;
  return onMessage;
}

module.exports = { serve };
