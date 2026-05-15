(function () {
  function createBootUI(deps) {
    const {
      S,
      U,
      cart,
      asset,
      tById,
      ZOOM_MIN,
      STAGE_2D_ZOOM_MIN,
      STAGE_2D_ZOOM_MAX,
      clampNumber,
      saveWorkspacePrefs,
      setStatus,
      copyTextToClipboard,
      refreshRenderStyleCache,
      requestRender,
      closeSettingsDrawer,
      openSettingsDrawer,
      closeContextMenu,
      syncWorkspaceChrome,
      syncViewToggleUI,
      toggleMetaPanel,
      toggleContextPanel,
      toggleRenderPanel,
      syncFocusButton,
      setHeaderMoreOpen,
      isCompactHeaderMode,
      applyCameraPreset,
      reset2DWorkspaceView,
      ensure2DTransform,
      sync2DTransformFields,
      fitAsset,
      reset2DTransform,
      applyDefaultViewForTemplate,
      toggleWorkspaceFullscreen,
    } = deps;

    function bindChromeAndSettingsUI() {
      U.layoutButtons.forEach((button) =>
        button.addEventListener("click", () => {
          S.galleryLayout = button.dataset.layout;
          deps.renderGallery();
        }),
      );

      U.backToGalleryBtn.addEventListener("click", () => {
        deps.openGallery();
        requestRender();
      });
      U.settingsOpenBtns.forEach((button) =>
        button.addEventListener("click", () => {
          if (S.settingsOpen) {
            closeSettingsDrawer();
            return;
          }
          openSettingsDrawer();
        }),
      );
      U.closeSettingsBtn.addEventListener("click", () => {
        closeSettingsDrawer();
      });

      if (U.togglePreviewBtn)
        U.togglePreviewBtn.addEventListener("click", () => {
          S.view.preview = !S.view.preview;
          syncWorkspaceChrome();
          saveWorkspacePrefs();
          setStatus(S.view.preview ? "Preview mode on." : "Preview mode off.");
        });
      if (U.toggleInspectorBtn)
        U.toggleInspectorBtn.addEventListener("click", () => {
          S.chrome.inspectorCollapsed = !S.chrome.inspectorCollapsed;
          syncWorkspaceChrome();
          saveWorkspacePrefs();
          setStatus(S.chrome.inspectorCollapsed ? "Inspector hidden." : "Inspector shown.");
        });
      if (U.toggleAssetStripBtn)
        U.toggleAssetStripBtn.addEventListener("click", () => {
          S.chrome.assetStripCollapsed = !S.chrome.assetStripCollapsed;
          syncWorkspaceChrome();
          saveWorkspacePrefs();
          setStatus(S.chrome.assetStripCollapsed ? "Face strip hidden." : "Face strip shown.");
        });
      if (U.toggleMetaPanelBtn) U.toggleMetaPanelBtn.addEventListener("click", toggleMetaPanel);
      if (U.toggleContextPanelBtn)
        U.toggleContextPanelBtn.addEventListener("click", toggleContextPanel);
      if (U.toggleRenderPanelBtn)
        U.toggleRenderPanelBtn.addEventListener("click", toggleRenderPanel);

      if (U.toggleMetaPanelBtn)
        U.toggleMetaPanelBtn.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleMetaPanel();
          }
        });
      if (U.toggleContextPanelBtn)
        U.toggleContextPanelBtn.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleContextPanel();
          }
        });
      if (U.toggleRenderPanelBtn)
        U.toggleRenderPanelBtn.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleRenderPanel();
          }
        });

      U.themeSelect.addEventListener("ds-theme-change", (event) => {
        const nextTheme = event?.detail?.theme || U.themeSelect.value;
        S.theme = nextTheme;
        refreshRenderStyleCache();
        requestRender();
        setStatus(`Theme set to ${S.theme}.`);
      });
      U.themeSelect.addEventListener("input", () => {
        if (window.DesignSystemThemeSelector) return;
        S.theme = U.themeSelect.value;
        document.documentElement.dataset.theme = S.theme;
        refreshRenderStyleCache();
        requestRender();
        setStatus(`Theme set to ${S.theme}.`);
      });
      if (U.rendererSelect)
        U.rendererSelect.addEventListener("input", () => {
          S.renderer.engine = U.rendererSelect.value === "webgl" ? "webgl" : "canvas";
          setStatus(
            S.renderer.engine === "webgl"
              ? "3D renderer set to WebGL Primary."
              : "3D renderer set to Canvas fallback/debug mode.",
          );
        });
      if (U.poseSelect)
        U.poseSelect.addEventListener("input", () => {
          S.view.pose = U.poseSelect.value;
          saveWorkspacePrefs();
          setStatus(`Pose set to ${S.view.pose}.`);
        });
      if (U.discBackStyleAssetSelect)
        U.discBackStyleAssetSelect.addEventListener("input", () => {
          S.view.discBackStyle = U.discBackStyleAssetSelect.value;
        });
      if (U.faceTintInput)
        U.faceTintInput.addEventListener("input", () => {
          S.view.faceTint = U.faceTintInput.value;
        });
      if (U.bgTextureSelect)
        U.bgTextureSelect.addEventListener("input", () => {
          S.view.bgTexture = U.bgTextureSelect.value;
          saveWorkspacePrefs();
        });
      if (U.wireframeCheckbox)
        U.wireframeCheckbox.addEventListener("input", () => {
          S.view.wireframe = U.wireframeCheckbox.checked;
        });
      if (U.verticesCheckbox)
        U.verticesCheckbox.addEventListener("input", () => {
          S.view.vertices = U.verticesCheckbox.checked;
        });
      if (U.uvAxisDebugCheckbox)
        U.uvAxisDebugCheckbox.addEventListener("input", () => {
          S.view.uvAxisDebug = U.uvAxisDebugCheckbox.checked;
        });
      if (U.spinCheckbox)
        U.spinCheckbox.addEventListener("input", () => {
          S.view.spin = U.spinCheckbox.checked;
          syncViewToggleUI();
          saveWorkspacePrefs();
        });
      if (U.gridCheckbox)
        U.gridCheckbox.addEventListener("input", () => {
          S.view.grid = U.gridCheckbox.checked;
          syncViewToggleUI();
        });
      U.glowCheckbox.addEventListener("input", () => {
        S.view.glow = U.glowCheckbox.checked;
        saveWorkspacePrefs();
        document.body.style.background = S.view.glow
          ? "radial-gradient(1200px 700px at 86% -8%, color-mix(in oklab, var(--ds-accent) 14%, transparent), transparent 62%), radial-gradient(900px 620px at -20% 120%, color-mix(in oklab, var(--ds-info) 12%, transparent), transparent 62%), var(--ds-bg)"
          : "var(--ds-bg)";
      });
      if (U.debugMappingCheckbox)
        U.debugMappingCheckbox.addEventListener("input", () => {
          S.debug.mapping = U.debugMappingCheckbox.checked;
          if (U.debugOutput) {
            U.debugOutput.hidden = !S.debug.mapping;
            if (!S.debug.mapping) U.debugOutput.textContent = "Mapping debug disabled.";
          }
        });
      if (U.copyDebugBtn)
        U.copyDebugBtn.addEventListener("click", async () => {
          const text = U.debugOutput?.textContent || "";
          const ok = await copyTextToClipboard(text);
          setStatus(ok ? "Copied mapping debug text." : "Copy failed. Clipboard blocked by browser.");
        });

      U.toolAutoRotateBtn.addEventListener("click", () => {
        S.view.spin = !S.view.spin;
        syncViewToggleUI();
        saveWorkspacePrefs();
      });
      if (U.toolAutoRotateMenuBtn)
        U.toolAutoRotateMenuBtn.addEventListener("click", () => {
          S.view.spin = !S.view.spin;
          syncViewToggleUI();
          saveWorkspacePrefs();
          setHeaderMoreOpen(true);
        });
      U.toolNormalsBtn.addEventListener("click", () => {
        S.view.normals = !S.view.normals;
        syncViewToggleUI();
        saveWorkspacePrefs();
      });
      if (U.toolNormalsMenuBtn)
        U.toolNormalsMenuBtn.addEventListener("click", () => {
          S.view.normals = !S.view.normals;
          syncViewToggleUI();
          saveWorkspacePrefs();
          setHeaderMoreOpen(true);
        });
      U.toolRenderStandardBtn.addEventListener("click", () => {
        S.view.renderMode = "standard";
        syncViewToggleUI();
        saveWorkspacePrefs();
      });
      U.toolRenderWobbleBtn.addEventListener("click", () => {
        S.view.renderMode = "wobble";
        syncViewToggleUI();
        saveWorkspacePrefs();
      });
      U.toolFaceVizBtn.addEventListener("click", () => {
        S.view.faceViz = S.view.faceViz === "opaque" ? "transparent" : "opaque";
        syncViewToggleUI();
        saveWorkspacePrefs();
      });
      U.toolTemplateLabelsBtn.addEventListener("click", () => {
        S.view.templateLabels = !S.view.templateLabels;
        syncViewToggleUI();
        saveWorkspacePrefs();
      });
      if (U.toolTemplateLabelsMenuBtn)
        U.toolTemplateLabelsMenuBtn.addEventListener("click", () => {
          S.view.templateLabels = !S.view.templateLabels;
          syncViewToggleUI();
          saveWorkspacePrefs();
          setHeaderMoreOpen(true);
        });
      if (U.toolMoreBtn && U.toolMoreMenu)
        U.toolMoreBtn.addEventListener("click", () => {
          setHeaderMoreOpen(U.toolMoreMenu.hidden);
        });

      document.addEventListener("click", (event) => {
        if (!U.toolMoreMenu || U.toolMoreMenu.hidden) return;
        const inMenu = U.toolMoreMenu.contains(event.target);
        const inTrigger = U.toolMoreBtn?.contains(event.target);
        if (!inMenu && !inTrigger) setHeaderMoreOpen(false);
      });
      document.addEventListener("pointerdown", (event) => {
        if (!S.contextMenu.open || !U.contextMenu) return;
        if (!U.contextMenu.contains(event.target)) closeContextMenu();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!S.settingsOpen) return;
        const inDrawer = U.settingsDrawer?.contains(event.target);
        const inTrigger = U.settingsOpenBtns.some((button) => button.contains(event.target));
        if (!inDrawer && !inTrigger) closeSettingsDrawer();
      });
      document.addEventListener("fullscreenchange", () => {
        syncFocusButton();
        closeContextMenu();
        requestRender();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeContextMenu();
          if (S.view.preview) {
            S.view.preview = false;
            syncWorkspaceChrome();
            saveWorkspacePrefs();
            requestRender();
            setStatus("Preview mode off.");
            return;
          }
          setHeaderMoreOpen(false);
        }
        if (
          S.screen === "workspace" &&
          !event.repeat &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !(event.target instanceof HTMLInputElement) &&
          !(event.target instanceof HTMLTextAreaElement) &&
          !(event.target instanceof HTMLSelectElement)
        ) {
          if (event.key.toLowerCase() === "p") {
            S.view.preview = !S.view.preview;
            syncWorkspaceChrome();
            saveWorkspacePrefs();
            requestRender();
            setStatus(S.view.preview ? "Preview mode on." : "Preview mode off.");
          }
          if (event.key.toLowerCase() === "i") {
            S.chrome.inspectorCollapsed = !S.chrome.inspectorCollapsed;
            syncWorkspaceChrome();
            saveWorkspacePrefs();
            requestRender();
            setStatus(S.chrome.inspectorCollapsed ? "Inspector hidden." : "Inspector shown.");
          }
        }
      });
      document.addEventListener(
        "scroll",
        () => {
          closeContextMenu();
        },
        true,
      );

      U.viewFrontBtn.addEventListener("click", () => {
        applyCameraPreset("front");
      });
      U.viewBackBtn.addEventListener("click", () => {
        applyCameraPreset("back");
      });
      U.viewLeftBtn.addEventListener("click", () => {
        applyCameraPreset("left");
      });
      U.viewRightBtn.addEventListener("click", () => {
        applyCameraPreset("right");
      });
      U.viewTopBtn.addEventListener("click", () => {
        applyCameraPreset("top");
      });
      U.viewBottomBtn.addEventListener("click", () => {
        applyCameraPreset("bottom");
      });
      U.viewHomeBtn.addEventListener("click", () => {
        if (asset()?.type === "2d") {
          const currentAsset = asset();
          if (!currentAsset?.image) {
            reset2DWorkspaceView();
            requestRender();
            return;
          }
          if (!S.view.assetEditSelected) {
            reset2DWorkspaceView();
            requestRender();
            return;
          }
          ensure2DTransform(currentAsset);
          currentAsset.tr.x = 0;
          currentAsset.tr.y = 0;
          sync2DTransformFields(currentAsset);
          requestRender();
          return;
        }
        applyCameraPreset("home");
      });
      U.viewIsoBtn.addEventListener("click", () => {
        applyCameraPreset("iso");
      });
      U.viewFitBtn.addEventListener("click", () => {
        if (asset()?.type === "2d") {
          if (!asset()?.image || !S.view.assetEditSelected) {
            reset2DWorkspaceView();
            requestRender();
            return;
          }
          fitAsset("contain");
          requestRender();
          return;
        }
        applyCameraPreset("fit");
      });
      U.zoomInBtn.addEventListener("click", () => {
        const currentAsset = asset();
        if (currentAsset?.type === "2d") {
          if (!currentAsset.image || !S.view.assetEditSelected) {
            S.view.stage2dZoom = clampNumber(
              (S.view.stage2dZoom || 1) + 0.12,
              STAGE_2D_ZOOM_MIN,
              STAGE_2D_ZOOM_MAX,
            );
            requestRender();
            return;
          }
          ensure2DTransform(currentAsset);
          currentAsset.tr.s = clampNumber(currentAsset.tr.s + 0.08, 0.2, 3);
          sync2DTransformFields(currentAsset);
          requestRender();
          return;
        }
        S.view.zoom += 0.16;
      });
      U.zoomOutBtn.addEventListener("click", () => {
        const currentAsset = asset();
        if (currentAsset?.type === "2d") {
          if (!currentAsset.image || !S.view.assetEditSelected) {
            S.view.stage2dZoom = clampNumber(
              (S.view.stage2dZoom || 1) - 0.12,
              STAGE_2D_ZOOM_MIN,
              STAGE_2D_ZOOM_MAX,
            );
            requestRender();
            return;
          }
          ensure2DTransform(currentAsset);
          currentAsset.tr.s = clampNumber(currentAsset.tr.s - 0.08, 0.2, 3);
          sync2DTransformFields(currentAsset);
          requestRender();
          return;
        }
        S.view.zoom = Math.max(ZOOM_MIN, S.view.zoom - 0.16);
      });
      U.zoomResetBtn.addEventListener("click", () => {
        if (asset()?.type === "2d") {
          if (!asset()?.image || !S.view.assetEditSelected) {
            reset2DWorkspaceView();
            requestRender();
            return;
          }
          reset2DTransform();
          requestRender();
          return;
        }
        const currentCart = cart();
        applyDefaultViewForTemplate(currentCart ? tById(currentCart.templateId) : null);
      });
      if (U.focusWorkspaceBtn)
        U.focusWorkspaceBtn.addEventListener("click", async () => {
          await toggleWorkspaceFullscreen();
        });

      [
        U.togglePreviewBtn,
        U.toggleInspectorBtn,
        U.toggleAssetStripBtn,
        U.toggleMetaPanelBtn,
        U.toggleContextPanelBtn,
        U.toggleRenderPanelBtn,
        U.toolAutoRotateBtn,
        U.toolAutoRotateMenuBtn,
        U.toolNormalsBtn,
        U.toolNormalsMenuBtn,
        U.toolRenderStandardBtn,
        U.toolRenderWobbleBtn,
        U.toolFaceVizBtn,
        U.toolTemplateLabelsBtn,
        U.toolTemplateLabelsMenuBtn,
        U.viewFrontBtn,
        U.viewBackBtn,
        U.viewLeftBtn,
        U.viewRightBtn,
        U.viewTopBtn,
        U.viewBottomBtn,
        U.viewHomeBtn,
        U.viewIsoBtn,
        U.viewFitBtn,
        U.zoomInBtn,
        U.zoomOutBtn,
        U.zoomResetBtn,
      ]
        .filter(Boolean)
        .forEach((control) => {
          control.addEventListener("click", () => requestRender());
        });

      [
        U.rendererSelect,
        U.poseSelect,
        U.discBackStyleAssetSelect,
        U.faceTintInput,
        U.bgTextureSelect,
        U.wireframeCheckbox,
        U.verticesCheckbox,
        U.uvAxisDebugCheckbox,
        U.spinCheckbox,
        U.gridCheckbox,
        U.glowCheckbox,
      ]
        .filter(Boolean)
        .forEach((control) => {
          control.addEventListener("input", () => requestRender());
        });
    }

    return {
      bindChromeAndSettingsUI,
    };
  }

  window.KataCartBootUI = {
    createBootUI,
  };
})();
