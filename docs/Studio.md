# Studio

> Studio is Aurii’s **project workspace** — a client of the Runtime, not the platform.
>
> It is a data operations UI for projects: sources, imports, schedules, entities, queries, and published routes.
>
> It is **not** a CMS and **not** an editorial authoring editor.
>
> **Status:** project-oriented Studio is **beta** (Phase 4). A future CMS product is separate ([ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)).
>
> Product boundaries: [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md). Extension model: [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md).

---

## Purpose

Studio makes the Runtime operable for humans working on a **project package**.

Everything available inside Studio should ultimately be available through the Runtime.

Studio never contains business logic. It visualizes and operates what Core already defines.

Frontends never read through Studio.

---

## Three layers

Studio is composed of three layers ([ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)):

```text
1. Generic Studio runtime     apps/studio  →  @aurii/studio-app
2. Declarative project config               →  defineStudio() in @aurii/studio
3. Optional custom views                    →  simple view registry (module paths)
```

| Layer | Package / location | Responsibility |
|-------|--------------------|----------------|
| **1. Runtime** | `apps/studio` (`@aurii/studio-app`) | Generic Astro UI; talks to Core via `@aurii/sdk` only |
| **2. Config** | `@aurii/studio` + project `studio.config.ts` | Navigation, collections, featured schemas, import/route groups, dashboards |
| **3. Custom views** | Project modules (optional) | Domain-specific pages (maps, coverage, …) using SDK/public APIs |

Projects depend on `@aurii/studio` for config without pulling the full UI. The app package is `@aurii/studio-app`.

---

## Default experience (no config)

Without a `defineStudio` config, Studio still works. Default navigation covers:

- Project overview / dashboard
- Dataset switcher
- Schemas
- Entities
- Sources
- Imports (wizard + saved definitions / history)
- Published API routes
- Query playground
- System status

Config customizes labels, grouping, featured schemas, and custom views. It does not replace Core behavior.

---

## Not a CMS

| Studio is | Studio is not |
|-----------|----------------|
| A project data workspace | A content management system |
| Import / sync / schedule ops | A newsroom or blog editor |
| Schema-aware browsing and query | Draft / preview / publish workflow UI |
| Enable/disable published routes | The delivery layer for frontends |

Authoring, revision, and publishing UIs belong to a **future separate product**, not to renaming Studio. See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

## Philosophy

Aurii is Runtime-first. Studio is built like any other application:

```text
Studio  →  public APIs / SDK  →  Aurii Core  →  storage
```

Studio never talks directly to storage.

Studio never bypasses APIs.

Studio never owns domain rules.

---

## Surfaces (beta)

| Surface | What operators do |
|---------|-------------------|
| **Sources** | Inspect DataSources (provenance, status, linked definitions) |
| **Imports** | Run wizard uploads; manage saved import definitions; dry-run vs commit |
| **History** | Review import/sync runs, errors, inserted/updated/skipped counts |
| **Schedules** | Enable/disable cron on sync/import definitions; see next run |
| **Published routes** | Inspect declared routes; enable/disable; access mode (Core serves them) |
| **Entities** | Browse and filter entities for the active dataset |
| **Query** | Run and explain Query Language |
| **System** | Connection, project/dataset, runtime health signals |

Schemas remain inspectable. Navigation may group collections by schema via `defineStudio`.

---

## Local and hosted runs

### Local development

```bash
bun run serve                  # Core API (default :3000)

AURII_CORE_URL=http://localhost:3000 \
AURII_PROJECT_SLUG=norge-data \
AURII_DEFAULT_DATASET=norwegian-geo \
AURII_PROJECT_ROOT=demo/norwegian-geo \
bun run studio                 # → @aurii/studio-app dev
```

### Static / hosted build

```bash
AURII_CORE_URL=https://api.example.com \
AURII_PROJECT_SLUG=norge-data \
AURII_DEFAULT_DATASET=norwegian-geo \
bun run studio:build           # static output for hosting
```

### Environment variables

