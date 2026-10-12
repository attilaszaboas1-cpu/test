# HTML5 Banner Animator (Figma plugin)

Turn a Figma frame into an animated HTML5 display banner, ready to upload to Google Ads, DV360, CM360 and most other ad networks.

You design the banner as a normal frame (e.g. 300×250). Each **top-level layer** in the frame becomes an element you can animate. You can preview the result live in the plugin and export a ZIP with `index.html` and its images.

## Install (development)

1. Open the **Figma desktop app**.
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Choose `manifest.json` from this folder.
4. Run it from **Plugins → Development → HTML5 Banner Animator**.

You don't need to build anything. The plugin is plain JavaScript (`code.js` + `ui.html`) with no dependencies.

## Workflow

1. **Design the banner frame.** Every direct child of the frame is animated as one unit, so group the layers that should move together (for example, "Headline" or "CTA button").
2. **Select the frame** (or any layer inside it) and run the plugin. If you select several frames, you can export all your banner sizes in one go.
3. Click **✨ Auto-animate** for a staggered starting point. Layer names help it choose:
   - `cta` / `button` layers get a pop entrance and a pulse.
   - `logo` layers get a zoom.
   - Text slides up.
   - A full-size background fades in.
4. Fine-tune each layer:
   - **Entrance**: fade, slide (with fade), fly (no fade), zoom, pop, blur or wipe; start time, duration, easing (including overshoot), distance.
   - **Emphasis**: pulse, heartbeat, float or shake, looping while the layer is visible.
   - **Exit**: any of the same effects, at a chosen time.
5. Set the **timeline length**, the number of **plays** (1–3× or forever) and the **clickTag** URL.
6. Click **Export HTML5 ZIP**, or **Download single HTML** for one file with the images inlined.

Your settings are saved in the Figma file. Duplicating a frame to make another size keeps its animations.

After you edit the design, click **↻ Refresh from Figma** to re-export the layer images.

## What gets exported

```
summer-sale_300x250.zip
├── index.html      # <meta name="ad.size">, clickTag, CSS @keyframes animation
└── images/
    ├── 01-background-shape.png
    ├── 02-headline.png
    └── …
```

- The animation is **pure CSS** (no JavaScript libraries), so the banners are small and accepted by ad validators.
- Click handling follows the standard `clickTag` convention: `<a href="javascript:window.open(window.clickTag)">`.
- Layers are exported at 1×, 2× or 3× PNG. You can optionally export vector shapes as SVG.
- Solid frame backgrounds become CSS. Gradient and image backgrounds are exported as an image.
- The plugin shows the ZIP size and warns you above the common 150 KB limit.
- The banner respects `prefers-reduced-motion`.
- When you export several frames, you get `banners.zip` with one upload-ready ZIP per size.

## Tips and limitations

- Text is exported as images, so it looks exactly like Figma and no web fonts are needed.
- Don't put a mask directly in the banner frame. Put the mask inside a group with the layers it masks.
- Ad networks usually require animation to stop within 30 seconds. Keep timeline × plays ≤ 30 s. When a banner stops, it shows the final state of the timeline, so leave your end-frame layers without exits.
