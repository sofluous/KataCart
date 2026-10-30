# Extracted reference textures

The optional command is `python tools/extract-reference-textures.py` from the repository root, with Pillow and psd-tools installed. It currently expects repository `_reference/`, which is absent after workspace reorganization; originals are in outer `../_reference/`. Review source/output paths before running it. Existing PNGs do not require regeneration to serve the app or run tests.
The script preserves source resolution, transparency and original reference files.
`manifest.json` records source paths, exact crop bounds, output sizes and model suitability.
`inventory.json` records PSD layers and effective visibility. `contact-sheet.jpg` previews sources.

- `gamecube`: front/back/spine overlays from the transparent Shenske PNG; maps to `gamecube-case`.
- `ps2-ketaros`: front/back/spine from the saved PSD composite; maps to `ps2-case`. Gray background is retained as authored.
- `ps2-juanky`: alternate transparent cover layout, with outer canvas margins removed. Maps to `ps2-case`; seams should receive a model preview check.
- `ps1-shenske`: extracted tall layout for review. Its proportions do not match the current PS1 jewel case. Do not auto-assign.
- `ps1-case`: jewel-case scan artwork split into faces. Contains plastic borders, photographed shading and low-resolution details; review before using as surface textures. Crop boundaries are approximate visual divisions.
- `psp-retail`: retail box cover layout. Requires a retail-case model; the current `psp-umd` models the smaller UMD shell.
- `disc`: photographic reflective underside, not printed disc-label artwork. Preserve as a separate reference; no new disc material slot is added.

Face filenames match KataCart asset IDs: `cover_front`, `cover_back`, `spine`, `disc_art`.
Four dedicated gallery samples load automatically: GameCube (Shenske), PS2 (Ketaros), PS2 (Juanky), and PS1 jewel-case scans. Each sample loads its front, back and spine PNGs onto the matching model. Existing sample carts are preserved. Face transforms stretch each extracted panel to its full target surface, including the wider PS1 model spine. These samples demonstrate the provided case artwork; they do not add branding overlays to user-created carts.

The tall PS1 PSD, PSP retail-case layout and reflective disc underside remain unassigned because they do not match the current model/surface definitions. Transparent overlays will need a background/artwork compositing step to preserve user artwork beneath them.
Sources contain third-party logos and author-provided sample/legal text. Original filenames and attribution are retained in the manifest; redistribution permissions have not been established.
