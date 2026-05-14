(function () {
  function createWorkspaceShell(deps) {
    const {
      S,
      U,
      asset,
      saveWorkspacePrefs,
      setStatus,
      openExportModal,
      isCompactHeaderMode,
      setHeaderMoreOpen,
    } = deps;

    function syncInspectorPanels() {
      const metaCollapsed = !!S.chrome.metaCollapsed;
      const contextCollapsed = !!S.chrome.contextCollapsed;
      U.canvasMetaPanel?.classList.toggle("is-collapsed", metaCollapsed);
      U.canvasContextPanel?.classList.toggle("is-collapsed", contextCollapsed);
      if (U.toggleMetaPanelBtn) {
        U.toggleMetaPanelBtn.setAttribute("aria-expanded", metaCollapsed ? "false" : "true");
        U.toggleMetaPanelBtn.title = metaCollapsed ? "Expand metadata" : "Collapse metadata";
      }
      if (U.toggleContextPanelBtn) {
        U.toggleContextPanelBtn.setAttribute(
          "aria-expanded",
          contextCollapsed ? "false" : "true",
        );
        U.toggleContextPanelBtn.title = contextCollapsed
          ? "Expand face inspector"
          : "Collapse face inspector";
      }
    }

    function toggleMetaPanel() {
      S.chrome.metaCollapsed = !S.chrome.metaCollapsed;
      syncInspectorPanels();
      saveWorkspacePrefs();
      setStatus(S.chrome.metaCollapsed ? "Metadata collapsed." : "Metadata expanded.");
    }

    function toggleContextPanel() {
      S.chrome.contextCollapsed = !S.chrome.contextCollapsed;
      syncInspectorPanels();
      saveWorkspacePrefs();
      setStatus(
        S.chrome.contextCollapsed ? "Face inspector collapsed." : "Face inspector expanded.",
      );
    }

    function syncFocusButton() {
      if (!U.focusWorkspaceBtn) return;
      const active = !!document.fullscreenElement;
      U.focusWorkspaceBtn.classList.toggle("is-active", active);
      U.focusWorkspaceBtn.title = active ? "Exit full screen" : "Enter full screen";
      U.focusWorkspaceBtn.innerHTML = active
        ? '<i class="iconoir-minimize"></i>Full Screen'
        : '<i class="iconoir-expand"></i>Full Screen';
    }

    function syncWorkspaceChrome() {
      const preview = !!S.view.preview;
      const inspectorCollapsed = preview || !!S.chrome.inspectorCollapsed;
      const assetStripCollapsed = preview || !!S.chrome.assetStripCollapsed;
      U.workspaceMain?.classList.toggle("is-preview", preview);
      const currentAsset = asset();
      const is2d = currentAsset?.type === "2d";
      const hasArtwork = !!currentAsset?.image;
      U.stage?.classList.toggle("asset-edit-ready", !preview && is2d && !hasArtwork);
      U.stage?.classList.toggle(
        "asset-view-ready",
        !preview && is2d && hasArtwork && !S.view.assetEditSelected,
      );
      U.stage?.classList.toggle(
        "asset-edit-selected",
        !preview && is2d && hasArtwork && S.view.assetEditSelected,
      );
      U.overlayLeft?.classList.toggle("is-collapsed", inspectorCollapsed);
      U.overlayRight?.classList.toggle("is-preview", preview);
      U.stageCanvas?.parentElement?.classList.toggle("is-preview", preview);
      U.assetStripShell?.classList.toggle("is-collapsed", assetStripCollapsed);
      U.togglePreviewBtn?.classList.toggle("is-active", preview);
      U.toggleInspectorBtn?.classList.toggle("is-active", !preview && !S.chrome.inspectorCollapsed);
      U.toggleAssetStripBtn?.classList.toggle(
        "is-active",
        !preview && !S.chrome.assetStripCollapsed,
      );
      if (U.togglePreviewBtn) {
        U.togglePreviewBtn.title = preview ? "Exit preview mode" : "Enter preview mode";
        U.togglePreviewBtn.innerHTML = preview
          ? '<i class="iconoir-eye-off"></i>Preview'
          : '<i class="iconoir-eye-empty"></i>Preview';
      }
      if (U.toggleInspectorBtn) {
        U.toggleInspectorBtn.title =
          inspectorCollapsed && !preview ? "Show inspector panel" : "Hide inspector panel";
      }
      if (U.toggleAssetStripBtn) {
        U.toggleAssetStripBtn.title =
          assetStripCollapsed && !preview ? "Show face strip" : "Hide face strip";
      }
      syncInspectorPanels();
      syncFocusButton();
    }

    function openExportModalToTab(tabId) {
      S.exportTab = tabId || "package";
      openExportModal();
    }

    function closeContextMenu() {
      S.contextMenu.open = false;
      if (!U.contextMenu) return;
      U.contextMenu.hidden = true;
      U.contextMenu.innerHTML = "";
    }

    function openContextMenu(x, y, items) {
      if (!U.contextMenu || !items?.length) return;
      U.contextMenu.innerHTML = "";
      items.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kc-context-menu-btn";
        btn.innerHTML = `${item.icon ? `<i class="${item.icon}"></i>` : ""}<span>${item.label}</span>`;
        btn.addEventListener("click", () => {
          closeContextMenu();
          item.action?.();
        });
        U.contextMenu.append(btn);
      });
      U.contextMenu.hidden = false;
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      const rect = U.contextMenu.getBoundingClientRect();
      const nx = Math.max(8, Math.min(x, vw - rect.width - 8));
      const ny = Math.max(8, Math.min(y, vh - rect.height - 8));
      U.contextMenu.style.left = `${nx}px`;
      U.contextMenu.style.top = `${ny}px`;
      S.contextMenu.open = true;
    }

    async function toggleWorkspaceFullscreen() {
      const target = document.documentElement;
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setStatus("Full screen off.");
          return;
        }
        if (target?.requestFullscreen) {
          await target.requestFullscreen();
          setStatus("Full screen on.");
        }
      } catch (_) {
        setStatus("Full screen toggle failed.");
      }
    }

    function syncViewToggleUI() {
      const currentAsset = asset();
      const is3d = currentAsset?.type === "3d";
      const is2d = currentAsset?.type === "2d";
      if (U.spinCheckbox) U.spinCheckbox.checked = S.view.spin;
      if (U.gridCheckbox) U.gridCheckbox.checked = S.view.grid;
      U.toolAutoRotateBtn.classList.toggle("active", is3d && S.view.spin);
      if (U.toolAutoRotateMenuBtn)
        U.toolAutoRotateMenuBtn.classList.toggle("active", is3d && S.view.spin);
      U.toolNormalsBtn.classList.toggle("active", is3d && S.view.normals);
      if (U.toolNormalsMenuBtn)
        U.toolNormalsMenuBtn.classList.toggle("active", is3d && S.view.normals);
      U.toolRenderStandardBtn.classList.toggle(
        "active",
        is3d && S.view.renderMode === "standard",
      );
      U.toolRenderWobbleBtn.classList.toggle("active", is3d && S.view.renderMode === "wobble");
      if (U.toolFaceVizBtn) {
        const isTransparent = is3d && S.view.faceViz === "transparent";
        U.toolFaceVizBtn.classList.toggle("active", isTransparent);
        U.toolFaceVizBtn.title = isTransparent ? "Transparent faces on" : "Transparent faces off";
        const ic = U.toolFaceVizBtn.querySelector("i");
        if (ic) ic.className = isTransparent ? "iconoir-eye-closed" : "iconoir-eye";
      }
      U.toolTemplateLabelsBtn.classList.toggle("active", S.view.templateLabels);
      if (U.toolTemplateLabelsMenuBtn)
        U.toolTemplateLabelsMenuBtn.classList.toggle("active", S.view.templateLabels);
      [
        U.toolRenderStandardBtn,
        U.toolRenderWobbleBtn,
        U.toolFaceVizBtn,
        U.toolAutoRotateBtn,
        U.toolAutoRotateMenuBtn,
        U.toolNormalsBtn,
        U.toolNormalsMenuBtn,
      ].forEach((btn) => {
        if (!btn) return;
        btn.disabled = !is3d;
      });
      [
        U.viewFrontBtn,
        U.viewBackBtn,
        U.viewLeftBtn,
        U.viewRightBtn,
        U.viewTopBtn,
        U.viewBottomBtn,
        U.viewIsoBtn,
      ].forEach((btn) => {
        if (!btn) return;
        btn.disabled = !is3d;
      });
      if (U.viewHomeBtn)
        U.viewHomeBtn.title = is2d
          ? S.view.assetEditSelected
            ? "Center artwork"
            : "Reset canvas view"
          : "Home view";
      if (U.viewFitBtn)
        U.viewFitBtn.title = is2d
          ? S.view.assetEditSelected
            ? "Fit artwork"
            : "Fit canvas view"
          : "Fit/reset view";
      const showMoreTools = is3d || isCompactHeaderMode();
      U.toolMoreBtn.hidden = !showMoreTools;
      if (!showMoreTools) setHeaderMoreOpen(false);
      U.poseSelect.disabled = !is3d;
      U.faceTintInput.disabled = !is3d;
      U.wireframeCheckbox.disabled = !is3d;
      U.verticesCheckbox.disabled = !is3d;
      U.uvAxisDebugCheckbox.disabled = !is3d;
      U.rendererSelect.disabled = !is3d;
      U.cameraPad?.querySelector(".camera-pad-grid")?.classList.toggle("is-2d", is2d);
      syncWorkspaceChrome();
    }

    return {
      syncInspectorPanels,
      toggleMetaPanel,
      toggleContextPanel,
      syncWorkspaceChrome,
      syncFocusButton,
      openExportModalToTab,
      closeContextMenu,
      openContextMenu,
      toggleWorkspaceFullscreen,
      syncViewToggleUI,
    };
  }

  window.KataCartWorkspaceShell = { createWorkspaceShell };
})();
