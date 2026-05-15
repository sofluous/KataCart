(function () {
  function createCreateFlow({
    S,
    U,
    TEMPLATES,
    tById,
    createCart,
    openWorkspace,
    setStatus,
  }) {
    function renderCreatePanel() {
      U.createTemplateList.innerHTML = "";
      TEMPLATES.forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "template-card";
        b.setAttribute("aria-selected", String(S.createTemplateId === t.id));
        b.innerHTML = `<strong>${t.name}</strong><span class="muted">${t.family}</span><span class="muted">${t.d.w} x ${t.d.h} x ${t.d.z}mm</span>`;
        b.addEventListener("click", () => {
          S.createTemplateId = t.id;
          U.createCartBtn.disabled = false;
          renderCreatePanel();
        });
        U.createTemplateList.append(b);
      });
    }

    function openCreatePanel() {
      S.createOpen = true;
      U.createPanel.classList.add("open");
      renderCreatePanel();
    }

    function closeCreatePanel() {
      S.createOpen = false;
      U.createPanel.classList.remove("open");
      S.createTemplateId = null;
      U.createCartBtn.disabled = true;
      renderCreatePanel();
    }

    function submitCreateCart() {
      const tid = S.createTemplateId;
      if (!tid) return;
      const t = tById(tid);
      const name = U.newCartNameInput.value.trim() || `${t.name} Cart`;
      const c = createCart(t, name);
      S.carts.unshift(c);
      closeCreatePanel();
      openWorkspace(c.id);
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
