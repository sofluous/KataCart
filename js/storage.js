(function () {
  function createStorageModule({
    S,
    storage = window.localStorage,
    workspacePrefsKey = "katacart-workspace-ui-v1",
    clampGizmoPitch,
    clampGizmoZoom,
  }) {
    function snapshotWorkspacePrefs() {
      return {
        preview: !!S.view.preview,
        inspectorCollapsed: !!S.chrome.inspectorCollapsed,
        assetStripCollapsed: !!S.chrome.assetStripCollapsed,
        metaCollapsed: !!S.chrome.metaCollapsed,
        contextCollapsed: !!S.chrome.contextCollapsed,
        renderCollapsed: !!S.chrome.renderCollapsed,
        renderMode: S.view.renderMode,
        faceViz: S.view.faceViz,
        templateLabels: !!S.view.templateLabels,
        normals: !!S.view.normals,
        spin: !!S.view.spin,
        pose: S.view.pose,
        bgTexture: S.view.bgTexture,
        glow: !!S.view.glow,
        gizmoYaw: Number(S.gizmo.yaw || 0),
        gizmoPitch: Number(S.gizmo.pitch || 0),
        gizmoZoom: Number(S.gizmo.zoom || 1),
      };
    }

    function saveWorkspacePrefs() {
      try {
        storage.setItem(workspacePrefsKey, JSON.stringify(snapshotWorkspacePrefs()));
      } catch {}
    }

    function loadWorkspacePrefs() {
      try {
        const raw = storage.getItem(workspacePrefsKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.preview === "boolean") S.view.preview = data.preview;
        if (typeof data.inspectorCollapsed === "boolean")
          S.chrome.inspectorCollapsed = data.inspectorCollapsed;
        if (typeof data.assetStripCollapsed === "boolean")
          S.chrome.assetStripCollapsed = data.assetStripCollapsed;
        if (typeof data.metaCollapsed === "boolean") S.chrome.metaCollapsed = data.metaCollapsed;
        if (typeof data.contextCollapsed === "boolean")
          S.chrome.contextCollapsed = data.contextCollapsed;
        if (typeof data.renderCollapsed === "boolean")
          S.chrome.renderCollapsed = data.renderCollapsed;
        if (typeof data.renderMode === "string") S.view.renderMode = data.renderMode;
        if (typeof data.faceViz === "string") S.view.faceViz = data.faceViz;
        if (typeof data.templateLabels === "boolean")
          S.view.templateLabels = data.templateLabels;
        if (typeof data.normals === "boolean") S.view.normals = data.normals;
        if (typeof data.spin === "boolean") S.view.spin = data.spin;
        if (typeof data.pose === "string") S.view.pose = data.pose;
        if (typeof data.bgTexture === "string") S.view.bgTexture = data.bgTexture;
        if (typeof data.glow === "boolean") S.view.glow = data.glow;
        if (Number.isFinite(Number(data.gizmoYaw))) S.gizmo.yaw = Number(data.gizmoYaw);
        if (Number.isFinite(Number(data.gizmoPitch)))
          S.gizmo.pitch = clampGizmoPitch(Number(data.gizmoPitch));
        if (Number.isFinite(Number(data.gizmoZoom)))
          S.gizmo.zoom = clampGizmoZoom(Number(data.gizmoZoom));
      } catch {}
    }

    return {
      saveWorkspacePrefs,
      loadWorkspacePrefs,
      snapshotWorkspacePrefs,
    };
  }

  window.KataCartStorage = {
    createStorageModule,
  };
})();
