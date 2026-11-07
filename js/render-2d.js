(function () {
  function createRender2D(deps) {
    const {
      S,
      U,
      X,
      ensure2DTransform,
      clampNumber,
      STAGE_2D_ZOOM_MIN,
      STAGE_2D_ZOOM_MAX,
      canvasFont,
      CANVAS_FS_1,
      CANVAS_FS_2,
      renderStyleCache,
      drawTemplateOverlay,
      faceCompositor,
      sync2DTransformFields,
      set2DAssetEditSelected,
      syncWorkspaceChrome,
      setStatus,
      cart = () => null,
      trackCartEdit = (c, edit) => edit(),
    } = deps;
    let lastPointer = null;

    function reset2DWorkspaceView() {
      S.view.stage2dPanX = 0;
      S.view.stage2dPanY = 0;
      S.view.stage2dZoom = 1;
    }

    function zoom2DWorkspaceAt(nextZoom, anchorX, anchorY, baseFrame, canvasW, canvasH) {
      const prevZoom = clampNumber(
        S.view.stage2dZoom || 1,
        STAGE_2D_ZOOM_MIN,
        STAGE_2D_ZOOM_MAX,
      );
      const clampedZoom = clampNumber(
        nextZoom,
        STAGE_2D_ZOOM_MIN,
        STAGE_2D_ZOOM_MAX,
      );
      if (!baseFrame || !canvasW || !canvasH || clampedZoom === prevZoom) {
        S.view.stage2dZoom = clampedZoom;
        return;
      }
      const prevFx = (canvasW - baseFrame.fw * prevZoom) / 2 + S.view.stage2dPanX;
      const prevFy = (canvasH - baseFrame.fh * prevZoom) / 2 + S.view.stage2dPanY;
      const localX = (anchorX - prevFx) / Math.max(1, baseFrame.fw * prevZoom);
      const localY = (anchorY - prevFy) / Math.max(1, baseFrame.fh * prevZoom);
      const nextFx = anchorX - localX * (baseFrame.fw * clampedZoom);
      const nextFy = anchorY - localY * (baseFrame.fh * clampedZoom);
      S.view.stage2dZoom = clampedZoom;
      S.view.stage2dPanX = nextFx - (canvasW - baseFrame.fw * clampedZoom) / 2;
      S.view.stage2dPanY = nextFy - (canvasH - baseFrame.fh * clampedZoom) / 2;
    }

    function pointInRect(x, y, rect) {
      return !!(
        rect &&
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h
      );
    }

    function getPixelizedSourceImage(a) {
      return faceCompositor.getPixelizedSourceImage(a);
    }

    function getMappedTemplateImage(a) {
      return faceCompositor.getMappedTemplateImage(a);
    }

    function draw2D(a, w, h, accentColor) {
      ensure2DTransform(a);
      const margin = 56;
      const aspect = a.w / a.h;
      let frameW = w - margin * 2;
      let frameH = frameW / aspect;
      if (frameH > h - margin * 2) {
        frameH = h - margin * 2;
        frameW = frameH * aspect;
      }
      const stageZoom = clampNumber(
        S.view.stage2dZoom || 1,
        STAGE_2D_ZOOM_MIN,
        STAGE_2D_ZOOM_MAX,
      );
      const frameX = (w - frameW * stageZoom) / 2 + (S.view.stage2dPanX || 0);
      const frameY = (h - frameH * stageZoom) / 2 + (S.view.stage2dPanY || 0);
      frameW *= stageZoom;
      frameH *= stageZoom;
      X.fillStyle = renderStyleCache.textMuted;
      X.font = canvasFont(CANVAS_FS_1);
      X.fillText(`${a.label} template ${a.w}x${a.h}`, frameX, frameY - 10);
      S.view.assetFrameRect = { x: frameX, y: frameY, w: frameW, h: frameH };
      if (!a.image) {
        X.save();
        X.setLineDash([8, 6]);
        X.lineWidth = 2;
        X.strokeStyle = S.view.dragOver ? accentColor : renderStyleCache.border;
        X.strokeRect(frameX + 6, frameY + 6, frameW - 12, frameH - 12);
        X.restore();
        X.font = canvasFont(CANVAS_FS_2);
        X.fillText(
          "Drop artwork here or use Upload Artwork",
          frameX + 14,
          frameY + 26,
        );
        X.font = canvasFont(CANVAS_FS_1);
        X.fillText("Supports PNG/JPG/WebP", frameX + 14, frameY + 46);
        drawTemplateOverlay(a, frameX, frameY, frameW, frameH, accentColor);
        return;
      }
      const mapped = getMappedTemplateImage(a);
      if (mapped && (a.layers || !(S.view.assetEditSelected && a.image))) {
        X.drawImage(mapped, frameX, frameY, frameW, frameH);
      }
      if (S.view.assetEditSelected && a.image?.img && !a.layers) {
        X.save();
        X.globalAlpha = 0.18;
        faceCompositor.paintArtwork(X, a, frameX, frameY, frameW, frameH);
        X.restore();
        X.save();
        X.beginPath();
        X.rect(frameX, frameY, frameW, frameH);
        X.clip();
        faceCompositor.paintArtwork(X, a, frameX, frameY, frameW, frameH);
        X.restore();
        X.save();
        X.strokeStyle = accentColor;
        X.lineWidth = 2;
        X.setLineDash([10, 8]);
        X.strokeRect(frameX, frameY, frameW, frameH);
        X.setLineDash([]);
        X.restore();
      }
      drawTemplateOverlay(a, frameX, frameY, frameW, frameH, accentColor);
    }

    function beginStagePointerInteraction(e, currentAsset) {
      if (currentAsset.layers?.find((l) => l.id === currentAsset.activeLayerId)?.visible === false) set2DAssetEditSelected(false);
      const rect = U.stageCanvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (U.stageCanvas.width / Math.max(1, rect.width));
      const py = (e.clientY - rect.top) * (U.stageCanvas.height / Math.max(1, rect.height));
      const insideFrame = pointInRect(px, py, S.view.assetFrameRect);
      S.view.stageClickSelectCandidate = !!currentAsset.image && insideFrame && currentAsset.layers?.find((l) => l.id === currentAsset.activeLayerId)?.visible !== false;
      if (S.view.assetEditSelected && !insideFrame) {
        set2DAssetEditSelected(false);
        syncWorkspaceChrome();
        setStatus("Artwork deselected.");
      }
      S.view.dragMode =
        currentAsset.image && S.view.assetEditSelected && insideFrame ? "asset" : "viewport";
      S.view.drag = true;
      S.view.dragMoved = false;
      lastPointer = { x: e.clientX, y: e.clientY };
    }

    function moveStagePointerInteraction(e, currentAsset) {
      if (!S.view.drag || !lastPointer) return false;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer = { x: e.clientX, y: e.clientY };
      if (S.view.dragMode === "asset") {
        ensure2DTransform(currentAsset);
        S.view.dragMoved = true;
        const rect = U.stageCanvas.getBoundingClientRect();
        const frame = S.view.assetFrameRect || { w: rect.width, h: rect.height };
        currentAsset.tr.x = clampNumber(
          currentAsset.tr.x + dx * (220 / Math.max(1, frame.w * 0.45)),
          -220,
          220,
        );
        currentAsset.tr.y = clampNumber(
          currentAsset.tr.y + dy * (220 / Math.max(1, frame.h * 0.45)),
          -220,
          220,
        );
        sync2DTransformFields(currentAsset);
        return true;
      }
      if (S.view.dragMode === "viewport") {
        S.view.dragMoved = true;
        const rect = U.stageCanvas.getBoundingClientRect();
        S.view.stage2dPanX += dx * (U.stageCanvas.width / Math.max(1, rect.width));
        S.view.stage2dPanY += dy * (U.stageCanvas.height / Math.max(1, rect.height));
      }
      return true;
    }

    function endStagePointerInteraction(currentAsset) {
      if (
        !S.view.dragMoved &&
        S.view.dragMode === "viewport" &&
        S.view.stageClickSelectCandidate &&
        currentAsset?.image
      ) {
        set2DAssetEditSelected(true);
        syncWorkspaceChrome();
        setStatus("Artwork selected.");
      }
      S.view.drag = false;
      S.view.dragMoved = false;
      S.view.dragMode = "";
      S.view.stageClickSelectCandidate = false;
      lastPointer = null;
    }

    function cancelStagePointerInteraction() {
      S.view.drag = false;
      S.view.dragMoved = false;
      S.view.dragMode = "";
      S.view.stageClickSelectCandidate = false;
      lastPointer = null;
    }

    function handleStageWheelInteraction(e, currentAsset) {
      const rect = U.stageCanvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (U.stageCanvas.width / Math.max(1, rect.width));
      const py = (e.clientY - rect.top) * (U.stageCanvas.height / Math.max(1, rect.height));
      if (S.view.assetEditSelected && currentAsset.layers?.find((l) => l.id === currentAsset.activeLayerId)?.visible !== false) {
        ensure2DTransform(currentAsset);
        currentAsset.tr.s = clampNumber(
          currentAsset.tr.s + (e.deltaY < 0 ? 0.08 : -0.08),
          0.2,
          3,
        );
        sync2DTransformFields(currentAsset);
        return true;
      }
      const frame = S.view.assetFrameRect;
      const baseFrame =
        frame && S.view.stage2dZoom
          ? {
              fw: frame.w / Math.max(S.view.stage2dZoom, 0.001),
              fh: frame.h / Math.max(S.view.stage2dZoom, 0.001),
            }
          : null;
      zoom2DWorkspaceAt(
        (S.view.stage2dZoom || 1) + (e.deltaY < 0 ? 0.12 : -0.12),
        px,
        py,
        baseFrame,
        U.stageCanvas.width,
        U.stageCanvas.height,
      );
      return true;
    }

    return {
      reset2DWorkspaceView,
      zoom2DWorkspaceAt,
      pointInRect,
      getPixelizedSourceImage,
      getMappedTemplateImage,
      draw2D,
      beginStagePointerInteraction,
      moveStagePointerInteraction: (...args) => trackCartEdit(cart(), () => moveStagePointerInteraction(...args)),
      endStagePointerInteraction,
      cancelStagePointerInteraction,
      handleStageWheelInteraction: (...args) => trackCartEdit(cart(), () => handleStageWheelInteraction(...args)),
    };
  }

  window.KataCartRender2D = { createRender2D };
})();
