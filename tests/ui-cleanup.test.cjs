const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

test("layer edits preserve source identity and undo transforms, order and deletion", () => {
  const context = { window: {} };
  for (const file of ["layer-model.js", "edit-history.js"]) vm.runInNewContext(fs.readFileSync(path.join(root, "js", file), "utf8"), context);
  const model = context.window.KataCartLayerModel;
  const history = context.window.KataCartEditHistory.createEditHistory();
  const source = { filename: "base.png", img: {} };
  const face = { image: source, tr: { x: 0, y: 0, s: 1, r: 0, px: 1 } };
  const cart = { assets: [face] };
  model.ensure(face);
  history.record(cart, () => { face.tr.s = 2; });
  assert.equal(history.canUndo(cart), true);
  history.undo(cart);
  assert.equal(face.tr.s, 1);
  assert.equal(face.image, source);
  history.redo(cart);
  assert.equal(face.tr.s, 2);
  history.record(cart, () => model.duplicate(face));
  assert.equal(face.layers.length, 2);
  const id = face.activeLayerId;
  history.record(cart, () => { model.selected(face).opacity = 0.4; model.reorder(face, -1); });
  assert.equal(face.layers[0].id, id);
  history.record(cart, () => model.remove(face));
  history.undo(cart);
  assert.equal(face.layers.length, 2);
  assert.equal(model.selected(face).opacity, 0.4);
  history.undo(cart);
  assert.equal(face.layers[1].id, id);
  assert.equal(model.selected(face).opacity, 1);
});

class Element {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.nodes = new Map();
    this.style = {};
    this.dataset = {};
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
    };
    this.attributes = {};
    this.isConnected = true;
    this.hidden = false;
  }
  set innerHTML(value) { this.html = value; this.children = []; this.nodes.clear(); }
  get innerHTML() { return this.html || ""; }
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  append(child) { this.children.push(child); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return { width: 180, height: 100 }; }
}

function controls() {
  const U = { layoutButtons: [], settingsOpenBtns: [] };
  return new Proxy(U, { get(target, key) { return target[key] ??= new Element(); } });
}

function load(module, namespace, factory, document = new Element()) {
  document.createElement = () => { const node = new Element(); node.ownerDocument = document; return node; };
  const context = { window: { innerWidth: 1200, innerHeight: 800 }, document };
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", module), "utf8"), context);
  return context.window[namespace][factory];
}

test("created and renamed cart names remain literal text in the gallery", () => {
  const U = controls();
  const cart = { id: "one", name: '<img src=x onerror="alert(1)">', assets: [] };
  const S = { carts: [cart], galleryLayout: "grid" };
  const gallery = load("gallery.js", "KataCartGallery", "createGallery")({ S, U,
    tById: () => ({ id: "ps2-case", family: "Disc Case", name: "PS2" }),
  });
  for (const name of [cart.name, "Renamed <strong>cart</strong> & friends"]) {
    cart.name = name;
    gallery.renderGallery();
    const card = U.galleryList.children[1];
    assert.equal(card.querySelector(".cart-name").textContent, name);
    assert.ok(!card.innerHTML.includes(name));
  }
});

test("2D context-menu Fit View resets an idle view and requests a new frame", () => {
  const U = controls();
  const S = { view: { stage2dZoom: 3, stage2dPanX: 60, stage2dPanY: 40 }, chrome: {}, contextMenu: {} };
  const a = { type: "2d", image: null };
  let redraws = 0;
  const requestRender = () => redraws++;
  const renderer = load("render-2d.js", "KataCartRender2D", "createRender2D")({ S });
  const shell = load("workspace-shell.js", "KataCartWorkspaceShell", "createWorkspaceShell")({ S, U, requestRender });
  const input = load("workspace-input.js", "KataCartWorkspaceInput", "createWorkspaceInput")({
    S, U, asset: () => a, requestRender, openContextMenu: shell.openContextMenu,
    reset2DWorkspaceView: renderer.reset2DWorkspaceView,
  });
  input.bindWorkspaceInputs();
  U.stageCanvas.emit("contextmenu", { preventDefault() {}, clientX: 10, clientY: 20 });
  U.contextMenu.children.find((button) => button.innerHTML.includes("Fit View")).emit("click");
  assert.equal(S.view.stage2dZoom, 1);
  assert.equal(S.view.stage2dPanX, 0);
  assert.equal(S.view.stage2dPanY, 0);
  assert.equal(redraws, 1);
  assert.equal(S.contextMenu.open, false);
});

