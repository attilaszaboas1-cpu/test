// Image export of layers relative to their frame: scale (1x/2x/3x) and format (PNG/JPG/SVG).
// Cropping ("Framed") and compression happen in the UI (see core/ui/images.js).

function round(n) {
  return Math.round(n * 100) / 100;
}

function exportSettings(format, scale) {
  if (format === 'svg') return { format: 'SVG' };
  if (format === 'jpg') return { format: 'JPG', constraint: { type: 'SCALE', value: scale } };
  return { format: 'PNG', constraint: { type: 'SCALE', value: scale } };
}

function solidFillCss(fills) {
  if (!Array.isArray(fills)) return null;
  const visible = fills.filter((f) => f.visible !== false);
  if (visible.length === 0) return 'transparent';
  if (visible.length === 1 && visible[0].type === 'SOLID') {
    const c = visible[0].color;
    const a = visible[0].opacity === undefined ? 1 : visible[0].opacity;
    return 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',' + round(a) + ')';
  }
  return null;
}

// A frame's own fill: CSS when it is a single solid colour, otherwise a PNG of the fill
// rendered through a temporary rectangle (removed again even if the export fails).
async function exportBackground(frame, scale) {
  const css = solidFillCss(frame.fills);
  if (css) return { css: css };
  const rect = figma.createRectangle();
  try {
    rect.resize(frame.width, frame.height);
    rect.fills = frame.fills;
    const bytes = await rect.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
    return { css: 'transparent', bytes: bytes, ext: 'png' };
  } finally {
    rect.remove();
  }
}

// Exports one node relative to `origin` (the frame's top-left). A hidden node is shown for
// the export; layers listed in opts.hide (elements nested inside this one that are animated
// separately) are hidden so they aren't baked in twice. Visibility is always restored.
async function exportNode(node, origin, opts) {
  const restore = [];
  try {
    if (!node.visible) {
      node.visible = true;
      restore.push(node);
    }
    for (const id of opts.hide || []) {
      const child = await figma.getNodeByIdAsync(id);
      if (child && child.visible) {
        child.visible = false;
        restore.push(child);
      }
    }
    const bounds = node.absoluteRenderBounds;
    if (!bounds || bounds.width < 0.01 || bounds.height < 0.01) return null;
    const format = opts.format || 'png';
    const bytes = await node.exportAsync(exportSettings(format, Number(opts.scale) || 2));
    return {
      x: round(bounds.x - origin.x),
      y: round(bounds.y - origin.y),
      width: round(bounds.width),
      height: round(bounds.height),
      ext: format,
      bytes: bytes
    };
  } finally {
    for (const n of restore) n.visible = !n.visible;
  }
}

/*
 * Exports layers and masks of a frame.
 * params: { items:[{id,key,scale,format,hide}], masks:[{id,key,scale}], background:bool }
 * Returns { items:{[key]:image}, masks:{[key]:image}, warnings:[], background?, radius? }
 */
async function exportAssets(frame, params) {
  const origin = frame.absoluteBoundingBox;
  const result = { items: {}, masks: {}, warnings: [] };

  for (const item of params.items || []) {
    const node = await figma.getNodeByIdAsync(item.id);
    if (!node || node.removed) {
      result.warnings.push('A layer in the HTML no longer exists.');
      continue;
    }
    try {
      const out = await exportNode(node, origin, item);
      if (out) result.items[item.key] = out;
      else result.warnings.push('"' + node.name + '" is empty and was skipped.');
    } catch (e) {
      result.warnings.push('Could not export "' + node.name + '": ' + e.message);
    }
  }

  for (const mask of params.masks || []) {
    const node = await figma.getNodeByIdAsync(mask.id);
    if (!node) continue;
    try {
      const out = await exportNode(node, origin, { format: 'png', scale: mask.scale });
      if (out) result.masks[mask.key] = out;
    } catch (e) {
      result.warnings.push('Could not export mask "' + node.name + '": ' + e.message);
    }
  }

  if (params.background) {
    result.background = await exportBackground(frame, 2);
    result.radius = typeof frame.cornerRadius === 'number' ? frame.cornerRadius : 0;
  }
  return result;
}

module.exports = { round, exportSettings, solidFillCss, exportBackground, exportNode, exportAssets };
