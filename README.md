# Banner Automation (Figma plugin)

Turn Figma banner frames into animated HTML5 ads, then package them for an ad channel (GWD, HTML5, AE, WPPP, BAN).

## Install (development)

1. Open the **Figma desktop app**.
2. Go to **Plugins → Development → Import plugin from manifest…** and choose `packages/banner/manifest.json`.
3. Run it from **Plugins → Development → Banner Automation**.

The committed `code.js` and `ui.html` are already built, so you don't need to build anything to use the plugin.

> Imported the plugin before this repo became a monorepo? Remove the old entry in Figma and import `packages/banner/manifest.json` instead.

## How it works

The plugin follows Figma's own UI (UI3 type, spacing, colours and icons, light and dark theme). The header holds the **frame picker**, the three steps, and a **⋯** menu. The preview stays on the right in every step.

The steps show their state: a ✓ when complete, and a badge with the number of open issues (red when something blocks the download, amber for warnings). Hover over a step to see what's missing.

### 1 · Layers

- Pick the banner frame from the header, from the list in the empty panel, or by selecting it on the canvas.
- The layer tree looks like Figma's layers panel. Hover over a row and click **+** to add it to the banner, or select layers on the canvas and press **A**.
- Clicking a row selects the layer on the canvas. Shift-click selects a range and Cmd/Ctrl-click adds to the selection. The panel under the tree shows the selected layer with **Add to banner**, or, once it's added, its export settings:
  - **Crop**: Framed crops to the banner. Full keeps the whole layer, for layers that move in from outside.
  - **Scale**: 1x, 2x or 3x.
  - **Format**: PNG, JPG or SVG.
  - **Clip to mask**, when the layer sits under a mask. The mask becomes a CSS `mask-image`, so a line can slide through its window.
- Search and the filter button (text, images, shapes, groups, only layers in the banner, hidden layers) switch the tree to a flat list. ↑ selects the parent on the canvas.
- Layers that can't be exported, such as masks, slices and FigJam objects, are dimmed, and a tooltip says why. If a group and some of its children are both added, the children are left out of the group's image.

### 2 · Animate

- **Frames**: the banner is split into frames, each with its own duration. Click a frame to jump the preview to it. You can also set **Plays** (1–3 or loop) and **End on last frame**, which makes the final play stop on the last frame instead of running its exits.
- **Layers** run front to back. Each row is collapsed and shows dots for the frames it appears in. Click a row to open its editor:
  - **Shown in**: which frames the layer appears in.
  - **Entrance / Exit**: effect, delay and duration for the frame being edited. A negative exit delay starts the exit before the frame ends; for example, −0.5 s with a 0.5 s duration finishes exactly at the end of the frame.
  - **Loop**: a repeating effect (pulse, heartbeat, float, bounce, shake, wiggle, blink). **Motion**: continuous movement while the layer is on screen. **Click & export**: which exit a click on the layer opens, plus its crop, scale and format.
  - **Advanced: easing and distance** is a disclosure that stays closed by default (this replaces the old FAST/ADV switch).
- ▲▼ on hover changes the stacking order. Shift-click several rows to copy one layer's animation to the others, or to remove them together.
- If a layer stays on screen into the next frame with a "None (cut)" exit and entrance, it carries over without flickering.

### 3 · Export

- A checklist at the top lists what's still missing, each with a **Fix** link. Without a channel or a size, **Download** stays disabled. A missing or malformed URL and sizes over the limit are warnings that don't block.
- **Channel**:

  | Channel | Click-through implementation |
  |---|---|
  | GWD | Loads `Enabler.js` (Google Studio / CM360). Exits are wired with `Enabler.exit(name, url)` once Enabler fires `INIT`; the animation stays paused on its first frame until `PAGE_LOADED`. Opened without Enabler (locally), it plays at once and exits use `window.open`. |
  | HTML5 | `clickTag` / `clickTag2`… variables with `window.open(window.clickTag)`. Works for Google Ads, DV360 and most DSPs. |
  | AE | Adform: loads `Adform.DHTML.js` with Adform's `document.write` / `window.API_URL` snippet, reads `clickTAG`, `clickTAG2`… with `dhtml.getVar`, and adds a `manifest.json`. |
  | WPPP | Same output as HTML5 for now (kept separate so it can diverge). |
  | BAN | Same output as HTML5 for now (kept separate so it can diverge). |

  A Xandr build (`APPNEXUS.getClickTag()`) is still in the generator but hidden from the menu.
- **Click-through**: the main exit URL, plus extra exits for single layers.
- **Sizes**: each banner frame with layers in it, with its **zipped weight** against the upload limit: 150 KB, or 200 KB for 300×600 (1 KB = 1000 bytes). The weight turns red when over.
- **Options**: compress images (opaque images are re-encoded as JPG when that's smaller), and a 1 px border with its colour.
- **Preview all** plays every size side by side. **Download** gives you one upload-ready ZIP per size, bundled into `banners_<channel>.zip` when there are several. Files are deflate-compressed.
- **⋯ › Copy animation to other sizes** copies the animation to other frames, matching layers by name.

The animation is pure CSS `@keyframes` with no runtime library. The output includes `<meta name="ad.size">` and respects `prefers-reduced-motion`.

### Keyboard shortcuts

| Key | Action |
|---|---|
| Space | Play / pause |
| ← → | Previous / next frame |
| A | Add the layers selected on the canvas |
| 1 2 3 | Go to Layers, Animate, Export |
| O | Show / hide layer outlines |
| + − 0 | Zoom in, out, to fit |
| Esc | Close menus and dialogs |
| ? | List the shortcuts |

Every icon-only button has a tooltip, which also shows its shortcut.

## Repository layout

```
packages/
  core/                shared by every plugin
    figma/             main thread: layer tree (tree.js), selection sync (selection.js),
                       image export (export.js), saved sessions (storage.js), RPC (rpc.js)
    ui/                UI: RPC client, icons, layer tree component (layers.js),
                       crop/compress (images.js), tooltips (tooltip.js), shortcuts (keys.js),
                       base.css (UI3 tokens from Figma's theme variables, shared components)
    zip.js             ZIP writer (deflate)
    text.js            HTML escaping, slugs
  banner/              Banner Automation plugin
    manifest.json      import this in Figma
    code.js, ui.html   built files (committed)
    plugin.config.js   build inputs
    src/main.js        Figma main thread
    src/app.js         UI logic
    src/steps.js       what each step still needs (stepper, Export checklist)
    src/generator.js   HTML5 banner generator
    src/ui.css, src/ui.template.html
  email/               reserved for the email plugin
tools/
  build.js             builds every packages/*/plugin.config.js into code.js + ui.html
  bundle.js            tiny CommonJS bundler (Figma needs single files)
```

Each plugin has its own `manifest.json`, so you can import it into Figma on its own. Plugin code uses `require('../../core/...')`, and the build turns that into single files. There are no npm dependencies.

## Development

```
npm run build   # regenerate every plugin's code.js and ui.html after editing sources
npm test        # all tests (core, plugins, bundler)
```

The tests run `code.js` against a fake Figma API (`packages/core/test/fake-figma.js`). They also fail when the committed `code.js` or `ui.html` is out of date with its sources.

Sessions are stored as plugin data on each banner frame, and package settings are stored on the document.