test("mapping debug enable and disable both request redraw on an idle workspace", () => {
  const U = controls();
  const S = { debug: { mapping: false } };
  let redraws = 0;
  const boot = load("boot-ui.js", "KataCartBootUI", "createBootUI")({ S, U, requestRender: () => redraws++ });
  boot.bindChromeAndSettingsUI();
  for (const checked of [true, false]) {
    U.debugMappingCheckbox.checked = checked;
    U.debugMappingCheckbox.emit("input");
    assert.equal(S.debug.mapping, checked);
    assert.equal(U.debugOutput.hidden, !checked);
  }
  assert.equal(redraws, 2);
});

test("animation continues for visible wobble, but static and hidden views stay idle", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf("function workspaceNeedsAnimation() {");
  const end = html.indexOf("function ensureRenderLoop()", start);
  assert.ok(start > 0 && end > start);
  const S = { screen: "workspace", view: { renderMode: "standard", spin: false }, gizmo: {} };
  const U = { miniCanvas: { clientWidth: 0, clientHeight: 0 } };
  let a = { type: "3d" };
  const needsAnimation = vm.runInNewContext(html.slice(start, end) + "\nworkspaceNeedsAnimation;", { S, U, asset: () => a });
  assert.equal(needsAnimation(), false);
  S.view.renderMode = "wobble";
  assert.equal(needsAnimation(), true);
  a = { type: "2d" };
  assert.equal(needsAnimation(), false);
  U.miniCanvas.clientWidth = U.miniCanvas.clientHeight = 160;
  assert.equal(needsAnimation(), true);
  S.screen = "gallery";
  assert.equal(needsAnimation(), false);
  S.screen = "workspace";
  a = null;
  assert.equal(needsAnimation(), false);
  S.view.renderMode = "standard";
  S.gizmo.drag = true;
  assert.equal(needsAnimation(), true);
  S.gizmo.drag = false;
  a = { type: "3d" };
  S.view.spin = true;
  assert.equal(needsAnimation(), true);
});

test("UV menu offers selection without advertising unsupported image export", () => {
  const U = controls();
  const c = { assets: [{ id: "uv_unwrap", type: "uv", label: "UV View" }] };
  let menu;
  const app = load("app-shell.js", "KataCartAppShell", "createAppShell")({
    S: {}, U, cart: () => c, tById: () => ({}), galleryThumb: () => null,
    setActiveAsset() {}, openContextMenu: (x, y, items) => { menu = items; },
  });
  app.renderAssetStrip();
  U.assetStrip.children[0].emit("contextmenu", { preventDefault() {} });
  assert.equal(menu.length, 1);
  assert.equal(menu[0].label, "Select Face");
});

test("gallery selection preserves the focused card and nested Open does not activate twice", () => {
  const U = controls(), document = new Element();
  const S = { carts: [{ id: "one", name: "One", assets: [] }], galleryLayout: "grid" };
  let opened = 0;
  const gallery = load("gallery.js", "KataCartGallery", "createGallery", document)({
    S, U, tById: () => ({ id: "ps2-case", name: "PS2" }), openWorkspace: () => opened++,
  });
  gallery.renderGallery();
  const card = U.galleryList.children[1];
  card.focus();
  card.emit("keydown", { target: card, key: " ", preventDefault() {} });
  assert.equal(S.gallerySelectedId, "one");
  assert.equal(U.galleryList.children[1], card);
  assert.equal(document.activeElement, card);
  assert.equal(card.classList.contains("is-selected"), true);
  card.emit("keydown", { target: card.querySelector("button"), key: "Enter" });
  assert.equal(opened, 0);
  card.emit("keydown", { target: card, key: "Enter", preventDefault() {} });
  assert.equal(opened, 1);
});

