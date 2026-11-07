(function () {
  function createEditorLayout({ S, U, cart, asset, setActiveAsset, set2DAssetEditSelected, syncWorkspaceChrome, saveWorkspacePrefs, requestRender, history, refreshAfterHistory, uploadImage, refreshLayers, trackCartEdit }) {
    let lastSurfaceId = null;
    let compactDock = "surfaces";
    const main = U.workspaceMain;
    const left = document.createElement("aside");
    left.className = "editor-left workspace-panel";
    left.setAttribute("aria-label", "Surfaces and artwork");
    left.innerHTML = '<h2>Surfaces</h2><div class="editor-surfaces"></div><section class="editor-objects"></section>';
    const right = document.createElement("aside");
    right.className = "editor-right";
    right.setAttribute("aria-label", "Properties inspector");
    const title = document.createElement("h2");
    title.className = "editor-selection-title";
    right.append(title, U.overlayLeft);
    const preview = document.createElement("details");
    preview.className = "editor-canvas-preview";
    preview.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "Preview / workspace camera";
    preview.append(summary, U.overlayRight);
    preview.addEventListener("toggle", () => requestRender());
    U.cameraPad?.setAttribute("aria-label", "Workspace camera controls");
    U.stage.append(preview);
    left.querySelector(".editor-surfaces").append(U.assetStripShell);
    const status = U.statusText.parentElement;
    status.classList.add("editor-status");
    main.append(left, right);
    U.stage.parentElement.querySelector(".workspace-header-center").append(status);
    U.statusText.setAttribute("role", "status");
    U.statusText.setAttribute("aria-live", "polite");
    main.classList.add("editor-shell");
    const modes = document.createElement("div");
    modes.className = "editor-view-modes";
    modes.setAttribute("aria-label", "Canvas view");
    for (const [mode, label] of [["2d", "Artwork"], ["3d", "Model"], ["uv", "UV"]]) {
      const button = document.createElement("button");
      button.className = "btn";
      button.type = "button";
      button.dataset.view = mode;
      button.textContent = label;
      button.addEventListener("click", () => {
        const c = cart();
        const next = mode === "2d"
          ? c?.assets.find((a) => a.type === "2d" && a.id === lastSurfaceId) || c?.assets.find((a) => a.type === "2d")
          : c?.assets.find((a) => a.type === mode);
        if (next) setActiveAsset(next.id);
      });
      modes.append(button);
    }
    U.stage.parentElement.querySelector(".workspace-header-left").append(modes);
    const undo = document.createElement("button"), redo = document.createElement("button");
    undo.className = redo.className = "btn";
    undo.type = redo.type = "button";
    undo.textContent = "Undo"; redo.textContent = "Redo";
    undo.id = "editorUndoBtn"; redo.id = "editorRedoBtn";
    undo.title = "Undo (Ctrl/Cmd+Z)"; redo.title = "Redo (Ctrl/Cmd+Shift+Z)";
    modes.append(undo, redo);
    function applyHistory(direction) {
      if (history[direction](cart())) refreshAfterHistory();
      syncHistory();
    }
    undo.addEventListener("click", () => applyHistory("undo"));
    redo.addEventListener("click", () => applyHistory("redo"));
    function syncHistory() {
      undo.disabled = !history.canUndo(cart());
      redo.disabled = !history.canRedo(cart());
    }
    const editable = (event) => event.target.closest?.("input, textarea, select, [contenteditable='true']");
    document.addEventListener("keydown", (event) => {
      if (S.screen !== "workspace" || S.settingsOpen || S.createOpen || U.exportModal.open || editable(event) || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      applyHistory(key === "y" || event.shiftKey ? "redo" : "undo");
    });
    const editFields = new Set([U.cartNameOverlay, U.metaNotes, U.metaTags, U.metaSku, U.txRange, U.tyRange, U.tsRange, U.trRange, U.pxRange, U.txOut, U.tyOut, U.tsOut, U.trOut, U.pxOut, U.m3dXRange, U.m3dYRange, U.m3dSRange, U.m3dXOut, U.m3dYOut, U.m3dSOut]);
    document.addEventListener("focusin", (event) => { if (editFields.has(event.target)) history.begin(cart()); });
    document.addEventListener("focusout", (event) => { if (editFields.has(event.target)) history.commit(); });
    document.addEventListener("pointerdown", (event) => { if (event.target === U.stageCanvas || editFields.has(event.target)) history.begin(cart()); });
    document.addEventListener("pointerup", () => history.commit());
    document.addEventListener("pointercancel", () => history.commit());
    document.addEventListener("change", (event) => { if (editFields.has(event.target)) history.commit(); });
    window.addEventListener("blur", () => history.commit());
    U.faceSelect.closest(".field").hidden = true;
    U.toggleAssetStripBtn.textContent = "Surfaces";
    U.toggleInspectorBtn.addEventListener("click", () => {
      compactDock = "inspector";
      if (window.matchMedia("(max-width: 1050px)").matches) {
        S.chrome.inspectorCollapsed = false;
        syncWorkspaceChrome();
        saveWorkspacePrefs();
      }
      sync();
    });
    U.toggleAssetStripBtn.addEventListener("click", () => {
      compactDock = "surfaces";
      if (window.matchMedia("(max-width: 1050px)").matches) {
        S.chrome.assetStripCollapsed = false;
        syncWorkspaceChrome();
        saveWorkspacePrefs();
      }
      sync();
    });
    const layerPanel = window.KataCartLayerPanel.createLayerPanel({
      host: left.querySelector(".editor-objects"), propertyHost: document.getElementById("canvasContextBody"),
      S, U, cart, asset, model: window.KataCartLayerModel, trackCartEdit,
      uploadImage, refresh: refreshLayers, set2DAssetEditSelected,
    });
    editFields.add(document.querySelector(".layer-name"));
    editFields.add(document.querySelector(".layer-opacity"));
    const observer = new ResizeObserver(() => requestRender());
    observer.observe(U.stage);

    function sync() {
      const a = asset();
      if (a?.type === "2d") lastSurfaceId = a.id;
      const is2d = a?.type === "2d";
      title.textContent = is2d ? `${a.label} / Properties` : a?.type === "uv" ? "UV / Properties" : "Model / Properties";
      layerPanel.sync();
      for (const button of modes.children) {
        if (!button.dataset.view) continue;
        const active = button.dataset.view === a?.type;
        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("is-active", active);
      }
      main.dataset.compactDock = compactDock;
      main.classList.toggle("editor-surfaces-hidden", !!S.chrome.assetStripCollapsed || !!S.view.preview);
      main.classList.toggle("editor-inspector-hidden", !!S.chrome.inspectorCollapsed || !!S.view.preview);
      left.inert = !!S.chrome.assetStripCollapsed || !!S.view.preview;
      syncHistory();
    }
    return { sync, syncHistory };
  }
  window.KataCartEditorLayout = { createEditorLayout };
})();
