// Small DOM helpers for plugin UIs.
const $ = (id) => document.getElementById(id);

function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type: type || 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

module.exports = { $, download };
