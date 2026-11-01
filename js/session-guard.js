(function () {
  function createSessionGuard({ target = window } = {}) {
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
        })),
      });
    }

    function trackCartEdit(c, edit) {
      if (changed || !c) return edit();
      const before = snapshot(c);
      try {
        return edit();
      } finally {
        if (snapshot(c) !== before) markChanged();
      }
    }

    // Downloads are not a restorable project save, so they never clear this flag.
    return { markChanged, trackCartEdit, hasChanges: () => changed };
  }

  window.KataCartSessionGuard = { createSessionGuard };
})();
