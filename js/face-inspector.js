(function () {
  function createFaceInspector(deps) {
    const {
      S,
      U,
      cart,
      asset,
      tById,
      templateSpec,
      assetPhysicalDimsMm,
      ensure2DTransform,
      ensureModelTransform,
      clampNumber,
      set2DAssetEditSelected,
      syncViewToggleUI,
      syncExportModalState,
      saveWorkspacePrefs,
      setDropHover,
    } = deps;

    function sync2DTransformFields(a) {
      U.txRange.value = String(a.tr.x);
      U.tyRange.value = String(a.tr.y);
      U.tsRange.value = String(Math.round(a.tr.s * 100));
      U.trRange.value = String(Math.round(a.tr.r));
      U.pxRange.value = String(Math.round(a.tr.px || 1));
      U.txOut.value = String(a.tr.x);
      U.tyOut.value = String(a.tr.y);
      U.tsOut.value = a.tr.s.toFixed(2);
      U.trOut.value = String(Math.round(a.tr.r));
      U.pxOut.value = String(Math.round(a.tr.px || 1));
    }

    function sync2DInspectorState(a) {
      const is2d = a?.type === "2d";
      const hasArtwork = !!a?.image;
      const controlReady = is2d && hasArtwork;
      const controls = [
        U.txRange,
        U.tyRange,
        U.tsRange,
        U.trRange,
        U.pxRange,
        U.txOut,
        U.tyOut,
        U.tsOut,
        U.trOut,
        U.pxOut,
        U.mirrorXBtn,
        U.mirrorYBtn,
        U.fitContainBtn,
        U.fitFillBtn,
        U.fitWidthBtn,
        U.fitHeightBtn,
        U.reset2dBtn,
      ];
      controls.forEach((control) => {
        if (control) control.disabled = !controlReady;
      });
      if (!U.context2D) return;
      U.context2D.classList.toggle("is-edit-locked", is2d && !controlReady);
      U.context2D.classList.toggle(
        "is-edit-active",
        is2d && controlReady && !!S.view.assetEditSelected,
      );
      U.context2D.classList.toggle("is-empty", is2d && !hasArtwork);
    }

    function sync3DTransformFields(c) {
      U.m3dXRange.value = String(c.modelTr.tx);
      U.m3dYRange.value = String(c.modelTr.ty);
      U.m3dSRange.value = String(Math.round(c.modelTr.s * 100));
      U.m3dXOut.value = c.modelTr.tx.toFixed(2);
      U.m3dYOut.value = c.modelTr.ty.toFixed(2);
      U.m3dSOut.value = c.modelTr.s.toFixed(2);
    }

    function syncContextFromAsset() {
      const c = cart();
      const a = asset();
      if (!c || !a) return;
      c.lastAssetId = a.id;
      const t = tById(c.templateId);
      const isDiscTemplate = !!templateSpec(t).capabilities?.supportsDiscPose;
      const mm = a.type === "2d" ? assetPhysicalDimsMm(a.id, t) : null;
      U.hudAsset.textContent = `Face: ${a.label}`;
      const assetDims =
        a.type === "2d"
          ? `${a.w}x${a.h}px${mm ? ` (${mm.w}x${mm.h}mm)` : ""}`
          : a.type === "3d"
            ? "3D Viewer"
            : "UV Viewer";
      U.hudTemplate.textContent = `Template: ${t.name} ${t.d.w}x${t.d.h}x${t.d.z}mm | Face ${a.label} ${assetDims} | UV ${t.uv.w}x${t.uv.h}px`;
      const is2d = a.type === "2d";
      const is3d = a.type === "3d";
      const isUV = a.type === "uv";
      const isDiscAsset = is2d && a.id === "disc_art";
      if (!is2d || !a.image) set2DAssetEditSelected(false);
      if (U.faceSelect) {
        U.faceSelect.innerHTML = "";
        c.assets.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.id;
          option.textContent = item.label;
          option.selected = item.id === a.id;
          U.faceSelect.append(option);
        });
      }
      if (U.assetSelect) {
        U.assetSelect.innerHTML = "";
        const currentAssetOption = document.createElement("option");
        currentAssetOption.value = "__current__";
        currentAssetOption.textContent = a.image?.filename || "No artwork assigned";
        currentAssetOption.selected = true;
        U.assetSelect.append(currentAssetOption);
        if (a.type === "2d") {
          const uploadOption = document.createElement("option");
          uploadOption.value = "__upload__";
          uploadOption.textContent = "Upload Artwork...";
          U.assetSelect.append(uploadOption);
        }
      }
      if (U.artworkFileRow) U.artworkFileRow.hidden = !is2d;
      U.context2D.hidden = !is2d;
      U.context3D.hidden = !is3d;
      U.contextUV.hidden = !isUV;
      if (U.discArtStyleRow) U.discArtStyleRow.hidden = !isDiscAsset;
      if (U.discBackStyleAssetSelect && isDiscAsset)
        U.discBackStyleAssetSelect.value = S.view.discBackStyle;
      if (U.poseSelect) {
        ["disc-open", "disc-split"].forEach((value) => {
          const option = [...U.poseSelect.options].find((o) => o.value === value);
          if (option) option.disabled = !isDiscTemplate;
        });
        if (!isDiscTemplate && (S.view.pose === "disc-open" || S.view.pose === "disc-split")) {
          S.view.pose = "default";
          U.poseSelect.value = "default";
        }
      }
      U.miniGizmo.hidden = !is3d;
      U.reset3dBtn.disabled = !is3d;
      U.rotX90Btn.disabled = !is3d;
      U.rotY90Btn.disabled = !is3d;
      U.mirror3dXBtn.disabled = !is3d;
      U.cartNameOverlay.value = c.name;
      U.metaNotes.value = c.notes || "";
      U.metaTags.value = c.tags || "";
      U.metaSku.value = c.sku || "";
      if (is2d) {
        ensure2DTransform(a);
        sync2DTransformFields(a);
        sync2DInspectorState(a);
      } else if (is3d) {
        ensureModelTransform(c);
        sync3DTransformFields(c);
      }
      setDropHover(false);
      syncViewToggleUI();
      syncExportModalState();
    }

    function syncTransformFromUI() {
      const a = asset();
      if (!a || a.type !== "2d") return;
      ensure2DTransform(a);
      a.tr.x = Number(U.txRange.value);
      a.tr.y = Number(U.tyRange.value);
      a.tr.s = Number(U.tsRange.value) / 100;
      a.tr.r = Number(U.trRange.value);
      a.tr.px = Number(U.pxRange.value);
      sync2DTransformFields(a);
    }

    function syncTransformValueInput(key) {
      const a = asset();
      if (!a || a.type !== "2d") return;
      ensure2DTransform(a);
      if (key === "x") {
        a.tr.x = clampNumber(Number(U.txOut.value || 0), -220, 220);
      } else if (key === "y") {
        a.tr.y = clampNumber(Number(U.tyOut.value || 0), -220, 220);
      } else if (key === "scale") {
        a.tr.s = clampNumber(Number(U.tsOut.value || 1), 0.2, 3);
      } else if (key === "rotate") {
        a.tr.r = clampNumber(Number(U.trOut.value || 0), -180, 180);
      } else if (key === "pixelize") {
        a.tr.px = clampNumber(Math.round(Number(U.pxOut.value || 1)), 1, 64);
      }
      sync2DTransformFields(a);
    }

    function fitAsset(mode) {
      const a = asset();
      if (!a || a.type !== "2d" || !a.image) return;
      ensure2DTransform(a);
      const sx = a.w / a.image.width;
      const sy = a.h / a.image.height;
      const contain = Math.min(sx, sy);
      if (mode === "fill") {
        a.tr.s = 1;
        a.tr.stx = sx / contain;
        a.tr.sty = sy / contain;
      } else if (mode === "width") {
        a.tr.s = 1;
        a.tr.stx = sx / contain;
        a.tr.sty = sx / contain;
      } else if (mode === "height") {
        a.tr.s = 1;
        a.tr.stx = sy / contain;
        a.tr.sty = sy / contain;
      } else {
        a.tr.s = 1;
        a.tr.stx = 1;
        a.tr.sty = 1;
      }
      sync2DTransformFields(a);
    }

    function reset2DTransform() {
      const a = asset();
      if (!a || a.type !== "2d") return;
      a.tr = { x: 0, y: 0, s: 1, stx: 1, sty: 1, r: 0, mx: false, my: false, px: 1 };
      syncContextFromAsset();
      saveWorkspacePrefs();
    }

    function toggle2DMirror(axis) {
      const a = asset();
      if (!a || a.type !== "2d") return;
      ensure2DTransform(a);
      if (axis === "x") a.tr.mx = !a.tr.mx;
      if (axis === "y") a.tr.my = !a.tr.my;
    }

    function sync3DTransformFromUI() {
      const c = cart();
      if (!c) return;
      ensureModelTransform(c);
      c.modelTr.tx = Number(U.m3dXRange.value);
      c.modelTr.ty = Number(U.m3dYRange.value);
      c.modelTr.s = Number(U.m3dSRange.value) / 100;
      sync3DTransformFields(c);
    }

    function sync3DTransformValueInput(key) {
      const c = cart();
      if (!c) return;
      ensureModelTransform(c);
      if (key === "x") {
        c.modelTr.tx = clampNumber(Number(U.m3dXOut.value || 0), -1, 1);
      } else if (key === "y") {
        c.modelTr.ty = clampNumber(Number(U.m3dYOut.value || 0), -1, 1);
      } else if (key === "scale") {
        c.modelTr.s = clampNumber(Number(U.m3dSOut.value || 1), 0.4, 2.3);
      }
      sync3DTransformFields(c);
    }

    function reset3DTransform() {
      const c = cart();
      if (!c) return;
      c.modelTr = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, s: 1, mx: false };
      syncContextFromAsset();
      saveWorkspacePrefs();
    }

    return {
      syncContextFromAsset,
      sync2DTransformFields,
      sync2DInspectorState,
      sync3DTransformFields,
      syncTransformFromUI,
      syncTransformValueInput,
      fitAsset,
      reset2DTransform,
      toggle2DMirror,
      sync3DTransformFromUI,
      sync3DTransformValueInput,
      reset3DTransform,
    };
  }

  window.KataCartFaceInspector = { createFaceInspector };
})();
