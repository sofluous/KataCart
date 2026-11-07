(function () {
  function createLayerPanel({ host, propertyHost, S, U, cart, asset, model, trackCartEdit, uploadImage, refresh, set2DAssetEditSelected }) {
    host.innerHTML = '<h2>Layers</h2><div class="editor-layer-list" aria-label="Image layers"></div><div class="editor-layer-actions"><button type="button" class="btn layer-add">Add image</button><button type="button" class="btn layer-duplicate">Duplicate</button><button type="button" class="btn layer-remove">Delete</button><button type="button" class="btn layer-up">Forward</button><button type="button" class="btn layer-down">Backward</button></div>';
    const properties = document.createElement("section");
    properties.className = "workspace-panel-section editor-layer-properties";
    properties.innerHTML = '<h3>Selected layer</h3><label class="field">Name<input class="layer-name" type="text" /></label><label class="setting-row">Visible<input class="layer-visible" type="checkbox" /></label><label class="field">Opacity<input class="layer-opacity" type="range" min="0" max="1" step="0.01" /><output class="layer-opacity-value"></output></label>';
    propertyHost.prepend(properties);
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp"; input.hidden = true; host.append(input);
    function edit(action) {
      const face = asset(); if (face?.type !== "2d") return;
      model.ensure(face);
      trackCartEdit(cart(), () => action(face));
      if (!model.selected(face)?.visible) set2DAssetEditSelected(false);
      refresh();
    }
    host.querySelector(".layer-add").addEventListener("click", () => input.click());
    input.addEventListener("change", () => { uploadImage(input.files?.[0], true); input.value = ""; });
    for (const [selector, action] of [[".layer-duplicate", model.duplicate], [".layer-remove", model.remove], [".layer-up", (f) => model.reorder(f, 1)], [".layer-down", (f) => model.reorder(f, -1)]]) host.querySelector(selector).addEventListener("click", () => edit(action));
    const name = properties.querySelector(".layer-name"), visible = properties.querySelector(".layer-visible"), opacity = properties.querySelector(".layer-opacity");
    name.addEventListener("input", () => edit((f) => { model.selected(f).name = name.value; }));
    visible.addEventListener("change", () => edit((f) => { model.selected(f).visible = visible.checked; }));
    opacity.addEventListener("input", () => edit((f) => { model.selected(f).opacity = Number(opacity.value); }));
    function sync() {
      const face = asset(), is2d = face?.type === "2d";
      const layers = is2d ? model.ensure(face) : [], selected = is2d ? model.selected(face) : null;
      const list = host.querySelector(".editor-layer-list"), focused = document.activeElement?.dataset.layerId;
      list.innerHTML = "";
      for (const layer of [...layers].reverse()) {
        const button = document.createElement("button"); button.type = "button"; button.className = "btn editor-layer editor-artwork"; button.dataset.layerId = layer.id;
        button.textContent = `${layer.visible ? "" : "Hidden: "}${layer.name}`;
        button.setAttribute("aria-pressed", String(layer === selected && !!S.view.assetEditSelected));
        button.classList.toggle("is-active", layer === selected);
        button.addEventListener("click", () => { face.activeLayerId = layer.id; set2DAssetEditSelected(layer.visible); refresh(); });
        list.append(button);
      }
      if (!layers.length) { const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = is2d ? "No layers. Add an image to begin." : "Choose an artwork surface."; list.append(empty); }
      if (focused) Array.from(list.children).find((b) => b.dataset.layerId === focused)?.focus();
      properties.hidden = !selected;
      if (selected) {
        if (document.activeElement !== name) name.value = selected.name;
        visible.checked = selected.visible; opacity.value = selected.opacity;
        properties.querySelector(".layer-opacity-value").textContent = `${Math.round(selected.opacity * 100)}%`;
      }
      host.querySelector(".layer-add").disabled = !is2d;
      for (const selector of [".layer-duplicate", ".layer-remove"]) host.querySelector(selector).disabled = !selected;
      const index = layers.indexOf(selected);
      host.querySelector(".layer-up").disabled = !selected || index === layers.length - 1;
      host.querySelector(".layer-down").disabled = !selected || index === 0;
    }
    return { sync };
  }
  window.KataCartLayerPanel = { createLayerPanel };
})();
