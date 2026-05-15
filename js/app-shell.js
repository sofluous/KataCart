(function () {
  function createAppShell({
    S,
    U,
    cart,
    tById,
    galleryThumb,
    ensureAsset,
    assetPhysicalDimsMm,
    set2DAssetEditSelected,
    reset2DWorkspaceView,
    applyDefaultViewForTemplate,
    syncContextFromAsset,
    syncSettingsControls,
    syncViewToggleUI,
    syncWorkspaceChrome,
    isCompactHeaderMode,
    setHeaderMoreOpen,
    setActiveAsset,
    openContextMenu,
    openExportModalToTab,
    syncExportModalState,
    downloadTemplate,
    reset2DTransform,
    reset3DTransform,
    closeCreatePanel,
  }) {
    function openWorkspace(cartId) {
      if (S.createOpen) closeCreatePanel();
      S.cartId = cartId;
      set2DAssetEditSelected(false);
      reset2DWorkspaceView();
      S.view.assetFrameRect = null;
      ensureAsset();
      const currentCart = cart();
      if (currentCart) applyDefaultViewForTemplate(tById(currentCart.templateId));
      S.screen = "workspace";
      document.body.dataset.screen = "workspace";
      U.galleryScreen.hidden = true;
      U.workspaceScreen.hidden = false;
      renderWorkspace();
    }

    function renderAssetStrip() {
      const currentCart = cart();
      if (!currentCart) return;
      U.assetStrip.innerHTML = "";
      const previewSrc =
        galleryThumb(currentCart)?.src ||
        currentCart.assets.find((item) => item.type === "2d" && !!item.image?.src)?.image?.src ||
        "";
      const template = tById(currentCart.templateId);
      currentCart.assets.forEach((asset) => {
        const item = document.createElement("article");
        item.className = `asset-card workspace-strip-card${asset.id === S.assetId ? " active" : ""}`;
        const mm = asset.type === "2d" ? assetPhysicalDimsMm(asset.id, template) : null;
        const faceMeta =
          asset.type === "2d"
            ? `${asset.w}x${asset.h}px${mm ? ` | ${mm.w}x${mm.h}mm` : ""}`
            : asset.type === "3d"
              ? "Model view"
              : "UV unwrap";
        const stateLabel =
          asset.type === "2d"
            ? asset.image?.src
              ? "Artwork ready"
              : "No artwork"
            : asset.type === "3d"
              ? "Model view"
              : "UV view";
        const stateClass =
          asset.type === "2d"
            ? asset.image?.src
              ? "is-ready"
              : "is-empty"
            : "is-view";
        const emptyLabel =
          asset.type === "2d"
            ? asset.image?.src
              ? ""
              : "No artwork"
            : asset.type === "3d"
              ? "Model"
              : "UV map";
        item.innerHTML = `<div class="asset-box"><div class="asset-empty"><strong>${emptyLabel}</strong><span>${faceMeta}</span></div></div><div class="asset-card-copy"><strong>${asset.label}</strong><div class="asset-card-meta"><span class="asset-card-state ${stateClass}">${stateLabel}</span><span>${faceMeta}</span></div></div>`;
        const box = item.querySelector(".asset-box");
        const empty = item.querySelector(".asset-empty");
        if (asset.type === "3d") box.classList.add("is-3d");
        if (asset.image?.src) {
          box.classList.add("has-image");
          box.style.backgroundImage = `url("${asset.image.src}")`;
          if (empty) empty.style.display = "none";
        } else if ((asset.type === "3d" || asset.type === "uv") && previewSrc) {
          box.classList.add("has-image");
          box.style.backgroundImage = `url("${previewSrc}")`;
        }
        item.addEventListener("click", () => {
          setActiveAsset(asset.id);
        });
        item.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          setActiveAsset(asset.id);
          const menu = [
            {
              label: "Select Face",
              icon: "iconoir-check-circle",
              action: () => setActiveAsset(asset.id),
            },
          ];
          if (asset.type === "2d") {
            menu.push(
              {
                label: "Upload Artwork",
                icon: "iconoir-upload",
                action: () => {
                  setActiveAsset(asset.id);
                  U.assetFileInput.click();
                },
              },
              {
                label: "Download Face Template",
                icon: "iconoir-download",
                action: () => {
                  setActiveAsset(asset.id, false);
                  downloadTemplate();
                },
              },
              {
                label: "Export Face Image",
                icon: "iconoir-media-image",
                action: () => {
                  U.exportImageAsset.value = asset.id;
                  openExportModalToTab("image");
                  syncExportModalState();
                },
              },
              {
                label: "Reset Artwork Transform",
                icon: "iconoir-undo",
                action: reset2DTransform,
              },
            );
          } else if (asset.type === "3d") {
            menu.push(
              {
                label: "Reset Model Transform",
                icon: "iconoir-undo",
                action: reset3DTransform,
              },
              {
                label: "Export Model View",
                icon: "iconoir-camera",
                action: () => {
                  U.exportImageAsset.value = "__model__";
                  openExportModalToTab("image");
                  syncExportModalState();
                },
              },
            );
          } else if (asset.type === "uv") {
            menu.push({
              label: "Export UV View",
              icon: "iconoir-download",
              action: () => openExportModalToTab("image"),
            });
          }
          openContextMenu(event.clientX, event.clientY, menu);
        });
        U.assetStrip.append(item);
      });
    }

    function renderWorkspace() {
      const currentCart = cart();
      if (!currentCart) return;
      syncContextFromAsset();
      renderAssetStrip();
      syncSettingsControls();
      syncViewToggleUI();
      syncWorkspaceChrome();
      U.settingsDrawer.classList.toggle("open", S.settingsOpen);
      if (!isCompactHeaderMode()) setHeaderMoreOpen(false);
    }

    return {
      openWorkspace,
      renderAssetStrip,
      renderWorkspace,
    };
  }

  window.KataCartAppShell = {
    createAppShell,
  };
})();
