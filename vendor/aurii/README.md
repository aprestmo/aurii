# Vendored Aurii package tarballs

These are packed `@aurii/*` artifacts (`bun run pack:packages` from [aprestmo/aurii](https://github.com/aprestmo/aurii)), **not** Aurii source.

This is **temporary infrastructure** until Aurii packages are published to a registry. It exists so this repository can be cloned and installed **without**:

- a sibling Aurii checkout
- `workspace:*`
- `bun link` / `npm link`
- copying Aurii Core source into this product

Root `package.json` pins every public package with `overrides` (`file:./vendor/aurii/*.tgz`) so transitive `@aurii/*` versions also resolve here instead of npm.

## Refresh / upgrade

From a checkout of [aprestmo/aurii](https://github.com/aprestmo/aurii) that you intend to consume:

```bash
# in aurii
bun run pack:packages
```

Then, from this repository:

```bash
# AURII_PACK_DIR may be an absolute path to aurii/.tmp/packs
AURII_PACK_DIR=/path/to/aurii/.tmp/packs bun run refresh:aurii
bun install
```

`scripts/refresh-aurii-packages.ts` copies the packed tarballs and rewrites root `overrides` if versions changed. Commit the updated `vendor/aurii/` files, `package.json`, and `bun.lock`.

When `@aurii/sdk`, `@aurii/core`, `@aurii/studio`, and the supporting packages are on a registry, replace `overrides` with semver and delete this directory.
