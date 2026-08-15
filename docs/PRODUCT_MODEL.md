# Aurii Product Model

> Canonical description of how Aurii is composed as a product platform.
>
> This document defines terms, boundaries, and supported product modes.
> It distinguishes **implemented** concepts from **planned** / **beta** ones.
> Implementation plans live in `Phase4.md`. Editorial + Context is **planned / post–Phase 4** — see [`Phase5.md`](../Phase5.md) (roadmap only; not implemented).

---

## One-sentence definition

Aurii is a **schema-driven platform for structured data**. Aurii Core is the system of record. Studio is a **project workspace** for operating data products. A CMS is a **future separate product** that may consume Core—not a synonym for Studio, and never a required layer between Core and a frontend.

---

## Canonical principle

| Layer | Role | Status |
|-------|------|--------|
| **Aurii Core** | System of record: schemas, entities, datasets, projects, imports, queries, delivery APIs | Implemented |
| **Studio** | Project-oriented data workspace (generic UI + declarative project config) | **Beta** (Phase 4) |
| **Project package** (`aurii.config.ts`) | Versioned files describing schemas, sources, imports, sync, routes, Studio config | **Beta** |
| **CMS / authoring product** | Future separate client for editorial authoring | **Planned** (post–Phase 4); not Studio. Roadmap: [`Phase5.md`](../Phase5.md) |

Data enters Core from **many sources**—files, HTTP APIs, databases, manual entry, automation, AI, and future product clients. Frontends and other consumers talk to Core through public APIs and the SDK. They do not read through Studio or a CMS UI.

See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md), [ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)–[ADR-0018](../adr/ADR-0018%20—%20Minimal%20Scheduling.md).

---

## Architecture

```text
  File / HTTP / DB / manual / automation / AI / future products
                         │
                         ▼
              ┌─────────────────────┐
              │     Aurii Core      │  ← system of record
              │  schemas · entities │
              │  datasets · projects│
              │  imports · query    │
              │  published routes   │
              └──────────┬──────────┘
                         │
         public APIs / SDK / events
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
   Studio          Frontends /        Other product
 (project          apps / AI /        clients (future
  workspace)       export             CMS, tools, …)
```

**A CMS or authoring interface is an optional future client of Aurii Core. It is not a required layer between Core and a frontend. Studio is not that CMS.**

- Core is the system of record.
- Studio is one client: a project workspace for sources, imports, schedules, entities, queries, and published routes.
- Frontends, apps, export adapters, and AI clients consume Core directly.
- They do not read through Studio or a CMS UI.

This preserves “Aurii is not a CMS” for Core and Studio, while allowing a separate CMS product later. See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

## Glossary

### Core / Runtime

The domain-agnostic engine and system of record. Core owns schemas, entities, datasets, projects, imports, pipelines, queries, events, DataSources, saved import/sync definitions, published route state, and the public HTTP API. It does not encode product-specific domain logic (Norwegian geography, newsroom workflow, and so on).

Location today: `packages/core/`. **Status:** implemented (platform ops surfaces in beta).

### Deployment

A running Aurii instance and its infrastructure boundary: process(es), storage, configuration, network exposure, and auth settings. One deployment may host one or more projects and datasets. “Deployment” is an operational concept; it is not a Core domain object that applications must model.

### Project (Core)

A Core top-level tenancy / administration boundary (UUID + slug + status). Resources such as datasets, DataSources, and published route state attach to a Project. See [`PROJECTS.md`](PROJECTS.md) and [ADR-0011](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md).

**Status:** implemented.

### Project package (`aurii.config.ts`)

Files on disk that declare an installable project: schemas, DataSources, import definitions, sync definitions, published routes, and Studio configuration. Entry point is `defineProject()` from `@aurii/core`. Links to a Core Project by `core.projectSlug`. See [`PROJECT_PACKAGES.md`](PROJECT_PACKAGES.md) and [ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md).

A project package is **not** a Core Project row, **not** a Product, and **not** a Dataset.

**Status:** beta.

### Dataset

A logical data boundary inside Core. Entities and schemas are scoped to a dataset (owned by a Project). Norwegian Geo uses dataset id `norwegian-geo`. A product may use one dataset or several; a dataset alone is not a product.

**Status:** implemented.

### Schema

Declarative definition of structure, validation, relationships, and declared behavior for a class of entities. Schemas are the source of truth for fields, reference targets, capabilities, and related platform behavior.

### Entity

A stored instance of a schema. Prefer entities (or platform definitions the Runtime understands) over special-cased object types.

