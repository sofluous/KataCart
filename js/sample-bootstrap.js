(function () {
  function createSampleBootstrap({
    S,
    TEMPLATES,
    tById,
    createCart,
    renderGallery,
    renderAssetStrip,
    syncContextFromAsset,
    setStatus,
    loadImageFromPath,
    requestRender,
  }) {
    const referenceSamples = [
      { name: "GameCube Reference - Shenske", templateId: "gamecube-case", folder: "gamecube" },
      { name: "PS2 Reference - Ketaros", templateId: "ps2-case", folder: "ps2-ketaros" },
      { name: "PS2 Reference - Juanky", templateId: "ps2-case", folder: "ps2-juanky" },
      { name: "PS1 Jewel Case Reference", templateId: "ps1-jewel", folder: "ps1-case" },
    ];

    function inferTemplateIdFromFolder(folder) {
      const name = String(folder || "").toLowerCase();
      if (name.includes("ps2")) return "ps2-case";
      if (name.includes("gamecube")) return "gamecube-case";
      if (name.includes("ps1")) return "ps1-jewel";
      if (name.includes("psp")) return "psp-umd";
      if (name.includes("gameboy")) return "gameboy-cart";
      if (name.includes("sd")) return "sd-card";
      if (name.includes("dv") || name.includes("tape")) return "mini-dv";
      if (name.includes("cd")) return "cd-jewel";
      return "cd-jewel";
    }

    function buildStarterCarts() {
      const sampleFolders = ["default", "CD_1", "PS2_1", "PS2_debug"];
      const carts = sampleFolders.map((folder) => {
        const tid = inferTemplateIdFromFolder(folder);
        const t = tById(tid);
        const c = createCart(t, folder);
        c.sampleFolder = folder;
        return c;
      });
      referenceSamples.forEach((sample) => {
        const template = TEMPLATES.find((t) => t.id === sample.templateId);
        if (!template) return;
        const c = createCart(template, sample.name);
        c.referenceFolder = sample.folder;
        c.notes = "Reference texture sample. Original sources and mappings: textures/reference/README.md";
        carts.push(c);
      });
      const represented = new Set(carts.map((c) => c.templateId));
      TEMPLATES.forEach((t) => {
        if (represented.has(t.id)) return;
        const c = createCart(t, `${t.name} Placeholder`);
        c.sampleFolder = null;
        c.isPlaceholder = true;
        carts.push(c);
      });
      return carts;
    }

    async function assignTextureByCandidates(cartObj, assetId, folder, names) {
      const a = cartObj.assets.find((x) => x.id === assetId && x.type === "2d");
      if (!a) return false;
      for (const filename of names) {
        const path = `./test/${folder}/${filename}`;
        try {
          const { img } = await loadImageFromPath(path);
          const baseName = String(path).split(/[\\/]/).pop() || path;
          a.image = { src: path, filename: baseName, width: img.width, height: img.height, img };
          a.tr = { x: 0, y: 0, s: 1, stx: 1, sty: 1, r: 0, mx: false, my: false, px: 1 };
          return true;
        } catch (_) {}
      }
      return false;
    }

    async function preloadSampleFolderAssets() {
      const plan = [];
      const referenceFailures = [];
      function discCandidatesForFolder(folder) {
        const name = String(folder || "").toLowerCase();
        if (name === "cd_1") return ["front-disc.png", "back-disc.png"];
        if (name === "ps2_debug") return ["dsic.png"];
        return ["disc.png", "disc_art.png", "front-disc.png", "back-disc.png", "dsic.png"];
      }
      S.carts.forEach((c) => {
        if (c.referenceFolder) {
          ["cover_front", "cover_back", "spine"].forEach((assetId) => {
            plan.push(assignReferenceTexture(c, assetId).catch(() => {
              referenceFailures.push(`${c.name}: ${assetId}`);
              return false;
            }));
          });
          return;
        }
        if (!c.sampleFolder || c.isPlaceholder) return;
        const f = c.sampleFolder;
        plan.push(
          assignTextureByCandidates(c, "cover_front", f, [
            "frontcover.png",
            "frontcover-1.png",
            "front.png",
            "cover_front.png",
          ]),
        );
        plan.push(
          assignTextureByCandidates(c, "cover_back", f, [
            "backcover.png",
            "backcover-1.png",
            "back.png",
            "cover_back.png",
          ]),
        );
        plan.push(assignTextureByCandidates(c, "spine", f, ["spine.png", "spine-1.png"]));
        plan.push(assignTextureByCandidates(c, "disc_art", f, discCandidatesForFolder(f)));
        plan.push(
          assignTextureByCandidates(c, "label_front", f, [
            "label_front.png",
            "label.png",
            "frontlabel.png",
          ]),
        );
      });
      const results = await Promise.allSettled(plan);
      const loaded = results.filter((r) => r.status === "fulfilled" && r.value).length;
      if (loaded > 0) {
        setStatus(`Loaded ${loaded} sample texture${loaded === 1 ? "" : "s"}.`);
      }
      if (referenceFailures.length) {
        console.warn("Reference textures failed to load:", referenceFailures);
        setStatus(`Could not load ${referenceFailures.length} reference texture(s). See console for details.`);
      }
      renderGallery();
      if (S.screen === "workspace") {
        syncContextFromAsset();
        renderAssetStrip();
      }
      requestRender();
    }

    async function assignReferenceTexture(cartObj, assetId) {
      const a = cartObj.assets.find((item) => item.id === assetId && item.type === "2d");
      if (!a || a.image) return false;
      const path = `./textures/reference/${cartObj.referenceFolder}/${assetId}.png`;
      const { img } = await loadImageFromPath(path);
      // A user may upload artwork while startup textures are still loading.
      if (a.image) return false;
      const fit = Math.min(a.w / img.width, a.h / img.height);
      a.image = { src: path, filename: `${assetId}.png`, width: img.width, height: img.height, img };
      // Match each extracted panel to its whole face, including differing spine widths.
      a.tr = {
        x: 0, y: 0, s: 1,
        stx: a.w / (img.width * fit), sty: a.h / (img.height * fit),
        r: 0, mx: false, my: false, px: 1,
      };
      return true;
    }

    return {
      inferTemplateIdFromFolder,
      buildStarterCarts,
      assignTextureByCandidates,
      preloadSampleFolderAssets,
    };
  }

  window.KataCartSampleBootstrap = {
    createSampleBootstrap,
  };
})();
