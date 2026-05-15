(function () {
  function createExportModule(deps) {
    const {
      S,
      U,
      TEMPLATES,
      cart,
      asset,
      tById,
      blueprint,
      assetPhysicalDimsMm,
      getMappedTemplateImage,
      templateCanvasForAsset,
      draw,
      setStatus,
      templateSpec,
      discDiameterMmForTemplate,
      mappedFaceSources,
      composedDiscSource,
      hexToRgb01,
      caseFaceDefs,
      WEBGL_FACE_UV_COORDS,
      WEBGL_FACE_UV_ORDER,
      WEBGL_FACE_POLY,
      CANONICAL_EXPORT_MAPPING_PROFILE,
    } = deps;

    function fileSlug(input, fallback = "katacart") {
      const out = String(input || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return out || fallback;
    }

    function dl(name, text, mime) {
      const b = new Blob([text], { type: mime });
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(u);
    }

    function dlUrl(name, url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
    }

    function dlBlob(name, blob) {
      const u = URL.createObjectURL(blob);
      dlUrl(name, u);
      setTimeout(() => URL.revokeObjectURL(u), 1500);
    }

    function textToBytes(text) {
      return new TextEncoder().encode(String(text || ""));
    }

    function concatBytes(parts) {
      const total = parts.reduce((n, p) => n + (p?.length || 0), 0);
      const out = new Uint8Array(total);
      let off = 0;
      parts.forEach((p) => {
        if (!p || !p.length) return;
        out.set(p, off);
        off += p.length;
      });
      return out;
    }

    function dataUriToBytes(uri) {
      const m = String(uri || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
      if (!m) return { mime: "application/octet-stream", bytes: new Uint8Array() };
      const mime = m[1] || "application/octet-stream";
      const isBase64 = !!m[2];
      const body = m[3] || "";
      if (isBase64) {
        const bin = atob(body);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
        return { mime, bytes: out };
      }
      const decoded = decodeURIComponent(body);
      return { mime, bytes: textToBytes(decoded) };
    }

    function bytesU16(v) {
      const b = new Uint8Array(2);
      new DataView(b.buffer).setUint16(0, v & 0xffff, true);
      return b;
    }

    function bytesU32(v) {
      const b = new Uint8Array(4);
      new DataView(b.buffer).setUint32(0, v >>> 0, true);
      return b;
    }

    let crc32Table = null;
    function crc32(bytes) {
      if (!crc32Table) {
        crc32Table = new Uint32Array(256);
        for (let i = 0; i < 256; i += 1) {
          let c = i;
          for (let j = 0; j < 8; j += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          crc32Table[i] = c >>> 0;
        }
      }
      let c = 0xffffffff;
      for (let i = 0; i < bytes.length; i += 1) c = crc32Table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    }

    function dosDateTime(date = new Date()) {
      const year = Math.max(1980, date.getFullYear());
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      const mins = date.getMinutes();
      const secs = Math.floor(date.getSeconds() / 2);
      const dosTime = (hours << 11) | (mins << 5) | secs;
      const dosDate = ((year - 1980) << 9) | (month << 5) | day;
      return { dosTime, dosDate };
    }

    function makeZipStore(files) {
      const now = dosDateTime();
      const locals = [];
      const centrals = [];
      let offset = 0;
      files.forEach((f) => {
        const nameBytes = textToBytes(f.name);
        const data = f.bytes || new Uint8Array();
        const csum = crc32(data);
        const localHeader = concatBytes([
          bytesU32(0x04034b50),
          bytesU16(20),
          bytesU16(0),
          bytesU16(0),
          bytesU16(now.dosTime),
          bytesU16(now.dosDate),
          bytesU32(csum),
          bytesU32(data.length),
          bytesU32(data.length),
          bytesU16(nameBytes.length),
          bytesU16(0),
          nameBytes,
        ]);
        locals.push(localHeader, data);
        const centralHeader = concatBytes([
          bytesU32(0x02014b50),
          bytesU16(20),
          bytesU16(20),
          bytesU16(0),
          bytesU16(0),
          bytesU16(now.dosTime),
          bytesU16(now.dosDate),
          bytesU32(csum),
          bytesU32(data.length),
          bytesU32(data.length),
          bytesU16(nameBytes.length),
          bytesU16(0),
          bytesU16(0),
          bytesU16(0),
          bytesU16(0),
          bytesU32(0),
          bytesU32(offset),
          nameBytes,
        ]);
        centrals.push(centralHeader);
        offset += localHeader.length + data.length;
      });
      const centralBytes = concatBytes(centrals);
      const end = concatBytes([
        bytesU32(0x06054b50),
        bytesU16(0),
        bytesU16(0),
        bytesU16(files.length),
        bytesU16(files.length),
        bytesU32(centralBytes.length),
        bytesU32(offset),
        bytesU16(0),
      ]);
      return new Blob([concatBytes([...locals, centralBytes, end])], {
        type: "application/zip",
      });
    }

    function makeGlbBlob(gltfObj) {
      const json = textToBytes(JSON.stringify(gltfObj));
      const jsonPad = (4 - (json.length % 4)) % 4;
      const jsonChunk = new Uint8Array(json.length + jsonPad);
      jsonChunk.set(json, 0);
      for (let i = json.length; i < jsonChunk.length; i += 1) jsonChunk[i] = 0x20;
      const header = new Uint8Array(12);
      const hv = new DataView(header.buffer);
      hv.setUint32(0, 0x46546c67, true);
      hv.setUint32(4, 2, true);
      hv.setUint32(8, 12 + 8 + jsonChunk.length, true);
      const chunkHeader = new Uint8Array(8);
      const cv = new DataView(chunkHeader.buffer);
      cv.setUint32(0, jsonChunk.length, true);
      cv.setUint32(4, 0x4e4f534a, true);
      return new Blob([header, chunkHeader, jsonChunk], {
        type: "model/gltf-binary",
      });
    }

    function uint8ToBase64(bytes) {
      let bin = "";
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        const chunk = bytes.subarray(i, i + step);
        bin += String.fromCharCode(...chunk);
      }
      return btoa(bin);
    }

    function arrayBufferToDataUri(buf, mime = "application/octet-stream") {
      const bytes = new Uint8Array(buf);
      return `data:${mime};base64,${uint8ToBase64(bytes)}`;
    }

    function discMaskedCanvas(srcCanvas) {
      if (!srcCanvas) return null;
      const size = Math.max(512, srcCanvas.width || 0, srcCanvas.height || 0);
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const x = c.getContext("2d");
      x.clearRect(0, 0, size, size);
      x.save();
      x.beginPath();
      x.arc(size * 0.5, size * 0.5, size * 0.48, 0, Math.PI * 2);
      x.closePath();
      x.clip();
      x.drawImage(srcCanvas, 0, 0, size, size);
      x.restore();
      x.save();
      x.globalCompositeOperation = "destination-out";
      x.beginPath();
      x.arc(size * 0.5, size * 0.5, size * 0.09, 0, Math.PI * 2);
      x.fill();
      x.restore();
      return c;
    }

    function templateBoxVerticesMeters(template) {
      const d = template.d;
      const n = 1 / Math.max(d.w, d.h, d.z || 1);
      const sx = d.w * n;
      const sy = d.h * n;
      const sz = Math.max(0.04, d.z * n);
      return [
        [-sx, -sy, -sz],
        [sx, -sy, -sz],
        [sx, sy, -sz],
        [-sx, sy, -sz],
        [-sx, -sy, sz],
        [sx, -sy, sz],
        [sx, sy, sz],
        [-sx, sy, sz],
      ];
    }

    function quadNormal(quadPos) {
      const a = quadPos[0];
      const b = quadPos[1];
      const d = quadPos[3];
      const ux = b[0] - a[0];
      const uy = b[1] - a[1];
      const uz = b[2] - a[2];
      const vx = d[0] - a[0];
      const vy = d[1] - a[1];
      const vz = d[2] - a[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    }

    function getExportMappingProfile() {
      return CANONICAL_EXPORT_MAPPING_PROFILE;
    }

    function applyUvOp(u, v, op) {
      if (op === "rot90cw") return [1 - v, u];
      if (op === "rot90ccw") return [v, 1 - u];
      if (op === "rot180") return [1 - u, 1 - v];
      if (op === "flipU") return [1 - u, v];
      if (op === "flipV") return [u, 1 - v];
      return [u, v];
    }

    function applyUvOpsList(points, ops = []) {
      let out = points.map((p) => ({ u: p.u, v: p.v }));
      (ops || []).forEach((op) => {
        out = out.map((p) => {
          const next = applyUvOp(p.u, p.v, op);
          return { u: next[0], v: next[1] };
        });
      });
      return out;
    }

    function exportTextureRoleForFace(faceId, profile) {
      let role =
        faceId === "front"
          ? "front"
          : faceId === "back"
            ? "back"
            : faceId === "spine"
              ? "spine"
              : null;
      const spineTarget = profile?.spineTargetFace || "spine";
      if (spineTarget !== "spine") {
        if (faceId === "spine") role = null;
        if (faceId === spineTarget) role = "spine";
      }
      return role;
    }

    function exportPayload() {
      const c = cart();
      if (!c) return null;
      const t = tById(c.templateId);
      return {
        app: "KataCart",
        version: "0.11.8",
        exportedAt: new Date().toISOString(),
        cart: {
          id: c.id,
          name: c.name,
          template: t,
          notes: c.notes,
          tags: c.tags,
          sku: c.sku,
          assets: c.assets.map((a) => ({
            id: a.id,
            label: a.label,
            type: a.type,
            width: a.w,
            height: a.h,
            hasImage: !!a.image,
            sourceSize: a.image ? { width: a.image.width, height: a.image.height } : null,
            transform: a.tr,
          })),
        },
        view: {
          renderer: S.renderer.engine,
          yaw: S.view.yaw,
          pitch: S.view.pitch,
          zoom: S.view.zoom,
          renderMode: S.view.renderMode,
          faceViz: S.view.faceViz,
          templateLabels: S.view.templateLabels,
          wireframe: S.view.wireframe,
          vertices: S.view.vertices,
          uvAxisDebug: S.view.uvAxisDebug,
          faceTint: S.view.faceTint,
          discBackStyle: S.view.discBackStyle,
          pose: S.view.pose,
          bgTexture: S.view.bgTexture,
          miniModel: {
            size: S.gizmo.size,
            yaw: S.gizmo.yaw,
            pitch: S.gizmo.pitch,
            zoom: S.gizmo.zoom,
          },
        },
        modelTransform: c.modelTr,
      };
    }

    function makeKataCartExportBundle() {
      const c = cart();
      if (!c) return null;
      const t = tById(c.templateId);
      const spec = templateSpec(t);
      const exportProfile = getExportMappingProfile();
      const baseName = fileSlug(`${c.name}-${t.id}`, "katacart");
      const payload = exportPayload();
      const mapped = mappedFaceSources(c);
      const discStyled = composedDiscSource(
        mapped.disc,
        S.view.discBackStyle || "silver-rainbow",
      );
      const textureRoles = [
        { role: "front", source: mapped.front?.canvas || null },
        { role: "back", source: mapped.back?.canvas || null },
        { role: "spine", source: mapped.spine?.canvas || null },
        {
          role: "disc",
          source: spec.capabilities?.discAsset ? discMaskedCanvas(discStyled?.canvas || null) : null,
        },
      ];
      const textures = textureRoles
        .filter((x) => !!x.source)
        .map((x) => ({
          role: x.role,
          filename: `${baseName}.texture.${x.role}.png`,
          canvas: x.source,
          dataUri: x.source.toDataURL("image/png"),
        }));
      const imageByRole = new Map(textures.map((x) => [x.role, x]));

      const faces = caseFaceDefs().map((f) => {
        const uvPts = applyUvOpsList(WEBGL_FACE_UV_COORDS[f.id], exportProfile.uvOps);
        const textureRole = exportTextureRoleForFace(f.id, exportProfile);
        return {
          id: f.id,
          poly: WEBGL_FACE_POLY[f.id],
          uvCorners: WEBGL_FACE_UV_ORDER[f.id],
          uv: uvPts.flatMap((p) => [p.u, p.v]),
          textureRole,
        };
      });
      const boxVerts = templateBoxVerticesMeters(t);
      const hasDisc = !!imageByRole.get("disc");
      if (hasDisc) {
        const discDia = discDiameterMmForTemplate(t);
        const n = 1 / Math.max(t.d.w, t.d.h, t.d.z || 1);
        const discR = discDia * n * 0.94;
        const z = Math.max(0.04, t.d.z * n) + 0.02;
        let discUv = [
          { u: 0, v: 0 },
          { u: 1, v: 0 },
          { u: 1, v: 1 },
          { u: 0, v: 1 },
        ];
        discUv = applyUvOpsList(discUv, exportProfile.uvOps);
        faces.push({
          id: "disc",
          poly: null,
          uvCorners: null,
          uv: discUv.flatMap((p) => [p.u, p.v]),
          quad: [
            [-discR, -discR, z],
            [discR, -discR, z],
            [discR, discR, z],
            [-discR, discR, z],
          ],
          textureRole: "disc",
        });
      }

      const binChunks = [];
      function pushChunk(typedArray, target) {
        const bytes = new Uint8Array(
          typedArray.buffer,
          typedArray.byteOffset,
          typedArray.byteLength,
        );
        let offset = 0;
        for (const c of binChunks) offset += c.bytes.length;
        const pad = (4 - (offset % 4)) % 4;
        if (pad) binChunks.push({ bytes: new Uint8Array(pad), target: undefined });
        let byteOffset = 0;
        for (const c of binChunks) byteOffset += c.bytes.length;
        binChunks.push({ bytes, target });
        return { buffer: 0, byteOffset, byteLength: bytes.length, target };
      }
      function minMaxFor(typed, stride) {
        const min = new Array(stride).fill(Number.POSITIVE_INFINITY);
        const max = new Array(stride).fill(Number.NEGATIVE_INFINITY);
        for (let i = 0; i < typed.length; i += stride) {
          for (let j = 0; j < stride; j += 1) {
            const v = typed[i + j];
            if (v < min[j]) min[j] = v;
            if (v > max[j]) max[j] = v;
          }
        }
        return { min, max };
      }

      const gltf = {
        asset: { version: "2.0", generator: "KataCart Exporter v1" },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [{ mesh: 0, name: `${c.name} Node` }],
        meshes: [{ name: `${c.name} Mesh`, primitives: [] }],
        materials: [],
        textures: [],
        images: [],
        samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 }],
        accessors: [],
        bufferViews: [],
        buffers: [],
        extras: {
          katacart: {
            templateId: t.id,
            templateName: t.name,
            templateSpec: spec,
            exportMappingProfile: exportProfile.id,
            modelTransform: c.modelTr,
            exportedAt: new Date().toISOString(),
          },
        },
      };

      const materialByRole = new Map();
      function ensureMaterial(role) {
        if (materialByRole.has(role || "_tint")) return materialByRole.get(role || "_tint");
        let matIndex = 0;
        if (role && imageByRole.get(role)) {
          const texDef = imageByRole.get(role);
          const imgIndex = gltf.images.push({
            name: `${role}_image`,
            uri: texDef.dataUri,
          }) - 1;
          const texIndex = gltf.textures.push({ sampler: 0, source: imgIndex }) - 1;
          matIndex = gltf.materials.push({
            name: `${role}_material`,
            pbrMetallicRoughness: {
              baseColorTexture: { index: texIndex },
              metallicFactor: 0,
              roughnessFactor: 1,
            },
            alphaMode: role === "disc" ? "BLEND" : "OPAQUE",
            doubleSided: true,
          }) - 1;
        } else {
          const tint = hexToRgb01(S.view.faceTint);
          matIndex = gltf.materials.push({
            name: "case_tint",
            pbrMetallicRoughness: {
              baseColorFactor: [tint[0], tint[1], tint[2], 1],
              metallicFactor: 0,
              roughnessFactor: 1,
            },
            alphaMode: "OPAQUE",
            doubleSided: true,
          }) - 1;
        }
        materialByRole.set(role || "_tint", matIndex);
        return matIndex;
      }

      faces.forEach((f) => {
        const quadPos = f.quad || f.uvCorners.map((vi) => boxVerts[vi]);
        const posArr = new Float32Array(quadPos.flatMap((p) => p));
        const n = quadNormal(quadPos);
        const nrmArr = new Float32Array([
          n[0], n[1], n[2],
          n[0], n[1], n[2],
          n[0], n[1], n[2],
          n[0], n[1], n[2],
        ]);
        const uvArr = new Float32Array(f.uv);
        const idxArr = new Uint16Array([0, 1, 2, 0, 2, 3]);

        const posView = pushChunk(posArr, 34962);
        const nrmView = pushChunk(nrmArr, 34962);
        const uvView = pushChunk(uvArr, 34962);
        const idxView = pushChunk(idxArr, 34963);

        const posMM = minMaxFor(posArr, 3);
        const posAccessor = gltf.accessors.push({
          bufferView: gltf.bufferViews.push(posView) - 1,
          componentType: 5126,
          count: 4,
          type: "VEC3",
          min: posMM.min,
          max: posMM.max,
        }) - 1;
        const nrmAccessor = gltf.accessors.push({
          bufferView: gltf.bufferViews.push(nrmView) - 1,
          componentType: 5126,
          count: 4,
          type: "VEC3",
        }) - 1;
        const uvAccessor = gltf.accessors.push({
          bufferView: gltf.bufferViews.push(uvView) - 1,
          componentType: 5126,
          count: 4,
          type: "VEC2",
        }) - 1;
        const idxAccessor = gltf.accessors.push({
          bufferView: gltf.bufferViews.push(idxView) - 1,
          componentType: 5123,
          count: 6,
          type: "SCALAR",
          min: [0],
          max: [3],
        }) - 1;

        gltf.meshes[0].primitives.push({
          attributes: {
            POSITION: posAccessor,
            NORMAL: nrmAccessor,
            TEXCOORD_0: uvAccessor,
          },
          indices: idxAccessor,
          material: ensureMaterial(f.textureRole),
          mode: 4,
          extras: { faceId: f.id, textureRole: f.textureRole || "tint" },
        });
      });

      const total = binChunks.reduce((acc, c) => acc + c.bytes.length, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      binChunks.forEach((c) => {
        merged.set(c.bytes, off);
        off += c.bytes.length;
      });
      gltf.buffers.push({
        byteLength: merged.length,
        uri: arrayBufferToDataUri(merged.buffer, "application/octet-stream"),
      });

      const manifest = {
        app: "KataCart",
        packageVersion: "1.0.0",
        packageName: baseName,
        exportedAt: new Date().toISOString(),
        cart: {
          id: c.id,
          name: c.name,
          templateId: t.id,
          templateName: t.name,
        },
        files: {
          state: `${baseName}.state.json`,
          manifest: `${baseName}.manifest.json`,
          gltf: `${baseName}.gltf`,
          glb: `${baseName}.glb`,
          textures: textures.map((x) => x.filename),
        },
        textures: textures.map((x) => ({
          role: x.role,
          filename: x.filename,
        })),
      };

      return { baseName, manifest, payload, gltf, textures };
    }

    function deepCloneJson(v) {
      return JSON.parse(JSON.stringify(v));
    }

    function applyNodeMatrix(gltf, matrix16) {
      if (!gltf?.nodes?.length) return;
      const n = gltf.nodes[0];
      delete n.translation;
      delete n.rotation;
      delete n.scale;
      n.matrix = matrix16.slice(0, 16);
    }

    function materialIndexByRole(gltf) {
      const map = new Map();
      (gltf.materials || []).forEach((m, i) => {
        if (!m?.name) return;
        const n = String(m.name).toLowerCase();
        if (n === "case_tint") map.set("tint", i);
        if (n.endsWith("_material")) map.set(n.replace("_material", ""), i);
      });
      return map;
    }

    function remapPrimitiveMaterials(gltf, faceRoleMap = {}) {
      const roleMats = materialIndexByRole(gltf);
      const tintMat = roleMats.has("tint") ? roleMats.get("tint") : 0;
      const prims = gltf?.meshes?.[0]?.primitives || [];
      prims.forEach((p) => {
        const faceId = p?.extras?.faceId;
        if (!faceId) return;
        const override = Object.prototype.hasOwnProperty.call(faceRoleMap, faceId)
          ? faceRoleMap[faceId]
          : undefined;
        if (override === undefined) return;
        const targetRole = override || "tint";
        p.material = roleMats.has(targetRole) ? roleMats.get(targetRole) : tintMat;
        if (p.extras) p.extras.textureRole = targetRole;
      });
    }

    function gltfPrimaryBufferBytes(gltf) {
      const uri = gltf?.buffers?.[0]?.uri || "";
      const parsed = dataUriToBytes(uri);
      return parsed.bytes || new Uint8Array();
    }

    function setGltfPrimaryBufferBytes(gltf, bytes) {
      if (!gltf?.buffers?.length) return;
      gltf.buffers[0].byteLength = bytes.length;
      gltf.buffers[0].uri = arrayBufferToDataUri(bytes.buffer, "application/octet-stream");
    }

    function applyUvOpsByFace(gltf, faceUvOps = {}) {
      const opsByFace = faceUvOps || {};
      const prims = gltf?.meshes?.[0]?.primitives || [];
      if (!prims.length) return;
      const accessors = gltf.accessors || [];
      const views = gltf.bufferViews || [];
      const bytes = gltfPrimaryBufferBytes(gltf);
      if (!bytes.length) return;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      prims.forEach((p) => {
        const faceId = p?.extras?.faceId;
        const ops = faceId ? opsByFace[faceId] : null;
        if (!ops || !ops.length) return;
        const uvAccessorIndex = p?.attributes?.TEXCOORD_0;
        if (uvAccessorIndex === undefined || uvAccessorIndex === null) return;
        const accessor = accessors[uvAccessorIndex];
        if (!accessor || accessor.componentType !== 5126 || accessor.type !== "VEC2") return;
        const view = views[accessor.bufferView];
        if (!view) return;
        const stride = view.byteStride || 8;
        const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count || 0;
        for (let i = 0; i < count; i += 1) {
          const off = base + i * stride;
          let u = dv.getFloat32(off, true);
          let v = dv.getFloat32(off + 4, true);
          ops.forEach((op) => {
            const next = applyUvOp(u, v, op);
            u = next[0];
            v = next[1];
          });
          dv.setFloat32(off, u, true);
          dv.setFloat32(off + 4, v, true);
        }
      });
      setGltfPrimaryBufferBytes(gltf, bytes);
    }

    function debugMappingVariants() {
      const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const core = [
        { id: "v01_baseline", label: "Baseline (current export)", matrix: I, faceRoleMap: {}, faceUvOps: {} },
        { id: "v02_rot_x_180", label: "Rotate model 180 on X", matrix: [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1], faceRoleMap: {}, faceUvOps: {} },
        { id: "v03_rot_y_180", label: "Rotate model 180 on Y", matrix: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1], faceRoleMap: {}, faceUvOps: {} },
        { id: "v04_rot_z_180", label: "Rotate model 180 on Z", matrix: [-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], faceRoleMap: {}, faceUvOps: {} },
        { id: "v05_swap_front_back", label: "Swap front/back textures", matrix: I, faceRoleMap: { front: "back", back: "front" }, faceUvOps: {} },
        { id: "v06_spine_on_right", label: "Move spine texture to right edge face", matrix: I, faceRoleMap: { spine: "tint", right: "spine" }, faceUvOps: {} },
        { id: "v07_swap_fb_rot_y_180", label: "Swap front/back + rotate Y 180", matrix: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1], faceRoleMap: { front: "back", back: "front" }, faceUvOps: {} },
        { id: "v08_mirror_x", label: "Mirror model on X", matrix: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], faceRoleMap: {}, faceUvOps: {} },
      ];
      const uvProfiles = [
        { id: "u00_none", label: "UV unchanged", map: {} },
        { id: "u01_fb_rot180", label: "Front+Back UV rot180", map: { front: ["rot180"], back: ["rot180"] } },
        { id: "u02_fb_flipu", label: "Front+Back UV flipU", map: { front: ["flipU"], back: ["flipU"] } },
        { id: "u03_fb_flipv", label: "Front+Back UV flipV", map: { front: ["flipV"], back: ["flipV"] } },
        { id: "u04_fb_rot90cw", label: "Front+Back UV rot90cw", map: { front: ["rot90cw"], back: ["rot90cw"] } },
        { id: "u05_fb_rot90ccw", label: "Front+Back UV rot90ccw", map: { front: ["rot90ccw"], back: ["rot90ccw"] } },
        { id: "u06_spine_flipu", label: "Spine UV flipU", map: { spine: ["flipU"] } },
        { id: "u07_spine_rot180", label: "Spine UV rot180", map: { spine: ["rot180"] } },
        { id: "u08_all_flipu", label: "All major faces UV flipU", map: { front: ["flipU"], back: ["flipU"], spine: ["flipU"], right: ["flipU"], top: ["flipU"], bottom: ["flipU"] } },
      ];
      const set = [];
      let idx = 1;
      core.forEach((c) => {
        uvProfiles.forEach((u, i) => {
          if (c.id !== "v01_baseline" && i > 2) return;
          const sid = String(idx).padStart(2, "0");
          set.push({
            id: `v${sid}_${c.id}_${u.id}`,
            label: `${c.label} | ${u.label}`,
            matrix: c.matrix,
            faceRoleMap: c.faceRoleMap,
            faceUvOps: u.map,
          });
          idx += 1;
        });
      });
      return set;
    }

    function makeDebugMappingPack(bundle) {
      const { baseName, gltf } = bundle;
      const variants = debugMappingVariants();
      const rows = [];
      const jobs = variants.map((v, idx) => {
        const g = deepCloneJson(gltf);
        applyNodeMatrix(g, v.matrix);
        remapPrimitiveMaterials(g, v.faceRoleMap);
        applyUvOpsByFace(g, v.faceUvOps);
        g.extras = g.extras || {};
        g.extras.katacart = g.extras.katacart || {};
        g.extras.katacart.debugVariant = {
          id: v.id,
          label: v.label,
          index: idx + 1,
          total: variants.length,
          matrix: v.matrix,
          faceRoleMap: v.faceRoleMap,
          faceUvOps: v.faceUvOps,
        };
        const filename = `${baseName}.${v.id}.glb`;
        rows.push(`${idx + 1}. ${filename}\n   ${v.label}`);
        return makeGlbBlob(g).arrayBuffer().then((ab) => ({
          name: filename,
          bytes: new Uint8Array(ab),
          meta: {
            id: v.id,
            label: v.label,
            filename,
            matrix: v.matrix,
            faceRoleMap: v.faceRoleMap,
          },
        }));
      });
      return Promise.all(jobs).then((files) => {
        const readme = [
          "KataCart Mapping Debug Pack",
          "",
          "Goal:",
          "Import each .glb into Blender and report which one is fully correct.",
          "",
          "Checks:",
          "- front text reads correctly and is on front face",
          "- back text reads correctly and is on back face",
          "- spine is on expected edge",
          "- model is upright (not upside down)",
          "",
          "Variants:",
          ...rows,
          "",
          "Reply format suggestion:",
          "best=<filename>",
          "notes=<what is still wrong>",
        ].join("\n");
        const manifest = {
          app: "KataCart",
          type: "mapping-debug-pack",
          generatedAt: new Date().toISOString(),
          baseName,
          variants: files.map((f) => f.meta),
        };
        const zipFiles = [
          { name: `${baseName}.debug.README.txt`, bytes: textToBytes(readme) },
          {
            name: `${baseName}.debug.manifest.json`,
            bytes: textToBytes(JSON.stringify(manifest, null, 2)),
          },
          ...files.map((f) => ({ name: f.name, bytes: f.bytes })),
        ];
        return { blob: makeZipStore(zipFiles), manifest, count: files.length };
      });
    }

    function makeTruthFaceDataUri(faceId, size = 1024) {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const x = c.getContext("2d");
      const palette = {
        front: { bg: "#a7f3d0", fg: "#06281b" },
        back: { bg: "#fde68a", fg: "#2f2103" },
        spine: { bg: "#bfdbfe", fg: "#061a3d" },
        right: { bg: "#fbcfe8", fg: "#3f0820" },
        top: { bg: "#ddd6fe", fg: "#21113f" },
        bottom: { bg: "#fecaca", fg: "#3f0a0a" },
        disc: { bg: "#e5e7eb", fg: "#111827" },
      };
      const face = String(faceId || "unknown").toLowerCase();
      const colors = palette[face] || { bg: "#e2e8f0", fg: "#0f172a" };
      x.fillStyle = colors.bg;
      x.fillRect(0, 0, size, size);
      x.strokeStyle = colors.fg;
      x.lineWidth = Math.max(8, Math.round(size * 0.014));
      x.strokeRect(10, 10, size - 20, size - 20);
      x.font = `700 ${Math.round(size * 0.14)}px monospace`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillStyle = colors.fg;
      x.fillText(face.toUpperCase(), size * 0.5, size * 0.52);
      x.font = `700 ${Math.round(size * 0.085)}px monospace`;
      x.fillText("UP", size * 0.5, size * 0.16);
      x.beginPath();
      x.moveTo(size * 0.5, size * 0.22);
      x.lineTo(size * 0.44, size * 0.32);
      x.lineTo(size * 0.56, size * 0.32);
      x.closePath();
      x.fill();
      x.font = `700 ${Math.round(size * 0.05)}px monospace`;
      x.fillText("TL", size * 0.12, size * 0.1);
      x.fillText("TR", size * 0.88, size * 0.1);
      x.fillText("BL", size * 0.12, size * 0.9);
      x.fillText("BR", size * 0.88, size * 0.9);
      return c.toDataURL("image/png");
    }

    function readPrimitiveUvSample(gltf, prim, maxCount = 4) {
      const idx = prim?.attributes?.TEXCOORD_0;
      if (idx === undefined || idx === null) return [];
      const accessor = gltf?.accessors?.[idx];
      if (!accessor || accessor.componentType !== 5126 || accessor.type !== "VEC2") return [];
      const view = gltf?.bufferViews?.[accessor.bufferView];
      if (!view) return [];
      const bytes = gltfPrimaryBufferBytes(gltf);
      if (!bytes.length) return [];
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const stride = view.byteStride || 8;
      const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
      const count = Math.min(accessor.count || 0, maxCount);
      const out = [];
      for (let i = 0; i < count; i += 1) {
        const off = base + i * stride;
        out.push({
          u: Number(dv.getFloat32(off, true).toFixed(4)),
          v: Number(dv.getFloat32(off + 4, true).toFixed(4)),
        });
      }
      return out;
    }

    function makeTruthCubeGltf(bundle) {
      const g = deepCloneJson(bundle.gltf);
      g.extras = g.extras || {};
      g.extras.katacart = g.extras.katacart || {};
      const roles = ["front", "back", "spine", "right", "top", "bottom"];
      const sampler = g.samplers && g.samplers.length
        ? g.samplers[0]
        : { magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 };
      g.samplers = [sampler];
      g.images = roles.map((r) => ({
        name: `${r}_truth_image`,
        uri: makeTruthFaceDataUri(r, 1024),
      }));
      g.textures = roles.map((_, i) => ({ sampler: 0, source: i }));
      g.materials = roles.map((r, i) => ({
        name: `${r}_material`,
        pbrMetallicRoughness: {
          baseColorTexture: { index: i },
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        alphaMode: "OPAQUE",
        doubleSided: true,
      }));
      const tintIndex = g.materials.push({
        name: "case_tint",
        pbrMetallicRoughness: {
          baseColorFactor: [0.7, 0.7, 0.7, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        alphaMode: "OPAQUE",
        doubleSided: true,
      }) - 1;
      const roleToMat = new Map(roles.map((r, i) => [r, i]));
      (g.meshes?.[0]?.primitives || []).forEach((p, i) => {
        const faceId = p?.extras?.faceId;
        p.material = roleToMat.has(faceId) ? roleToMat.get(faceId) : tintIndex;
        p.extras = p.extras || {};
        p.extras.truthVariant = {
          primitiveIndex: i,
          assignedRole: roleToMat.has(faceId) ? faceId : "tint",
        };
      });
      return g;
    }

    function makeTruthCubeExportPack(bundle) {
      const { baseName } = bundle;
      const gltfTruth = makeTruthCubeGltf(bundle);
      const prims = gltfTruth?.meshes?.[0]?.primitives || [];
      const mapping = prims.map((p, i) => ({
        primitiveIndex: i,
        faceId: p?.extras?.faceId || null,
        textureRole: p?.extras?.textureRole || null,
        poly: WEBGL_FACE_POLY[p?.extras?.faceId] || null,
        uvCorners: WEBGL_FACE_UV_ORDER[p?.extras?.faceId] || null,
        uvCoords: WEBGL_FACE_UV_COORDS[p?.extras?.faceId] || null,
        uvSample: readPrimitiveUvSample(gltfTruth, p, 4),
      }));
      const manifest = {
        app: "KataCart",
        type: "truth-cube-parity-pack",
        generatedAt: new Date().toISOString(),
        baseName,
        note: "This uses exporter geometry + UVs with generated labeled face textures.",
        mapping,
      };
      const readme = [
        "KataCart Truth Cube Parity Pack",
        "",
        "Goal:",
        "Verify Blender orientation from exporter ground truth.",
        "",
        "Expected in Blender default import:",
        "- FRONT label on front-facing case side",
        "- BACK label on back-facing case side",
        "- SPINE on intended edge",
        "- UP arrow points toward top edge of each face",
        "",
        "Files:",
        `- ${baseName}.truth.gltf`,
        `- ${baseName}.truth.glb`,
        `- ${baseName}.truth.manifest.json`,
        "",
        "Reply with:",
        "result=<what is wrong/right>",
      ].join("\n");
      return makeGlbBlob(gltfTruth)
        .arrayBuffer()
        .then((ab) => {
          const files = [
            { name: `${baseName}.truth.README.txt`, bytes: textToBytes(readme) },
            {
              name: `${baseName}.truth.manifest.json`,
              bytes: textToBytes(JSON.stringify(manifest, null, 2)),
            },
            {
              name: `${baseName}.truth.gltf`,
              bytes: textToBytes(JSON.stringify(gltfTruth, null, 2)),
            },
            { name: `${baseName}.truth.glb`, bytes: new Uint8Array(ab) },
          ];
          return { blob: makeZipStore(files), count: files.length };
        });
    }

    function validateTruthCubeParity() {
      const bundle = makeKataCartExportBundle();
      if (!bundle) {
        setStatus("Truth validate failed: no active cart.");
        return;
      }
      const profile = getExportMappingProfile();
      const truth = makeTruthCubeGltf(bundle);
      const prims = truth?.meshes?.[0]?.primitives || [];
      const errors = [];
      const eps = 0.003;
      const caseFaces = ["front", "back", "spine", "right", "top", "bottom"];
      caseFaces.forEach((faceId) => {
        const prim = prims.find((p) => p?.extras?.faceId === faceId);
        if (!prim) {
          errors.push(`Missing primitive for face ${faceId}.`);
          return;
        }
        const expected = applyUvOpsList(WEBGL_FACE_UV_COORDS[faceId], profile.uvOps);
        const sample = readPrimitiveUvSample(truth, prim, 4);
        if (sample.length < 4) {
          errors.push(`UV sample missing for face ${faceId}.`);
          return;
        }
        for (let i = 0; i < 4; i += 1) {
          const du = Math.abs(sample[i].u - expected[i].u);
          const dv = Math.abs(sample[i].v - expected[i].v);
          if (du > eps || dv > eps) {
            errors.push(
              `${faceId} UV mismatch at ${i}: got (${sample[i].u},${sample[i].v}) expected (${expected[i].u},${expected[i].v})`,
            );
            break;
          }
        }
      });
      const exportPrims = bundle?.gltf?.meshes?.[0]?.primitives || [];
      const spineTargetPrim = exportPrims.find(
        (p) => p?.extras?.faceId === profile.spineTargetFace,
      );
      if (profile.spineTargetFace && profile.spineTargetFace !== "spine") {
        const spineFacePrim = exportPrims.find((p) => p?.extras?.faceId === "spine");
        if (spineFacePrim?.extras?.textureRole === "spine") {
          errors.push("Spine texture is still assigned to spine face.");
        }
      }
      if (spineTargetPrim?.extras?.textureRole !== "spine") {
        errors.push(`Spine texture not assigned to ${profile.spineTargetFace} face.`);
      }
      if (errors.length) {
        console.warn("[KataCart Truth Validate] Failed", errors);
        setStatus(`Truth validate failed (${errors.length}). Check console for details.`);
        return;
      }
      setStatus(`Truth validate passed for canonical profile: ${profile.id}.`);
    }

    function downloadTemplateAsset(a, namePrefix = "") {
      const c = templateCanvasForAsset(a);
      const prefix = namePrefix ? `${fileSlug(namePrefix)}_` : "";
      c.toBlob((blob) => {
        if (!blob) return;
        const u = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = u;
        link.download = `${prefix}${a.id}_template_${a.w}x${a.h}.png`;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(u);
      }, "image/png");
    }

    function downloadTemplate() {
      const a = asset();
      if (!a || a.type !== "2d") {
        setStatus("Select a 2D face first.");
        return;
      }
      downloadTemplateAsset(a);
      setStatus(`Downloaded face template for ${a.label}.`);
    }

    function openExportModal() {
      if (!U.exportModal) return;
      refreshTemplateExportTable();
      refreshExportImageAssetOptions();
      setExportTab(S.exportTab || "package");
      syncExportModalState();
      if (typeof U.exportModal.showModal === "function") U.exportModal.showModal();
    }

    function closeExportModal() {
      if (!U.exportModal) return;
      if (U.exportModal.open) U.exportModal.close();
    }

    function setExportTab(tabId) {
      S.exportTab = tabId;
      const map = {
        package: U.exportPanelPackage,
        template: U.exportPanelTemplate,
        image: U.exportPanelImage,
      };
      Object.entries(map).forEach(([id, panel]) => {
        if (!panel) return;
        panel.hidden = id !== tabId;
      });
      (U.exportTabButtons || []).forEach((btn) => {
        const active = btn.dataset.exportTab === tabId;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    function templateAssetSummary(template) {
      return blueprint(template)
        .filter((a) => a.type === "2d")
        .map((a) => {
          const mm = assetPhysicalDimsMm(a.id, template);
          const mmTxt = mm ? ` (${mm.w}x${mm.h}mm)` : "";
          return `${a.label}: ${a.w}x${a.h}px${mmTxt}`;
        })
        .join("\n");
    }

    function refreshTemplateExportTable() {
      if (!U.exportTemplateTableBody) return;
      const prev = new Set(
        [...U.exportTemplateTableBody.querySelectorAll("input[type='checkbox']:checked")].map(
          (x) => x.value,
        ),
      );
      U.exportTemplateTableBody.innerHTML = "";
      TEMPLATES.forEach((t) => {
        const tr = document.createElement("tr");
        const checked = prev.has(t.id);
        tr.innerHTML = `
          <td><input class="export-template-check" type="checkbox" value="${t.id}" ${checked ? "checked" : ""} /></td>
          <td><strong>${t.name}</strong><div class="muted">${t.family}</div></td>
          <td><pre class="dim-list">${templateAssetSummary(t)}</pre></td>
        `;
        U.exportTemplateTableBody.append(tr);
      });
      const checks = [...U.exportTemplateTableBody.querySelectorAll(".export-template-check")];
      const checkedCount = checks.filter((x) => x.checked).length;
      if (U.exportTemplateSelectAll) {
        U.exportTemplateSelectAll.checked = checks.length > 0 && checkedCount === checks.length;
        U.exportTemplateSelectAll.indeterminate = checkedCount > 0 && checkedCount < checks.length;
      }
    }

    function runTemplateBatchExport() {
      if (!U.exportTemplateTableBody) return;
      const selected = [
        ...U.exportTemplateTableBody.querySelectorAll(".export-template-check:checked"),
      ].map((x) => x.value);
      if (!selected.length) {
        setStatus("Select at least one template row to export.");
        return;
      }
      let files = 0;
      selected.forEach((tid) => {
        const t = tById(tid);
        const list = blueprint(t).filter((a) => a.type === "2d");
        list.forEach((a) => {
          downloadTemplateAsset(a, t.id);
          files += 1;
        });
      });
      setStatus(
        `Downloaded ${files} template image${files === 1 ? "" : "s"} from ${selected.length} template set${selected.length === 1 ? "" : "s"}.`,
      );
    }

    function refreshExportImageAssetOptions() {
      if (!U.exportImageAsset) return;
      const c = cart();
      if (!c) return;
      const current = U.exportImageAsset.value;
      const currentAsset = asset();
      const options = [{ value: "__model__", label: "Model View" }];
      c.assets.forEach((a) => {
        if (a.type !== "2d") return;
        options.push({ value: a.id, label: `Face: ${a.label} (${a.w}x${a.h})` });
      });
      U.exportImageAsset.innerHTML = options
        .map((o) => `<option value="${o.value}">${o.label}</option>`)
        .join("");
      const fallback = currentAsset?.type === "2d" ? currentAsset.id : "__model__";
      const wanted = options.some((o) => o.value === current) ? current : fallback;
      U.exportImageAsset.value = options.some((o) => o.value === wanted)
        ? wanted
        : (options[0]?.value || "__model__");
    }

    function syncExportModalState() {
      const isModel = (U.exportImageAsset?.value || "__model__") === "__model__";
      if (U.exportModelScaleRow) U.exportModelScaleRow.hidden = !isModel;
      if (U.exportModelScale) U.exportModelScale.disabled = !isModel;
      if (U.exportImageFormat) {
        const fmt = U.exportImageFormat.value;
        if (U.exportTransparentBg) {
          if (fmt === "jpg") {
            U.exportTransparentBg.checked = false;
            U.exportTransparentBg.disabled = true;
          } else {
            U.exportTransparentBg.disabled = false;
          }
        }
      }
    }

    function mimeForFormat(fmt) {
      if (fmt === "jpg" || fmt === "jpeg") return "image/jpeg";
      if (fmt === "webp") return "image/webp";
      return "image/png";
    }

    function exportCanvasDataUrl(canvas, fmt, quality = 0.92, transparent = true) {
      if (!canvas) return null;
      const mime = mimeForFormat(fmt);
      const needsOpaque = !transparent || mime === "image/jpeg";
      let source = canvas;
      if (needsOpaque) {
        const c = document.createElement("canvas");
        c.width = canvas.width;
        c.height = canvas.height;
        const x = c.getContext("2d");
        const bg =
          getComputedStyle(document.documentElement).getPropertyValue("--ds-bg").trim() ||
          "#10131a";
        x.fillStyle = bg;
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(canvas, 0, 0);
        source = c;
      }
      return source.toDataURL(mime, quality);
    }

    function canvasAlphaBounds(canvas, threshold = 2) {
      const x = canvas.getContext("2d");
      const { data, width, height } = x.getImageData(0, 0, canvas.width, canvas.height);
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let i = 3, px = 0; i < data.length; i += 4, px += 1) {
        if (data[i] <= threshold) continue;
        const xPos = px % width;
        const yPos = (px / width) | 0;
        if (xPos < minX) minX = xPos;
        if (xPos > maxX) maxX = xPos;
        if (yPos < minY) minY = yPos;
        if (yPos > maxY) maxY = yPos;
      }
      if (maxX < minX || maxY < minY) return null;
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    function cropCanvasWithPadding(canvas, bounds, padPx) {
      if (!bounds) return canvas;
      const pad = Math.max(0, Math.round(padPx));
      const x0 = Math.max(0, bounds.x - pad);
      const y0 = Math.max(0, bounds.y - pad);
      const x1 = Math.min(canvas.width, bounds.x + bounds.w + pad);
      const y1 = Math.min(canvas.height, bounds.y + bounds.h + pad);
      const out = document.createElement("canvas");
      out.width = Math.max(1, x1 - x0);
      out.height = Math.max(1, y1 - y0);
      out.getContext("2d").drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return out;
    }

    function composeModelSnapshot(scale = 1, transparent = true) {
      const prevAssetId = S.assetId;
      const c = cart();
      const modelAsset = c?.assets?.find((x) => x.type === "3d");
      if (modelAsset) S.assetId = modelAsset.id;
      draw();
      const stage = U.stageCanvas;
      const gl = U.stageGlCanvas;
      const raw = document.createElement("canvas");
      raw.width = Math.max(1, Math.round(stage.width * scale));
      raw.height = Math.max(1, Math.round(stage.height * scale));
      const x = raw.getContext("2d");
      x.scale(scale, scale);
      if (!gl.hidden && gl.width > 0 && gl.height > 0) x.drawImage(gl, 0, 0, stage.width, stage.height);
      x.drawImage(stage, 0, 0, stage.width, stage.height);
      const pad = Math.max(10, Math.round(18 * scale));
      const cropped = cropCanvasWithPadding(raw, canvasAlphaBounds(raw), pad);
      let out = cropped;
      if (!transparent) {
        const bg =
          getComputedStyle(document.documentElement).getPropertyValue("--ds-bg").trim() ||
          "#10131a";
        const filled = document.createElement("canvas");
        filled.width = out.width;
        filled.height = out.height;
        const fx = filled.getContext("2d");
        fx.fillStyle = bg;
        fx.fillRect(0, 0, filled.width, filled.height);
        fx.drawImage(out, 0, 0);
        out = filled;
      }
      S.assetId = prevAssetId;
      draw();
      return out;
    }

    function exportMappedAssetImage(a, baseName, fmt, quality, transparent) {
      if (!a || a.type !== "2d") return false;
      const mapped = getMappedTemplateImage(a);
      if (!mapped) return false;
      const u = exportCanvasDataUrl(mapped, fmt, quality, transparent);
      if (!u) return false;
      dlUrl(`${baseName}.${fileSlug(a.id, "asset")}.${fmt}`, u);
      return true;
    }

    function runPackageExport(mode) {
      const bundle = makeKataCartExportBundle();
      if (!bundle) return;
      const { baseName, manifest, payload, gltf, textures } = bundle;
      if (mode === "state") {
        dl(`${baseName}.state.json`, JSON.stringify(payload, null, 2), "application/json");
        setStatus("Exported state JSON.");
        return;
      }
      if (mode === "glb") {
        dlBlob(`${baseName}.glb`, makeGlbBlob(gltf));
        setStatus("Exported quick GLB.");
        return;
      }
      if (mode === "debug") {
        makeDebugMappingPack(bundle)
          .then((pack) => {
            dlBlob(`${baseName}.mapping-debug.zip`, pack.blob);
            setStatus(`Exported mapping debug pack (${pack.count} GLB variants).`);
          })
          .catch(() => {
            setStatus("Debug mapping export failed.");
          });
        return;
      }
      if (mode === "truth") {
        makeTruthCubeExportPack(bundle)
          .then((pack) => {
            dlBlob(`${baseName}.truth-cube.zip`, pack.blob);
            setStatus("Exported truth cube parity pack.");
          })
          .catch(() => {
            setStatus("Truth cube export failed.");
          });
        return;
      }
      if (mode === "zip") {
        makeGlbBlob(gltf)
          .arrayBuffer()
          .then((ab) => {
            const files = [
              { name: `${baseName}.manifest.json`, bytes: textToBytes(JSON.stringify(manifest, null, 2)) },
              { name: `${baseName}.state.json`, bytes: textToBytes(JSON.stringify(payload, null, 2)) },
              { name: `${baseName}.gltf`, bytes: textToBytes(JSON.stringify(gltf, null, 2)) },
              { name: `${baseName}.glb`, bytes: new Uint8Array(ab) },
            ];
            textures.forEach((t) => {
              const parsed = dataUriToBytes(t.dataUri);
              files.push({ name: t.filename, bytes: parsed.bytes });
            });
            dlBlob(`${baseName}.zip`, makeZipStore(files));
            setStatus(`Exported ZIP package (${files.length} files, including glTF + GLB + textures).`);
          })
          .catch(() => {
            setStatus("ZIP export failed.");
          });
        return;
      }
      if (mode === "gltf") {
        dl(`${baseName}.gltf`, JSON.stringify(gltf, null, 2), "model/gltf+json");
        textures.forEach((t) => dlUrl(t.filename, t.dataUri));
        setStatus(`Exported glTF + ${textures.length} face texture${textures.length === 1 ? "" : "s"}.`);
        return;
      }
      dl(`${baseName}.manifest.json`, JSON.stringify(manifest, null, 2), "application/json");
      dl(`${baseName}.state.json`, JSON.stringify(payload, null, 2), "application/json");
      dl(`${baseName}.gltf`, JSON.stringify(gltf, null, 2), "model/gltf+json");
      dlBlob(`${baseName}.glb`, makeGlbBlob(gltf));
      textures.forEach((t) => dlUrl(t.filename, t.dataUri));
      setStatus(`Exported package: ${baseName} (manifest + state + glTF + GLB + ${textures.length} face texture${textures.length === 1 ? "" : "s"}).`);
    }

    function runImageExport() {
      const c = cart();
      if (!c) return;
      const fmt = U.exportImageFormat?.value || "png";
      const quality = Math.max(0.6, Math.min(1, Number(U.exportImageQuality?.value || 92) / 100));
      const transparent = !!U.exportTransparentBg?.checked;
      const target = U.exportImageAsset?.value || "__model__";
      const baseName = fileSlug(`${c.name}-${c.templateId}`, "katacart");
      if (target === "__model__") {
        const scale = Math.max(1, Number(U.exportModelScale?.value || 1));
        const snap = composeModelSnapshot(scale, transparent);
        const u = exportCanvasDataUrl(snap, fmt, quality, transparent);
        if (!u) return;
        dlUrl(`${baseName}.model-view.${fmt}`, u);
        setStatus("Exported model view image.");
        return;
      }
      const a = c.assets.find((x) => x.id === target);
      if (!a || a.type !== "2d") {
        setStatus("Choose a valid 2D face to export.");
        return;
      }
      const ok = exportMappedAssetImage(a, baseName, fmt, quality, transparent);
      setStatus(ok ? `Exported face image: ${a.label}.` : "Selected face has no mapped image to export.");
    }

    function bindExportUI() {
      U.exportJsonBtn?.addEventListener("click", openExportModal);
      U.closeExportModalBtn?.addEventListener("click", closeExportModal);
      U.cancelPackageExportBtn?.addEventListener("click", closeExportModal);
      U.cancelTemplateExportBtn?.addEventListener("click", closeExportModal);
      U.cancelImageExportBtn?.addEventListener("click", closeExportModal);
      (U.exportTabButtons || []).forEach((btn) =>
        btn.addEventListener("click", () => {
          setExportTab(btn.dataset.exportTab || "package");
          syncExportModalState();
        }),
      );
      U.exportTemplateSelectAll?.addEventListener("input", () => {
        const on = !!U.exportTemplateSelectAll.checked;
        [...(U.exportTemplateTableBody?.querySelectorAll(".export-template-check") || [])].forEach(
          (x) => {
            x.checked = on;
          },
        );
        refreshTemplateExportTable();
      });
      U.exportTemplateTableBody?.addEventListener("input", (e) => {
        if (e.target && e.target.classList.contains("export-template-check")) {
          refreshTemplateExportTable();
        }
      });
      U.exportImageAsset?.addEventListener("input", syncExportModalState);
      U.exportImageFormat?.addEventListener("input", syncExportModalState);
      U.runPackageExportBtn?.addEventListener("click", () => {
        runPackageExport(U.exportPackageType?.value || "full");
      });
      U.runTruthValidateBtn?.addEventListener("click", validateTruthCubeParity);
      U.runTemplateBatchBtn?.addEventListener("click", runTemplateBatchExport);
      U.runImageExportBtn?.addEventListener("click", runImageExport);
    }

    return {
      downloadTemplateAsset,
      downloadTemplate,
      openExportModal,
      closeExportModal,
      syncExportModalState,
      bindExportUI,
      runPackageExport,
      validateTruthCubeParity,
    };
  }

  window.KataCartExport = { createExportModule };
})();