### DataSource

A Core-managed resource (scoped to Project + Dataset) describing where data comes from. Kinds include `file`, `http`, `database`, `manual`, `product`, `automation`, and `other`. Secrets stay server-side (`SecretRef`); API responses never include secret values. Links to saved import/sync definitions; does not replace the import/pipeline engine.

**Status:** beta. See [ADR-0015](../adr/ADR-0015%20—%20DataSource%20Model.md).

### Import definition (saved)

A repeatable, declarative mapping from a source into schemas and entities (field maps, transforms, validation, persist). Saved definitions are first-class operable surfaces in Studio and Core—distinct from one-off upload wizard runs. May reference a DataSource and optional schedule.

**Status:** import engine implemented; saved definitions + Studio ops surfaces beta.

### Sync definition

A saved import definition oriented toward recurring refresh from an external DataSource (for example nightly HTTP postal-code sync). Same engine as imports; typically carries a schedule. Declared in the project package under `sync:`.

**Status:** beta.

### Schedule

Minimal cron schedule on a saved import/sync definition (`type: "cron"`, expression, timezone). Single-process scheduler co-located with the API server. Enable/disable, no overlapping runs per definition, failures on run records. Not a distributed job platform.

**Status:** beta. See [ADR-0018](../adr/ADR-0018%20—%20Minimal%20Scheduling.md).

### Published route

A stable, versioned public HTTP endpoint (`/public/:projectSlug/v1/...`) backed by a declarative query. Definition lives in project code (`defineRoute`); enable/access/cache state lives in Core. Consumers call Core—never Studio.

**Status:** beta. See [ADR-0016](../adr/ADR-0016%20—%20Published%20Routes.md).

### Studio configuration

Declarative Studio layout for a project via `defineStudio()` from `@aurii/studio`: navigation groups, collections, featured schemas, import/route groups, dashboards, and optional custom views. Without config, Studio ships a default project workspace.

**Status:** beta. See [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md) and [`Studio.md`](Studio.md).

### Pipeline

Declared transforms, validation, enrichment, and persistence steps. Imports use pipelines today; broader automation pipelines remain part of the platform vocabulary.

### Product

A coherent solution composed from datasets, schemas, imports, capabilities, modules, and consumers. A product is **not** merely another name for a dataset, Core Project, or project package.

Examples:

| Product | Nature |
|---------|--------|
| Norwegian Geo | Data product (import → Core → delivery) |
| Tax-list explorer | Data product + visualization consumer |
| Classic blog | Authored product (future CMS client) |
| News CMS | Authored / hybrid product (future) |
| LiveCenter | Hybrid realtime product (later phase) |

Products live outside generic Core as compositions: `product.yaml` / modules, project packages, and client applications.

### Product Module / Dataset Module

Domain data packaged for a product—for example education or health under Norwegian Geo. Modules declare schemas, imports, sources, and dependencies (often on a product’s core reference data).

A product module is **not** a runtime plugin.

Norwegian Geo convention: `demo/norwegian-geo/product.yaml` and `modules/<id>/module.yaml`. Phase 4 formalizes useful generic parts without inventing a large new Core “Product Runtime.”

### Plugin

A runtime extension mechanism that adds engines, connectors, field types, pipeline steps, or (later) Studio surfaces to Core. Plugins extend the Runtime; dataset modules package domain data. Do not conflate the two.

**Full Plugin Runtime:** largely planned. Studio beta uses a **simple view registry**, not a full plugin marketplace ([ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)).

### Studio

The generic **project workspace** client (`@aurii/studio-app`). It uses public Core APIs and the SDK. Surfaces include sources, imports, history, schedules, published routes, entities, query, and system status. Projects customize it with `defineStudio` and optional custom views.

Studio is **not** a CMS, **not** an editorial editor, and **not** the platform. It must not own business logic.

**Status:** data workspace usable; project-oriented Studio **beta**.

### Data Workspace

Studio (or equivalent) surfaces for sources, imports, schemas, entities, queries, published routes, schedules, and operations. Sufficient for data-only products. No editorial authoring UI is required.

### Authoring Workspace / CMS (future product)

An **optional**, separate content creation, editing, preview, and publishing client. It would write to Core through public APIs. It is **not** Studio renamed. Not implemented; planned for later phases after Phase 4 proves delivery. See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

### Consumer

Any frontend, app, public API façade, AI client, export adapter, or print workflow that uses Core outputs through APIs, SDK, events, or documented offline/build-time modes (for example snapshot files).

