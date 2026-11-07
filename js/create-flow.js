(function () {
  function createCreateFlow({
    S,
    U,
    TEMPLATES,
    tById,
    createCart,
    openWorkspace,
    setStatus,
    markSessionChanged = () => {},
    variantsFor = () => [{ id: "blank", name: "Blank - no artwork", faces: [] }],
    applyVariant = async () => {},
  }) {
    let returnFocus = null;
    let creating = false;
    let requestId = 0;

    function renderVariants() {
      S.createVariantId = "blank";
      if (!U.createVariantSelect) return;
      U.createVariantSelect.innerHTML = "";
      for (const variant of variantsFor(S.createTemplateId)) {
        const option = document.createElement("option");
        option.value = variant.id;
        option.textContent = variant.name;
        U.createVariantSelect.append(option);
      }
      U.createVariantSelect.value = "blank";
      U.createVariantSelect.disabled = !S.createTemplateId || creating;
      syncVariantSummary();
    }

    function syncVariantSummary() {
      const variant = variantsFor(S.createTemplateId).find((v) => v.id === S.createVariantId);
      if (U.createVariantSummary) U.createVariantSummary.textContent = variant?.faces.length
        ? "Includes front, back and spine. Disc artwork is not included. Reference sources/attribution are retained in textures/reference/README.md."
        : "Start with empty surfaces and add your own artwork.";
    }

    function setCreating(value) {
      creating = value;
      U.createCartBtn.disabled = value || !S.createTemplateId;
      U.createCartBtn.textContent = value ? "Loading artwork..." : "Create Cart";
      U.newCartNameInput.disabled = value;
      if (U.createVariantSelect) U.createVariantSelect.disabled = value || !S.createTemplateId;
      for (const button of U.createTemplateList.children) button.disabled = value;
    }

    function renderCreatePanel() {
      U.createTemplateList.innerHTML = "";
      TEMPLATES.forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "template-card";
        b.dataset.templateId = t.id;
        b.setAttribute("aria-pressed", String(S.createTemplateId === t.id));
        b.innerHTML = `<strong>${t.name}</strong><span class="muted">${t.family}</span><span class="muted">${t.d.w} x ${t.d.h} x ${t.d.z}mm</span>`;
        b.addEventListener("click", () => {
          if (creating) return;
          S.createTemplateId = t.id;
          U.createCartBtn.disabled = false;
          for (const button of U.createTemplateList.children) {
            button.setAttribute("aria-pressed", String(button.dataset.templateId === t.id));
          }
          renderVariants();
        });
        U.createTemplateList.append(b);
      });
    }

    function openCreatePanel() {
      if (S.createOpen) return;
      returnFocus = document.activeElement;
      S.createOpen = true;
      U.createPanel.inert = false;
      U.createPanel.setAttribute("aria-hidden", "false");
      U.createPanel.classList.add("open");
      renderCreatePanel();
      renderVariants();
      U.newCartNameInput.focus();
    }

    function closeCreatePanel(restoreFocus = true) {
      if (!S.createOpen) return;
      requestId++;
      S.createOpen = false;
      U.createPanel.inert = true;
      U.createPanel.setAttribute("aria-hidden", "true");
      U.createPanel.classList.remove("open");
      S.createTemplateId = null;
      U.createCartBtn.disabled = true;
      renderCreatePanel();
      setCreating(false);
      renderVariants();
      if (restoreFocus) {
        const target = returnFocus?.isConnected ? returnFocus : U.galleryList.querySelector(".new-cart-btn");
        target?.focus();
      }
      returnFocus = null;
    }

    async function submitCreateCart() {
      if (creating) return;
      const tid = S.createTemplateId;
      if (!tid) return;
      const t = tById(tid);
      const name = U.newCartNameInput.value.trim() || `${t.name} Cart`;
      const c = createCart(t, name);
      const variantId = S.createVariantId || "blank";
      const pendingId = ++requestId;
      setCreating(true);
      try {
        if (variantId !== "blank") await applyVariant(c, variantId);
        if (pendingId !== requestId || !S.createOpen) return;
        S.carts.unshift(c);
        markSessionChanged();
        closeCreatePanel(false);
        openWorkspace(c.id);
        U.backToGalleryBtn.focus();
        setStatus(`Created ${variantId === "blank" ? "blank cart" : "cart from artwork template"}: ${c.name}.`);
      } catch (error) {
        if (pendingId === requestId && S.createOpen) {
          setStatus(`Could not load artwork template: ${error.message}`);
          if (U.createVariantSummary) U.createVariantSummary.textContent = "Artwork could not be loaded. Retry, choose another template, or choose Blank.";
        }
      } finally {
        if (pendingId === requestId) setCreating(false);
      }
    }

    function bindCreateUI() {
      U.cancelCreateBtn.addEventListener("click", closeCreatePanel);
      U.createCartBtn.addEventListener("click", submitCreateCart);
      U.createVariantSelect?.addEventListener("change", () => {
        S.createVariantId = U.createVariantSelect.value;
        syncVariantSummary();
      });
    }

    return {
      openCreatePanel,
      closeCreatePanel,
      renderCreatePanel,
      bindCreateUI,
    };
  }

  window.KataCartCreateFlow = {
    createCreateFlow,
  };
})();
