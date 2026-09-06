# Public packages

> Experimental 0.x distribution for external Aurii consumers.
>
> This is **not** a marketplace, license-tier, or pricing document. It records how to pack and publish the packages an independent product actually needs.

Related: [`EXTERNAL_CONSUMERS.md`](EXTERNAL_CONSUMERS.md), [`PROJECT_PACKAGES.md`](PROJECT_PACKAGES.md), [`DELIVERY.md`](DELIVERY.md).

---

## Intended consumer graph

```text
Product frontend (Astro / other)
        │
        └── @aurii/sdk  →  HTTP / published routes  →  Aurii Runtime

Project package (aurii.config.ts, defineStudio, defineRoute)
        │
        ├── @aurii/core
        ├── @aurii/studio
        └── transitive: @aurii/types, @aurii/validation, @aurii/db
```

A product UI must **not** import `@aurii/core` or `@aurii/db`.

Studio is an operator tool. It is not a runtime dependency of a public frontend.

---

## Published surface (experimental)

| Package | Role | Current version |
|---------|------|-----------------|
| `@aurii/sdk` | Typed HTTP / published-route client | 0.1.0 |
| `@aurii/core` | Runtime + `defineProject` / `defineRoute` / `registerProjectPackage` | 0.3.0 |
| `@aurii/studio` | `defineStudio` helpers | 0.1.0 |
| `@aurii/types` | Shared types | 0.1.0 |
| `@aurii/validation` | Shared validation | 0.1.0 |
| `@aurii/db` | Drizzle schema / migrations (Core transitive) | 0.1.0 |

Packages ship TypeScript source and assume a **Bun** consumer. That matches the current monorepo. A compiled JS emit is a later concern, not required for the first external product.

License remains `UNLICENSED` until a public license is chosen. Do not invent Community/Pro/Enterprise tiers here.

---

## Pack locally (no registry credentials)

```bash
bun run pack:packages
# writes .tmp/packs/*.tgz and .tmp/packs/manifest.json
```

The packer:

1. stages each public package
2. rewrites `workspace:*` to concrete versions
3. excludes `__tests__`
4. runs `bun pm pack`

A clean consumer can then depend on the tarballs. Until the packages exist on a registry, pin **all** public tarballs with `overrides` so transitive `@aurii/*` versions do not hit npm:

```json
{
  "dependencies": {
    "@aurii/sdk": "file:../aurii/.tmp/packs/aurii-sdk-0.1.0.tgz",
    "@aurii/core": "file:../aurii/.tmp/packs/aurii-core-0.3.0.tgz",
    "@aurii/studio": "file:../aurii/.tmp/packs/aurii-studio-0.1.0.tgz"
  },
  "overrides": {
    "@aurii/types": "file:../aurii/.tmp/packs/aurii-types-0.1.0.tgz",
    "@aurii/validation": "file:../aurii/.tmp/packs/aurii-validation-0.1.0.tgz",
    "@aurii/db": "file:../aurii/.tmp/packs/aurii-db-0.1.0.tgz",
    "@aurii/core": "file:../aurii/.tmp/packs/aurii-core-0.3.0.tgz",
    "@aurii/sdk": "file:../aurii/.tmp/packs/aurii-sdk-0.1.0.tgz",
    "@aurii/studio": "file:../aurii/.tmp/packs/aurii-studio-0.1.0.tgz"
  }
}
```

Temporary `file:` tarball paths are valid for extraction tooling and for this pack test. They are **not** the committed end-state for `aprestmo/norwegian-geo`. After `bun publish`, the product pins semver and drops `file:` overrides.

CI proves this path in the `external-consumer` job (`tests/pack/pack-public-packages.test.ts`).

---

## Publish (when registry credentials exist)

From a clean `main` with the intended versions already bumped:

```bash
# leaves first
cd packages/types && bun publish --access public
cd ../validation && bun publish --access public
cd ../db && bun publish --access public
cd ../core && bun publish --access public
cd ../sdk && bun publish --access public
cd ../studio && bun publish --access public
```

`bun publish` should rewrite `workspace:*` to the packed version. If a future Bun release does not, use `bun run pack:packages` and publish the rewritten tarballs with `npm publish <tarball>`.

This environment may not hold npm/GitHub Packages credentials. That must not become a reason to keep `workspace:*` in the downstream product.

Until the first registry publish, an external product should pin:

- a released git tag + packed tarball, or
- the published semver once it exists

Do **not** pin `workspace:*`, `bun link`, `npm link`, or a sibling `../aurii` path.

---

## Versioning

0.x is experimental. Breaking changes are allowed while the first external product is extracted. After Norwegian Geo consumes these packages independently, treat `@aurii/sdk` and the project-package exports as the compatibility surface that would break a second product.
