(function () {
  function createWorkspaceInput(deps) {
    const {
      S,
      U,
      cart,
      asset,
      clampNumber,
      ZOOM_MIN,
      STAGE_2D_ZOOM_MIN,
      STAGE_2D_ZOOM_MAX,
      saveWorkspacePrefs,
      setStatus,
      renderGallery,
      syncContextFromAsset,
      setActiveAsset,
      uploadImage,
      syncTransformFromUI,
      syncTransformValueInput,
      toggle2DMirror,
      fitAsset,
      reset2DTransform,
      sync3DTransformFromUI,
      sync3DTransformValueInput,
      ensureModelTransform,
      reset3DTransform,
      clampGizmoPitch,
      applyGizmoZoom,
      beginStagePointerInteraction,
      moveStagePointerInteraction,
      endStagePointerInteraction,
      cancelStagePointerInteraction,
      handleStageWheelInteraction,
      applyWorkspaceWheelZoom,
      refreshRenderStyleCache,
      syncWorkspaceChrome,
      openContextMenu,
      applyCameraPreset,
      reset2DWorkspaceView,
      toggleWorkspaceFullscreen,
      isEmpty2DAssetActive,
      setDropHover,
      isCompactHeaderMode,
      setHeaderMoreOpen,
      resizeCanvas,
      bindExportUI,
      loadWorkspacePrefs,
      buildStarterCarts,
      openGallery,
      preloadSampleFolderAssets,
      renderCreatePanel,
      tById,
      applyDefaultViewForTemplate,
      requestRender,
    } = deps;

    let lastPt = null;

    function bindWorkspaceInputs() {
      U.cartNameOverlay.addEventListener("input", () => {
        const currentCart = cart();
        if (currentCart) currentCart.name = U.cartNameOverlay.value;
      });
      U.cartNameOverlay.addEventListener("blur", () => {
        const currentCart = cart();
        if (!currentCart) return;
        currentCart.updatedAt = new Date().toISOString();
        renderGallery();
        setStatus(`Renamed cart to "${currentCart.name}".`);
      });

      U.metaNotes.addEventListener("input", () => {
        const currentCart = cart();
        if (currentCart) currentCart.notes = U.metaNotes.value;
      });
      U.metaTags.addEventListener("input", () => {
        const currentCart = cart();
        if (currentCart) currentCart.tags = U.metaTags.value;
      });
      U.metaSku.addEventListener("input", () => {
        const currentCart = cart();
        if (currentCart) currentCart.sku = U.metaSku.value;
      });
      if (U.faceSelect)
        U.faceSelect.addEventListener("input", () => {
          setActiveAsset(U.faceSelect.value);
        });
      if (U.assetSelect)
        U.assetSelect.addEventListener("input", () => {
          if (U.assetSelect.value === "__upload__") {
            const currentAsset = asset();
            if (currentAsset?.type === "2d") U.assetFileInput.click();
          }
          syncContextFromAsset();
          requestRender();
        });

      U.assetFileInput.addEventListener("change", (event) => {
        uploadImage(event.target.files?.[0]);
        event.target.value = "";
      });
      U.txRange.addEventListener("input", syncTransformFromUI);
      U.tyRange.addEventListener("input", syncTransformFromUI);
      U.tsRange.addEventListener("input", syncTransformFromUI);
      U.trRange.addEventListener("input", syncTransformFromUI);
      U.pxRange.addEventListener("input", syncTransformFromUI);
      U.txOut.addEventListener("change", () => syncTransformValueInput("x"));
      U.tyOut.addEventListener("change", () => syncTransformValueInput("y"));
      U.tsOut.addEventListener("change", () => syncTransformValueInput("scale"));
      U.trOut.addEventListener("change", () => syncTransformValueInput("rotate"));
      U.pxOut.addEventListener("change", () => syncTransformValueInput("pixelize"));
      U.mirrorXBtn.addEventListener("click", () => toggle2DMirror("x"));
      U.mirrorYBtn.addEventListener("click", () => toggle2DMirror("y"));
      U.fitContainBtn.addEventListener("click", () => fitAsset("contain"));
      U.fitFillBtn.addEventListener("click", () => fitAsset("fill"));
      U.fitWidthBtn.addEventListener("click", () => fitAsset("width"));
      U.fitHeightBtn.addEventListener("click", () => fitAsset("height"));
      U.reset2dBtn.addEventListener("click", reset2DTransform);
      U.m3dXRange.addEventListener("input", sync3DTransformFromUI);
      U.m3dYRange.addEventListener("input", sync3DTransformFromUI);
      U.m3dSRange.addEventListener("input", sync3DTransformFromUI);
      U.m3dXOut.addEventListener("change", () => sync3DTransformValueInput("x"));
      U.m3dYOut.addEventListener("change", () => sync3DTransformValueInput("y"));
      U.m3dSOut.addEventListener("change", () => sync3DTransformValueInput("scale"));
      U.rotX90Btn.addEventListener("click", () => {
        const currentCart = cart();
        if (!currentCart) return;
        ensureModelTransform(currentCart);
        currentCart.modelTr.rx += 90;
        requestRender();
      });
      U.rotY90Btn.addEventListener("click", () => {
        const currentCart = cart();
        if (!currentCart) return;
        ensureModelTransform(currentCart);
        currentCart.modelTr.ry += 90;
        requestRender();
      });
      U.mirror3dXBtn.addEventListener("click", () => {
        const currentCart = cart();
        if (!currentCart) return;
        ensureModelTransform(currentCart);
        currentCart.modelTr.mx = !currentCart.modelTr.mx;
        requestRender();
      });
      U.reset3dBtn.addEventListener("click", reset3DTransform);

      U.miniCanvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        S.gizmo.drag = true;
        S.gizmo.px = event.clientX;
        S.gizmo.py = event.clientY;
        U.miniCanvas.setPointerCapture(event.pointerId);
        requestRender();
      });
      U.miniCanvas.addEventListener("pointermove", (event) => {
        if (!S.gizmo.drag) return;
        const dx = event.clientX - S.gizmo.px;
        const dy = event.clientY - S.gizmo.py;
        S.gizmo.px = event.clientX;
        S.gizmo.py = event.clientY;
        S.gizmo.yaw += dx * 0.01;
        S.gizmo.pitch = clampGizmoPitch(S.gizmo.pitch - dy * 0.01);
        requestRender();
      });
      U.miniCanvas.addEventListener("pointerup", (event) => {
        S.gizmo.drag = false;
        saveWorkspacePrefs();
        if (U.miniCanvas.hasPointerCapture(event.pointerId))
          U.miniCanvas.releasePointerCapture(event.pointerId);
        requestRender();
      });
      U.miniCanvas.addEventListener("pointercancel", (event) => {
        S.gizmo.drag = false;
        saveWorkspacePrefs();
        if (U.miniCanvas.hasPointerCapture(event.pointerId))
          U.miniCanvas.releasePointerCapture(event.pointerId);
        requestRender();
      });
      U.miniCanvas.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
          const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
          applyGizmoZoom(S.gizmo.zoom * factor);
        },
        { passive: false },
      );

      U.stageCanvas.addEventListener("pointerdown", (event) => {
        const currentAsset = asset();
        if (!currentAsset || (currentAsset.type !== "3d" && currentAsset.type !== "2d")) return;
        if (currentAsset.type === "2d") {
          beginStagePointerInteraction(event, currentAsset);
        } else {
          S.view.dragMode = "orbit";
          lastPt = { x: event.clientX, y: event.clientY };
        }
        S.view.drag = true;
        S.view.dragMoved = false;
        U.stageCanvas.classList.add("drag");
        U.stageCanvas.setPointerCapture(event.pointerId);
        requestRender();
      });
      U.stageCanvas.addEventListener("pointermove", (event) => {
        const currentAsset = asset();
        if (currentAsset?.type === "2d") {
          moveStagePointerInteraction(event, currentAsset);
          return;
        }
        if (!S.view.drag || !lastPt) return;
        const dx = event.clientX - lastPt.x;
        const dy = event.clientY - lastPt.y;
        lastPt = { x: event.clientX, y: event.clientY };
        if (currentAsset?.type === "3d") {
          S.view.dragMoved = true;
          S.view.yaw += dx * 0.01;
          S.view.pitch = deps.clampViewPitch(S.view.pitch - dy * 0.01);
          requestRender();
        }
      });
      U.stageCanvas.addEventListener("pointerup", (event) => {
        const currentAsset = asset();
        if (currentAsset?.type === "2d") {
          endStagePointerInteraction(currentAsset);
        } else {
          S.view.drag = false;
          S.view.dragMoved = false;
          S.view.dragMode = "";
        }
        U.stageCanvas.classList.remove("drag");
        lastPt = null;
        if (U.stageCanvas.hasPointerCapture(event.pointerId))
          U.stageCanvas.releasePointerCapture(event.pointerId);
        requestRender();
      });
      U.stageCanvas.addEventListener("pointercancel", (event) => {
        if (asset()?.type === "2d") cancelStagePointerInteraction();
        else {
          S.view.drag = false;
          S.view.dragMoved = false;
          S.view.dragMode = "";
        }
        U.stageCanvas.classList.remove("drag");
        lastPt = null;
        if (U.stageCanvas.hasPointerCapture(event.pointerId))
          U.stageCanvas.releasePointerCapture(event.pointerId);
        requestRender();
      });
      U.stageCanvas.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
          const currentAsset = asset();
          if (currentAsset?.type === "2d") {
            handleStageWheelInteraction(event, currentAsset);
            requestRender();
            return;
          }
          applyWorkspaceWheelZoom(event.deltaY, event.clientX, event.clientY);
        },
        { passive: false },
      );
      U.stageCanvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const menu = [
          {
            label: S.view.preview ? "Exit Preview" : "Enter Preview",
            icon: S.view.preview ? "iconoir-eye-off" : "iconoir-eye-empty",
            action: () => {
              S.view.preview = !S.view.preview;
              syncWorkspaceChrome();
              saveWorkspacePrefs();
              setStatus(S.view.preview ? "Preview mode on." : "Preview mode off.");
            },
          },
          {
            label: S.chrome.inspectorCollapsed ? "Show Inspector" : "Hide Inspector",
            icon: "iconoir-sidebar-collapse",
            action: () => {
              S.chrome.inspectorCollapsed = !S.chrome.inspectorCollapsed;
              syncWorkspaceChrome();
              saveWorkspacePrefs();
            },
          },
          {
            label: S.chrome.assetStripCollapsed ? "Show Face Strip" : "Hide Face Strip",
            icon: "iconoir-view-columns-3",
            action: () => {
              S.chrome.assetStripCollapsed = !S.chrome.assetStripCollapsed;
              syncWorkspaceChrome();
              saveWorkspacePrefs();
            },
          },
          {
            label: "Fit View",
            icon: "iconoir-frame-select",
            action: () => {
              if (asset()?.type === "2d") {
                if (asset()?.image && S.view.assetEditSelected) fitAsset("contain");
                else reset2DWorkspaceView();
                return;
              }
              applyCameraPreset("fit");
            },
          },
          {
            label: document.fullscreenElement ? "Exit Full Screen" : "Enter Full Screen",
            icon: document.fullscreenElement ? "iconoir-minimize" : "iconoir-expand",
            action: () => {
              toggleWorkspaceFullscreen();
            },
          },
        ];
        if (asset()?.type === "3d") {
          menu.splice(
            4,
            0,
            {
              label: "Front View",
              icon: "iconoir-view-grid",
              action: () => applyCameraPreset("front"),
            },
            {
              label: "Isometric View",
              icon: "iconoir-cube-bandage",
              action: () => applyCameraPreset("iso"),
            },
          );
        }
        openContextMenu(event.clientX, event.clientY, menu);
      });
      U.stageCanvas.addEventListener("dragover", (event) => {
        if (!isEmpty2DAssetActive()) return;
        event.preventDefault();
        setDropHover(true);
        requestRender();
      });
      U.stageCanvas.addEventListener("dragenter", (event) => {
        if (!isEmpty2DAssetActive()) return;
        event.preventDefault();
        setDropHover(true);
        requestRender();
      });
      U.stageCanvas.addEventListener("dragleave", () => {
        setDropHover(false);
        requestRender();
      });
      U.stageCanvas.addEventListener("drop", (event) => {
        if (!isEmpty2DAssetActive()) return;
        event.preventDefault();
        setDropHover(false);
        const file = [...(event.dataTransfer?.files || [])].find((item) =>
          item.type.startsWith("image/"),
        );
        if (!file) {
          setStatus("Drop an image file (PNG/JPG/WebP).");
          return;
        }
        uploadImage(file);
      });

      [
        U.faceSelect,
        U.txRange,
        U.tyRange,
        U.tsRange,
        U.trRange,
        U.pxRange,
        U.m3dXRange,
        U.m3dYRange,
        U.m3dSRange,
      ]
        .filter(Boolean)
        .forEach((control) => {
          control.addEventListener("input", () => requestRender());
        });

      [
        U.txOut,
        U.tyOut,
        U.tsOut,
        U.trOut,
        U.pxOut,
        U.m3dXOut,
        U.m3dYOut,
        U.m3dSOut,
      ]
        .filter(Boolean)
        .forEach((control) => {
          control.addEventListener("change", () => requestRender());
        });

      [
        U.mirrorXBtn,
        U.mirrorYBtn,
        U.fitContainBtn,
        U.fitFillBtn,
        U.fitWidthBtn,
        U.fitHeightBtn,
        U.reset2dBtn,
        U.reset3dBtn,
      ]
        .filter(Boolean)
        .forEach((control) => {
          control.addEventListener("click", () => requestRender());
        });
    }

    function initApp() {
      bindExportUI();
      window.addEventListener("resize", () => {
        resizeCanvas();
        if (!isCompactHeaderMode()) setHeaderMoreOpen(false);
        requestRender();
      });

      if (window.DesignSystemThemeSelector && U.themeSelect) {
        S.theme = document.documentElement.getAttribute("data-theme") || S.theme;
        U.themeSelect.value = S.theme;
      } else if (U.themeSelect && !U.themeSelect.options.length) {
        U.themeSelect.innerHTML = `<option value="${S.theme}">${S.theme}</option>`;
        U.themeSelect.value = S.theme;
      }
      refreshRenderStyleCache?.();
      loadWorkspacePrefs();
      S.carts = buildStarterCarts();
      document.body.style.background = S.view.glow
        ? "radial-gradient(1200px 700px at 86% -8%, color-mix(in oklab, var(--ds-accent) 14%, transparent), transparent 62%), radial-gradient(900px 620px at -20% 120%, color-mix(in oklab, var(--ds-info) 12%, transparent), transparent 62%), var(--ds-bg)"
        : "var(--ds-bg)";
      openGallery();
      preloadSampleFolderAssets().catch(() => {});
      renderCreatePanel();
      requestRender();
    }

    return {
      bindWorkspaceInputs,
      initApp,
    };
  }

  window.KataCartWorkspaceInput = {
    createWorkspaceInput,
  };
})();
