// Figma-style tooltips for any element with data-tip (and optional data-key for a shortcut).
// Icon-only buttons must have one; data-tip also becomes the aria-label.
const { escapeHtml: esc } = require('../text');

function tipHtml(el) {
  const key = el.getAttribute('data-key');
  return esc(el.getAttribute('data-tip')) + (key ? '<kbd>' + esc(key) + '</kbd>' : '');
}

// Gives every [data-tip] without an accessible name an aria-label.
function labelTips(root) {
  root.querySelectorAll('[data-tip]').forEach((el) => {
    if (!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', el.getAttribute('data-tip'));
  });
}

function attachTooltips(doc) {
  const tip = doc.createElement('div');
  tip.id = 'tooltip';
  tip.hidden = true;
  tip.setAttribute('role', 'tooltip');
  doc.body.appendChild(tip);
  let timer = null;
  let current = null;

  const hide = () => { clearTimeout(timer); timer = null; current = null; tip.hidden = true; };
  const show = (el) => {
    if (!el.isConnected || !el.getAttribute('data-tip')) return;
    tip.innerHTML = tipHtml(el);
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
    let x = r.left + r.width / 2 - t.width / 2;
    let y = r.bottom + 6;
    if (y + t.height > vh - 4) y = r.top - t.height - 6;
    x = Math.max(4, Math.min(vw - t.width - 4, x));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  };
  const target = (e) => e.target.closest && e.target.closest('[data-tip]');

  doc.addEventListener('mouseover', (e) => {
    const el = target(e);
    if (el === current) return;
    hide();
    if (!el) return;
    current = el;
    timer = setTimeout(() => show(el), 450);
  });
  doc.addEventListener('focusin', (e) => { const el = target(e); if (el && el.matches(':focus-visible')) { current = el; show(el); } });
  doc.addEventListener('focusout', hide);
  doc.addEventListener('mousedown', hide, true);
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  doc.addEventListener('scroll', hide, true);
  const observer = new MutationObserver(() => {
    labelTips(doc);
    if (current && !current.isConnected) hide();
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  labelTips(doc);
  return { hide };
}

module.exports = { attachTooltips, labelTips, tipHtml };