| Variable | Meaning |
|----------|---------|
| `AURII_CORE_URL` / `PUBLIC_AURII_CORE_URL` | Core API base URL (default `http://localhost:3000`) |
| `AURII_PROJECT_SLUG` / `PUBLIC_AURII_PROJECT_SLUG` | Core Project slug to bind |
| `AURII_DEFAULT_DATASET` / `PUBLIC_AURII_DEFAULT_DATASET` | Default dataset id |
| `AURII_PROJECT_ROOT` | Optional path to project package (loads `studio/studio.config.ts` by convention) |
| `AURII_STUDIO_CONFIG` | Optional explicit path to a `defineStudio` module (overrides convention) |

**Do not embed API tokens or secrets in public Studio builds.** Auth tokens stay in the browser session / localStorage after login, not in the static asset bundle.

Browser connection keys (login UI): `aurii.apiUrl`, `aurii.token`, `aurii.dataset`.

---

## Declarative config (`defineStudio`)

From `@aurii/studio`, projects export something like:

```ts
import {
  defineStudio,
  collection,
  sources,
  imports,
  apiRoutes,
  customView,
} from "@aurii/studio";

export default defineStudio({
  title: "Norwegian Geo",
  featuredSchemas: ["county", "municipality", "postal-code"],
  navigation: [
    {
      title: "Geography",
      items: [
        collection("county", { columns: ["id", "name"], featured: true }),
        collection("municipality", { columns: ["id", "name", "countyId"] }),
      ],
    },
    { title: "Intake", items: [sources(), imports()] },
    { title: "Delivery", items: [apiRoutes()] },
  ],
  views: [
    {
      id: "coverage",
      title: "Coverage",
      module: "./views/coverage.ts",
    },
  ],
});
```

The project package references this file via `studio:` in `aurii.config.ts`. See [`PROJECT_PACKAGES.md`](PROJECT_PACKAGES.md).

When Studio runs with `AURII_PROJECT_ROOT` (or `AURII_STUDIO_CONFIG`), `@aurii/studio-app` loads the project's `defineStudio` module at SSR/build time — via the package convention `studio/studio.config.ts`, without importing `@aurii/core` into the Studio bundle. Without those env vars, Studio uses the generic default workspace (or a slug-based fallback for known demos).

Config may set:

- Navigation groups and items
- Collection columns / filters / sort
- Hidden or featured schemas
- Import groups and route groups
- Dashboards and custom view registrations

---

## Extension model

Beta uses a **simple view registry**, not a full Plugin Runtime ([ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)).

Rules for custom views:

1. Register via `defineStudio` (`views` + nav `customView(...)`).
2. Use `@aurii/sdk` / public HTTP APIs only.
3. No direct database access.
4. No Core domain logic inside the view module.
5. Isolation is thin (client modules)—sufficient for beta; expand later if needed.

Norwegian Geo example: coverage view under `demo/norwegian-geo/studio/`.

---

## Package split

| Package | Role |
|---------|------|
| `@aurii/studio` | `defineStudio` and helpers — safe for project packages to depend on |
| `@aurii/studio-app` | Astro application in `apps/studio` |

---

## Accessibility, performance, offline

Studio should remain keyboard-friendly and responsive. Large imports and sync runs execute asynchronously with progress feedback. The Runtime remains authoritative if connectivity drops; Studio is not an offline SoR.

Full collaboration, AI copilots, and marketplace plugins are **planned / visionary**, not beta exit criteria.

---

## Guiding principle

Studio should never invent behavior.

It should reveal behavior already defined by:

- Runtime
- Schema Language
- Project package (`defineProject` / `defineRoute`)
- Studio config (`defineStudio`)
- Capability / Pipeline / Query languages

If Studio contains business logic, the architecture has failed.

---

## Related documents

- [PRODUCT_MODEL.md](PRODUCT_MODEL.md)
- [PROJECT_PACKAGES.md](PROJECT_PACKAGES.md)
- [ADR-0017 — Studio Extension Model](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)
- [ADR-0014 — Project Configuration Package](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)
- [ADR-0015 — DataSource Model](../adr/ADR-0015%20—%20DataSource%20Model.md)
- [ADR-0016 — Published Routes](../adr/ADR-0016%20—%20Published%20Routes.md)
- [ADR-0018 — Minimal Scheduling](../adr/ADR-0018%20—%20Minimal%20Scheduling.md)
