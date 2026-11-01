const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

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
  const start = html.indexOf("function uploadImage(file) {");
  const end = html.indexOf("function loadImageFromPath", start);
  for (const success of [false, true]) {
    const { guard, c, a } = session();
    let image;
    const upload = vm.runInNewContext(html.slice(start, end) + "\nuploadImage;", {
      cart: () => c, asset: () => a, trackCartEdit: guard.trackCartEdit,
      URL: { createObjectURL: () => "blob:test" }, Image: class { constructor() { image = this; this.width = this.height = 100; } },
      setStatus() {}, syncContextFromAsset() {}, renderAssetStrip() {}, saveWorkspacePrefs() {}, requestRender() {},
    });
    upload({ name: "art.png" });
    assert.equal(guard.hasChanges(), false);
    if (success) image.onload(); else image.onerror();
    assert.equal(guard.hasChanges(), success);
  }
});
