// Banner Automation — Figma main thread.
// Serves the layer tree of a banner frame, persists sessions as plugin data and
// exports the layers the user added to the HTML as images. Generic pieces live in core.
const tree = require('../../core/figma/tree');
const storage = require('../../core/figma/storage');
const imageExport = require('../../core/figma/export');
const selection = require('../../core/figma/selection');
const { serve } = require('../../core/figma/rpc');

figma.showUI(__html__, { width: 1120, height: 800, themeColors: true, title: 'Banner Automation' });

const SESSION_KEY = 'ba.session';
const SNAPSHOT_KEY = 'ba.snapshot';
const PACKAGE_KEY = 'ba.package';

function listBanners() {
  return tree.listTopFrames(figma.currentPage).map((f) => {
    const session = storage.readJSON(f, SESSION_KEY);
    return Object.assign(tree.frameInfo(f), { elements: session && session.elements ? session.elements.length : 0 });
  });
}

function sendSelection() {
  const s = selection.selectionInfo();
  figma.ui.postMessage({ type: 'selection', ids: s.ids, bannerId: s.frameId });
}

serve({
  async init() {
    const s = selection.selectionInfo();
    return {
      banners: listBanners(),
      current: s.frameId,
      pkg: storage.readJSON(figma.root, PACKAGE_KEY),
      selection: s.ids
    };
  },

  async listBanners() {
    return listBanners();
  },

  async getBanner(p) {
    const frame = await selection.getNode(p.id);
    return {
      info: tree.frameInfo(frame),
      tree: tree.serializeTree(frame),
      session: storage.readJSON(frame, SESSION_KEY)
    };
  },

  async saveSession(p) {
    storage.writeJSON(await selection.getNode(p.id), SESSION_KEY, p.session);
    return true;
  },

  async saveSnapshot(p) {
    storage.writeSnapshot(await selection.getNode(p.id), SNAPSHOT_KEY, p.session);
    return true;
  },

  async loadSnapshot(p) {
    return storage.readSnapshot(await selection.getNode(p.id), SNAPSHOT_KEY);
  },

  async savePackage(p) {
    storage.writeJSON(figma.root, PACKAGE_KEY, p.pkg);
    return true;
  },

  async exportAssets(p) {
    return imageExport.exportAssets(await selection.getNode(p.id), p);
  },

  async locate(p) {
    return selection.locate(p.id);
  },

  async selectParent() {
    return selection.selectParent();
  },

  async notify(p) {
    figma.notify(p.text, { error: !!p.error });
    return true;
  }
});

figma.on('selectionchange', sendSelection);
figma.on('currentpagechange', async () => {
  figma.ui.postMessage({ type: 'banners', banners: listBanners() });
  sendSelection();
});
