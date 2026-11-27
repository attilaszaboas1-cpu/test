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
  return createImageBitmap(new Blob([img.bytes], { type: MIME[img.ext] }));
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

module.exports = { MIME, DEFAULT_EXPORT, exportOptions, cropBox, canvasBytes, decode, compressImage, processImage };
