// 24px stroke icons used by every plugin UI.
const ICONS = {
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  'select': '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M4 15v4a1 1 0 0 0 1 1h4"/><path d="M13 13l8 3-3.5 1.5L16 21z"/>',
  'history': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  'save': '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>',
  'search': '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  'filter': '<path d="M4 6h16M7 12h10M10 18h4"/>',
  'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  'package': '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  'layout': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M9 12h12"/>',
  'refresh': '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  'play': '<path d="M7 4l13 8-13 8z"/>',
  'pause': '<path d="M8 5v14M16 5v14"/>',
  'restart': '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 3v6h6"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-up': '<path d="M6 15l6-6 6 6"/>',
  'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'close': '<path d="M6 6l12 12M18 6L6 18"/>',
  'external': '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  'download': '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  'files': '<path d="M9 3h7l4 4v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M16 3v4h4M5 7v13a1 1 0 0 0 1 1h9"/>',
  'locate': '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  'mask': '<path d="M9 4H5v16h4M15 4h4v16h-4M12 2v20"/>',
  'trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  'text': '<path d="M4 7V5h11v2M9.5 5v14M7.5 19h4M14 12v-1h7v1M17.5 11v8M16 19h3"/>',
  'frame': '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
  'group': '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  'image': '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/>',
  'shape': '<path d="M5.5 5.5h13v13h-13z"/>',
  'settings': '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  'loop': '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  'motion': '<path d="M3 17c3-7 6-7 9 0s6 7 9 0"/><path d="M18 6l3 0 0 3"/>',
  'star': '<path d="M12 3l2.8 6 6.2.6-4.8 4.2 1.4 6.2-5.6-3.2-5.6 3.2 1.4-6.2L3 9.6 9.2 9z"/>',
  'in': '<path d="M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/>',
  'out': '<path d="M15 17l5-5-5-5M20 12H8M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5"/>',
  'plus': '<path d="M12 6v12M6 12h12"/>',
  'minus': '<path d="M6 12h12"/>',
  'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  'more': '<circle cx="6" cy="12" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="18" cy="12" r=".9"/>',
  'warning': '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  'error': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
  'keyboard': '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  'cursor': '<path d="M6 4l12 7-5.5 1.5L10 18z"/>',
  'frame-select': '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/><path d="M12 10v4M10 12h4"/>',
  'chevron-down-sm': '<path d="M8 10l4 4 4-4"/>'
};

function icon(name) {
  return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

// Replaces <i data-icon="name"> placeholders in static markup.
function hydrateIcons(root) {
  root.querySelectorAll('i[data-icon]').forEach((i) => { i.outerHTML = icon(i.dataset.icon); });
}

module.exports = { ICONS, icon, hydrateIcons };
