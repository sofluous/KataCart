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
  }) {
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
      const represented = new Set(carts.map((c) => c.templateId));
      TEMPLATES.forEach((t) => {
        if (represented.has(t.id)) return;
        const c = createCart(t, `${t.name} Placeholder`);
        c.sampleFolder = t.id;
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
      S.carts.forEach((c) => {
        const f = c.sampleFolder || c.name;
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
        plan.push(
          assignTextureByCandidates(c, "disc_art", f, ["disc.png", "dsic.png", "disc_art.png"]),
        );
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
        setStatus(`Loaded ${loaded} sample texture${loaded === 1 ? "" : "s"} from /test folders.`);
      }
      renderGallery();
      if (S.screen === "workspace") {
        syncContextFromAsset();
        renderAssetStrip();
      }
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
