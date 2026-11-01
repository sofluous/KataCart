# KataCart

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

The [texture guide](textures/reference/README.md) explains source attribution and suitability; redistribution permissions have not been established. Do not assume generated textures are cleared for publication. Extraction needs Pillow/psd-tools and original source files; current script expects `_reference/` inside this repository, while the full local workspace stores it outside. Serving/tests use existing PNGs and do not require the extractor or originals.

See [AGENTS.md](AGENTS.md) for product constraints. Optional local docs live at `../_docs/README.md` and may be absent in clones. No hosting configuration is supplied here; review intended runtime uploads separately from Git ignore rules. Contact sheets/inventory reports are inspection artifacts mixed with runtime textures pending a verified extraction-output cleanup.
