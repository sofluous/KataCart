(function () {
  function createFaceCompositor({ S, drawInnerEdgeLabels }) {
    const layeredCache = new WeakMap(), sourceIds = new WeakMap();
    let nextSourceId = 0;
    // Unvisited legacy faces retain a read-only adapter until the layer UI opens them.
    function getFaceLayers(a) {
      if (Array.isArray(a?.layers)) return a.layers;
      if (!a?.image?.img) return [];
      return [Object.freeze({
        id: `${a.id}:artwork`, type: "image", source: a.image,
        transform: a.tr, visible: true, opacity: 1, boundary: "crop",
      })];
    }

    function getPixelizedSourceImage(a) {
      if (!a?.image?.img) return null;
      const px = Math.max(1, Math.round(a.tr?.px || 1));
      if (px <= 1) return a.image.img;
      if (!a.image.pixelCache) a.image.pixelCache = {};
      if (a.image.pixelCache[px]) return a.image.pixelCache[px];
      const src = a.image.img;
      const sw = src.width;
      const sh = src.height;
      const tw = Math.max(1, Math.floor(sw / px));
      const th = Math.max(1, Math.floor(sh / px));
      const low = document.createElement("canvas");
      low.width = tw;
      low.height = th;
      const lx = low.getContext("2d");
      lx.imageSmoothingEnabled = false;
      lx.drawImage(src, 0, 0, tw, th);
      const out = document.createElement("canvas");
      out.width = sw;
      out.height = sh;
      const ox = out.getContext("2d");
      ox.imageSmoothingEnabled = false;
      ox.drawImage(low, 0, 0, tw, th, 0, 0, sw, sh);
      a.image.pixelCache[px] = out;
      return out;
    }

    function paintArtwork(x, a, fx, fy, fw, fh) {
      const layer = getFaceLayers(a)[0];
      if (!layer) return;
      const src = getPixelizedSourceImage(a);
      const tr = layer.transform;
      const fit = Math.min(fw / src.width, fh / src.height);
      const dw = src.width * fit * tr.s * (tr.stx || 1);
      const dh = src.height * fit * tr.s * (tr.sty || 1);
      x.imageSmoothingEnabled = Math.round(tr.px || 1) <= 1;
      x.translate(fx + fw / 2 + (tr.x / 220) * (fw * 0.45), fy + fh / 2 + (tr.y / 220) * (fh * 0.45));
      x.rotate((tr.r * Math.PI) / 180);
      x.scale(tr.mx ? -1 : 1, tr.my ? -1 : 1);
      x.drawImage(src, -dw / 2, -dh / 2, dw, dh);
    }

    function getMappedTemplateImage(a) {
      if (Array.isArray(a?.layers)) {
        if (!a.layers.length) return null;
        const key = JSON.stringify([a.w, a.h, !!S.view.templateLabels, a.layers.map((l) => {
          if (!sourceIds.has(l.source)) sourceIds.set(l.source, ++nextSourceId);
          return [l.id, sourceIds.get(l.source), l.visible, l.opacity, l.transform];
        })]);
        const cached = layeredCache.get(a);
        if (cached?.key === key) { if (a.image) a.image.mappedKey = key; return cached.canvas; }
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, a.w); canvas.height = Math.max(1, a.h);
        const x = canvas.getContext("2d");
        for (const l of a.layers) {
          if (!l.visible || l.opacity <= 0 || !l.source?.img) continue;
          x.save(); x.globalAlpha = Math.min(1, Math.max(0, l.opacity));
          paintArtwork(x, { ...a, layers: undefined, image: l.source, tr: l.transform }, 0, 0, canvas.width, canvas.height);
          x.restore();
        }
        drawInnerEdgeLabels(x, a, 0, 0, canvas.width, canvas.height);
        layeredCache.set(a, { key, canvas });
        if (a.image) a.image.mappedKey = key;
        return canvas;
      }
      const layer = getFaceLayers(a)[0];
      if (!layer) return null;
      const src = getPixelizedSourceImage(a);
      if (!src) return null;
      const key = [
        a.image.src,
        a.image.filename || "",
        a.w,
        a.h,
        a.tr.x,
        a.tr.y,
        a.tr.s,
        a.tr.stx || 1,
        a.tr.sty || 1,
        a.tr.r,
        a.tr.mx ? 1 : 0,
        a.tr.my ? 1 : 0,
        Math.round(a.tr.px || 1),
        S.view.templateLabels ? 1 : 0,
      ].join("|");
      if (a.image.mappedKey === key && a.image.mappedCache) return a.image.mappedCache;
      const c = document.createElement("canvas");
      c.width = Math.max(1, a.w);
      c.height = Math.max(1, a.h);
      const x = c.getContext("2d");
      paintArtwork(x, a, 0, 0, c.width, c.height);
      drawInnerEdgeLabels(x, a, 0, 0, c.width, c.height);
      a.image.mappedKey = key;
      a.image.mappedCache = c;
      return c;
    }

    return { getFaceLayers, getPixelizedSourceImage, getMappedTemplateImage, paintArtwork };
  }
  window.KataCartFaceCompositor = { createFaceCompositor };
})();
