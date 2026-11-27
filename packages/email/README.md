# Email (planned)

Reserved for a separate email plugin. It will reuse `packages/core` (layer tree,
image export, saved sessions, zip writer, UI components) like `packages/banner` does.

To add it: create `manifest.json`, `plugin.config.js` and `src/` here (copy the
banner package's layout), then `npm run build` produces its `code.js` and `ui.html`.