Consumers must not depend on Studio or a CMS being deployed.

### External product clients (future)

Additional clients beyond Studio and delivery frontends—CLI tools, AI agents, a future CMS product, custom ops dashboards. All consume the same Core APIs. None become intermediaries for delivery.

---

## Project vs Product vs Dataset vs Project package

```text
Product  (shipping composition — product.yaml, modules, consumers)
  │
  ├── Project package  (aurii.config.ts — files: schemas, sources, imports, sync, routes, studio)
  │         │ links by slug
  │         ▼
  ├── Core Project     (runtime tenancy: UUID + slug)
  │         │
  │         └── Dataset(s)  (storage / query boundary)
  │
  └── Consumers        (web, API, AI, print — talk to Core)
```

| Concept | What it is | What it is not |
|---------|------------|----------------|
| **Dataset** | Logical storage/query boundary in Core | A full product or Studio app |
| **Core Project** | Runtime tenancy / admin parent | Files on disk; a marketing product name |
| **Project package** | Declarative files (`aurii.config.ts`) for install & Studio | A Core table; a Product Runtime |
| **Product** | Coherent solution spanning data, packaging, and consumers | A Core primitive required before shipping data |
| **Product module** | Domain data package for a product | A Runtime plugin |
| **Plugin** | Runtime extension | A folder of schemas and CSV/JSON imports |

A product may map to one or more Core Projects over time. Norwegian Geo keeps `product.yaml` for module composition and adds `aurii.config.ts` as the installable project package ([ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)).

---

## Aurii vs CMS

| | Aurii (Core + Studio) | CMS (future separate product) |
|--|----------------------|-------------------------------|
| Primary job | Import, store, relate, query, deliver structured data | Author, revise, preview, publish editorial content |
| System of record | Aurii Core | Would still write to Aurii Core (client) |
| Studio | Project data workspace | Not the CMS |
| Required for frontends? | Core APIs/SDK yes; Studio no | Never required between Core and frontend |
| Phase 4 | In scope (data products + delivery) | Out of scope |

Saying “Studio is our CMS” is incorrect. Studio operates data products. A CMS, if built, is another client.

---

## Three supported modes

### 1. Data product without a CMS

Examples: Norwegian Geo, tax lists, company and bankruptcy data, SSB datasets, election data, public APIs and visualizations.

```text
Many sources (file, HTTP, DB, manual, automation, …)
      ↓
DataSources + import / sync definitions (+ optional schedule)
      ↓
Aurii Core
      ↓
Published routes / Query API / SDK
      ↓
Frontend, visualization, API consumer, AI, or print
```

Studio’s project workspace configures and inspects sources, imports, schedules, schemas, entities, queries, published routes, runs, and errors. No editorial authoring interface is required.

**Status:** Path proven through import, Core, query, API, SDK, and live published routes (Norwegian Geo core schemas). Project-oriented Studio, DataSources, schedules, and published routes are **beta**. Live frontend delivery is documented in [`DELIVERY.md`](DELIVERY.md); `apps/geo` uses committed snapshots only as an explicit offline/build-time mode.

### 2. Authored content with an optional CMS layer

Examples: classic blog CMS, documentation CMS, magazine or publication CMS, news CMS.

```text
Editor
   ↓
Future CMS / authoring product (separate client)
   ↓
Aurii Core
   ↓
Delivery API / SDK
   ↓
Frontend and other consumers
```

The authoring interface writes to Core through public APIs. The frontend reads from Core. The frontend does **not** read through the CMS client. Studio remains a data workspace, not that CMS.

**Status:** Architecturally supported; authoring workspace and editorial reference vertical are **not** implemented in Phase 4. Roadmap: [`Phase5.md`](../Phase5.md) (planned / post–Phase 4). Prerequisites are defined in `Phase4.md` workstream E.

### 3. Hybrid product

Examples: a newsroom article referencing municipalities or companies; a live event enriched with structured reference data; an editorial package producing web, NewsML-G2, visualizations, and print from the same entities.

```text
External data ──→ DataSources / imports / sync ──┐
                                                   │
Editors ────────→ Future CMS client ───────────────┼──→ Aurii Core
                                                   │         ↓
Automation / AI ───────────────────────────────────┘   API / SDK / events
                                                             ↓
                                              Web, apps, visualizations,
                                              public APIs, AI, and print
```

Hybrid products compose imported entities with authored entities through schema-declared references. Core stays generic; domain composition lives in product schemas, modules, and clients.

