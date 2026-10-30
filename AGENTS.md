# KataCart Development

Read [README](README.md) for serving, checks, runtime samples, and tooling limitations.

- Preserve template/face/asset identities and the 2D/3D editing/export contracts. Cart artwork and editing state are session-local; preference storage is not full project persistence.
- Runtime code is `index.html` and `js/`. Keep `test/` sample artwork and `textures/reference/` loaded PNGs in their established paths; do not classify them as test-only material by name.
- Required regression checks are in `tests/`; run `node --test tests/sample-bootstrap.test.cjs` from this directory. Check changed JavaScript with `node --check`; syntax checks do not prove rendering, focus, or export behavior. No package/build/lint toolchain is configured.
- `tools/extract-reference-textures.py` is optional, requires Pillow and psd-tools, and currently expects a missing repository `_reference/`. Do not run it until its source/output paths and regeneration checks are reviewed. Keep existing runtime PNGs intact.
- Follow applicable parent instructions when available. Optional local context is at `../_docs/README.md`, absent in standalone clones; serving and current tests must not depend on that folder.
- Preserve existing edits/untracked tests, textures, and tooling; do not stage/reset automatically. Address behavioral audit findings in separately scoped work with regression coverage.
