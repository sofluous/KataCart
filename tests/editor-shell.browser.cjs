// Optional browser acceptance check. Requires playwright-core and installed Edge.
const { chromium } = require(process.env.KATACART_PLAYWRIGHT || "playwright-core");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = path.resolve(root, "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      res.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
    const parity = await page.evaluate(() => {
      const source = document.createElement("canvas"); source.width = 17; source.height = 23;
      const sx = source.getContext("2d");
      sx.fillStyle = "rgba(200,30,90,0.7)"; sx.fillRect(0, 0, 11, 19);
      sx.fillStyle = "#24aaff"; sx.fillRect(7, 5, 10, 18);
      const S = { view: { templateLabels: false } };
      const compositor = window.KataCartFaceCompositor.createFaceCompositor({ S, drawInnerEdgeLabels() {} });
      const cases = [{}, { x: 67, y: -43 }, { s: 0.65, stx: 1.4, sty: 0.8 }, { r: 37 }, { mx: true }, { my: true }, { mx: true, my: true, r: -90 }, { px: 4, x: -32, r: 15 }];
      for (const change of cases) {
        const tr = { x: 0, y: 0, s: 1, r: 0, px: 1, ...change };
        const a = { id: "front", w: 80, h: 96, image: { src: "fixture", img: source }, tr };
        const actual = compositor.getMappedTemplateImage(a);
        const expected = document.createElement("canvas"); expected.width = a.w; expected.height = a.h;
        let image = source;
        if (tr.px > 1) {
          const low = document.createElement("canvas"); low.width = Math.max(1, Math.floor(source.width / tr.px)); low.height = Math.max(1, Math.floor(source.height / tr.px));
          const lx = low.getContext("2d"); lx.imageSmoothingEnabled = false; lx.drawImage(source, 0, 0, low.width, low.height);
          image = document.createElement("canvas"); image.width = source.width; image.height = source.height;
          const ix = image.getContext("2d"); ix.imageSmoothingEnabled = false; ix.drawImage(low, 0, 0, low.width, low.height, 0, 0, image.width, image.height);
        }
        const x = expected.getContext("2d"), fit = Math.min(a.w / image.width, a.h / image.height);
        const dw = image.width * fit * tr.s * (tr.stx || 1), dh = image.height * fit * tr.s * (tr.sty || 1);
        x.imageSmoothingEnabled = tr.px <= 1;
        x.translate(a.w / 2 + (tr.x / 220) * (a.w * 0.45), a.h / 2 + (tr.y / 220) * (a.h * 0.45));
        x.rotate(tr.r * Math.PI / 180); x.scale(tr.mx ? -1 : 1, tr.my ? -1 : 1);
        x.drawImage(image, -dw / 2, -dh / 2, dw, dh);
        const left = actual.getContext("2d").getImageData(0, 0, a.w, a.h).data;
        const right = x.getImageData(0, 0, a.w, a.h).data;
        if (!left.every((value, i) => value === right[i])) return false;
        if (compositor.getMappedTemplateImage(a) !== actual) return false;
      }
      return true;
    });
    assert.equal(parity, true, "Shared compositor matches legacy pixels for eight transform fixtures");
    const layeredPixels = await page.evaluate(() => {
      const compositor = window.KataCartFaceCompositor.createFaceCompositor({ S: { view: { templateLabels: false } }, drawInnerEdgeLabels() {} });
      const model = window.KataCartLayerModel;
      function source(color) {
        const img = document.createElement("canvas"); img.width = img.height = 8;
        const ctx = img.getContext("2d"); ctx.fillStyle = color; ctx.fillRect(0, 0, 8, 8);
        return { img, filename: color };
      }
      const face = { w: 8, h: 8, image: null, tr: {} };
      model.add(face, source("#ff0000"));
      const top = model.add(face, source("#0000ff")); top.opacity = 0.5;
      const pixel = () => Array.from(compositor.getMappedTemplateImage(face).getContext("2d").getImageData(4, 4, 1, 1).data);
      const mixed = pixel();
      top.visible = false; const hidden = pixel();
      top.visible = true; model.reorder(face, -1); const reordered = pixel();
      return { mixed, hidden, reordered };
    });
    assert.ok(Math.abs(layeredPixels.mixed[0] - 127) <= 1 && Math.abs(layeredPixels.mixed[2] - 128) <= 1);
    assert.deepEqual(layeredPixels.hidden, [255, 0, 0, 255]);
    assert.deepEqual(layeredPixels.reordered, [255, 0, 0, 255]);
    const card = page.locator(".cart-card:not(.new-cart-card)").first();
    await card.focus();
    await page.keyboard.press("Enter");
    await page.locator(".editor-left").waitFor({ state: "visible" });
    await page.locator(".editor-view-modes [data-view='2d']").click();
    assert.equal(await page.locator("#canvasRenderPanel").isVisible(), false);
    assert.equal(await page.locator("#faceSelect").isVisible(), false);
    assert.equal(await page.locator("#assetStrip [data-asset-id='model_3d']").count(), 0);
    assert.equal(await page.locator("#assetStrip [data-asset-id='uv_unwrap']").count(), 0);
    await page.locator(".editor-view-modes [data-view='3d']").click();
    assert.equal(await page.locator(".editor-view-modes [data-view='3d']").getAttribute("aria-pressed"), "true");
    await page.locator(".editor-view-modes [data-view='uv']").click();
    assert.equal(await page.locator(".editor-view-modes [data-view='uv']").getAttribute("aria-pressed"), "true");
    await page.locator(".editor-view-modes [data-view='2d']").click();
    const bounds = await page.evaluate(() => Object.fromEntries([".stage", ".editor-left", ".editor-right", ".editor-status", ".editor-canvas-preview"].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [s, { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }];
    })));
    assert.ok(bounds[".editor-left"].right <= bounds[".stage"].x);
    assert.ok(bounds[".stage"].right <= bounds[".editor-right"].x);
    assert.ok(bounds[".editor-status"].bottom <= bounds[".stage"].y);
    assert.ok(Math.abs(bounds[".editor-right"].bottom - bounds[".stage"].bottom) < 2);
    assert.ok(bounds[".editor-canvas-preview"].x >= bounds[".stage"].x);
    assert.ok(bounds[".editor-canvas-preview"].right <= bounds[".stage"].right);
    assert.ok(bounds[".editor-canvas-preview"].bottom <= bounds[".stage"].bottom);
    assert.equal(await page.locator(".stage #miniCanvas").count(), 1);
    assert.equal(await page.locator(".stage .camera-pad").count(), 1);
    await page.locator(".editor-canvas-preview summary").click();
    assert.equal(await page.locator("#miniCanvas").isVisible(), false);
    await page.locator(".editor-canvas-preview summary").click();
    assert.equal(await page.locator("#miniCanvas").isVisible(), true);
    assert.ok(bounds[".stage"].width > 200 && bounds[".stage"].height > 200);
    const heights = await page.locator("#assetStrip .workspace-strip-card").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
    assert.ok(heights.length > 1 && heights.every((height) => height === heights[0]));
    await page.locator("#toggleContextPanelBtn").click();
    assert.equal(await page.locator("#canvasContextBody").isVisible(), false);
    await page.locator("#toggleContextPanelBtn").click();
    assert.equal(await page.locator("#canvasContextBody").isVisible(), true);
    for (const theme of ["mono-slate", "amber-terminal", "skeuo-panel"]) {
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      const r = await page.locator(".stage").boundingBox();
      assert.ok(r.width > 200 && r.height > 200, theme);
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = "mono-slate"; });
    if (process.env.KATACART_SCREENSHOT) await page.screenshot({ path: process.env.KATACART_SCREENSHOT });
    await page.setViewportSize({ width: 700, height: 900 });
    await page.locator("#toggleInspectorBtn").click();
    await page.locator(".editor-right").waitFor({ state: "visible" });
    assert.equal(await page.locator("#overlayLeft").isVisible(), true);
    assert.equal(await page.locator(".editor-left").isVisible(), false);
    await page.locator("#toggleAssetStripBtn").click();
    // A second click opens the surface pane if an old preference was already on.
    if (!(await page.locator(".editor-left").isVisible())) await page.locator("#toggleAssetStripBtn").click();
    await page.locator(".editor-left").waitFor({ state: "visible" });
    assert.equal(await page.locator(".editor-right").isVisible(), false);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#backToGalleryBtn").click();
    await page.locator(".new-cart-btn").click();
    await page.locator("[data-template-id='ps2-case']").click();
    assert.equal(await page.locator("#createVariantSelect option").count(), 3);
    const beforeCount = await page.locator(".cart-card").count();
    await page.route("**/textures/reference/ps2-ketaros/spine.png", (route) => route.abort());
    await page.locator("#createVariantSelect").selectOption("ps2-ketaros");
    await page.locator("#createCartBtn").click();
    await page.locator("#createVariantSummary").filter({ hasText: "could not be loaded" }).waitFor();
    assert.equal(await page.locator(".cart-card").count(), beforeCount);
    assert.equal(await page.locator("#createCartBtn").isEnabled(), true);
    await page.unroute("**/textures/reference/ps2-ketaros/spine.png");
    await page.locator("#createVariantSelect").selectOption("ps2-juanky");
    await page.locator("#createCartBtn").click();
    await page.locator("#workspaceScreen").waitFor({ state: "visible" });
    assert.equal(await page.locator("#assetStrip .has-image").count(), 3);
    await page.locator(".editor-view-modes [data-view='2d']").click();
    await page.locator(".editor-artwork").click();
    assert.equal(await page.locator(".editor-artwork").getAttribute("aria-pressed"), "true");
    const scaleBefore = Number(await page.locator("#tsOut").inputValue());
    await page.locator("#stageCanvas").hover();
    await page.mouse.wheel(0, -100);
    await page.waitForFunction((before) => Number(document.getElementById("tsOut").value) > before, scaleBefore);
    assert.deepEqual(errors, []);
    await page.locator("#editorUndoBtn").click();
    assert.equal(Number(await page.locator("#tsOut").inputValue()), scaleBefore);
    await page.locator("#editorRedoBtn").click();
    assert.ok(Number(await page.locator("#tsOut").inputValue()) > scaleBefore);
    await page.locator(".layer-duplicate").click();
    assert.equal(await page.locator(".editor-layer").count(), 2);
    await page.locator(".layer-name").fill("Overlay");
    await page.locator(".layer-name").blur();
    await page.locator(".layer-opacity").fill("0.5");
    await page.locator(".layer-opacity").dispatchEvent("input");
    await page.locator(".layer-opacity").dispatchEvent("change");
    assert.equal(await page.locator(".layer-opacity-value").textContent(), "50%");
    await page.locator(".layer-visible").uncheck();
    assert.ok((await page.locator(".editor-layer").first().textContent()).includes("Hidden: Overlay"));
    await page.locator("#editorUndoBtn").click();
    assert.equal(await page.locator(".layer-visible").isChecked(), true);
    await page.locator(".layer-down").click();
    assert.equal(await page.locator(".editor-layer").last().textContent(), "Overlay");
    await page.locator(".layer-remove").click();
    assert.equal(await page.locator(".editor-layer").count(), 1);
    await page.locator("#editorUndoBtn").click();
    assert.equal(await page.locator(".editor-layer").count(), 2);
    await page.locator("#editorRedoBtn").click();
    assert.equal(await page.locator(".editor-layer").count(), 1);
    await page.locator(".editor-objects input[type=file]").setInputFiles({
      name: "pixel.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
    });
    await page.waitForFunction(() => document.querySelectorAll(".editor-layer").length === 2);
    await page.locator("#editorUndoBtn").click();
    assert.equal(await page.locator(".editor-layer").count(), 1);
    await page.locator("#editorRedoBtn").click();
    assert.equal(await page.locator(".editor-layer").count(), 2);
    await page.locator("#exportJsonBtn").click();
    await page.locator("#exportTabImageBtn").click();
    await page.locator("#exportImageAsset").selectOption("cover_front");
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#runImageExportBtn").click()]);
    assert.ok(download.suggestedFilename().endsWith(".png"));
    page.on("dialog", (dialog) => dialog.dismiss());
    assert.deepEqual(errors, []);
    console.log("PASS: compositor pixel parity, layer add/duplicate/name/opacity/visibility/order/delete and undo/redo, artwork editing/download, dock geometry, view modes, compact switching, variant failure recovery; no browser script errors.");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
