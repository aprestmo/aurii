# Provenance

This repository was extracted from [aprestmo/aurii](https://github.com/aprestmo/aurii).

Phase 4 proved Norwegian Geo inside the Aurii monorepo (`apps/geo`, `demo/norwegian-geo`). Aurii PR [#66](https://github.com/aprestmo/aurii/pull/66) specified the standalone consumer shape; that PR merged into a stacked branch rather than `main`, so this tree was reconstructed from current Aurii `main` plus that specification.

## History-preserving extract

```bash
git clone --no-local <aurii> /tmp/norwegian-geo-extract
cd /tmp/norwegian-geo-extract
git filter-repo --force \
  --path demo/norwegian-geo \
  --path apps/geo \
  --path-rename demo/norwegian-geo:project \
  --path-rename apps/geo:apps/web
```

Then a standalone workspace commit added:

- root `package.json` / `bun.lock` (no `workspace:*` on `@aurii/*`)
- `vendor/aurii/*.tgz` + `overrides` (interim until registry publish)
- public-package imports instead of `../../../packages/...`
- repo-local paths instead of `apps/geo` / `demo/norwegian-geo` / Aurii `REPO_ROOT`
- CI and GitHub Pages workflows owned by this repository

Useful product history from the Aurii commits that touched those paths is retained.

## Remaining manual setting

GitHub Pages: **Settings → Pages → Source = GitHub Actions**. Base path is `/norwegian-geo/`.
