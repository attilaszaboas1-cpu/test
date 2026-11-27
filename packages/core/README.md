# GDH Cast core

Shared code for the GDH Cast Figma plugins: GDH Cast Banner (`packages/banner`), and
GDH Cast Email (`packages/email`, planned).

- `figma/`: main-thread helpers (layer tree, selection, image export, plugin-data storage, RPC)
- `ui/`: UI helpers and components (RPC client, icons, layer tree row, images, tooltips,
  shortcuts, `base.css` with Figma UI3 tokens)
- `zip.js`, `text.js`: used by both sides

Plugins `require('../../core/…')`, and `tools/build.js` bundles each plugin into single files.
