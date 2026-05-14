(function () {
  function createRender3DWebGL(deps) {
    const {
      S,
      U,
      X,
      canvasFont,
      CANVAS_FS_MICRO,
      caseFaceDefs,
      ensureModelTransform,
      templateSpec,
      discDiameterMmForTemplate,
      applyPosePresetToModel,
      getMappedTemplateImage,
      WEBGL_FACE_UV_ARRAY,
      WEBGL_FACE_UV_COORDS,
      WEBGL_BASE_MODEL_YAW,
    } = deps;

    const state = {
      gl: null,
      ready: false,
      program: null,
      bufPos: null,
      bufUv: null,
      bufIdx: null,
      loc: {},
      texCache: new Map(),
      discCompositeCache: new Map(),
      whiteTex: null,
    };

    function mat4Identity() {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }

    function mat4Multiply(a, b) {
      const o = new Array(16).fill(0);
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
          o[c * 4 + r] =
            a[0 * 4 + r] * b[c * 4 + 0] +
            a[1 * 4 + r] * b[c * 4 + 1] +
            a[2 * 4 + r] * b[c * 4 + 2] +
            a[3 * 4 + r] * b[c * 4 + 3];
        }
      }
      return o;
    }

    function mat4Translate(x, y, z) {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    }

    function mat4Scale(x, y, z) {
      return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
    }

    function mat4RotateX(rad) {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
    }

    function mat4RotateY(rad) {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
    }

    function mat4RotateZ(rad) {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }

    function mat4Perspective(fovRad, aspect, near, far) {
      const f = 1 / Math.tan(fovRad / 2);
      const nf = 1 / (near - far);
      return [
        f / aspect,
        0,
        0,
        0,
        0,
        f,
        0,
        0,
        0,
        0,
        (far + near) * nf,
        -1,
        0,
        0,
        (2 * far * near) * nf,
        0,
      ];
    }

    function mat4TransformPoint(m, p, w = 1) {
      return {
        x: m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12] * w,
        y: m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13] * w,
        z: m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14] * w,
        w: m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15] * w,
      };
    }

    function quadSignedArea(quad) {
      let area = 0;
      for (let i = 0; i < quad.length; i += 1) {
        const a = quad[i];
        const b = quad[(i + 1) % quad.length];
        area += a.x * b.y - b.x * a.y;
      }
      return area * 0.5;
    }

    function hexToRgb01(hex, fallback = [0.55, 0.58, 0.63]) {
      const h = String(hex || "").trim().replace("#", "");
      if (!/^[0-9a-fA-F]{6}$/.test(h)) return fallback;
      const n = Number.parseInt(h, 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    function glCompile(gl, type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const msg = gl.getShaderInfoLog(s) || "shader compile failed";
        gl.deleteShader(s);
        throw new Error(msg);
      }
      return s;
    }

    function glProgram(gl, vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, glCompile(gl, gl.VERTEX_SHADER, vs));
      gl.attachShader(p, glCompile(gl, gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const msg = gl.getProgramInfoLog(p) || "program link failed";
        gl.deleteProgram(p);
        throw new Error(msg);
      }
      return p;
    }

    function initWebGL() {
      if (state.ready) return true;
      if (!U.stageGlCanvas) return false;
      const gl =
        U.stageGlCanvas.getContext("webgl", {
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
        }) || U.stageGlCanvas.getContext("experimental-webgl");
      if (!gl) return false;
      try {
        const vs = `
          attribute vec3 a_pos;
          attribute vec2 a_uv;
          uniform mat4 u_mvp;
          uniform float u_wobble;
          uniform float u_time;
          varying vec2 v_uv;
          void main() {
            vec4 clip = u_mvp * vec4(a_pos, 1.0);
            if (u_wobble > 0.5) {
              vec2 ndc = clip.xy / max(clip.w, 0.0001);
              float depth = max(0.65, 1.25 / max(0.2, clip.w));
              vec2 drift = vec2(
                sin(u_time * 0.55 + a_pos.y * 7.0),
                cos(u_time * 0.47 + a_pos.x * 6.0)
              ) * (0.0038 * depth);
              vec2 grid = vec2(208.0, 156.0);
              ndc = floor(ndc * grid + 0.5) / grid;
              clip.xy = ndc * clip.w;
            }
            gl_Position = clip;
            v_uv = a_uv;
          }
        `;
        const fs = `
          precision mediump float;
          varying vec2 v_uv;
          uniform sampler2D u_tex;
          uniform vec4 u_color;
          uniform float u_use_tex;
          uniform float u_disc_mask;
          uniform float u_alpha;
          void main() {
            vec4 tex = texture2D(u_tex, v_uv);
            vec4 outc = mix(u_color, vec4(tex.rgb, tex.a * u_alpha), u_use_tex);
            if (u_disc_mask > 0.5) {
              float d = distance(v_uv, vec2(0.5));
              if (d > 0.33 || d < 0.055) discard;
            }
            if (outc.a <= 0.001) discard;
            gl_FragColor = outc;
          }
        `;
        state.program = glProgram(gl, vs, fs);
        state.loc = {
          aPos: gl.getAttribLocation(state.program, "a_pos"),
          aUv: gl.getAttribLocation(state.program, "a_uv"),
          uMvp: gl.getUniformLocation(state.program, "u_mvp"),
          uTex: gl.getUniformLocation(state.program, "u_tex"),
          uColor: gl.getUniformLocation(state.program, "u_color"),
          uUseTex: gl.getUniformLocation(state.program, "u_use_tex"),
          uDiscMask: gl.getUniformLocation(state.program, "u_disc_mask"),
          uAlpha: gl.getUniformLocation(state.program, "u_alpha"),
          uWobble: gl.getUniformLocation(state.program, "u_wobble"),
          uTime: gl.getUniformLocation(state.program, "u_time"),
        };
        state.bufPos = gl.createBuffer();
        state.bufUv = gl.createBuffer();
        state.bufIdx = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.bufIdx);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          new Uint16Array([0, 1, 2, 0, 2, 3]),
          gl.STATIC_DRAW,
        );
        state.whiteTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, state.whiteTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([255, 255, 255, 255]),
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        state.gl = gl;
        state.ready = true;
        return true;
      } catch (_) {
        state.ready = false;
        return false;
      }
    }

    function clearWebGL() {
      if (!state.ready || !state.gl) return;
      const gl = state.gl;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    function glTextureFor(canvasOrImg, key) {
      if (!state.ready || !state.gl) return null;
      const gl = state.gl;
      if (!canvasOrImg) return state.whiteTex;
      const k = key || String(Math.random());
      let rec = state.texCache.get(k);
      if (!rec) {
        const tex = gl.createTexture();
        rec = { tex };
        state.texCache.set(k, rec);
      }
      gl.bindTexture(gl.TEXTURE_2D, rec.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasOrImg);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return rec.tex;
    }

    function mappedFaceSources(c) {
      const byId = (id) => c.assets.find((a) => a.id === id);
      const mapped = (id) => {
        const a = byId(id);
        if (!a || a.type !== "2d" || !a.image) return null;
        const can = getMappedTemplateImage(a);
        const k = `${id}|${a.image.mappedKey || a.image.src || Date.now()}`;
        return { canvas: can, key: k };
      };
      return {
        front: mapped("cover_front") || mapped("label_front"),
        back: mapped("cover_back"),
        spine: mapped("spine"),
        disc: mapped("disc_art"),
      };
    }

    function drawDiscBackStyleCanvas(ctx, cx, cy, r, style) {
      if (style === "ps1-black") {
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.15, cx, cy, r);
        g.addColorStop(0, "rgba(88,88,92,0.95)");
        g.addColorStop(0.58, "rgba(28,30,34,0.96)");
        g.addColorStop(1, "rgba(10,12,16,0.98)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        return;
      }
      if (style === "ps2-blue") {
        const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
        g.addColorStop(0, "rgba(126,185,255,0.9)");
        g.addColorStop(0.55, "rgba(45,96,190,0.92)");
        g.addColorStop(1, "rgba(14,36,96,0.95)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        return;
      }
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, "rgba(216,222,230,0.96)");
      g.addColorStop(0.18, "rgba(126,170,255,0.46)");
      g.addColorStop(0.35, "rgba(255,132,206,0.46)");
      g.addColorStop(0.52, "rgba(117,255,209,0.42)");
      g.addColorStop(0.7, "rgba(255,238,156,0.42)");
      g.addColorStop(1, "rgba(176,182,194,0.96)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    function composedDiscSource(discEntry, style) {
      const safeStyle = style || "silver-rainbow";
      const art = discEntry?.canvas || null;
      const artKey = discEntry?.key || "none";
      const key = `${safeStyle}|${artKey}`;
      if (state.discCompositeCache.has(key)) {
        return { canvas: state.discCompositeCache.get(key), key };
      }
      const size = Math.max(512, art ? Math.max(art.width || 0, art.height || 0) : 1024);
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const x = c.getContext("2d");
      const cx = size * 0.5;
      const cy = size * 0.5;
      const r = size * 0.5;
      drawDiscBackStyleCanvas(x, cx, cy, r, safeStyle);
      if (art) x.drawImage(art, 0, 0, size, size);
      if (safeStyle !== "silver-rainbow") {
        x.globalAlpha = 0.16;
        drawDiscBackStyleCanvas(x, cx, cy, r, safeStyle);
        x.globalAlpha = 1;
      }
      state.discCompositeCache.set(key, c);
      return { canvas: c, key };
    }

    function drawQuadWebGL(gl, data, tex, color, alpha = 1, discMask = 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, state.bufPos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.pos), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(state.loc.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(state.loc.aPos);

      gl.bindBuffer(gl.ARRAY_BUFFER, state.bufUv);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uv), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(state.loc.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(state.loc.aUv);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.bufIdx);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex || state.whiteTex);
      gl.uniform1i(state.loc.uTex, 0);
      gl.uniform4f(state.loc.uColor, color[0], color[1], color[2], alpha);
      gl.uniform1f(state.loc.uUseTex, tex ? 1 : 0);
      gl.uniform1f(state.loc.uDiscMask, discMask);
      gl.uniform1f(state.loc.uAlpha, alpha);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function vsub(a, b) {
      return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }

    function vcross(a, b) {
      return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      };
    }

    function vnorm(a) {
      const m = Math.hypot(a.x, a.y, a.z) || 1;
      return { x: a.x / m, y: a.y / m, z: a.z / m };
    }

    function draw3DWebGL(c, template, w, h) {
      if (!initWebGL()) return false;
      const gl = state.gl;
      const gw = Math.max(1, Math.floor(w));
      const gh = Math.max(1, Math.floor(h));
      if (U.stageGlCanvas.width !== gw || U.stageGlCanvas.height !== gh) {
        U.stageGlCanvas.width = gw;
        U.stageGlCanvas.height = gh;
      }
      gl.viewport(0, 0, gw, gh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.useProgram(state.program);
      gl.uniform1f(state.loc.uWobble, S.view.renderMode === "wobble" ? 1 : 0);
      if (state.loc.uTime) gl.uniform1f(state.loc.uTime, performance.now() * 0.001);

      ensureModelTransform(c);
      const d = template.d;
      const pose = S.view.pose || "default";
      const isDisc = !!templateSpec(template).capabilities?.discAsset;
      const showDisc = isDisc && (pose === "disc-open" || pose === "disc-split");
      const n = 1 / Math.max(d.w, d.h, d.z || 1);
      const sx = d.w * n;
      const sy = d.h * n;
      const sz = Math.max(0.04, d.z * n);
      const verts = [
        [-sx, -sy, -sz],
        [sx, -sy, -sz],
        [sx, sy, -sz],
        [-sx, sy, -sz],
        [-sx, -sy, sz],
        [sx, -sy, sz],
        [sx, sy, sz],
        [-sx, sy, sz],
      ];
      const faceDefs = caseFaceDefs();
      const texSrc = mappedFaceSources(c);
      const discStyled = composedDiscSource(texSrc.disc, S.view.discBackStyle || "silver-rainbow");
      const texByFace = {
        front: texSrc.front ? glTextureFor(texSrc.front.canvas, texSrc.front.key) : null,
        back: texSrc.back ? glTextureFor(texSrc.back.canvas, texSrc.back.key) : null,
        spine: texSrc.spine ? glTextureFor(texSrc.spine.canvas, texSrc.spine.key) : null,
        disc: discStyled ? glTextureFor(discStyled.canvas, discStyled.key) : null,
      };
      const tint = hexToRgb01(S.view.faceTint);
      const alpha = S.view.faceViz === "transparent" ? 0.34 : 1;
      const backTint = [0.96, 0.96, 0.98];

      const aspect = gw / Math.max(1, gh);
      const proj = mat4Perspective(Math.PI / 3.2, aspect, 0.05, 40);
      const camDist = 2.65;
      let model = mat4Identity();
      const poseModel = { ...c.modelTr };
      applyPosePresetToModel(poseModel, pose);
      const baseScale = 0.9 * S.view.zoom * poseModel.s;
      model = mat4Multiply(
        model,
        mat4Scale(baseScale * (poseModel.mx ? -1 : 1), baseScale, baseScale),
      );
      model = mat4Multiply(model, mat4RotateY(WEBGL_BASE_MODEL_YAW));
      model = mat4Multiply(model, mat4RotateX((poseModel.rx * Math.PI) / 180));
      model = mat4Multiply(model, mat4RotateY((poseModel.ry * Math.PI) / 180));
      model = mat4Multiply(model, mat4RotateZ((poseModel.rz * Math.PI) / 180));
      model = mat4Multiply(
        model,
        mat4Translate(poseModel.tx * 0.7, -poseModel.ty * 0.7, poseModel.tz * 0.7),
      );
      model = mat4Multiply(model, mat4RotateY(S.view.yaw));
      model = mat4Multiply(model, mat4RotateX(S.view.pitch));
      const view = mat4Translate(0, 0, -camDist);
      const mv = mat4Multiply(view, model);
      const mvp = mat4Multiply(proj, mv);
      gl.uniformMatrix4fv(state.loc.uMvp, false, new Float32Array(mvp));
      const vertsObj = verts.map((v) => ({ x: v[0], y: v[1], z: v[2] }));
      const camVerts = vertsObj.map((p) => mat4TransformPoint(mv, p, 1));
      const pts = vertsObj.map((p) => {
        const clip = mat4TransformPoint(mvp, p, 1);
        const iw = 1 / Math.max(1e-6, clip.w);
        const ndcX = clip.x * iw;
        const ndcY = clip.y * iw;
        return {
          x: (ndcX * 0.5 + 0.5) * gw,
          y: (1 - (ndcY * 0.5 + 0.5)) * gh,
          z: clip.z * iw,
        };
      });
      const overlayFaces = [];
      const visibleVerts = new Set();

      faceDefs.forEach((f) => {
        const pos = [];
        f.uvCorners.forEach((vi) => {
          const p = verts[vi];
          pos.push(p[0], p[1], p[2]);
        });
        const uv = WEBGL_FACE_UV_ARRAY[f.id] || [0, 0, 1, 0, 1, 1, 0, 1];
        const texture = texByFace[f.id] || null;
        const color = texture ? [1, 1, 1] : f.id === "back" ? backTint : tint;
        drawQuadWebGL(gl, { pos, uv }, texture, color, alpha, 0);

        const quadPoly = f.poly.map((i) => pts[i]);
        const quadUv = f.uvCorners.map((i) => pts[i]);
        const area = quadSignedArea(quadPoly);
        const visible = area < 0;
        if (visible) f.poly.forEach((i) => visibleVerts.add(i));
        const p0 = camVerts[f.poly[0]];
        const p1 = camVerts[f.poly[1]];
        const p3 = camVerts[f.poly[3]];
        const nrm = vnorm(vcross(vsub(p1, p0), vsub(p3, p0)));
        const rawHandedFlipX =
          S.debug.mapping ? quadSignedArea(f.uvCorners.map((i) => pts[i])) < 0 : false;
        overlayFaces.push({
          id: f.id,
          quadPoly,
          quadUv,
          uvApplied: (WEBGL_FACE_UV_COORDS[f.id] || []).map((p) => ({ u: p.u, v: p.v })),
          handedFlipX: false,
          rawHandedFlipX,
          area,
          visible,
          normal: nrm,
          poly: [...f.poly],
          uvCorners: [...f.uvCorners],
        });
      });

      if (showDisc && texByFace.disc) {
        const discDia = discDiameterMmForTemplate(template);
        const discR = Math.max(0.08, discDia * n * 0.94);
        const splitX = -(sx + discR * 0.68);
        const discOffset = pose === "disc-split" ? [splitX, 0, 0.03] : [0, 0, 0.02];
        const disc = [
          [-discR + discOffset[0], -discR + discOffset[1], sz + discOffset[2]],
          [discR + discOffset[0], -discR + discOffset[1], sz + discOffset[2]],
          [discR + discOffset[0], discR + discOffset[1], sz + discOffset[2]],
          [-discR + discOffset[0], discR + discOffset[1], sz + discOffset[2]],
        ];
        const pos = disc.flatMap((p) => [p[0], p[1], p[2]]);
        drawQuadWebGL(
          gl,
          { pos, uv: [0, 0, 1, 0, 1, 1, 0, 1] },
          texByFace.disc,
          [1, 1, 1],
          0.96,
          1,
        );
      }

      let debugText = "";
      if (S.debug.mapping) {
        const lines = [];
        lines.push(`pose=${pose} render=${S.view.renderMode} faceViz=${S.view.faceViz}`);
        lines.push(
          `camera yaw=${S.view.yaw.toFixed(3)} pitch=${S.view.pitch.toFixed(3)} zoom=${S.view.zoom.toFixed(3)}`,
        );
        lines.push(
          `model tx=${poseModel.tx.toFixed(2)} ty=${poseModel.ty.toFixed(2)} tz=${poseModel.tz.toFixed(2)} rx=${poseModel.rx.toFixed(2)} ry=${poseModel.ry.toFixed(2)} rz=${poseModel.rz.toFixed(2)} s=${poseModel.s.toFixed(2)} mx=${poseModel.mx ? 1 : 0}`,
        );
        lines.push(`visibleVerts=[${[...visibleVerts].sort((a, b) => a - b).join(", ")}]`);
        overlayFaces.forEach((f) => {
          const c = {
            x: (f.quadPoly[0].x + f.quadPoly[1].x + f.quadPoly[2].x + f.quadPoly[3].x) * 0.25,
            y: (f.quadPoly[0].y + f.quadPoly[1].y + f.quadPoly[2].y + f.quadPoly[3].y) * 0.25,
          };
          const ux = f.quadUv[1].x - f.quadUv[0].x;
          const uy = f.quadUv[1].y - f.quadUv[0].y;
          const vx = f.quadUv[3].x - f.quadUv[0].x;
          const vy = f.quadUv[3].y - f.quadUv[0].y;
          const uvA = f.uvApplied || [];
          const uvText = uvA
            .map((p, i) => `${["TL", "TR", "BR", "BL"][i]}(${p.u.toFixed(2)},${p.v.toFixed(2)})`)
            .join(" ");
          lines.push(
            `${f.id.padEnd(6)} vis=${f.visible ? "1" : "0"} area=${f.area.toFixed(1).padStart(8)} center=(${c.x.toFixed(1)},${c.y.toFixed(1)}) U=(${ux.toFixed(1)},${uy.toFixed(1)}) V=(${vx.toFixed(1)},${vy.toFixed(1)}) poly=[${f.poly.join(",")}] uvCorners=[${f.uvCorners.join(",")}] handFlipX=${f.handedFlipX ? 1 : 0} rawHand=${f.rawHandedFlipX ? 1 : 0} uvApplied=${uvText} n=(${f.normal.x.toFixed(2)},${f.normal.y.toFixed(2)},${f.normal.z.toFixed(2)})`,
          );
        });
        lines.push(
          "expected assets: front<-cover_front/label_front, back<-cover_back, spine<-spine, disc<-disc_art",
        );
        debugText = lines.join("\n");
      }
      return { overlay: { pts, faces: overlayFaces, visibleVerts }, debugText };
    }

    function draw3DWebGLOverlays(overlay) {
      if (
        !S.view.wireframe &&
        !S.view.vertices &&
        !S.view.normals &&
        !S.view.uvAxisDebug &&
        !S.view.templateLabels
      ) {
        return;
      }
      if (!overlay) return;
      const pts = overlay.pts || [];
      const faces = overlay.faces || [];
      const visibleVerts = overlay.visibleVerts || new Set();
      faces.forEach((f) => {
        if (S.view.wireframe && f.visible) {
          X.save();
          X.strokeStyle =
            getComputedStyle(document.documentElement).getPropertyValue("--ds-border").trim() ||
            "rgba(210,220,240,0.7)";
          X.lineWidth = 1.2;
          X.beginPath();
          X.moveTo(f.quadPoly[0].x, f.quadPoly[0].y);
          X.lineTo(f.quadPoly[1].x, f.quadPoly[1].y);
          X.lineTo(f.quadPoly[2].x, f.quadPoly[2].y);
          X.lineTo(f.quadPoly[3].x, f.quadPoly[3].y);
          X.closePath();
          X.stroke();
          X.restore();
        }
        if (S.view.templateLabels && f.visible) {
          const qx =
            (f.quadPoly[0].x + f.quadPoly[1].x + f.quadPoly[2].x + f.quadPoly[3].x) / 4;
          const qy =
            (f.quadPoly[0].y + f.quadPoly[1].y + f.quadPoly[2].y + f.quadPoly[3].y) / 4;
          X.save();
          X.font = canvasFont(CANVAS_FS_MICRO + 1, "700");
          X.textAlign = "center";
          X.textBaseline = "middle";
          const label = f.id.toUpperCase();
          const pad = 5;
          const tw = X.measureText(label).width + pad * 2;
          X.fillStyle = "rgba(8, 12, 18, 0.78)";
          X.strokeStyle = "rgba(228, 240, 255, 0.72)";
          X.lineWidth = 1;
          X.beginPath();
          X.roundRect(qx - tw / 2, qy - 9, tw, 18, 7);
          X.fill();
          X.stroke();
          X.fillStyle = "#f4fbff";
          X.fillText(label, qx, qy + 0.5);
          X.restore();
        }
      });
      if (S.view.vertices) {
        X.save();
        X.fillStyle =
          getComputedStyle(document.documentElement).getPropertyValue("--ds-accent").trim() ||
          "#7bd0ff";
        pts.forEach((p, i) => {
          if (S.view.faceViz === "opaque" && !visibleVerts.has(i)) return;
          X.beginPath();
          X.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
          X.fill();
          X.font = canvasFont(CANVAS_FS_MICRO);
          X.fillText(String(i), p.x + 4, p.y - 3);
        });
        X.restore();
      }
    }

    return {
      clearWebGL,
      draw3DWebGL,
      draw3DWebGLOverlays,
    };
  }

  window.KataCartRender3DWebGL = { createRender3DWebGL };
})();
