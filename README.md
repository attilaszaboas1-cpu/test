# Banner Automation (Figma plugin)

Turn Figma banner frames into animated HTML5 ads, then package them for an ad channel (GWD, HTML5, AE, WPPP, BAN).

## Install (development)

1. Open the **Figma desktop app**.
2. Go to **Plugins → Development → Import plugin from manifest…** and choose `manifest.json`.
3. Run it from **Plugins → Development → Banner Automation**.

The committed `ui.html` is already built, so you don't need to build anything to use the plugin.

## How it works

### Left panel: layers

- Selecting a banner frame in Figma (or any layer inside one) loads that frame's full layer tree.
- **+ Add** puts a layer into the HTML as an animated element. You can add any layer at any depth, such as a group, the line inside a masked group, or the CTA button frame.
- Each layer has its own export settings:
  - **Framed** crops the image to the banner. **Full** keeps the whole layer, which you need for elements that move in from outside the banner.
  - **1x/2x/3x** sets the export scale.
  - **PNG/JPG/SVG** sets the image format.
- If a layer sits under a mask, the mask icon clips it to that mask in the HTML. The mask becomes a CSS `mask-image`, so a line can slide through its window.
- If a group and some of its children are both added, the children are left out of the group's image so nothing appears twice.
- Searching and **Filters** (text, images, shapes, groups, "In HTML only", hidden layers) switch the tree to a flat list.
- The **toolbar** buttons:
  - **↑** selects the parent layer in Figma.
  - **→** adds the layers selected in Figma.
  - **The selection icon** follows the Figma selection.
  - **Save** stores a snapshot of the session, and **Restore session** goes back to it.

### Right panel: timeline and preview

- **Banner selector** switches between frames on the page.
- **Layout icon** copies the animation to other sizes, matching layers by name.
- **Refresh** re-exports the layers after you edit the design.
- **FRAMES −/+** splits the banner into frames (scenes), each with its own duration.
  - **Plays** sets 1–3 plays or forever.
  - **End on last frame** makes the final play stop on the last frame instead of running its exits.
- **Playback**: the scrubber, ▶/↺, **‹ F2 ›** to jump between frames, 👁 for element outlines, and zoom −/+/Fit.
- **Element cards** (front to back):
  - **▲▼** changes the stacking order. The link icon picks the element's click target (exit), and the trash icon removes it.
  - **Frame bars** (F1, F2…) set which frames the element appears in.
  - **In / Out** set the Delay, Preset and Duration for the current frame. A negative Out delay starts the exit before the frame ends; for example, −0.5 s with a 0.5 s duration finishes exactly at the end of the frame.
  - The **Loop** tab adds a repeating effect (pulse, heartbeat, float, bounce, shake, wiggle, blink) with a duration, delay and repeat count.
  - The **Motion** tab adds continuous movement while the element is on screen: slow zoom, drift, or custom move/scale/rotate.
  - The **Settings** tab holds the click target, crop/scale/format and mask clipping.
  - If an element stays on screen into the next frame with a "None (cut)" exit and entrance, it carries over without flickering.
- **FAST / ADV**: ADV adds easing and distance controls.

### Package

**Package** (bottom left) opens the Banner Package sheet:

- **Package settings**: border color, show border, compress images. With compression on, opaque images are re-encoded as JPG when that makes them smaller.
- **Exits**: the main exit plus extra exits. Elements can be bound to an exit with the link icon.
- **Sizes**: which configured banners to export.
- **Channel**:

  | Channel | Click-through implementation |
  |---|---|
  | GWD | Loads `Enabler.js` (Google Studio / CM360). Exits are wired with `Enabler.exit(name, url)` once Enabler fires `INIT`; the animation stays paused on its first frame until `PAGE_LOADED`. Opened without Enabler (locally), it plays at once and exits use `window.open`. |
  | HTML5 | `clickTag` / `clickTag2`… variables with `window.open(window.clickTag)`. Works for Google Ads, DV360 and most DSPs. |
  | AE | Adform: loads `Adform.DHTML.js` with Adform's `document.write` / `window.API_URL` snippet, reads `clickTAG`, `clickTAG2`… with `dhtml.getVar`, and adds a `manifest.json`. |
  | WPPP | Same output as HTML5 for now (kept separate so it can diverge). |
  | BAN | Same output as HTML5 for now (kept separate so it can diverge). |

  A Xandr build (`APPNEXUS.getClickTag()`) is still in the generator but hidden from the menu.

- **Preview** plays every size side by side.
- Each size shows its **zipped weight** against the upload limit: 150 KB, or 200 KB for 300×600 (1 KB = 1000 bytes). It turns red when over, and Download all warns about any size over the limit.
- **Download all** gives you one upload-ready ZIP per size. Files are deflate-compressed; images that don't get smaller are stored as-is. When you export several sizes, they come bundled in a single `banners_<channel>.zip`.

The animation is pure CSS `@keyframes` with no runtime library. The output includes `<meta name="ad.size">` and respects `prefers-reduced-motion`.

## Development

```
src/generator.js     HTML/CSS/ZIP generator (shared with the tests)
src/app.js           plugin UI logic
src/ui.css           UI styles
src/ui.template.html UI markup
code.js              Figma main thread (layer tree, plugin data, image export)
build.js             inlines src/ into ui.html
```

```
npm run build   # regenerate ui.html after editing src/
npm test        # generator unit tests
```

Sessions are stored as plugin data on each banner frame, and package settings are stored on the document.
