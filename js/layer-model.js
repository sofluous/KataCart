(function () {
  let nextId = 0;
  const transform = () => ({ x: 0, y: 0, s: 1, stx: 1, sty: 1, r: 0, mx: false, my: false, px: 1 });
  function selected(face) { return face.layers?.find((l) => l.id === face.activeLayerId) || face.layers?.[face.layers.length - 1] || null; }
  function makeLayer(source, tr = transform()) {
    return { id: `layer_${++nextId}`, name: source.filename || "Image", type: "image", source, transform: { ...tr }, visible: true, opacity: 1, boundary: "crop" };
  }
  function ensure(face) {
    if (Array.isArray(face.layers)) return face.layers;
    const image = face.image, tr = face.tr || transform();
    face.layers = image ? [makeLayer(image, tr)] : [];
    face.activeLayerId = selected(face)?.id || null;
    let emptyTransform = { ...tr };
    Object.defineProperties(face, {
      image: { enumerable: true, configurable: true,
        get: () => selected(face)?.source || null,
        set: (source) => {
          const layer = selected(face);
          if (source && layer) layer.source = source;
          else if (source) { const added = makeLayer(source, emptyTransform); face.layers.push(added); face.activeLayerId = added.id; }
          else if (layer) { face.layers = face.layers.filter((l) => l !== layer); face.activeLayerId = selected(face)?.id || null; }
        },
      },
      tr: { enumerable: true, configurable: true,
        get: () => selected(face)?.transform || emptyTransform,
        set: (tr) => { const layer = selected(face); if (layer) layer.transform = tr; else emptyTransform = tr; },
      },
    });
    return face.layers;
  }
  function add(face, source) { ensure(face); const layer = makeLayer(source); face.layers.push(layer); face.activeLayerId = layer.id; return layer; }
  function replace(face, id, source) {
    ensure(face);
    if (!id && !face.layers.length) return add(face, source);
    const layer = face.layers.find((l) => l.id === id);
    if (!layer) throw new Error("The upload target layer no longer exists.");
    layer.source = source; layer.name = source.filename || layer.name; layer.transform = transform();
    return layer;
  }
  function duplicate(face) { ensure(face); const layer = selected(face); if (!layer) return; const copy = { ...layer, id: `layer_${++nextId}`, name: `${layer.name} copy`, transform: { ...layer.transform } }; face.layers.splice(face.layers.indexOf(layer) + 1, 0, copy); face.activeLayerId = copy.id; }
  function remove(face) { ensure(face); const index = face.layers.indexOf(selected(face)); if (index < 0) return; face.layers.splice(index, 1); face.activeLayerId = face.layers[Math.min(index, face.layers.length - 1)]?.id || null; }
  function reorder(face, delta) { ensure(face); const i = face.layers.indexOf(selected(face)), j = i + delta; if (i < 0 || j < 0 || j >= face.layers.length) return; [face.layers[i], face.layers[j]] = [face.layers[j], face.layers[i]]; }
  window.KataCartLayerModel = { ensure, selected, add, replace, duplicate, remove, reorder };
})();