test("template selection keeps focus and create drawer returns focus on cancel", () => {
  const U = controls(), document = new Element(), trigger = new Element();
  trigger.ownerDocument = document;
  U.newCartNameInput.ownerDocument = document;
  trigger.focus();
  const S = { createOpen: false };
  const templates = ["a", "b"].map((id) => ({ id, name: id, d: { w: 10, h: 10, z: 1 } }));
  const create = load("create-flow.js", "KataCartCreateFlow", "createCreateFlow", document)({ S, U, TEMPLATES: templates });
  create.openCreatePanel();
  assert.equal(document.activeElement, U.newCartNameInput);
  assert.equal(U.createPanel.inert, false);
  const [first, second] = U.createTemplateList.children;
  second.focus();
  second.emit("click");
  assert.equal(S.createTemplateId, "b");
  assert.equal(U.createTemplateList.children[1], second);
  assert.equal(document.activeElement, second);
  assert.equal(first.attributes["aria-pressed"], "false");
  assert.equal(second.attributes["aria-pressed"], "true");
  assert.equal(U.createCartBtn.disabled, false);
  create.closeCreatePanel();
  assert.equal(document.activeElement, trigger);
  assert.equal(U.createPanel.inert, true);
  assert.equal(U.createPanel.attributes["aria-hidden"], "true");
});

test("face-strip Enter and Space select faces and retain focus after strip refresh", () => {
  const U = controls(), document = new Element();
  const S = { assetId: "front" };
  const c = { assets: [{ id: "front", type: "uv", label: "Front" }, { id: "back", type: "uv", label: "Back" }] };
  const app = load("app-shell.js", "KataCartAppShell", "createAppShell", document)({
    S, U, cart: () => c, tById: () => ({}), galleryThumb: () => null,
    setActiveAsset: (id) => { S.assetId = id; app.renderAssetStrip(); },
  });
  app.renderAssetStrip();
  for (const key of ["Enter", " "]) {
    const card = U.assetStrip.children[1];
    card.focus();
    card.emit("keydown", { key, preventDefault() {} });
    const replacement = U.assetStrip.children[1];
    assert.equal(S.assetId, "back");
    assert.equal(document.activeElement, replacement);
    assert.equal(replacement.tabIndex, 0);
    assert.equal(replacement.attributes["aria-pressed"], "true");
  }
});

test("Escape dismisses the topmost open UI before changing preview", () => {
  const U = controls(), document = new Element();
  const S = { screen: "gallery", view: { preview: true }, contextMenu: { open: true }, settingsOpen: true, createOpen: true };
  U.toolMoreMenu.hidden = true;
  const calls = [];
  const boot = load("boot-ui.js", "KataCartBootUI", "createBootUI", document)({
    S, U, closeContextMenu: () => { S.contextMenu.open = false; calls.push("menu"); },
    closeSettingsDrawer: () => { S.settingsOpen = false; calls.push("settings"); },
    closeCreatePanel: () => { S.createOpen = false; calls.push("create"); },
    syncWorkspaceChrome() {}, saveWorkspacePrefs() {}, requestRender() {}, setStatus() {},
  });
  boot.bindChromeAndSettingsUI();
  const event = { key: "Escape", preventDefault() {} };
  document.emit("keydown", event);
  assert.equal(S.view.preview, true);
  document.emit("keydown", event);
  document.emit("keydown", event);
  assert.deepEqual(calls, ["menu", "settings", "create"]);
  assert.equal(S.view.preview, true);
  U.exportModal.open = true;
  document.emit("keydown", event);
  assert.equal(S.view.preview, true);
});

