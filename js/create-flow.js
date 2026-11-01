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
  }) {
    let returnFocus = null;

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
          S.createTemplateId = t.id;
          U.createCartBtn.disabled = false;
          for (const button of U.createTemplateList.children) {
            button.setAttribute("aria-pressed", String(button.dataset.templateId === t.id));
          }
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
      U.newCartNameInput.focus();
    }

    function closeCreatePanel(restoreFocus = true) {
      if (!S.createOpen) return;
      S.createOpen = false;
      U.createPanel.inert = true;
      U.createPanel.setAttribute("aria-hidden", "true");
      U.createPanel.classList.remove("open");
      S.createTemplateId = null;
      U.createCartBtn.disabled = true;
      renderCreatePanel();
      if (restoreFocus) {
        const target = returnFocus?.isConnected ? returnFocus : U.galleryList.querySelector(".new-cart-btn");
        target?.focus();
      }
      returnFocus = null;
    }

    function submitCreateCart() {
      const tid = S.createTemplateId;
      if (!tid) return;
      const t = tById(tid);
      const name = U.newCartNameInput.value.trim() || `${t.name} Cart`;
      const c = createCart(t, name);
      S.carts.unshift(c);
      markSessionChanged();
      closeCreatePanel(false);
      openWorkspace(c.id);
      U.backToGalleryBtn.focus();
      setStatus(`Created blank cart: ${c.name}.`);
    }

    function bindCreateUI() {
      U.cancelCreateBtn.addEventListener("click", closeCreatePanel);
      U.createCartBtn.addEventListener("click", submitCreateCart);
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
