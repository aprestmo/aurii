# Project packages

> Short guide to `aurii.config.ts` and how it relates to product composition.
>
> **Status:** beta (Phase 4). Decision: [ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md).

---

## What a project package is

A **project package** is a versioned set of files that describe how to install and operate a project against Aurii Core:

- schemas
- DataSources
- saved import definitions
- sync definitions (scheduled refresh)
- published routes
- Studio configuration

The entry file is `aurii.config.ts` (or `.js`), exported via `defineProject()` from `@aurii/core`.

It is **not**:

- a Core Project row (that is runtime tenancy — UUID + slug)
- a Product (`product.yaml` shipping composition)
- a Dataset (storage/query boundary)

See [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md) for the full distinction.

---

## Minimal shape

```ts
import { defineProject } from "@aurii/core";

export default defineProject({
  id: "norwegian-geo",
  title: "Norwegian Geo",
  description: "Norwegian reference geodata",
  core: {
    projectSlug: "norge-data",       // Core Project slug
    defaultDataset: "norwegian-geo", // Dataset within that project
  },
  schemas: ["./core/schemas/county.yaml", /* … */],
  sources: ["./sources/kartverket.ts", "./sources/bring.ts"],
  imports: ["./imports/counties.ts", /* … */],
  sync: ["./sync/postal-codes-nightly.ts"],
  routes: ["./routes/counties.ts", /* … */],
  studio: "./studio/studio.config.ts",
});
```

`version: 1` is applied by `defineProject`. Paths are relative to the package root. Invalid or duplicate references fail at load/validate time ([ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)).

Reference package: `demo/norwegian-geo/aurii.config.ts`.

---

## `defineProject` / `defineStudio` / `defineRoute`

| Helper | Package | Declares |
|--------|---------|----------|
| `defineProject` | `@aurii/core` | Package entry: link to Core + file lists |
| `defineStudio` | `@aurii/studio` | Navigation, collections, custom views |
| `defineRoute` | `@aurii/core` | Published route definition (path, method, declarative query) |

**Definition vs state:** route *definitions* live in project files; *activation* (enabled, access, cache TTL) is Core-side ([ADR-0016](../adr/ADR-0016%20—%20Published%20Routes.md)). Studio can change state; it does not invent query semantics.

DataSources and schedules are declared/linked through sources and import/sync definition files ([ADR-0015](../adr/ADR-0015%20—%20DataSource%20Model.md), [ADR-0018](../adr/ADR-0018%20—%20Minimal%20Scheduling.md)).

---

## Relationship to `product.yaml`

| | `aurii.config.ts` | `product.yaml` |
|--|-------------------|----------------|
| Purpose | Installable project config for Core + Studio | Shipping product composition (modules, layers, consumers) |
| Audience | Developers operating a project | Product authors documenting module graph |
| Links to | Core Project slug + default dataset | Dataset id, module list, `dependsOn` |
| Norwegian Geo | Present (beta) | Present (canonical composition) |

They **coexist**. There is **no** Core “Product” runtime object and no second tenancy model. Do not write an ADR to promote Product into Core unless a later phase proves that need in more than one shipping product.

```text
product.yaml          →  what modules ship as this product (CLI import order)
aurii.config.ts       →  how to bind and operate the project in Core/Studio
Core Project + Dataset →  runtime boundaries those files target
```

### When a schema belongs where

| Schema kind | `product.yaml` / `module.yaml` / `lib/manifest.ts` | `aurii.config.ts` `schemas:` | `defineStudio` |
|-------------|----------------------------------------------------|------------------------------|----------------|
| Core reference (county, municipality, postal-code) | Yes — composition + CLI import | Yes — package install set | Yes — featured collections |
| Shipped dataset module (school, hospital, public-holiday) | Yes — module list + CLI import | **No** — YAML stays in the module | Yes — ops collections |
| Planned / future module | `futureModules` only | No | No |