test("settings drawer focuses its close control and optionally returns focus", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf("let settingsReturnFocus = null;");
  const end = html.indexOf("function set2DAssetEditSelected", start);
  const U = controls(), document = new Element(), trigger = new Element();
  trigger.ownerDocument = U.closeSettingsBtn.ownerDocument = document;
  trigger.focus();
  const S = { settingsOpen: false };
  const api = vm.runInNewContext(html.slice(start, end) + "\n({openSettingsDrawer, closeSettingsDrawer});", { S, U, document, syncSettingsControls() {} });
  api.openSettingsDrawer();
  assert.equal(document.activeElement, U.closeSettingsBtn);
  assert.equal(U.settingsDrawer.inert, false);
  api.closeSettingsDrawer();
  assert.equal(document.activeElement, trigger);
  assert.equal(U.settingsDrawer.inert, true);
  assert.equal(U.settingsDrawer.attributes["aria-hidden"], "true");
  api.openSettingsDrawer();
  api.closeSettingsDrawer(false);
  assert.equal(document.activeElement, U.closeSettingsBtn);
});

function session() {
  const target = new Element();
  const guard = load("session-guard.js", "KataCartSessionGuard", "createSessionGuard")({ target });
  const a = { id: "cover_front", type: "2d", w: 100, h: 100, image: null, tr: { x: 0, y: 0, s: 1 } };
  const c = { name: "Sample", notes: "", tags: "", sku: "", modelTr: { rx: 0, ry: 0, mx: false }, assets: [a] };
  return { guard, target, c, a };
}

test("edit history restores image sources and transforms without cloning runtime images", () => {
  const history = load("edit-history.js", "KataCartEditHistory", "createEditHistory")();
  const { c, a } = session();
  const first = { src: "blob:first", img: {} }, second = { src: "blob:second", img: {} };
  a.image = first;
  history.record(c, () => { a.image = second; a.tr.x = 60; });
  assert.equal(history.undo(c), true);
  assert.equal(a.image, first);
  assert.equal(a.tr.x, 0);
  assert.equal(history.redo(c), true);
  assert.equal(a.image, second);
  assert.equal(a.tr.x, 60);
});

test("gesture transactions merge edits and leave unrelated background sample loading intact", () => {
  const history = load("edit-history.js", "KataCartEditHistory", "createEditHistory")();
  const { c, a } = session();
  history.begin(c);
  history.record(c, () => { a.tr.x = 10; });
  history.record(c, () => { a.tr.x = 20; });
  const sample = { src: "sample.png" };
  a.image = sample;
  history.commit();
  assert.equal(history.undo(c), true);
  assert.equal(a.tr.x, 0);
  assert.equal(a.image, sample);
  assert.equal(history.canUndo(c), false);
  assert.equal(history.redo(c), true);
  assert.equal(a.tr.x, 20);
});

test("history is cart-local, ignores no-ops and clears redo after a new edit", () => {
  const history = load("edit-history.js", "KataCartEditHistory", "createEditHistory")();
  const { c } = session(), other = session().c;
  history.record(c, () => { c.name = c.name; });
  assert.equal(history.canUndo(c), false);
  history.record(c, () => { c.name = "A"; });
  assert.equal(history.canUndo(other), false);
  history.undo(c);
  assert.equal(history.canRedo(c), true);
  history.record(c, () => { c.notes = "new"; });
  assert.equal(history.canRedo(c), false);
});

test("exit guard continues recording undo history after its first dirty edit", () => {
  const history = load("edit-history.js", "KataCartEditHistory", "createEditHistory")();
  const target = new Element();
  const guard = load("session-guard.js", "KataCartSessionGuard", "createSessionGuard")({ target, history });
  const { c } = session();
  guard.trackCartEdit(c, () => { c.name = "First"; });
  guard.trackCartEdit(c, () => { c.name = "Second"; });
  history.undo(c); assert.equal(c.name, "First");
  history.undo(c); assert.equal(c.name, "Sample");
  assert.equal(guard.hasChanges(), true);
  assert.equal(target.listeners.beforeunload.length, 1);
});

