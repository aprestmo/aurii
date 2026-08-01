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

They **coexist**. Do not invent a second tenancy model or a “Product Runtime” to merge them prematurely. Phase 4 may add SDK helpers to load manifests; documentation stays honest about two files until a later consolidation.

```text
product.yaml          →  what modules ship as this product
aurii.config.ts       →  how to bind and operate the project in Core/Studio
Core Project + Dataset →  runtime boundaries those files target
```

---

## Typical developer flow

1. Clone or create a project package with `aurii.config.ts`.
2. Ensure a Core Project exists for `core.projectSlug` (and dataset for `defaultDataset`).
3. Import / register schemas and run imports (`bun run import:norwegian-geo` for the reference vertical).
4. Start Core (`bun run serve`).
5. Register package resources (sources, saved imports, routes) against the running API:

   ```bash
   AURII_CORE_URL=http://localhost:3000 bun run demo/norwegian-geo/scripts/register-via-api.ts
   ```

6. Run Studio locally with env vars pointing at Core + project package:

   ```bash
   AURII_CORE_URL=http://localhost:3000 \
   AURII_PROJECT_SLUG=norge-data \
   AURII_DEFAULT_DATASET=norwegian-geo \
   AURII_PROJECT_ROOT=demo/norwegian-geo \
   bun run studio
   ```

   Studio loads `defineStudio` from the package when `AURII_PROJECT_ROOT` is set.

Frontends consume Core published routes or the Query API via `@aurii/sdk` — not Studio.

### Platform persistence

When `AURII_DB_PATH` points at a SQLite file, Core stores DataSources, saved imports, published route state, project tokens, secrets, and audit events in the same database (`SqlitePlatformStore`). In-memory mode (`:memory:` / tests) keeps an ephemeral store.

---

## Related documents

- [PRODUCT_MODEL.md](PRODUCT_MODEL.md)
- [Studio.md](Studio.md)
- [PROJECTS.md](PROJECTS.md)
- [ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)
- [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)