**Rule:** `aurii.config.ts` `schemas:` is the project-package install set (what `loadProjectPackage` validates as package-owned schema files). Dataset-module schema YAML is owned by the product manifest so CLI import order stays one graph. Studio still operates shipped modules: list their **sources**, **saved imports**, and **collections** in the package.

Norwegian Geo decision (N3.2): education, health, and calendar are **Studio-operable**. They are not CLI-only. Planned modules in `futureModules` stay documentation until implemented.

### Adding a shipped, operable module (Norwegian Geo)

1. Create `modules/<id>/` with `module.yaml`, schemas, imports, and `data/`.
2. Declare the module in `product.yaml` and `lib/manifest.ts` (CLI import order / `dependsOn`).
3. Add source + saved-import descriptors under `sources/` and `imports/`; list them in `aurii.config.ts`.
4. Add Studio collections and `importGroups` in `studio/studio.config.ts`.
5. Extend `scripts/fetch.ts` if the module has a live API source.
6. `bun run import:norwegian-geo` then `bun run register:norwegian-geo-platform`.

A planned module only needs a `futureModules` entry until those files exist.

---

## `loadProjectPackage` / `registerProjectPackage`

| Helper | Package | Role |
|--------|---------|------|
| `loadProjectPackage(root)` | `@aurii/core` | Load and validate `aurii.config.ts` |
| `materializeProjectPackage(pkg)` | `@aurii/core` | Resolve source/import/route payloads |
| `registerProjectPackage({ root, coreUrl, token })` | `@aurii/core` | HTTP bind into a running Core (idempotent) |
| `applyProjectPackage({ pkg, projectId, … })` | `@aurii/core` | In-process bind for tests / bootstrap |

CLI scripts are thin wrappers. Do not copy register loops into new product scripts.

```ts
import { registerProjectPackage } from "@aurii/core";

await registerProjectPackage({
  root: "demo/norwegian-geo",
  coreUrl: process.env.AURII_CORE_URL ?? "http://localhost:3000",
  token: process.env.AURII_API_TOKEN,
});
```

---

## Typical developer flow

1. Clone or create a project package with `aurii.config.ts`.
2. Ensure a Core Project exists for `core.projectSlug` (and dataset for `defaultDataset`).
3. Import / register schemas and run imports (`bun run import:norwegian-geo` for the reference vertical).
4. Start Core (`bun run serve`).
5. Register package resources (sources, saved imports, routes) against the running API:

   ```bash
   AURII_CORE_URL=http://localhost:3000 bun run register:norwegian-geo-platform
   ```

   That script calls `registerProjectPackage` from `@aurii/core`.

6. Run Studio locally with env vars pointing at Core + project package:

   ```bash
   AURII_CORE_URL=http://localhost:3000 \
   AURII_PROJECT_SLUG=norge-data \
   AURII_DEFAULT_DATASET=norwegian-geo \
   AURII_PROJECT_ROOT=demo/norwegian-geo \
   bun run studio
   ```

   Studio loads `defineStudio` from the package when `AURII_PROJECT_ROOT` is set.

Frontends consume Core published routes or the Query API via `@aurii/sdk` — not Studio. Contract: [`DELIVERY.md`](DELIVERY.md).

### Platform persistence

Platform ops (DataSources, saved imports, published route state, project tokens, secrets, audit) persist in:

- `PostgresPlatformStore` when `DATABASE_URL` is the primary ops database (unless `AURII_PLATFORM_STORE=sqlite` or `AURII_DB_PATH=:memory:`)
- `SqlitePlatformStore` when `AURII_DB_PATH` is a file and Postgres is not selected
- in-memory store for `:memory:` / tests (`AURII_PLATFORM_STORE=memory`)

Secrets stay server-side. HA multi-node scheduling remains out of beta.

---

## Related documents

- [PRODUCT_MODEL.md](PRODUCT_MODEL.md)
- [DELIVERY.md](DELIVERY.md)
- [Studio.md](Studio.md)
- [PROJECTS.md](PROJECTS.md)
- [ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)
- [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)
