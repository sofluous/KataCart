(function () {
  function createRender3D(deps) {
    const {
      S,
      U,
      X,
      getMappedTemplateImage,
      canvasFont,
      CANVAS_FS_MICRO,
      CANVAS_FS_1,
      templateSpec,
      discDiameterMmForTemplate,
      applyPosePresetToModel,
      drawInnerEdgeLabels,
      rgbaFromHex,
      ensureModelTransform,
      caseFaceDefs,
    } = deps;

    function rot(p) {
      const cy = Math.cos(S.view.yaw);
      const sy = Math.sin(S.view.yaw);
      const cp = Math.cos(S.view.pitch);
      const sp = Math.sin(S.view.pitch);
      const x = p.x * cy - p.z * sy;
      const z = p.x * sy + p.z * cy;
      return { x, y: p.y * cp - z * sp, z: p.y * sp + z * cp };
    }

    function proj(p, k, cx, cy) {
      const f = k / (p.z + 4.2);
      return { x: cx + p.x * f, y: cy - p.y * f, z: p.z };
    }

    function stylizeProjectedPoint(pt, z, idx) {
      if (S.view.renderMode !== "wobble") return pt;
      const wobble = 2.3 + Math.max(0, z + 0.8) * 1.2;
      const t = performance.now() * 0.00105 + idx * 1.13;
      const jx = Math.sin(t) * wobble;
      const jy = Math.cos(t * 0.93) * wobble;
      return {
        x: Math.round((pt.x + jx) / 3) * 3,
        y: Math.round((pt.y + jy) / 3) * 3,
        z: pt.z,
      };
    }

    function model(p, m) {
      const s = m.s || 1;
      let x = p.x * s * (m.mx ? -1 : 1);
      let y = p.y * s;
      let z = p.z * s;
      const rx = (m.rx * Math.PI) / 180;
      const ry = (m.ry * Math.PI) / 180;
      const rz = (m.rz * Math.PI) / 180;
      const cx = Math.cos(rx);
      const sx = Math.sin(rx);
      const cy = Math.cos(ry);
      const sy = Math.sin(ry);
      const cz = Math.cos(rz);
      const sz = Math.sin(rz);
      const y1 = y * cx - z * sx;
      const z1 = y * sx + z * cx;
      y = y1;
      z = z1;
      const x2 = x * cy + z * sy;
      const z2 = -x * sy + z * cy;
      x = x2;
      z = z2;
      const x3 = x * cz - y * sz;
      const y3 = x * sz + y * cz;
      x = x3;
      y = y3;
      return { x: x + m.tx, y: y + m.ty, z: z + m.tz };
    }

    function face(poly, pts, color, a, ctx = X, stroke = true) {
      ctx.beginPath();
      ctx.moveTo(pts[poly[0]].x, pts[poly[0]].y);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(pts[poly[i]].x, pts[poly[i]].y);
      ctx.closePath();
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (S.view.wireframe && stroke) {
        ctx.strokeStyle =
          getComputedStyle(document.documentElement).getPropertyValue("--ds-border").trim() ||
          "#777";
        ctx.stroke();
      }
    }

    function drawVertices(pts, ctx = X, visibleIdx = null) {
      if (!S.view.vertices) return;
      ctx.save();
      ctx.fillStyle =
        getComputedStyle(document.documentElement).getPropertyValue("--ds-accent").trim() ||
        "#7bd0ff";
      pts.forEach((p, i) => {
        if (visibleIdx && !visibleIdx.has(i)) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = canvasFont(CANVAS_FS_MICRO);
        ctx.fillText(String(i), p.x + 4, p.y - 3);
      });
      ctx.restore();
    }

    function drawUvAxisDebug(quad, faceId = "", ctx = X) {
      if (!S.view.uvAxisDebug || !quad || quad.length !== 4) return;
      function qp(u, v) {
        const p0 = quad[0];
        const p1 = quad[1];
        const p2 = quad[2];
        const p3 = quad[3];
        return {
          x:
            p0.x * (1 - u) * (1 - v) +
            p1.x * u * (1 - v) +
            p2.x * u * v +
            p3.x * (1 - u) * v,
          y:
            p0.y * (1 - u) * (1 - v) +
            p1.y * u * (1 - v) +
            p2.y * u * v +
            p3.y * (1 - u) * v,
        };
      }
      function arrow(a, b, color) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - Math.cos(ang - 0.5) * 6, b.y - Math.sin(ang - 0.5) * 6);
        ctx.lineTo(b.x - Math.cos(ang + 0.5) * 6, b.y - Math.sin(ang + 0.5) * 6);
        ctx.closePath();
        ctx.fill();
      }
      const c = qp(0.5, 0.5);
      const u = qp(0.78, 0.5);
      const v = qp(0.5, 0.78);
      ctx.save();
      arrow(c, u, "#ff6d6d");
      arrow(c, v, "#66d4ff");
      ctx.fillStyle = "#ffffff";
      ctx.font = canvasFont(CANVAS_FS_MICRO, "700");
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("U+", u.x + 4, u.y);
      ctx.fillText("V+", v.x + 4, v.y);
      if (faceId) {
        const t = qp(0.1, 0.1);
        ctx.fillText(`${faceId}`, t.x + 2, t.y + 2);
      }
      ctx.restore();
    }

    function assetImageById(cart, id) {
      if (!cart) return null;
      const a = cart.assets.find((x) => x.id === id && x.image && x.image.img);
      return a ? getMappedTemplateImage(a) : null;
    }

    function applyImageToTriangle(img, s0, s1, s2, d0, d1, d2, ctx = X) {
      const den = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
      if (!den) return;
      const a =
        (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / den;
      const b =
        (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / den;
      const c =
        (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / den;
      const d =
        (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / den;
      const e =
        (d0.x * (s1.x * s2.y - s2.x * s1.y) +
          d1.x * (s2.x * s0.y - s0.x * s2.y) +
          d2.x * (s0.x * s1.y - s1.x * s0.y)) /
        den;
      const f =
        (d0.y * (s1.x * s2.y - s2.x * s1.y) +
          d1.y * (s2.x * s0.y - s0.x * s2.y) +
          d2.y * (s0.x * s1.y - s1.x * s0.y)) /
        den;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(d0.x, d0.y);
      ctx.lineTo(d1.x, d1.y);
      ctx.lineTo(d2.x, d2.y);
      ctx.closePath();
      ctx.clip();
      ctx.transform(a, b, c, d, e, f);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }

    function applyImageToQuad(img, quad, opts = {}, ctx = X) {
      const { flipX = false, flipY = false, rotate180 = false, rotate90 = false, rotate270 = false } = opts;
      function quadSignedArea(q) {
        let s = 0;
        for (let i = 0; i < q.length; i += 1) {
          const a = q[i];
          const b = q[(i + 1) % q.length];
          s += a.x * b.y - a.y * b.x;
        }
        return s * 0.5;
      }
      const handedFlipX = quadSignedArea(quad) < 0 ? !flipX : flipX;
      const sw = img.width;
      const sh = img.height;
      const source = [
        { x: 0, y: 0 },
        { x: sw, y: 0 },
        { x: sw, y: sh },
        { x: 0, y: sh },
      ].map((p) => ({
        x: handedFlipX ? sw - p.x : p.x,
        y: flipY ? sh - p.y : p.y,
      }));
      const q = rotate180 ? [source[2], source[3], source[0], source[1]] : source;
      let qq = q;
      if (rotate90) qq = [q[3], q[0], q[1], q[2]];
      if (rotate270) qq = [q[1], q[2], q[3], q[0]];
      applyImageToTriangle(img, qq[0], qq[1], qq[2], quad[0], quad[1], quad[2], ctx);
      applyImageToTriangle(img, qq[0], qq[2], qq[3], quad[0], quad[2], quad[3], ctx);
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

    function vdot(a, b) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    function drawFaceAssist(faceName, quad, n, camForward) {
      if (!S.view.normals) return;
      if (vdot(n, camForward) >= -0.02) return;
      const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
      const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
      const dx = n.x * 22;
      const dy = -n.y * 22;
      const ex = cx + dx;
      const ey = cy + dy;
      X.save();
      X.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue("--ds-accent").trim() ||
        "#7bd0ff";
      X.fillStyle = X.strokeStyle;
      X.lineWidth = 2;
      X.beginPath();
      X.moveTo(cx, cy);
      X.lineTo(ex, ey);
      X.stroke();
      const ang = Math.atan2(ey - cy, ex - cx);
      X.beginPath();
      X.moveTo(ex, ey);
      X.lineTo(ex - Math.cos(ang - 0.45) * 8, ey - Math.sin(ang - 0.45) * 8);
      X.lineTo(ex - Math.cos(ang + 0.45) * 8, ey - Math.sin(ang + 0.45) * 8);
      X.closePath();
      X.fill();
      X.fillStyle = "#eaf6ff";
      X.font = canvasFont(CANVAS_FS_MICRO);
      X.textAlign = "left";
      X.textBaseline = "middle";
      X.fillText(faceName, ex + 6, ey);
      X.restore();
    }

    function resolveFaceTexOpts(faceId) {
      const map = {
        front: {},
        back: {},
        spine: { flipX: true },
        right: { flipY: true, rotate90: true, flipX: true },
        top: { flipX: true },
        bottom: { flipY: true },
      };
      return map[faceId] || { flipY: true };
    }

    function textureQuadForFace(faceId, pts) {
      const map = {
        front: [2, 3, 0, 1],
        back: [7, 6, 5, 4],
        spine: [2, 6, 5, 1],
        right: [3, 7, 4, 0],
        top: [3, 2, 6, 7],
        bottom: [0, 4, 5, 1],
      };
      const idx = map[faceId];
      if (!idx) return null;
      return [pts[idx[0]], pts[idx[1]], pts[idx[2]], pts[idx[3]]];
    }

    function getFaceAssetBindings(cart) {
      return {
        front: assetImageById(cart, "cover_front") || assetImageById(cart, "label_front"),
        back: assetImageById(cart, "cover_back"),
        spine: assetImageById(cart, "spine"),
        disc: assetImageById(cart, "disc_art"),
      };
    }

    function orientedImageForFace(img, opts = {}) {
      if (!img) return null;
      const { flipX = false, flipY = false, rotate180 = false, rotate90 = false, rotate270 = false } = opts;
      const out = document.createElement("canvas");
      const sw = img.width;
      const sh = img.height;
      const quarter = rotate90 || rotate270;
      out.width = quarter ? sh : sw;
      out.height = quarter ? sw : sh;
      const x = out.getContext("2d");
      x.save();
      x.translate(out.width / 2, out.height / 2);
      if (rotate90) x.rotate(Math.PI / 2);
      if (rotate270) x.rotate(-Math.PI / 2);
      if (rotate180) x.rotate(Math.PI);
      x.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      x.drawImage(img, -sw / 2, -sh / 2, sw, sh);
      x.restore();
      return out;
    }

    function drawDiscTexture(img, quad, ctx = X) {
      function drawDiscBackStyle(cx, cy, r) {
        const style = S.view.discBackStyle || "silver-rainbow";
        ctx.save();
        if (style === "ps1-black") {
          const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.15, cx, cy, r);
          g.addColorStop(0, "rgba(88,88,92,0.95)");
          g.addColorStop(0.58, "rgba(28,30,34,0.96)");
          g.addColorStop(1, "rgba(10,12,16,0.98)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        } else if (style === "ps2-blue") {
          const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
          g.addColorStop(0, "rgba(126,185,255,0.9)");
          g.addColorStop(0.55, "rgba(45,96,190,0.92)");
          g.addColorStop(1, "rgba(14,36,96,0.95)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        } else {
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
        ctx.restore();
      }

      function qp(u, v) {
        const p0 = quad[0];
        const p1 = quad[1];
        const p2 = quad[2];
        const p3 = quad[3];
        return {
          x:
            p0.x * (1 - u) * (1 - v) +
            p1.x * u * (1 - v) +
            p2.x * u * v +
            p3.x * (1 - u) * v,
          y:
            p0.y * (1 - u) * (1 - v) +
            p1.y * u * (1 - v) +
            p2.y * u * v +
            p3.y * (1 - u) * v,
        };
      }

      const r = 0.33;
      const dq = [
        qp(0.5 - r, 0.5 - r),
        qp(0.5 + r, 0.5 - r),
        qp(0.5 + r, 0.5 + r),
        qp(0.5 - r, 0.5 + r),
      ];
      const cx = (dq[0].x + dq[1].x + dq[2].x + dq[3].x) / 4;
      const cy = (dq[0].y + dq[1].y + dq[2].y + dq[3].y) / 4;
      const discR = Math.max(8, Math.hypot(dq[1].x - dq[0].x, dq[1].y - dq[0].y) * 0.5);
      const hubRadius = r * 0.16;

      function traceProjectedDisc(radius, segments = 64) {
        const segs = Math.max(24, segments | 0);
        for (let i = 0; i <= segs; i += 1) {
          const a = (i / segs) * Math.PI * 2;
          const p = qp(0.5 + Math.cos(a) * radius, 0.5 + Math.sin(a) * radius);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
      }

      ctx.save();
      ctx.beginPath();
      traceProjectedDisc(r, 72);
      ctx.clip();
      drawDiscBackStyle(cx, cy, discR);
      applyImageToQuad(img, dq, {}, ctx);
      if ((S.view.discBackStyle || "silver-rainbow") !== "silver-rainbow") {
        ctx.globalAlpha = 0.16;
        drawDiscBackStyle(cx, cy, discR);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      traceProjectedDisc(hubRadius, 56);
      ctx.fillStyle = "rgba(10,14,20,0.78)";
      ctx.fill();
      ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue("--ds-accent").trim() ||
        "#7bd0ff";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.restore();
    }

    function quadCenter(quad) {
      if (!quad || quad.length !== 4) return { x: 0, y: 0 };
      return {
        x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) * 0.25,
        y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) * 0.25,
      };
    }

    function quadProjectedHeight(quad) {
      if (!quad || quad.length !== 4) return 0;
      const l = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
      const r = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);
      return (l + r) * 0.5;
    }

    function quadProjectedWidth(quad) {
      if (!quad || quad.length !== 4) return 0;
      const t = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
      const b = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y);
      return (t + b) * 0.5;
    }

    function discRadiusPxForQuad(template, quad, minPx = 12, fill = 0.94) {
      if (!template || !quad || quad.length !== 4) return minPx;
      const pxH = quadProjectedHeight(quad);
      const pxW = quadProjectedWidth(quad);
      const pxPerMmH = pxH / Math.max(1, template.d.h);
      const pxPerMmW = pxW / Math.max(1, template.d.w);
      const pxPerMm = Math.max(0.0001, Math.min(pxPerMmH, pxPerMmW));
      const r = discDiameterMmForTemplate(template) * 0.5 * pxPerMm * fill;
      return Math.max(minPx, r);
    }

    function drawQuadPath(ctx, quad) {
      if (!ctx || !quad || quad.length !== 4) return;
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      ctx.lineTo(quad[1].x, quad[1].y);
      ctx.lineTo(quad[2].x, quad[2].y);
      ctx.lineTo(quad[3].x, quad[3].y);
      ctx.closePath();
    }

    function drawQuadFill(quad, color, alpha = 1, ctx = X) {
      if (!quad || quad.length !== 4) return;
      ctx.save();
      drawQuadPath(ctx, quad);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    function computeOpenCaseFlap(frontQuad, backQuad, stageW, stageH, open = 1) {
      if (!frontQuad || frontQuad.length !== 4) return null;
      const h0 = frontQuad[0];
      const h1 = frontQuad[3];
      const p0 = frontQuad[1];
      const p1 = frontQuad[2];
      const a = -1.15 * Math.max(0.7, Math.min(1.35, open));
      const rot2 = (p, h) => {
        const dx = p.x - h.x;
        const dy = p.y - h.y;
        return {
          x: h.x + dx * Math.cos(a) - dy * Math.sin(a),
          y: h.y + dx * Math.sin(a) + dy * Math.cos(a),
        };
      };
      let q1 = rot2(p0, h0);
      let q2 = rot2(p1, h1);
      const frontCenter = {
        x: (frontQuad[0].x + frontQuad[1].x + frontQuad[2].x + frontQuad[3].x) / 4,
        y: (frontQuad[0].y + frontQuad[1].y + frontQuad[2].y + frontQuad[3].y) / 4,
      };
      const backCenter =
        backQuad && backQuad.length === 4
          ? {
              x: (backQuad[0].x + backQuad[1].x + backQuad[2].x + backQuad[3].x) / 4,
              y: (backQuad[0].y + backQuad[1].y + backQuad[2].y + backQuad[3].y) / 4,
            }
          : frontCenter;
      let vx = frontCenter.x - backCenter.x;
      let vy = frontCenter.y - backCenter.y;
      const vlen = Math.hypot(vx, vy) || 1;
      vx /= vlen;
      vy /= vlen;
      const push = Math.max(6, Math.min(Math.min(stageW, stageH) * 0.03, 24));
      q1 = { x: q1.x + vx * push, y: q1.y + vy * push };
      q2 = { x: q2.x + vx * push, y: q2.y + vy * push };
      return {
        hinge: [h0, h1],
        flap: [h0, q1, q2, h1],
        rimTop: [frontQuad[0], frontQuad[1], q1, h0],
        rimBottom: [h1, q2, frontQuad[2], frontQuad[3]],
      };
    }

    function draw3D(cart, template, w, h, ca) {
      ensureModelTransform(cart);
      const d = template.d;
      const pose = S.view.pose || "default";
      const isDisc = !!templateSpec(template).capabilities?.discAsset;
      const discVisibleInPose = pose === "disc-open" || pose === "disc-split";
      const n = 1 / Math.max(d.w, d.h, d.z || 1);
      const sx = d.w * n;
      const sy = d.h * n;
      const sz = Math.max(0.04, d.z * n);
      const poseModel = { ...cart.modelTr };
      applyPosePresetToModel(poseModel, pose);
      const splitX = pose === "disc-split" && isDisc ? -w * 0.12 : 0;
      const k = Math.min(w, h) * 0.36 * S.view.zoom;
      const cx = w * 0.5 + splitX;
      const cy = h * 0.56;
      const verts = [
        { x: -sx, y: -sy, z: -sz },
        { x: sx, y: -sy, z: -sz },
        { x: sx, y: sy, z: -sz },
        { x: -sx, y: sy, z: -sz },
        { x: -sx, y: -sy, z: sz },
        { x: sx, y: -sy, z: sz },
        { x: sx, y: sy, z: sz },
        { x: -sx, y: sy, z: sz },
      ]
        .map((p) => model(p, poseModel))
        .map(rot);
      const pts = verts.map((v, i) => stylizeProjectedPoint(proj(v, k, cx, cy), v.z, i));
      const bind = getFaceAssetBindings(cart);
      const faces = caseFaceDefs(bind);
      const camForward = vnorm({ x: 0, y: 0, z: 1 });
      let frontQuad = null;
      let backQuad = null;
      let openingQuad = null;
      const visibleVerts = new Set();
      faces
        .map((f) => ({
          ...f,
          z: f.poly.reduce((acc, idx) => acc + verts[idx].z, 0) / f.poly.length,
        }))
        .sort((a, b) => a.z - b.z)
        .forEach((f) => {
          const p0 = verts[f.poly[0]];
          const p1 = verts[f.poly[1]];
          const p3 = verts[f.poly[3]];
          const nrm = vnorm(vcross(vsub(p1, p0), vsub(p3, p0)));
          const facing = vdot(nrm, camForward);
          const baseAlpha = S.view.faceViz === "transparent" ? 0.14 : 1;
          const backAlpha = S.view.faceViz === "transparent" ? 0.1 : 1;
          const quad = textureQuadForFace(f.id, pts) || f.poly.map((idx) => pts[idx]);
          if (f.id === "front") frontQuad = quad;
          if (f.id === "back") backQuad = quad;
          if (f.id === "right") openingQuad = quad;
          if (S.view.faceViz === "opaque" && facing >= -0.005) return;
          const tint = rgbaFromHex(S.view.faceTint, baseAlpha, { r: 140, g: 148, b: 160 });
          const fillColor = facing < -0.005 ? tint : `rgba(255, 255, 255, ${backAlpha})`;
          const strokeVisible = !(S.view.faceViz === "opaque" && facing >= -0.005);
          face(f.poly, pts, fillColor, 1, X, strokeVisible);
          if (facing < -0.005) f.poly.forEach((idx) => visibleVerts.add(idx));
          drawFaceAssist(f.id.toUpperCase(), quad, nrm, camForward);
          if (facing < -0.005) drawUvAxisDebug(quad, f.id.toUpperCase());
          if (!f.tex || facing >= -0.005) return;
          if (pose === "disc-open" && isDisc && f.id === "front") return;
          applyImageToQuad(f.tex, quad, resolveFaceTexOpts(f.id));
          if (f.id === "front" && bind.disc && discVisibleInPose && pose !== "disc-split") {
            drawDiscTexture(bind.disc, quad);
          }
        });
      if (pose === "disc-open" && isDisc && frontQuad) {
        const open = computeOpenCaseFlap(frontQuad, backQuad, w, h, 1);
        if (open) {
          drawQuadFill(open.rimTop, "rgba(188, 194, 206, 0.2)", 1, X);
          drawQuadFill(open.rimBottom, "rgba(176, 184, 198, 0.18)", 1, X);
          drawQuadFill(open.flap, "rgba(156, 164, 178, 0.2)", 1, X);
          if (bind.front) applyImageToQuad(bind.front, open.flap, resolveFaceTexOpts("front"));
          X.save();
          X.strokeStyle = "rgba(255,255,255,0.5)";
          X.beginPath();
          X.moveTo(open.hinge[0].x, open.hinge[0].y);
          X.lineTo(open.hinge[1].x, open.hinge[1].y);
          X.stroke();
          X.restore();
        }
        if (bind.disc && backQuad) drawDiscTexture(bind.disc, backQuad);
      }
      if (pose === "disc-split" && isDisc && bind.disc) {
        const refQuad = frontQuad || backQuad || openingQuad;
        const caseCenter = quadCenter(refQuad);
        const openCenter = quadCenter(openingQuad || refQuad);
        let dx = openCenter.x - caseCenter.x;
        let dy = openCenter.y - caseCenter.y;
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        const projH = quadProjectedHeight(refQuad);
        const discR = discRadiusPxForQuad(template, refQuad, 12, 0.94);
        const lift = Math.max(discR * 0.6, projH * 0.08);
        const cxSplit = openCenter.x + dx * lift;
        const cySplit = openCenter.y + dy * lift;
        const q = [
          { x: cxSplit - discR, y: cySplit - discR },
          { x: cxSplit + discR, y: cySplit - discR },
          { x: cxSplit + discR, y: cySplit + discR },
          { x: cxSplit - discR, y: cySplit + discR },
        ];
        drawDiscTexture(bind.disc, q);
      }
      drawVertices(pts, X, S.view.faceViz === "opaque" ? visibleVerts : null);
    }

    function drawMiniModel(cart, template) {
      const ctx = U.miniCanvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rw = U.miniCanvas.clientWidth || 160;
      const rh = U.miniCanvas.clientHeight || 160;
      const w = Math.max(1, Math.floor(rw * dpr));
      const h = Math.max(1, Math.floor(rh * dpr));
      if (U.miniCanvas.width !== w || U.miniCanvas.height !== h) {
        U.miniCanvas.width = w;
        U.miniCanvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      const d = template.d;
      const n = 1 / Math.max(d.w, d.h, d.z || 1);
      const sx = d.w * n;
      const sy = d.h * n;
      const sz = Math.max(0.04, d.z * n);
      const k = Math.min(w, h) * 0.42 * (S.gizmo.size / 100);
      const cx = w * 0.5;
      const cy = h * 0.56;
      const camYaw = S.view.yaw;
      const camPitch = S.view.pitch;
      const m = { ...cart.modelTr };
      const pose = S.view.pose || "default";
      applyPosePresetToModel(m, pose);
      function rcam(p) {
        const cy = Math.cos(camYaw);
        const sy = Math.sin(camYaw);
        const cp = Math.cos(camPitch);
        const sp = Math.sin(camPitch);
        const x = p.x * cy - p.z * sy;
        const z = p.x * sy + p.z * cy;
        return { x, y: p.y * cp - z * sp, z: p.y * sp + z * cp };
      }
      const verts = [
        { x: -sx, y: -sy, z: -sz },
        { x: sx, y: -sy, z: -sz },
        { x: sx, y: sy, z: -sz },
        { x: -sx, y: sy, z: -sz },
        { x: -sx, y: -sy, z: sz },
        { x: sx, y: -sy, z: sz },
        { x: sx, y: sy, z: sz },
        { x: -sx, y: sy, z: sz },
      ]
        .map((p) => model(p, m))
        .map(rcam);
      const pts = verts.map((v) => {
        const f = k / (v.z + 4.2);
        return { x: cx + v.x * f, y: cy - v.y * f, z: v.z };
      });
      const bind = getFaceAssetBindings(cart);
      const isDisc = !!templateSpec(template).capabilities?.discAsset;
      const discVisibleInPose = pose === "disc-open" || pose === "disc-split";
      const visibleVerts = new Set();
      const faces = caseFaceDefs(bind);
      const camForward = vnorm({ x: 0, y: 0, z: 1 });
      faces
        .map((f) => ({
          ...f,
          z: f.poly.reduce((acc, idx) => acc + verts[idx].z, 0) / f.poly.length,
        }))
        .sort((a, b) => a.z - b.z)
        .forEach((f) => {
          const p0 = verts[f.poly[0]];
          const p1 = verts[f.poly[1]];
          const p3 = verts[f.poly[3]];
          const nrm = vnorm(vcross(vsub(p1, p0), vsub(p3, p0)));
          const facing = vdot(nrm, camForward);
          const tint = rgbaFromHex(S.view.faceTint, 0.24, { r: 140, g: 148, b: 160 });
          const fillColor = facing < -0.005 ? tint : "rgba(255,255,255,0.1)";
          const strokeVisible = !(S.view.faceViz === "opaque" && facing >= -0.005);
          face(f.poly, pts, fillColor, 1, ctx, strokeVisible);
          if (facing < -0.005) f.poly.forEach((idx) => visibleVerts.add(idx));
          if (!f.tex || facing >= -0.005) return;
          if (pose === "disc-open" && isDisc && f.id === "front") return;
          const quad = textureQuadForFace(f.id, pts) || f.poly.map((idx) => pts[idx]);
          applyImageToQuad(f.tex, quad, resolveFaceTexOpts(f.id), ctx);
          if (f.id === "front" && bind.disc && discVisibleInPose && pose !== "disc-split") {
            drawDiscTexture(bind.disc, quad, ctx);
          }
        });
      if (pose === "disc-open" && isDisc) {
        const front = textureQuadForFace("front", pts) || [pts[0], pts[3], pts[2], pts[1]];
        const back = textureQuadForFace("back", pts) || [pts[4], pts[5], pts[6], pts[7]];
        const open = computeOpenCaseFlap(front, back, w, h, 0.95);
        if (open) {
          drawQuadFill(open.rimTop, "rgba(186, 193, 206, 0.18)", 1, ctx);
          drawQuadFill(open.rimBottom, "rgba(174, 181, 196, 0.16)", 1, ctx);
          drawQuadFill(open.flap, "rgba(154, 162, 176, 0.18)", 1, ctx);
          if (bind.front) applyImageToQuad(bind.front, open.flap, resolveFaceTexOpts("front"), ctx);
        }
      }
      if (pose === "disc-split" && isDisc && bind.disc) {
        const front = textureQuadForFace("front", pts) || [pts[0], pts[3], pts[2], pts[1]];
        const opening = textureQuadForFace("right", pts) || [pts[3], pts[0], pts[4], pts[7]];
        const caseCenter = quadCenter(front);
        const openCenter = quadCenter(opening);
        let dx = openCenter.x - caseCenter.x;
        let dy = openCenter.y - caseCenter.y;
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        const projH = quadProjectedHeight(front);
        const discR = discRadiusPxForQuad(template, front, 7, 0.94);
        const lift = Math.max(discR * 0.55, projH * 0.08);
        const cxSplit = openCenter.x + dx * lift;
        const cySplit = openCenter.y + dy * lift;
        const q = [
          { x: cxSplit - discR, y: cySplit - discR },
          { x: cxSplit + discR, y: cySplit - discR },
          { x: cxSplit + discR, y: cySplit + discR },
          { x: cxSplit - discR, y: cySplit + discR },
        ];
        drawDiscTexture(bind.disc, q, ctx);
      }
      drawVertices(pts, ctx, S.view.faceViz === "opaque" ? visibleVerts : null);
    }

    function drawUVUnwrap(cart, template, w, h, accentColor) {
      const d = template.d;
      const ratioFront = d.w / d.h;
      const ratioSpine = d.z / d.h;
      const pad = 28;
      const gap = 14;
      const totalRatio = ratioFront * 2 + ratioSpine;
      const baseH = Math.min(h - pad * 2, (w - pad * 2 - gap * 2) / totalRatio);
      const frontW = baseH * ratioFront;
      const spineW = Math.max(18, baseH * ratioSpine);
      const stripW = frontW + spineW + frontW + gap * 2;
      const sx = (w - stripW) / 2;
      const sy = (h - baseH) / 2;
      const frames = [
        { faceId: "back", label: "BACK", x: sx, y: sy, w: frontW, h: baseH },
        { faceId: "spine", label: "SPINE", x: sx + frontW + gap, y: sy, w: spineW, h: baseH },
        {
          faceId: "front",
          label: "FRONT",
          x: sx + frontW + gap + spineW + gap,
          y: sy,
          w: frontW,
          h: baseH,
        },
      ];
      const bind = getFaceAssetBindings(cart);
      X.save();
      X.fillStyle = "rgba(10,14,20,0.32)";
      X.fillRect(sx - 12, sy - 12, stripW + 24, baseH + 24);
      X.restore();
      frames.forEach((f) => {
        const raw = bind[f.faceId];
        const img = orientedImageForFace(raw, resolveFaceTexOpts(f.faceId));
        const slot = (() => {
          if (f.faceId === "front") {
            return cart.assets.find((x) => x.id === "cover_front") || cart.assets.find((x) => x.id === "label_front");
          }
          if (f.faceId === "back") return cart.assets.find((x) => x.id === "cover_back");
          if (f.faceId === "spine") return cart.assets.find((x) => x.id === "spine");
          return null;
        })();
        X.save();
        X.strokeStyle = accentColor;
        X.setLineDash([8, 6]);
        X.lineWidth = 1.5;
        X.strokeRect(f.x, f.y, f.w, f.h);
        X.setLineDash([]);
        if (img) X.drawImage(img, f.x, f.y, f.w, f.h);
        X.strokeStyle = "rgba(255,255,255,0.55)";
        X.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
        X.fillStyle = "rgba(8,12,20,0.84)";
        X.font = canvasFont(CANVAS_FS_1, "700");
        X.textAlign = "center";
        X.textBaseline = "middle";
        X.fillText(f.label, f.x + f.w / 2, f.y + 14);
        drawUvAxisDebug(
          [
            { x: f.x, y: f.y },
            { x: f.x + f.w, y: f.y },
            { x: f.x + f.w, y: f.y + f.h },
            { x: f.x, y: f.y + f.h },
          ],
          f.faceId.toUpperCase(),
        );
        if (slot) {
          drawInnerEdgeLabels(X, slot, f.x, f.y, f.w, f.h, {
            minPx: 16,
            maxPx: 26,
            force: true,
          });
        }
        X.restore();
      });
      if (bind.disc) {
        const discImg = orientedImageForFace(bind.disc, resolveFaceTexOpts("front"));
        const dr = Math.min(baseH * 0.24, 86);
        const dcx = sx + stripW - dr;
        const dcy = sy + baseH - dr;
        X.save();
        X.beginPath();
        X.arc(dcx, dcy, dr, 0, Math.PI * 2);
        X.closePath();
        X.fillStyle = "rgba(10,14,20,0.54)";
        X.fill();
        X.strokeStyle = "rgba(255,255,255,0.64)";
        X.lineWidth = 2;
        X.stroke();
        X.beginPath();
        X.arc(dcx, dcy, dr * 0.22, 0, Math.PI * 2);
        X.stroke();
        if (discImg) {
          X.save();
          X.beginPath();
          X.arc(dcx, dcy, dr, 0, Math.PI * 2);
          X.clip();
          X.drawImage(discImg, dcx - dr, dcy - dr, dr * 2, dr * 2);
          X.restore();
        }
        X.fillStyle = "rgba(8,12,20,0.84)";
        X.font = canvasFont(CANVAS_FS_MICRO, "700");
        X.textAlign = "center";
        X.fillText("DISC", dcx, dcy - dr - 12);
        X.restore();
      }
    }

    return {
      draw3D,
      drawMiniModel,
      drawUVUnwrap,
    };
  }

  window.KataCartRender3D = { createRender3D };
})();
