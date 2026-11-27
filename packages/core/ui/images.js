// Image handling in the UI: export options, cropping to the frame and compression.
// Browser-only parts (canvas) are only touched when an image actually needs work.
const MIME = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' };
const DEFAULT_EXPORT = { mode: 'framed', scale: 2, format: 'png' };

function exportOptions(saved) {
  return Object.assign({}, DEFAULT_EXPORT, saved);
}

/*
 * The part of an exported layer that lies inside the frame ("Framed" crop).
 * raw: { x, y, width, height } relative to the frame; frame: { W, H }.
 * Returns null when nothing is inside, else { x0, y0, x1, y1, cropped }.
 */
function cropBox(raw, frame) {
  const x0 = Math.max(0, raw.x), y0 = Math.max(0, raw.y);
  const x1 = Math.min(frame.W, raw.x + raw.width), y1 = Math.min(frame.H, raw.y + raw.height);
  if (x1 <= x0 || y1 <= y0) return null;
  const cropped = x0 > raw.x + 0.5 || y0 > raw.y + 0.5 || x1 < raw.x + raw.width - 0.5 || y1 < raw.y + raw.height - 0.5;
  return { x0, y0, x1, y1, cropped };
}

function canvasBytes(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Image encoding failed'));
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
    }, type, quality);
  });
}

async function decode(img) {
  const blob = new Blob([img.bytes], { type: MIME[img.ext] });
  if (img.ext !== 'svg') return createImageBitmap(blob);
  // createImageBitmap can't read SVG blobs; go through an <img>.
  const url = URL.createObjectURL(blob);
  try {
    const el = new Image();
    el.src = url;
    await el.decode();
    return el;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Re-encodes an opaque image as JPG when that is smaller; transparent PNGs are kept.
async function compressImage(img) {
  const bmp = await decode(img);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const g = canvas.getContext('2d');
  g.drawImage(bmp, 0, 0);
  if (img.ext === 'png') {
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return img; // keep transparency
  }
  const jpg = await canvasBytes(canvas, 'image/jpeg', 0.82);
  return jpg.length < img.bytes.length ? Object.assign({}, img, { ext: 'jpg', bytes: jpg }) : img;
}

// Crops to the frame ("Framed", frame given) and optionally compresses. SVGs pass through.
async function processImage(raw, frame, compress) {
  if (raw.ext === 'svg') return raw;
  let img = raw;
  try {
    if (frame) {
      const box = cropBox(raw, frame);
      if (!box) return null;
      if (box.cropped) {
        const bmp = await decode(raw);
        const sx = bmp.width / raw.width, sy = bmp.height / raw.height;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((box.x1 - box.x0) * sx));
        canvas.height = Math.max(1, Math.round((box.y1 - box.y0) * sy));
        canvas.getContext('2d').drawImage(bmp, Math.round((box.x0 - raw.x) * sx), Math.round((box.y0 - raw.y) * sy), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        img = Object.assign({}, raw, { x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0, bytes: await canvasBytes(canvas, MIME[raw.ext], 0.9) });
      }
    }
    if (compress) img = await compressImage(img);
  } catch (e) {
    console.warn('Image processing failed', e);
  }
  return img;
}

/*
 * Flattens layers into one image (e.g. a banner's static backup).
 * spec: { width, height, scale, background:{ css, bytes?, ext? }, border?: color,
 *         layers:[{ image:{bytes,ext,x,y,width,height}, mask?:{…same}, motion?:{x,y,s,r} }] }
 * Layers are drawn in order (back → front). A mask clips its layer by the mask's alpha,
 * like CSS mask-image. Motion is a translate/scale/rotate around the layer's centre.
 * Returns { bytes, ext, width, height }.
 */
async function composeImage(spec, type, quality) {
  const scale = spec.scale || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.width * scale);
  canvas.height = Math.round(spec.height * scale);
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  // JPEG has no alpha: start from white so transparent areas don't turn black.
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, spec.width, spec.height);
  const bg = spec.background || {};
  if (bg.css && bg.css !== 'transparent') {
    g.fillStyle = bg.css;
    g.fillRect(0, 0, spec.width, spec.height);
  }
  if (bg.bytes) g.drawImage(await decode(bg), 0, 0, spec.width, spec.height);

  for (const layer of spec.layers || []) {
    const img = layer.image;
    const bmp = await decode(img);
    let source = bmp;
    let box = { x: img.x, y: img.y, w: img.width, h: img.height };
    if (layer.mask) {
      // Draw the layer into the mask's box, then keep only what the mask covers.
      const m = layer.mask;
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(m.width * scale));
      off.height = Math.max(1, Math.round(m.height * scale));
      const o = off.getContext('2d');
      o.scale(scale, scale);
      drawWithMotion(o, bmp, { x: img.x - m.x, y: img.y - m.y, w: img.width, h: img.height }, layer.motion);
      o.globalCompositeOperation = 'destination-in';
      o.drawImage(await decode(m), 0, 0, m.width, m.height);
      source = off;
      box = { x: m.x, y: m.y, w: m.width, h: m.height };
      g.drawImage(source, box.x, box.y, box.w, box.h);
      continue;
    }
    drawWithMotion(g, source, box, layer.motion);
  }

  if (spec.border) {
    g.strokeStyle = spec.border;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, spec.width - 1, spec.height - 1);
  }
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const bytes = await canvasBytes(canvas, ext === 'png' ? 'image/png' : 'image/jpeg', quality === undefined ? 0.85 : quality);
  return { bytes: bytes, ext: ext, width: canvas.width, height: canvas.height };
}

function drawWithMotion(g, src, box, motion) {
  if (!motion) { g.drawImage(src, box.x, box.y, box.w, box.h); return; }
  g.save();
  g.translate(box.x + box.w / 2 + (motion.x || 0), box.y + box.h / 2 + (motion.y || 0));
  g.rotate((motion.r || 0) * Math.PI / 180);
  g.scale(motion.s || 1, motion.s || 1);
  g.drawImage(src, -box.w / 2, -box.h / 2, box.w, box.h);
  g.restore();
}

module.exports = { MIME, DEFAULT_EXPORT, exportOptions, cropBox, canvasBytes, decode, compressImage, processImage, composeImage };
