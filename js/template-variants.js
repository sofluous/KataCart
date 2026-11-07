(function () {
  const REFERENCE_SAMPLES = [
    { id: "gamecube-shenske", name: "GameCube Reference - Shenske", templateId: "gamecube-case", folder: "gamecube" },
    { id: "ps2-ketaros", name: "PS2 Reference - Ketaros", templateId: "ps2-case", folder: "ps2-ketaros" },
    { id: "ps2-juanky", name: "PS2 Reference - Juanky", templateId: "ps2-case", folder: "ps2-juanky" },
    { id: "ps1-jewel-scan", name: "PS1 Jewel Case Reference", templateId: "ps1-jewel", folder: "ps1-case" },
  ];
  const FACES = ["cover_front", "cover_back", "spine"];

  function variantsFor(templateId) {
    return [{ id: "blank", name: "Blank - no artwork", faces: [] },
      ...REFERENCE_SAMPLES.filter((v) => v.templateId === templateId).map((v) => ({ ...v, faces: [...FACES] }))];
  }

  function createTemplateVariants({ loadImageFromPath }) {
    async function applyVariant(c, id) {
      if (id === "blank") return;
      const variant = REFERENCE_SAMPLES.find((v) => v.id === id && v.templateId === c.templateId);
      if (!variant) throw new Error("Artwork template is incompatible with this cart type.");
      if (c.assets.some((a) => a.image)) throw new Error("Artwork templates can only be applied to a new blank cart.");
      // Decode every face before modifying the cart, so failed imports remain atomic.
      const ready = await Promise.all(FACES.map(async (faceId) => {
        const a = c.assets.find((a) => a.id === faceId && a.type === "2d");
        if (!a) throw new Error(`Missing required surface: ${faceId}`);
        const src = `./textures/reference/${variant.folder}/${faceId}.png`;
        const { img } = await loadImageFromPath(src);
        if (!(img.width > 0 && img.height > 0)) throw new Error(`Invalid texture: ${faceId}`);
        return { a, src, img };
      }));
      if (c.assets.some((a) => a.image)) throw new Error("Cart artwork changed while the template was loading.");
      for (const { a, src, img } of ready) {
        const fit = Math.min(a.w / img.width, a.h / img.height);
        a.image = { src, filename: `${a.id}.png`, width: img.width, height: img.height, img };
        a.tr = { x: 0, y: 0, s: 1, stx: a.w / (img.width * fit), sty: a.h / (img.height * fit), r: 0, mx: false, my: false, px: 1 };
      }
      c.artworkVariantId = variant.id;
    }
    return { variantsFor, applyVariant };
  }

  window.KataCartTemplateVariants = { REFERENCE_SAMPLES, variantsFor, createTemplateVariants };
})();
