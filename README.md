# KataCart

The model preview and workspace camera widget now sit inside the canvas in a collapsible overlay. Status feedback sits in the header so the canvas and properties dock use the full remaining height. Undo/Redo supports current cart metadata, artwork replacement/transforms and model transforms, with per-cart history capped at 50 steps and grouped drag/slider gestures. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work outside text inputs; inputs retain native editing shortcuts. History is session-only and is not a save/recovery feature.

Rendering foundation: `js/face-compositor.js` exposes the existing face image as one read-only layer descriptor and shares its paint/composition functions with selected artwork, mapped previews and image exports. Current face/image/transform storage and legacy transform units are preserved; this does not yet add multiple editable layers.

Create Cart now separates the physical cart type from its compatible artwork template. Blank is always available; PS2 offers Ketaros/Juanky, GameCube offers Shenske, and PS1 offers the jewel-case scan. Reference variants include front/back/spine only, not disc artwork. They apply only to newly created carts; loading failures or cancellation do not add partial carts. Source and attribution notes remain in `textures/reference/README.md`.

The workspace uses docked Surfaces/Artwork on the left and full-height Properties on the right, with Artwork/Model/UV view buttons above the canvas and preview/camera inside it. Artwork is still one object per printable surface; multi-layer tools and surface/reverse fills are later milestones.

Optional browser check: with `playwright-core` resolvable and Microsoft Edge installed, run `node tests/editor-shell.browser.cjs`. Set `KATACART_PLAYWRIGHT` to a module path for an external tools installation; `KATACART_SCREENSHOT` optionally writes a desktop screenshot. This harness starts/stops its own local server and checks dock geometry, surface rows, view switching, collapse, three-theme geometry and compact switching. It is separate from the dependency-free Node suite.

Browser editor for cartridge/case artwork, face assignment, 2D placement, 3D previews, and exports. Editing/cart artwork is session-local; saved view preferences do not restore a complete edited project. Export work before leaving the session.

Creating a cart or changing its metadata, artwork or transforms enables the browser's leave/reload warning. View-only controls and automatic sample loading do not. Exports currently produce outputs rather than a project that can be reopened, so exporting does not clear the warning. Browsers control the prompt text and may suppress it, especially without prior interaction or on mobile shutdown; the warning is not a backup.

Serve this directory over HTTP and open `index.html`. With Python 3 available, from this directory:

```text
python -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`; stop with Ctrl+C. Keep relative runtime paths intact. No build or package installation is needed to serve the existing app.

With Node.js available (validated with Node 24.14.1), run from this directory:

```text
node --test tests/sample-bootstrap.test.cjs tests/ui-cleanup.test.cjs
```

This checks real reference PNG loading, missing-file handling, upload races, literal cart names, idle redraws, wobble scheduling, UV menu availability, keyboard selection and drawer focus/Escape behavior. UI checks use lightweight DOM stand-ins; they do not validate browser layout or actual downloads. Use `node --check js/CHANGED_FILE.js` for changed modules. There is no configured build/lint command. Browser interaction, WebGL output, and export workflows require separate manual/browser checks.

| Path | Ownership |
| --- | --- |
| `index.html`, `js/`, `design-system/` | Application shell, active modules, theme assets |
| `test/` | Runtime starter artwork requested by sample-bootstrap; retain in delivery |
| `textures/reference/` | Runtime reference PNGs and provenance; current tests read these PNGs |
| `tests/` | Repository-owned automated regression checks |
| `tools/` | Optional texture extractor; source paths need review before regeneration |

Artwork surfaces support session-local image layers: add, replace the selected image through the existing upload action, duplicate, rename, show/hide, set opacity, move forward/backward and delete. The top row renders last. Existing transform controls edit the selected visible layer; hidden layers remain selectable in the list for properties. Undo/redo includes layer stacks and transforms.

Layer state and composition live in `js/layer-model.js`, `js/layer-panel.js` and `js/face-compositor.js`. Flattened outputs use the shared composition. JSON layer descriptors are diagnostic output, not a restorable project: uploaded blob URLs and session sources are not persisted. SVG/text layers, wrapping, locking, surface fills and editable project import remain later work.

The [texture guide](textures/reference/README.md) explains source attribution and suitability; redistribution permissions have not been established. Do not assume generated textures are cleared for publication. Extraction needs Pillow/psd-tools and original source files; current script expects `_reference/` inside this repository, while the full local workspace stores it outside. Serving/tests use existing PNGs and do not require the extractor or originals.

See [AGENTS.md](AGENTS.md) for product constraints. Optional local docs live at `../_docs/README.md` and may be absent in clones. No hosting configuration is supplied here; review intended runtime uploads separately from Git ignore rules. Contact sheets/inventory reports are inspection artifacts mixed with runtime textures pending a verified extraction-output cleanup.
