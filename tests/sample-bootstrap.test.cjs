const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js/sample-bootstrap.js"), "utf8");

function setup(loadOverride) {
  const templates = ["cd-jewel", "ps2-case", "gamecube-case", "ps1-jewel", "psp-umd"].map((id) => ({ id, name: id }));
  const S = { carts: [], screen: "workspace" };
  const status = [];
  const warnings = [];
  let redraws = 0;
  const context = { window: {}, console: { warn: (...args) => warnings.push(args) } };
  vm.runInNewContext(source, context);
  const api = context.window.KataCartSampleBootstrap.createSampleBootstrap({
    S, TEMPLATES: templates,
    tById: (id) => templates.find((t) => t.id === id),
    createCart: (t, name) => ({ templateId: t.id, name, assets: ["cover_front", "cover_back", "spine", "disc_art"].map((id) => ({ id, type: "2d", w: id === "spine" ? 192 : 1024, h: 1400, image: null })) }),
    renderGallery() {}, renderAssetStrip() {}, syncContextFromAsset() {},
    setStatus: (s) => status.push(s), requestRender: () => redraws++,
    loadImageFromPath: async (src) => {
      if (src.startsWith("./test/")) throw new Error("Legacy sample absent in test");
      if (loadOverride) return loadOverride(src, S);
      const png = fs.readFileSync(path.join(root, src));
      assert.equal(png.subarray(1, 4).toString(), "PNG");
      return { img: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) } };
    },
  });
  S.carts = api.buildStarterCarts();
  return { S, api, status, warnings, redraws: () => redraws };
}

test("reference carts load real PNG faces onto matching templates and redraw", async () => {
  const { S, api, redraws, warnings } = setup();
  assert.equal(S.carts.filter((c) => c.sampleFolder).length, 4);
  const refs = S.carts.filter((c) => c.referenceFolder);
  assert.equal(refs.length, 4);
  assert.deepEqual(Array.from(refs, (c) => c.templateId), ["gamecube-case", "ps2-case", "ps2-case", "ps1-jewel"]);
  assert.ok(S.carts.find((c) => c.templateId === "psp-umd").isPlaceholder);
  await api.preloadSampleFolderAssets();
  for (const c of refs) {
    for (const a of c.assets.filter((a) => a.id !== "disc_art")) {
      assert.ok(a.image, `${c.name}: ${a.id}`);
      const fit = Math.min(a.w / a.image.width, a.h / a.image.height);
      assert.ok(Math.abs(a.image.width * fit * a.tr.stx - a.w) < 0.001);
      assert.ok(Math.abs(a.image.height * fit * a.tr.sty - a.h) < 0.001);
    }
    assert.equal(c.assets.find((a) => a.id === "disc_art").image, null);
  }
  assert.equal(redraws(), 1);
  assert.equal(warnings.length, 0);
});

test("missing reference files report failures and still refresh", async () => {
  const { api, status, warnings, redraws } = setup(async () => { throw new Error("Missing PNG"); });
  await api.preloadSampleFolderAssets();
  assert.match(status.at(-1), /Could not load 12/);
  assert.equal(warnings.length, 1);
  assert.equal(redraws(), 1);
});

test("an upload made during an asynchronous reference load is preserved", async () => {
  const uploaded = { filename: "my-artwork.png" };
  const { S, api } = setup(async (src, state) => {
    const c = state.carts.find((c) => src.includes(`/${c.referenceFolder}/`));
    const id = path.basename(src, ".png");
    c.assets.find((a) => a.id === id).image = uploaded;
    return { img: { width: 100, height: 100 } };
  });
  await api.preloadSampleFolderAssets();
  for (const c of S.carts.filter((c) => c.referenceFolder)) {
    assert.equal(c.assets.find((a) => a.id === "cover_front").image, uploaded);
  }
});
