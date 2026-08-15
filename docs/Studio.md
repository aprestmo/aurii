# Studio

> Studio is Aurii’s **extensible project workspace** — a client of the Runtime, not the platform.
>
> Default experience: schema-generated (or generic) UI for collections and records, plus data operations (sources, imports, schedules, query, published routes).
>
> Architecture: generated UI is the **default**, not the ceiling. Projects may replace field inputs, record editors, collection views, tools, and navigation.
>
> Studio is **not** a publication CMS and **not** an Editorial product. It **may** host domain-specific editors (for example a match desk) as extensions on public APIs.
>
> **Status:** project-oriented Studio is **beta** (Phase 4). Full extension API is **planned** ([ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)). A future CMS product is separate ([ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)).
>
> Product boundaries: [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md). Fitness tests: [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md). Extension model: [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md), [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md).

---

## Purpose

Studio makes the Runtime operable for humans working on a **project package**.

Everything available inside Studio should ultimately be available through the Runtime.

Studio never contains business logic. It visualizes and operates what Core already defines. Domain-specific match desks or map views are **presentation modules** that still call public APIs.

Frontends never read through Studio.

Core must remain fully usable without Studio.

---

## Generated default, replaceable UI

```text
Schema
  ↓
Default generated UI
  ↓
Customizable / replaceable UI
```

Without config or extensions, Studio still works. Schema-generated (or today’s generic) record UI is the **default editor for any entity**—Company, Municipality, Match, Article—not a CMS-only feature.

Projects may progressively replace:

| Extension | Status |
|-----------|--------|
| Navigation, collection columns, featured schemas | **Beta** — `defineStudio` |
| Custom pages / tools (module path) | **Beta** — simple view registry |
| Custom field inputs | **Planned** |
| Custom record editors (replace the entity form) | **Planned** |
| Custom collection views (List, Table, Cards, Map, Custom) | **Planned** |
| Domain-specific workflows on generic Core operations | **Planned** |

Kampbart should be able to ship Score / Lineup / Timeline / Events / Match report **without Core knowing football**. Playgrounds should be able to offer List | Table | Map **without Map becoming a Core type**.

Do not implement those UIs unless that is the assigned task. Do not lock component APIs yet. Do keep Core/Studio changes compatible with this trajectory.

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

## Not a publication CMS

| Studio is | Studio is not |
|-----------|----------------|
| An extensible project workspace | A publication / newsroom CMS |
| Import / sync / schedule ops | The delivery layer for frontends |
| Schema-aware generated UI (default) | The only allowed editing experience |
| Custom editors and views via extensions | Domain logic (football, Gaselle, geo rules) |
| Enable/disable published routes | A required proxy for frontends |

Authoring collaboration, revision UX, preview, and Context belong to a **future separate Editorial product**, not to renaming Studio. Domain tools such as a match desk **do not wait** on that product—they are Studio extensions ([ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)). See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

## Content / Data / Sources (optional lenses)

These are **mental models**, not three Core stores and not a mandated top-level IA:

- **Sources** — external systems and sync (already a Studio surface)
- **Data** — records and datasets (collections, query)
- **Content** — editorial production on the same entities (rich fields, custom editors, future Editorial client)

`defineStudio` may group navigation this way. Default remains schema collections plus ops. Do not force a Content section onto Norwegian Geo.

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
| **Entities** | Browse and filter entities; relation links; default record UI |
| **Query** | Run and explain Query Language |
| **System** | Connection, project/dataset, runtime health signals |

Schemas remain inspectable. Navigation may group collections by schema via `defineStudio`. Collection **views** (table vs map vs custom) are a planned extension of this surface.

Studio should later use Core relations to show **context around a record** (incoming references, related articles, parent municipality)—presentation only.

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

Beta uses a **simple view registry**, not a full Plugin Runtime ([ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)). The planned contract widens that registry to field inputs, record editors, and collection views ([ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)).

Rules for custom views **and** future editors:

1. Register via `defineStudio` (or the successor extension API).
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
- [DELIVERY.md](DELIVERY.md)
- [PROJECT_PACKAGES.md](PROJECT_PACKAGES.md)
- [ADR-0017 — Studio Extension Model](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)
- [ADR-0014 — Project Configuration Package](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)
- [ADR-0015 — DataSource Model](../adr/ADR-0015%20—%20DataSource%20Model.md)
- [ADR-0016 — Published Routes](../adr/ADR-0016%20—%20Published%20Routes.md)
- [ADR-0018 — Minimal Scheduling](../adr/ADR-0018%20—%20Minimal%20Scheduling.md)
- [ADR-0020 — Extensible Studio](../adr/ADR-0020%20—%20Extensible%20Studio.md)
- [ADR-0019 — Provenance and Editorial Overrides](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)
- [ARCHITECTURE_FITNESS.md](ARCHITECTURE_FITNESS.md)