function compositorHarness() {
  const canvases = [], labels = [];
  const S = { view: { templateLabels: false } };
  const document = { createElement: () => {
    const operations = [];
    const context = Object.fromEntries(["translate", "rotate", "scale", "drawImage"].map((name) => [name, (...args) => operations.push([name, ...args])]));
    const canvas = { getContext: () => context, operations };
    canvases.push(canvas);
    return canvas;
  } };
  const ctx = { window: {}, document };
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/face-compositor.js"), "utf8"), ctx);
  const api = ctx.window.KataCartFaceCompositor.createFaceCompositor({ S, drawInnerEdgeLabels: (...args) => labels.push(args) });
  const face = { id: "cover_front", w: 100, h: 200, image: { src: "art.png", filename: "art.png", img: { width: 20, height: 40 } }, tr: { x: 0, y: 0, s: 1, r: 0, px: 1 } };
  return { api, face, S, canvases, labels };
}

test("legacy layer adapter exposes the live source/transform without migrating the face", () => {
  const { api, face } = compositorHarness();
  const before = JSON.stringify(face);
  const layer = api.getFaceLayers(face)[0];
  assert.equal(layer.id, "cover_front:artwork");
  assert.equal(layer.source, face.image);
  assert.equal(layer.transform, face.tr);
  assert.equal(Object.isFrozen(layer), true);
  assert.equal(JSON.stringify(face), before);
  assert.equal(api.getFaceLayers({ image: null }).length, 0);
  assert.equal(api.getMappedTemplateImage({ image: null }), null);
});

test("face composition caches stable artwork and invalidates transforms, labels and replacements", () => {
  const { api, face, S, labels } = compositorHarness();
  const first = api.getMappedTemplateImage(face);
  assert.equal(api.getMappedTemplateImage(face), first);
  assert.equal(labels.length, 1);
  const key = face.image.mappedKey;
  face.tr.x = 10;
  const moved = api.getMappedTemplateImage(face);
  assert.notEqual(moved, first);
  assert.notEqual(face.image.mappedKey, key);
  S.view.templateLabels = true;
  assert.notEqual(api.getMappedTemplateImage(face), moved);
  face.image = { ...face.image, mappedKey: undefined, mappedCache: undefined, img: { width: 40, height: 40 } };
  assert.notEqual(api.getMappedTemplateImage(face), moved);
});

test("pixelization reuses source cache and shared painting retains legacy transform units", () => {
  const { api, face } = compositorHarness();
  face.tr = { x: 220, y: -220, s: 2, stx: 1.5, sty: 0.5, r: 90, mx: true, my: false, px: 4 };
  const pixelized = api.getPixelizedSourceImage(face);
  assert.equal(api.getPixelizedSourceImage(face), pixelized);
  const canvas = api.getMappedTemplateImage(face);
  const [translate, rotate, scale, draw] = canvas.operations;
  assert.deepEqual(translate, ["translate", 95, 10]);
  assert.deepEqual(rotate, ["rotate", Math.PI / 2]);
  assert.deepEqual(scale, ["scale", -1, 1]);
  assert.equal(draw[1], pixelized);
  assert.deepEqual(draw.slice(2), [-150, -100, 300, 200]);
});

test("artwork variants are restricted to compatible physical cart types", () => {
  const api = load("template-variants.js", "KataCartTemplateVariants", "createTemplateVariants")({});
  assert.deepEqual(Array.from(api.variantsFor("ps2-case"), (v) => v.id), ["blank", "ps2-ketaros", "ps2-juanky"]);
  assert.deepEqual(Array.from(api.variantsFor("psp-umd"), (v) => v.id), ["blank"]);
  assert.deepEqual(Array.from(api.variantsFor("ps1-jewel"), (v) => v.id), ["blank", "ps1-jewel-scan"]);
});

function variantCart() {
  return { templateId: "ps2-case", assets: ["cover_front", "cover_back", "spine", "disc_art"].map((id) => ({ id, type: "2d", w: id === "spine" ? 192 : 1024, h: 1400, image: null })) };
}

