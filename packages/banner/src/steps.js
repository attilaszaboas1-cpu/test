/*
 * The three steps of the flow (Layers → Animate → Export) and what each still needs.
 * Pure: the UI passes in its state and renders the result in the stepper and the
 * Export checklist.
 *
 * input: {
 *   ctx:      null | { info:{width,height}, session, index }   the banner being edited
 *   pkg:      package settings { channel, exits:[{name,url}], exclude }
 *   included: banners that will be exported [{ id, width, height, name }]
 *   zipSizes: { [bannerId]: { bytes } | { error } }            measured zips
 *   sizeLimit(w, h) → bytes
 * }
 * Each issue: { text, fix, level }. fix names the UI action that resolves it; level 'error'
 * blocks the download, 'warning' is shown but doesn't block.
 */
const STEPS = [
  { id: 'layers', n: 1, label: 'Layers' },
  { id: 'animate', n: 2, label: 'Animate' },
  { id: 'export', n: 3, label: 'Export' }
];

const URL_RE = /^https?:\/\/[^\s/?#]+\.[^\s/?#]+(\S*)$/i;

function validUrl(url) {
  return URL_RE.test(String(url || '').trim());
}

function kb(bytes) {
  return Math.round(bytes / 1000) + ' KB';
}

function layerIssues(ctx) {
  if (!ctx) return [{ text: 'Choose a banner frame', fix: 'choose-frame', level: 'error' }];
  const els = ctx.session.elements;
  const issues = [];
  if (!els.length) issues.push({ text: 'Add at least one layer to the banner', fix: 'go-layers', level: 'error' });
  const missing = els.filter((el) => !ctx.index[el.id]);
  if (missing.length) issues.push({ text: missing.length === 1 ? '“' + missing[0].name + '” was deleted in Figma' : missing.length + ' layers were deleted in Figma', fix: 'go-animate', level: 'warning' });
  return issues;
}

function animateIssues(ctx) {
  if (!ctx || !ctx.session.elements.length) return [];
  const never = ctx.session.elements.filter((el) => ctx.index[el.id] && !el.scenes.some((sc) => sc.on));
  if (!never.length) return [];
  return [{ text: never.length === 1 ? '“' + never[0].name + '” isn’t shown in any frame' : never.length + ' layers aren’t shown in any frame', fix: 'go-animate', level: 'warning' }];
}

function exportIssues(input) {
  const pkg = input.pkg;
  const issues = [];
  if (!pkg.channel) issues.push({ text: 'Choose a channel', fix: 'focus-channel', level: 'error' });
  const main = pkg.exits[0];
  if (!main || !String(main.url || '').trim()) issues.push({ text: 'Add the click-through URL', fix: 'focus-exit', level: 'warning' });
  else if (!validUrl(main.url)) issues.push({ text: 'The click-through URL must start with https://', fix: 'focus-exit', level: 'warning' });
  pkg.exits.slice(1).forEach((x, i) => {
    if (!validUrl(x.url)) issues.push({ text: '“' + (x.name || 'Exit ' + (i + 2)) + '” needs a valid URL', fix: 'focus-exit', level: 'warning' });
  });
  if (!input.included.length) issues.push({ text: 'Include at least one size', fix: 'focus-sizes', level: 'error' });
  input.included.forEach((b) => {
    const z = input.zipSizes[b.id];
    const label = b.width + '×' + b.height;
    if (z && z.error) issues.push({ text: label + ' could not be exported: ' + z.error, fix: 'focus-sizes', level: 'error' });
    else if (z && z.bytes > input.sizeLimit(b.width, b.height)) {
      issues.push({ text: label + ' is ' + kb(z.bytes) + ', over the ' + kb(input.sizeLimit(b.width, b.height)) + ' limit', fix: 'focus-sizes', level: 'warning' });
    }
  });
  return issues;
}

// → [{ id, n, label, issues, done }]
function stepStatus(input) {
  const ctx = input.ctx;
  const out = {
    layers: layerIssues(ctx),
    animate: animateIssues(ctx),
    export: exportIssues(input)
  };
  return STEPS.map((s) => Object.assign({}, s, { issues: out[s.id], done: out[s.id].length === 0 && !!ctx && ctx.session.elements.length > 0 }));
}

// Every issue, in step order, tagged with its step.
function allIssues(status) {
  return status.reduce((all, s) => all.concat(s.issues.map((i) => Object.assign({ step: s.id }, i))), []);
}

// Issues that block the download.
function blockers(status) {
  return allIssues(status).filter((i) => i.level === 'error');
}

module.exports = { STEPS, validUrl, stepStatus, allIssues, blockers };
