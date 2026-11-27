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
 *   checks:   { [bannerId]: { audit:{clickTag,targets,hardcoded}, staticBytes?, staticError? } }
 * }
 * Export issues carry the pharma rule they belong to (rule: 'static' |
 * 'clicktag'), so the Export step can show each rule with its result.
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
    const c = input.checks && input.checks[b.id];
    if (!c) return;
    if (c.staticError) issues.push({ text: label + ': the static backup could not be made: ' + c.staticError, fix: 'focus-sizes', level: 'error', rule: 'static' });
    if (c.audit) {
      if (c.audit.targets) issues.push({ text: label + ' has ' + c.audit.targets + ' target attribute' + (c.audit.targets > 1 ? 's' : ''), fix: 'focus-channel', level: 'error', rule: 'clicktag' });
      if (c.audit.hardcoded.length) issues.push({ text: label + ' links to ' + c.audit.hardcoded[0] + ' directly instead of through clickTag', fix: 'focus-channel', level: 'error', rule: 'clicktag' });
    }
  });
  const anyAudit = input.included.map((b) => input.checks && input.checks[b.id] && input.checks[b.id].audit).find(Boolean);
  if (pkg.channel && anyAudit && !anyAudit.clickTag) {
    issues.push({ text: 'This channel doesn’t use clickTag (GWD uses Enabler exits); choose HTML5, AE, WPPP or BAN', fix: 'focus-channel', level: 'warning', rule: 'clicktag' });
  }
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

/*
 * The pharma rules checked on the Export step, each with its result.
 * measured: true once every included size has been built and checked.
 * → [{ id, label, state: 'ok' | 'warning' | 'error' | 'pending', issues }]
 */
const PHARMA_RULES = [
  { id: 'static', label: 'Static backup image from the last frame' },
  { id: 'clicktag', label: 'clickTag only, no target attributes' }
];

function pharmaChecks(status, measured) {
  const issues = allIssues(status).filter((i) => i.rule);
  return PHARMA_RULES.map((r) => {
    const mine = issues.filter((i) => i.rule === r.id);
    const state = mine.some((i) => i.level === 'error') ? 'error' : mine.length ? 'warning' : measured ? 'ok' : 'pending';
    return Object.assign({}, r, { state: state, issues: mine });
  });
}

module.exports = { STEPS, PHARMA_RULES, validUrl, stepStatus, allIssues, blockers, pharmaChecks };