**Status:** Relational references (Phase 3) enable the data half. Full hybrid editorial products are later phases.

---

## Mapping examples to the model

| Example | Mode | Core role | Clients | Notes |
|---------|------|-----------|---------|-------|
| **Norwegian Geo** | Data-only | Counties, municipalities, postal codes, module entities | Studio project workspace; `apps/geo` consumer | Canonical import/data/delivery vertical; reference `aurii.config.ts` |
| **Tax-list exploration** | Data-only | Large imported tables, queries, exports | Studio + visualization frontend | Future scale stress case (Phase 4) |
| **Classic blog** | Authored | Article/page entities, schemas, delivery API | Future CMS + site | CMS optional; site reads Core |
| **News CMS** | Authored / hybrid | Articles, related reference data | Future CMS + news site | Editorial vertical (post–Phase 4) |
| **LiveCenter** | Hybrid | Structured events + reference enrichment | Live UI + authoring | Later phase; composition on Runtime, not Core special case |

---

## Boundaries that must not blur

1. **Core stays domain-agnostic.** Norwegian geo rules, newsroom rules, and LiveCenter UX stay outside Core.
2. **Schemas remain the source of truth** for structure, validation, and relationships.
3. **Applications do not read the database directly.**
4. **Studio and future CMS clients use public APIs and the SDK only.**
5. **Frontends do not depend on Studio.**
6. **CMS/authoring is optional**, never an intermediary for delivery, and **not** Studio.
7. **Document implemented / beta / planned separately.** Phase docs and ADRs record decisions; do not present planned CMS, workflow, assets, realtime, RBAC, or AI features as complete.

---

## Relationship to Norwegian Geo’s product.yaml

`demo/norwegian-geo/product.yaml` is the working example of **product composition** (modules, layers, dependencies).

`demo/norwegian-geo/aurii.config.ts` is the **project package** for Studio, sources, imports, sync, and published routes. It points at Core Project slug `norge-data` and dataset `norwegian-geo`.

The two coexist ([ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)):

| File | Answers |
|------|---------|
| `product.yaml` | What modules make up this shipping product? |
| `aurii.config.ts` | How does a developer install and operate this project in Core/Studio? |

Phase 4 may add SDK helpers to load manifests; that is not a second tenancy model or a “Product Runtime.”

---

## Reference verticals

| Vertical | Purpose | Status |
|----------|---------|--------|
| **Norwegian Geo** | Canonical import, schema, query, storage, SDK, Studio project package, and delivery testbed | Implemented core path; project Studio / routes / sources **beta**; Phase 4 strengthens delivery |
| **Editorial** (planned) | Canonical authoring, revision, publishing, preview, workflow, media, **Context** | Not built; post–Phase 4 roadmap in [`Phase5.md`](../Phase5.md) |

Use the vertical that matches the capability under change. Cross-cutting Runtime changes must eventually be validated against both. See `AGENTS.md`.

---

## Related ADRs (project-oriented Studio)

| ADR | Topic |
|-----|--------|
| [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md) | Optional authoring / CMS as separate client |
| [ADR-0011](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md) | Core Project tenancy |
| [ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md) | `aurii.config.ts` / `defineProject` |
| [ADR-0015](../adr/ADR-0015%20—%20DataSource%20Model.md) | DataSource registry |
| [ADR-0016](../adr/ADR-0016%20—%20Published%20Routes.md) | Published delivery routes |
| [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md) | Studio layers and simple view registry |
| [ADR-0018](../adr/ADR-0018%20—%20Minimal%20Scheduling.md) | Cron schedules on sync/import definitions |

---

## Related documents

- [PROJECT_PACKAGES.md](./PROJECT_PACKAGES.md) — `aurii.config.ts`, `defineProject` / `defineStudio` / `defineRoute`
- [PROJECTS.md](./PROJECTS.md) — Core Project boundary
- [Phase4.md](../Phase4.md) — Data Products and Delivery plan
- [Phase5.md](../Phase5.md) — Editorial & Context (planned / post–Phase 4)
- [DELIVERY.md](./DELIVERY.md) — Live frontend delivery contract
- [NORWEGIAN_GEO.md](./NORWEGIAN_GEO.md) — Norwegian Geo layer boundaries
- [REFERENCE_DEMO.md](./REFERENCE_DEMO.md) — agent/contributor demo guide
- [Studio.md](./Studio.md) — project-oriented Studio (beta)
- [Architecture.md](./Architecture.md) — engine-level architecture
- [AGENTS.md](../AGENTS.md) — agent reasoning rules
