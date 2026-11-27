# GDH Cast Email (planned)

Reserved for the **GDH Cast Email** Figma plugin. Like `packages/banner` (GDH Cast Banner),
it will build on `packages/core`: the layer tree, image export, saved sessions, zip writer
and UI components.

To add it, create `manifest.json` (name "GDH Cast Email", with its own id),
`plugin.config.js` and `src/` here, copying the banner package's layout. Then
`npm run build` produces its `code.js` and `ui.html`.