test("variant imports use existing PNGs and fill only their declared surfaces", async () => {
  const api = load("template-variants.js", "KataCartTemplateVariants", "createTemplateVariants")({
    loadImageFromPath: async (src) => {
      const png = fs.readFileSync(path.join(root, src));
      return { img: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) } };
    },
  });
  const c = variantCart();
  await api.applyVariant(c, "ps2-juanky");
  assert.equal(c.artworkVariantId, "ps2-juanky");
  for (const a of c.assets.slice(0, 3)) {
    assert.ok(a.image.src.includes("ps2-juanky"));
    const fit = Math.min(a.w/a.image.width, a.h/a.image.height);
    assert.ok(Math.abs(a.image.width * fit * a.tr.stx - a.w) < 0.001);
  }
  assert.equal(c.assets[3].image, null);
  await assert.rejects(api.applyVariant(c, "ps2-ketaros"), /new blank cart/);
});

test("failed and incompatible variant imports leave all cart faces untouched", async () => {
  const api = load("template-variants.js", "KataCartTemplateVariants", "createTemplateVariants")({
    loadImageFromPath: async (src) => {
      if (src.includes("spine")) throw new Error("Missing spine");
      return { img: { width: 100, height: 100 } };
    },
  });
  const c = variantCart();
  await assert.rejects(api.applyVariant(c, "gamecube-shenske"), /incompatible/);
  await assert.rejects(api.applyVariant(c, "ps2-ketaros"), /Missing spine/);
  assert.ok(c.assets.every((a) => a.image === null));
  assert.equal(c.artworkVariantId, undefined);
});

test("cancelling variant creation prevents a late import from adding a cart", async () => {
  const U = controls(), S = { carts: [], createOpen: false };
  const t = { id: "ps2-case", name: "PS2", d: {} };
  let finish, marked = false, opened = false;
  const pending = new Promise((resolve) => { finish = resolve; });
  U.newCartNameInput.value = "My PS2";
  const catalog = load("template-variants.js", "KataCartTemplateVariants", "createTemplateVariants")({});
  const flow = load("create-flow.js", "KataCartCreateFlow", "createCreateFlow")({
    S, U, TEMPLATES: [t], tById: () => t, createCart: variantCart,
    variantsFor: catalog.variantsFor, applyVariant: () => pending,
    markSessionChanged: () => { marked = true; }, openWorkspace: () => { opened = true; }, setStatus() {},
  });
  flow.bindCreateUI(); flow.openCreatePanel();
  U.createTemplateList.children[0].emit("click");
  U.createVariantSelect.value = "ps2-ketaros";
  U.createVariantSelect.emit("change");
  U.createCartBtn.emit("click");
  assert.equal(U.createCartBtn.disabled, true);
  flow.closeCreatePanel();
  finish(); await new Promise(setImmediate);
  assert.equal(S.carts.length, 0);
  assert.equal(marked, false);
  assert.equal(opened, false);
});

test("exit guard stays inactive for unchanged carts and view-only edits", () => {
  const { guard, target, c } = session();
  const view = { zoom: 1 };
  guard.trackCartEdit(c, () => { c.name = "Sample"; view.zoom = 2; });
  assert.equal(guard.hasChanges(), false);
  assert.equal(target.listeners.beforeunload, undefined);
});

test("cart edits install one browser exit warning that remains active", () => {
  const { guard, target, c } = session();
  guard.trackCartEdit(c, () => { c.notes = "Edited"; });
  guard.markChanged();
  guard.trackCartEdit(c, () => { c.tags = "retro"; });
  assert.equal(guard.hasChanges(), true);
  assert.equal(target.listeners.beforeunload.length, 1);
  let prevented = false;
  const event = { preventDefault: () => { prevented = true; } };
  target.emit("beforeunload", event);
  assert.equal(prevented, true);
  assert.equal(event.returnValue, "");
});

test("metadata and model buttons mark cart edits, while identical metadata does not", () => {
  for (const field of ["cartNameOverlay", "metaNotes", "metaTags", "metaSku", "rotX90Btn", "rotY90Btn", "mirror3dXBtn"]) {
    const { guard, c } = session();
    const U = controls();
    const api = load("workspace-input.js", "KataCartWorkspaceInput", "createWorkspaceInput")({
      S: {}, U, cart: () => c, trackCartEdit: guard.trackCartEdit, ensureModelTransform() {}, requestRender() {},
    });
    api.bindWorkspaceInputs();
    if (field === "cartNameOverlay") {
      U[field].value = c.name;
      U[field].emit("input");
      assert.equal(guard.hasChanges(), false);
    }
    U[field].value = "Edited";
    U[field].emit(field.endsWith("Btn") ? "click" : "input");
    assert.equal(guard.hasChanges(), true, field);
  }
});

