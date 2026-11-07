(function () {
  function createEditHistory({ limit = 50, onChange = () => {} } = {}) {
    const histories = new WeakMap();
    let active = null;
    const copy = (value, key) => key === "layers" ? value.map((l) => ({ ...l, transform: { ...l.transform } })) : value && typeof value === "object" ? { ...value } : value;
    const same = (key, a, b) => key === "image" ? a === b : key === "layers"
      ? a.length === b.length && a.every((l, i) => l.source === b[i].source && JSON.stringify({ ...l, source: null }) === JSON.stringify({ ...b[i], source: null }))
      : JSON.stringify(a) === JSON.stringify(b);
    function state(c) {
      if (!histories.has(c)) histories.set(c, { undo: [], redo: [] });
      return histories.get(c);
    }
    function capture(c) {
      const fields = ["name", "notes", "tags", "sku", "modelTr"].map((key) => ({ target: c, key, value: copy(c[key]) }));
      for (const face of c.assets) {
        if (Array.isArray(face.layers)) {
          fields.push({ target: face, key: "layers", value: copy(face.layers, "layers") });
          fields.push({ target: face, key: "activeLayerId", value: face.activeLayerId });
          continue;
        }
        fields.push({ target: face, key: "image", value: face.image });
        fields.push({ target: face, key: "tr", value: copy(face.tr) });
      }
      return fields;
    }
    function push(c, patches) {
      patches = patches.filter((p) => !same(p.key, p.before, p.after));
      if (!patches.length) return;
      const h = state(c);
      h.undo.push(patches);
      if (h.undo.length > limit) h.undo.shift();
      h.redo.length = 0;
    }
    function commit() {
      if (!active) return;
      push(active.cart, active.patches);
      active = null;
      onChange();
    }
    function begin(c) {
      if (!c || active?.cart === c) return;
      commit();
      active = { cart: c, patches: [] };
    }
    function record(c, edit) {
      if (!c) return edit();
      // Capture only this synchronous edit; background sample loads are not history.
      const before = capture(c);
      try { return edit(); }
      finally {
        const patches = before.filter((p) => !same(p.key, p.value, p.target[p.key])).map((p) => ({ target: p.target, key: p.key, before: p.value, after: p.key === "image" ? p.target[p.key] : copy(p.target[p.key], p.key) }));
        if (active?.cart === c) {
          for (const patch of patches) {
            const existing = active.patches.find((p) => p.target === patch.target && p.key === patch.key);
            if (existing) existing.after = patch.after;
            else active.patches.push(patch);
          }
        } else push(c, patches);
        onChange();
      }
    }
    function apply(c, direction) {
      commit();
      if (!c) return false;
      const h = state(c), from = h[direction], patches = from.pop();
      if (!patches) return false;
      for (const p of patches) p.target[p.key] = p.key === "image" ? p[direction === "undo" ? "before" : "after"] : copy(p[direction === "undo" ? "before" : "after"], p.key);
      h[direction === "undo" ? "redo" : "undo"].push(patches);
      onChange();
      return true;
    }
    return {
      begin, commit, record,
      undo: (c) => apply(c, "undo"), redo: (c) => apply(c, "redo"),
      canUndo: (c) => !!c && (!!state(c).undo.length || (active?.cart === c && active.patches.length > 0)),
      canRedo: (c) => !!c && !!state(c).redo.length,
    };
  }
  window.KataCartEditHistory = { createEditHistory };
})();
