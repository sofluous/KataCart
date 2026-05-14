(function () {
  const WEBGL_FACE_UV_ORDER = {
    front: [2, 3, 0, 1],
    back: [7, 6, 5, 4],
    spine: [2, 6, 5, 1],
    right: [3, 7, 4, 0],
    top: [3, 2, 6, 7],
    bottom: [0, 4, 5, 1],
  };

  const WEBGL_FACE_POLY = {
    front: [0, 3, 2, 1],
    back: [4, 5, 6, 7],
    bottom: [0, 1, 5, 4],
    right: [3, 0, 4, 7],
    top: [3, 7, 6, 2],
    spine: [1, 2, 6, 5],
  };

  const WEBGL_FACE_UV_COORDS = {
    front: [
      { u: 0, v: 1 },
      { u: 1, v: 1 },
      { u: 1, v: 0 },
      { u: 0, v: 0 },
    ],
    back: [
      { u: 0, v: 1 },
      { u: 1, v: 1 },
      { u: 1, v: 0 },
      { u: 0, v: 0 },
    ],
    spine: [
      { u: 1, v: 1 },
      { u: 0, v: 1 },
      { u: 0, v: 0 },
      { u: 1, v: 0 },
    ],
    right: [
      { u: 1, v: 1 },
      { u: 1, v: 0 },
      { u: 0, v: 0 },
      { u: 0, v: 1 },
    ],
    top: [
      { u: 1, v: 1 },
      { u: 0, v: 1 },
      { u: 0, v: 0 },
      { u: 1, v: 0 },
    ],
    bottom: [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 1, v: 1 },
      { u: 0, v: 1 },
    ],
  };

  const CANONICAL_EXPORT_MAPPING_PROFILE = {
    id: "blender",
    label: "Blender Parity",
    uvOps: ["rot180", "flipU"],
    spineTargetFace: "right",
  };

  const WEBGL_FACE_UV_ARRAY = {
    front: [0, 1, 1, 1, 1, 0, 0, 0],
    back: [0, 1, 1, 1, 1, 0, 0, 0],
    spine: [1, 1, 0, 1, 0, 0, 1, 0],
    right: [1, 1, 1, 0, 0, 0, 0, 1],
    top: [1, 1, 0, 1, 0, 0, 1, 0],
    bottom: [0, 0, 1, 0, 1, 1, 0, 1],
  };

  const CASE_FACE_RENDER_ORDER = ["front", "back", "bottom", "right", "top", "spine"];
  const WEBGL_BASE_MODEL_YAW = Math.PI;

  function caseFaceDefs(bind = {}) {
    return CASE_FACE_RENDER_ORDER.map((id) => ({
      id,
      poly: WEBGL_FACE_POLY[id],
      uvCorners: WEBGL_FACE_UV_ORDER[id],
      tex: bind[id] || null,
    }));
  }

  window.KataCartRenderConfig = {
    WEBGL_FACE_UV_ORDER,
    WEBGL_FACE_POLY,
    WEBGL_FACE_UV_COORDS,
    CANONICAL_EXPORT_MAPPING_PROFILE,
    WEBGL_FACE_UV_ARRAY,
    CASE_FACE_RENDER_ORDER,
    WEBGL_BASE_MODEL_YAW,
    caseFaceDefs,
  };
})();
