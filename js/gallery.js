(function () {
  function createGallery(deps) {
    const {
      S,
      U,
      tById,
      openWorkspace,
      openCreatePanel,
      openContextMenu,
      syncSettingsControls,
    } = deps;

    function gallerySummary(cart) {
      const template = tById(cart.templateId);
      const filled = cart.assets.filter((asset) => asset.type === "2d" && !!asset.image).length;
      const total = cart.assets.filter((asset) => asset.type === "2d").length;
      return { template, filled, total };
    }

    function galleryThumb(cart) {
      const preferred = ["cover_front", "label_front", "cover_back", "disc_art", "spine"];
      for (const id of preferred) {
        const asset = cart.assets.find((item) => item.id === id && item.type === "2d" && item.image?.src);
        if (asset?.image?.src) return { src: asset.image.src, label: asset.label };
      }
      const fallback = cart.assets.find((item) => item.type === "2d" && item.image?.src);
      if (fallback?.image?.src) return { src: fallback.image.src, label: fallback.label };
      return null;
    }

    function galleryPlaceholderMeta(template) {
      const byTemplate = {
        "cd-jewel": {
          icon: "iconoir-compact-disc",
          title: "CD Jewel Case",
          subtitle: "Disc case template",
        },
        "ps1-jewel": {
          icon: "iconoir-compact-disc",
          title: "PS1 Jewel Case",
          subtitle: "PlayStation disc case",
        },
        "ps2-case": {
          icon: "iconoir-gamepad",
          title: "PS2 Case",
          subtitle: "PlayStation 2 case",
        },
        "gamecube-case": {
          icon: "iconoir-gamepad",
          title: "GameCube Case",
          subtitle: "Nintendo optical case",
        },
        "psp-umd": {
          icon: "iconoir-headset",
          title: "PSP UMD",
          subtitle: "Portable disc media",
        },
        "gameboy-cart": {
          icon: "iconoir-gamepad",
          title: "Game Boy Cart",
          subtitle: "Handheld cartridge",
        },
        "sd-card": {
          icon: "iconoir-sd-card",
          title: "SD Card",
          subtitle: "Storage media",
        },
        "mini-dv": {
          icon: "iconoir-multiple-pages-empty",
          title: "MiniDV",
          subtitle: "Tape media",
        },
      };
      const templateId = template?.id || "";
      if (byTemplate[templateId]) return byTemplate[templateId];
      const family = (template?.family || "").toLowerCase();
      if (family.includes("disc")) {
        return { icon: "iconoir-compact-disc", title: "Disc Case", subtitle: template?.name || "No Thumbnail" };
      }
      if (family.includes("handheld")) {
        return { icon: "iconoir-gamepad", title: "Handheld Cart", subtitle: template?.name || "No Thumbnail" };
      }
      if (family.includes("storage")) {
        return { icon: "iconoir-sd-card", title: "Storage Media", subtitle: template?.name || "No Thumbnail" };
      }
      if (family.includes("tape")) {
        return { icon: "iconoir-multiple-pages-empty", title: "Tape Media", subtitle: template?.name || "No Thumbnail" };
      }
      return { icon: "iconoir-box", title: "Cartridge", subtitle: template?.name || "No Thumbnail" };
    }

    function galleryTagTone(cart) {
      const tags = String(cart?.tags || cart?.meta?.tags || "")
        .toLowerCase()
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (!tags.length) return "";
      const has = (keyword) => tags.some((tag) => tag === keyword || tag.includes(keyword));
      if (has("retro") || has("vintage")) return "retro";
      if (has("horror") || has("dark")) return "horror";
      if (has("sci") || has("future") || has("cyber")) return "scifi";
      if (has("handheld") || has("portable")) return "handheld";
      return "";
    }

    function renderGallery() {
      U.galleryList.className = `layout-${S.galleryLayout}`;
      U.layoutButtons.forEach((button) =>
        button.classList.toggle("active", button.dataset.layout === S.galleryLayout),
      );
      U.galleryList.innerHTML = "";

      const newCard = document.createElement("article");
      newCard.className = "cart-card new-cart-card";
      newCard.innerHTML = `
        <button class="new-cart-btn" type="button">
          <div class="gallery-thumb">
            <div class="gallery-thumb-placeholder">
              <i class="iconoir-plus-circle"></i>
              <strong>Add Cart</strong>
              <span>Create a blank cartridge slot</span>
            </div>
          </div>
          <div class="cart-meta">
            <strong>New Cartridge</strong>
            <span class="muted">Select template and create</span>
          </div>
        </button>
      `;
      newCard.querySelector("button").addEventListener("click", openCreatePanel);
      newCard.addEventListener("dblclick", openCreatePanel);
      newCard.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openContextMenu(event.clientX, event.clientY, [
          {
            label: "Create New Cart",
            icon: "iconoir-plus-circle",
            action: openCreatePanel,
          },
        ]);
      });
      U.galleryList.append(newCard);

      if (!S.carts.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No carts yet. Start by creating a new cart tile above.";
        U.galleryList.append(empty);
        return;
      }

      S.carts.forEach((cart) => {
        const summary = gallerySummary(cart);
        const thumb = galleryThumb(cart);
        const placeholder = galleryPlaceholderMeta(summary.template);
        const card = document.createElement("article");
        card.className = "cart-card";
        if (S.gallerySelectedId === cart.id) card.classList.add("is-selected");
        const tagTone = galleryTagTone(cart);
        if (tagTone) card.dataset.tagTone = tagTone;
        card.setAttribute("data-family", summary.template.family || "");
        card.tabIndex = 0;
        card.innerHTML = `
          <div class="gallery-thumb">
            ${
              thumb
                ? `<div class="gallery-thumb-media"></div>`
                : `<div class="gallery-thumb-placeholder"><i class="${placeholder.icon}"></i><strong>${placeholder.title}</strong><span>${placeholder.subtitle}</span></div>`
            }
          </div>
          <div class="cart-meta">
            <strong>${cart.name}</strong>
            <span class="muted">${summary.template.name}</span>
            <span class="muted">${summary.filled}/${summary.total} 2D assets filled</span>
          </div>
          <div class="gallery-actions">
            <button class="btn" type="button"><i class="iconoir-arrow-right-circle"></i>Open</button>
          </div>
        `;
        if (thumb) {
          const media = card.querySelector(".gallery-thumb-media");
          if (media) media.style.backgroundImage = `url("${thumb.src}")`;
        }
        card.querySelector("button").addEventListener("click", (event) => {
          event.stopPropagation();
          openWorkspace(cart.id);
        });
        card.addEventListener("click", () => {
          S.gallerySelectedId = cart.id;
          renderGallery();
        });
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter") openWorkspace(cart.id);
          if (event.key === " ") {
            event.preventDefault();
            S.gallerySelectedId = cart.id;
            renderGallery();
          }
        });
        card.addEventListener("dblclick", () => openWorkspace(cart.id));
        card.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          S.gallerySelectedId = cart.id;
          renderGallery();
          openContextMenu(event.clientX, event.clientY, [
            {
              label: "Open Workspace",
              icon: "iconoir-arrow-right-circle",
              action: () => openWorkspace(cart.id),
            },
            {
              label: "Select Cart",
              icon: "iconoir-check-circle",
              action: () => {
                S.gallerySelectedId = cart.id;
                renderGallery();
              },
            },
            {
              label: "Create New Cart",
              icon: "iconoir-plus-circle",
              action: openCreatePanel,
            },
          ]);
        });
        U.galleryList.append(card);
      });
    }

    function openGallery() {
      S.screen = "gallery";
      document.body.dataset.screen = "gallery";
      U.galleryScreen.hidden = false;
      U.workspaceScreen.hidden = true;
      syncSettingsControls();
      renderGallery();
    }

    return {
      galleryThumb,
      openGallery,
      renderGallery,
    };
  }

  window.KataCartGallery = {
    createGallery,
  };
})();