test("2D wheel canvas zoom stays clean but selected-artwork scaling warns", () => {
  const { guard, c, a } = session();
  const U = controls();
  U.stageCanvas.width = U.stageCanvas.height = 100;
  U.stageCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  const S = { view: { stage2dZoom: 1, stage2dPanX: 0, stage2dPanY: 0 } };
  const api = load("render-2d.js", "KataCartRender2D", "createRender2D")({
    S, U, cart: () => c, trackCartEdit: guard.trackCartEdit,
    STAGE_2D_ZOOM_MIN: 0.2, STAGE_2D_ZOOM_MAX: 4,
    clampNumber: (value, min, max) => Math.max(min, Math.min(max, value)),
    ensure2DTransform() {}, sync2DTransformFields() {},
  });
  const wheel = { clientX: 50, clientY: 50, deltaY: -1 };
  api.handleStageWheelInteraction(wheel, a);
  assert.equal(guard.hasChanges(), false);
  S.view.assetEditSelected = true;
  api.handleStageWheelInteraction(wheel, a);
  assert.equal(guard.hasChanges(), true);
});

test("inspector mirror and model transform edits activate the guard", () => {
  for (const action of ["toggle2DMirror", "sync3DTransformFromUI"]) {
    const { guard, c, a } = session();
    const U = controls();
    U.m3dXRange.value = "0.5"; U.m3dYRange.value = "0"; U.m3dSRange.value = "100";
    const api = load("face-inspector.js", "KataCartFaceInspector", "createFaceInspector")({
      S: {}, U, cart: () => c, asset: () => a, trackCartEdit: guard.trackCartEdit,
      ensure2DTransform() {}, ensureModelTransform() {},
    });
    api[action]("x");
    assert.equal(guard.hasChanges(), true, action);
  }
});

test("creating a new cart marks the session, opening and cancelling create does not", () => {
  const { guard, c } = session();
  const U = controls(), S = { carts: [], createOpen: false };
  U.newCartNameInput.value = "New cart";
  const t = { id: "ps2-case", name: "PS2", d: {} };
  const api = load("create-flow.js", "KataCartCreateFlow", "createCreateFlow")({
    S, U, TEMPLATES: [t], tById: () => t, createCart: () => c,
    markSessionChanged: guard.markChanged, openWorkspace() {}, setStatus() {},
  });
  api.bindCreateUI();
  api.openCreatePanel();
  api.closeCreatePanel();
  assert.equal(guard.hasChanges(), false);
  api.openCreatePanel();
  U.createTemplateList.children[0].emit("click");
  U.createCartBtn.emit("click");
  assert.equal(guard.hasChanges(), true);
  assert.equal(S.carts.length, 1);
});

test("successful artwork upload marks its original cart, failed upload stays clean", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const start = html.indexOf("function uploadImage(");
  const end = html.indexOf("function loadImageFromPath", start);
  for (const success of [false, true]) {
    const { guard, c, a } = session();
    let image;
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, "js/layer-model.js"), "utf8"), context);
    const upload = vm.runInNewContext(html.slice(start, end) + "\nuploadImage;", {
      window: context.window,
      cart: () => c, asset: () => a, trackCartEdit: guard.trackCartEdit,
      URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} }, Image: class { constructor() { image = this; this.width = this.height = 100; } },
      setStatus() {}, syncContextFromAsset() {}, renderAssetStrip() {}, saveWorkspacePrefs() {}, requestRender() {},
    });
    upload({ name: "art.png" });
    assert.equal(guard.hasChanges(), false);
    if (success) image.onload(); else image.onerror();
    assert.equal(guard.hasChanges(), success);
  }
});
