(function () {
  function createSessionGuard({ target = window, history = null } = {}) {
    let changed = false;

    function warnBeforeLeaving(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    function markChanged() {
      if (changed) return;
      changed = true;
      target.addEventListener("beforeunload", warnBeforeLeaving);
    }

    function snapshot(c) {
      return JSON.stringify({
        name: c.name, notes: c.notes, tags: c.tags, sku: c.sku,
        modelTr: c.modelTr,
        assets: c.assets.map((a) => ({
          id: a.id, tr: a.tr,
          image: a.image ? { src: a.image.src, filename: a.image.filename } : null,
          layers: a.layers?.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, transform: l.transform, source: l.source.src })),
        })),
      });
    }

    function trackCartEdit(c, edit) {
      const perform = () => history ? history.record(c, edit) : edit();
      if (changed || !c) return perform();
      const before = snapshot(c);
      try {
        return perform();
      } finally {
        if (snapshot(c) !== before) markChanged();
      }
    }

    // Downloads are not a restorable project save, so they never clear this flag.
    return { markChanged, trackCartEdit, hasChanges: () => changed };
  }

  window.KataCartSessionGuard = { createSessionGuard };
})();
