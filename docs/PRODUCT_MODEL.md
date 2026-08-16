# Aurii Product Model

> Canonical description of how Aurii is composed as a product platform.
>
> This document defines terms, boundaries, and supported product modes.
> It distinguishes **implemented** concepts from **planned** / **beta** ones.
> Implementation status: Phase 4 is **complete** (`Phase4.md`). Editorial + Context is **planned / post–Phase 4** — see [`Phase5.md`](../Phase5.md) (roadmap only; not implemented).
> Architecture fitness tests: [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).
> Product strategy (open Core, Studio audience, customer-led evolution): [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).
> Platform validation (portfolio, reuse test, MVP criteria): [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md).

---

## One-sentence definition

Aurii is a platform for **modeling, ingesting, editing, enriching, relating, and publishing structured data and editorial content**. Aurii Core is the system of record. Studio is a **customizable project workspace** for developers and operators on the same Core model (generated UI by default; replaceable by extensions). Opinionated products — including a future publication CMS — are **separate clients** that may consume Core. None of them is a synonym for Studio, and none is a required layer between Core and a frontend.

Aurii is not only an alternative to a traditional headless CMS. The same Core must be able to support publication CMS, Kampbart, playground directories, DN Gaselle, Geo datasets, LiveCenter, documentation, and other structured-data applications without each project inventing its own backend. Those examples are architecture tests and possible products — not a closed list of what Aurii may become.

Product direction (open Core, product boundaries, Studio audience, customer-led evolution): [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

---

## Platform principles

These refine existing ADRs; they do not replace them.

1. **Data is not necessarily content.** A municipality, company, or match is a record. It need not be an article.
2. **Content can reference data without owning it.** An article may point at a company; the company is not a field of the article.
3. **Structured data and rich content can live on the same record.** A playground can have coordinates and a rich description without two storage models.
4. **External sources are a normal way data enters Aurii.** Manual editing is one origin among many.
5. **Aurii should be able to preserve provenance.** Where a value came from is Core metadata, not a product hack ([ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)).
6. **Editorial overrides must be able to exist without destroying source data.** Source value and override are distinct concepts.
7. **The schema describes the domain, not only the form in Studio.** APIs, validation, relations, search, and editors all derive from it.
8. **Generated Studio is the default, not the limitation.** ([ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md))
9. **Domain-specific interfaces must be buildable without domain-special logic in Core.** Kampbart’s match desk is a Studio extension, not a Match engine.
10. **Core must be usable without Studio.** Imports, query, and delivery never require a UI.
11. **Products discover requirements. Core absorbs durable generalizations.** A need should not enter Core merely because it could theoretically be useful elsewhere. See [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) and the reuse test in [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md).
12. **Studio is an Aurii workspace, not the default domain product.** Journalists, magazine editors, and report authors should normally work in products built for those jobs.

---

## Unified records (not “articles vs data”)

Core does **not** assume that records are articles or traditional CMS documents.

The same entity/schema primitive represents:

| Kind | Examples |
|------|----------|
| Structured records | `Company`, `Match`, `Player`, `Municipality` |
| Editorial documents | `Article`, `MatchReport`, documentation pages |
| Hybrids | `Playground` (facts + tips/blocks), `Match` (score/lineup + report) |

There is **one** storage/lifecycle model: schema-typed entities. Do not introduce separate “content” and “data” stores unless a future ADR shows a strong technical reason. Studio (and a future CMS client) may *present* records differently; Core does not split them.

See [ADR-0006](../adr/ADR-0006%20—%20Unified%20Data%20Model.md) and [`Domain Model.md`](Domain%20Model.md).

---

## Canonical principle

| Layer | Role | Status |
|-------|------|--------|
| **Aurii Core** | System of record: schemas, entities, datasets, projects, imports, queries, delivery APIs | Implemented |
| **Studio** | Extensible project workspace (generic UI + declarative config + planned extension API) | **Beta** (Phase 4); full extension API planned |
| **Project package** (`aurii.config.ts`) | Versioned files describing schemas, sources, imports, sync, routes, Studio config | **Beta** |
| **CMS / authoring product** | Future separate client for publication authoring | **Planned** (post–Phase 4); not Studio. Roadmap: [`Phase5.md`](../Phase5.md) |

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

**A CMS or authoring interface is an optional future client of Aurii Core. It is not a required layer between Core and a frontend. Studio is not that CMS—but Studio may host operator-facing custom editors as extensions on the same Core model.**

- Core is the system of record and remains usable independently of Studio and of commercial products.
- Studio is one client: an extensible **developer/operator** project workspace for sources, imports, schedules, entities, queries, published routes, and (via extensions) domain-specific operational editors.
- Products may be **separate, opinionated applications** over the same Core. They do not need to share one universal UI.
- Frontends, apps, export adapters, and AI clients consume Core directly.
- They do not read through Studio or a CMS UI.

This preserves “Aurii is not a CMS” for Core and Studio, while allowing separate CMS and other products later. See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md) and [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

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

A stored instance of a schema—the unified record. An entity may be purely structured, primarily editorial, or a hybrid. Prefer entities (or platform definitions the Runtime understands) over special-cased object types. Relations are schema-declared and owned by Core.

### DataSource

A Core-managed resource (scoped to Project + Dataset) describing where data comes from. Kinds include `file`, `http`, `database`, `manual`, `product`, `automation`, and `other`. Secrets stay server-side (`SecretRef`); API responses never include secret values. Links to saved import/sync definitions; does not replace the import/pipeline engine.

**Status:** beta. See [ADR-0015](../adr/ADR-0015%20—%20DataSource%20Model.md).

**Intended evolution (not implemented):** reusable source adapters (fetch → transform → identity matching → normalize → upsert/sync), conceptually a `packages/sources` layer feeding Core. Long-running sync may later run in `apps/worker` (or equivalent) rather than only on the API process. The `defineSource({ name, target, fetch, transform, identity })` sketch is illustrative; the adapter API is **not locked**. Provenance of resulting values is [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md).

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

Products may be **separate, opinionated clients** over Core. They may share capabilities, packages, and APIs while differing in navigation, workflows, mental models, defaults, terminology, and interaction patterns. Aurii should not assume one modular CMS UI can cover every product by toggling features. See [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

Examples (architecture tests and possible products — not a closed catalog):

| Product | Nature |
|---------|--------|
| Norwegian Geo | Data product (import → Core → delivery); canonical implemented vertical |
| Playground directory | Hybrid structured + editorial records; map/list/table Studio views |
| DN Gaselle | Structured company/financial data related to articles; ingestion + overrides |
| Kampbart | Structured sports graph + operational match editor (Studio extension) |
| Tax-list explorer | Data product + visualization consumer |
| Classic blog / publication CMS | Authored product (future CMS client) |
| News CMS | Authored / hybrid product (future) |
| LiveCenter | Hybrid realtime product (later phase) |
| Documentation | Authored product on the same entity model |

Products live outside generic Core as compositions: `product.yaml` / modules, project packages, and client applications.

### Product Module / Dataset Module

Domain data packaged for a product—for example education or health under Norwegian Geo. Modules declare schemas, imports, sources, and dependencies (often on a product’s core reference data).

A product module is **not** a runtime plugin.

Norwegian Geo convention: `demo/norwegian-geo/product.yaml` and `modules/<id>/module.yaml`. Phase 4 formalizes useful generic parts without inventing a large new Core “Product Runtime.”

### Plugin

A runtime extension mechanism that adds engines, connectors, field types, pipeline steps, or (later) Studio surfaces to Core. Plugins extend the Runtime; dataset modules package domain data. Do not conflate the two.

**Full Plugin Runtime:** largely planned. Studio beta uses a **simple view registry**, not a full plugin marketplace ([ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md)). Planned Studio surface: [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md).

### Studio

The generic **project workspace** client (`@aurii/studio-app`) on public Core APIs and the SDK. Default experience: schema-aware generated (or generic) UI for collections and records, plus sources, imports, history, schedules, published routes, query, and system status. Projects customize it with `defineStudio` and, over time, a stable extension API (custom field inputs, record editors, collection views, tools, navigation). See [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md) and [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md).

Studio’s primary audience is a **developer, data operator, integrator, or technical project administrator**. It is a tool for working with Aurii — not the default end-user CMS for a journalist, magazine editor, report author, or other domain user.

Studio is **not** a publication CMS, **not** the Editorial product, and **not** the platform. It **is** allowed to host operator-facing domain-specific editors (for example a match desk or map) as extensions. That must not turn Studio into a universal CMS or product shell. It must not own business logic. Core must remain usable without Studio.

**Status:** data workspace usable; project-oriented Studio **beta**; full extension API **planned**.

### Content / Data / Sources (product lenses)

Useful **mental models** for operators—not separate Core storage models and not a frozen Studio information architecture:

| Lens | Meaning | Typical surfaces |
|------|---------|------------------|
| **Content** | Editorial production | Schemas with rich/free-form fields; custom editors; future Editorial client |
| **Data** | Records and datasets | Collections, query, tables, maps |
| **Sources** | External systems and synchronization | DataSources, imports, sync, schedules, provenance |

Default Studio navigation stays project-configured collections and ops. A project *may* group items under these lenses via `defineStudio`. Norwegian Geo need not show a Content section. A Match record may be both data and content.

### Provenance / editorial override

Planned Core metadata distinguishing **source values** from **editorial overrides**, plus origin, upstream id, fetch times, sync status, and transform identity. Not required in ordinary record JSON. See [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md).

**Status:** designed; not implemented as a Core metadata store. DataSource registry is **beta**.

### Data Workspace

Studio (or equivalent) surfaces for sources, imports, schemas, entities, queries, published routes, schedules, and operations—plus generated record UI and optional custom views/editors. Sufficient for data-only products. A separate publication-CMS client is not required.

### Authoring Workspace / CMS (future product)

An **optional**, separate content creation, editing, preview, and publishing client. It would write to Core through public APIs. It is **not** Studio renamed. Different publishing cases (blog, magazine, newsroom) may justify separate products that share capabilities rather than one universal CMS. Not implemented; planned for later phases after Phase 4 proves delivery. See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md) and [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

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

| | Aurii (Core + Studio) | CMS / domain product (future separate clients) |
|--|----------------------|-------------------------------|
| Primary job | Model, ingest, edit, enrich, relate, query, and deliver structured data **and** editorial content | Do a domain job: author, revise, preview, publish, collaborate, report, … |
| System of record | Aurii Core (usable without Studio or any commercial product) | Would still write to Aurii Core (client) |
| Studio | Developer/operator project workspace (generated UI default; custom editors/views via extensions) | Not the CMS; not renamed Studio; not the journalist’s or editor’s default tool |
| Required for frontends? | Core APIs/SDK yes; Studio no | Never required between Core and frontend |
| One UI for every product? | No. Products may be separate opinionated applications | Do not assume one modular CMS scales from blog to newsroom |
| Phase 4 | **Complete** (data products + delivery; architecture for sources, provenance, Studio extension) | Out of scope as a product |

Saying “Studio is our CMS” is incorrect. Studio operates projects on Core and may host operator-facing domain-specific editors. A publication CMS, if built, is another client (Editorial + Context — [`Phase5.md`](../Phase5.md)). Other products (magazine, newsroom, reports, …) may be separate applications that share capabilities. See [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

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

Studio’s project workspace configures and inspects sources, imports, schedules, schemas, entities, queries, published routes, runs, and errors. Domain-specific collection views (for example Map) are extensions, not Core. No publication-CMS client is required.

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

The authoring interface writes to Core through public APIs. The frontend reads from Core. The frontend does **not** read through the CMS client. Studio remains a developer/operator data workspace, not that CMS. Different authored products need not share one UI.

**Status:** Architecturally supported; authoring workspace and editorial reference vertical are **not** implemented in Phase 4. Roadmap: [`Phase5.md`](../Phase5.md) (planned / post–Phase 4). Prerequisites are defined in `Phase4.md` workstream E.

### 3. Hybrid product

Examples: Gaselle (companies + articles); playgrounds (facts + copy); Kampbart (match graph + report); a newsroom article referencing municipalities; Geo with editorial overrides; LiveCenter.

```text
External data ──→ DataSources / imports / sync ──┐
                                                   │
Studio (generated or custom editors) ─────────────┼──→ Aurii Core
                                                   │         ↓
Future CMS client (optional) ─────────────────────┤   API / SDK / events
                                                   │         ↓
Automation / AI ───────────────────────────────────┘   Web, apps, maps,
                                                       rankings, APIs, print
```

Hybrid products compose imported entities with authored fields or entities through schema-declared references. Structured facts and rich content may share a record. Core stays generic; domain composition lives in product schemas, modules, and clients (including Studio extensions).

**Status:** Relational references (Phase 3) enable the graph. DataSource beta enables intake. Provenance/overrides and full custom editors are **designed** ([ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md), [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)); not fully implemented. Full publication-CMS hybrid is later phases.

---

## Mapping examples to the model

| Example | Mode | Core role | Clients | Notes |
|---------|------|-----------|---------|-------|
| **Norwegian Geo** | Data-only (enrichment/overrides later) | Counties, municipalities, postal codes, module entities | Studio project workspace; `apps/geo` consumer | Canonical import/data/delivery vertical; fitness test **Geo** |
| **Playground directory** | Hybrid | Structured place records + rich fields; geo references | Studio list/table/map views; public site | Fitness test; not implemented as a demo unless assigned |
| **DN Gaselle** | Hybrid | Companies, financials, rankings related to articles | Studio tables; publication frontend; APIs | Fitness test: data must not be modeled as articles |
| **Kampbart** | Hybrid | Sports graph (match, team, player, events) + report | Custom Studio match editor; public site | Fitness test: Studio as specialized tool via extensions |
| **Tax-list exploration** | Data-only | Large imported tables, queries, exports | Studio + visualization frontend | Future scale stress case (Phase 4) |
| **Classic blog / docs** | Authored | Article/page entities, schemas, delivery API | Future CMS + site, or generated Studio | CMS optional; site reads Core |
| **News CMS** | Authored / hybrid | Articles, related reference data | Future CMS + news site | Editorial vertical (post–Phase 4) |
| **LiveCenter** | Hybrid | Structured events + reference enrichment | Live UI + authoring | Later phase; composition on Runtime, not Core special case |

Architecture questions and capability matrix: [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).

---

## Boundaries that must not blur

1. **Core stays domain-agnostic.** Norwegian geo rules, football, Gaselle rankings, newsroom rules, magazine workflow, and LiveCenter UX stay outside Core. Do not introduce newsroom, magazine, report, or article as Core built-ins.
2. **Schemas remain the source of truth** for structure, validation, and relationships. Relations are part of the foundation, not an add-on.
3. **Applications do not read the database directly.**
4. **Studio and future CMS clients use public APIs and the SDK only.**
5. **Frontends do not depend on Studio.**
6. **A publication CMS is optional**, never an intermediary for delivery, and **not** Studio renamed. Studio *may* host operator-facing custom editors as extensions. It must not become a universal CMS/product shell.
7. **Do not split content storage from data storage** without a strong technical ADR.
8. **Document implemented / beta / planned separately.** Phase docs and ADRs record decisions; do not present planned CMS, provenance store, map views, workflow, assets, realtime, RBAC, or AI features as complete.

---

## Relationship to Norwegian Geo’s product.yaml

`demo/norwegian-geo/product.yaml` is the working example of **product composition** (modules, layers, dependencies).

`demo/norwegian-geo/aurii.config.ts` is the **project package** for Studio, sources, imports, sync, and published routes. It points at Core Project slug `norge-data` and dataset `norwegian-geo`.

The two coexist ([ADR-0014](../adr/ADR-0014%20—%20Project%20Configuration%20Package.md)):

| File | Answers |
|------|---------|
| `product.yaml` | What modules make up this shipping product? CLI import order and `dependsOn`. |
| `aurii.config.ts` | How does a developer install and operate this project in Core/Studio? |

**Schema placement:** core geography schemas are listed in both files. Shipped module schemas (`school`, `kindergarten`, `hospital`, `public-holiday`) live in `product.yaml` / `module.yaml` / `lib/manifest.ts` for CLI import. They are **not** copied into `aurii.config.ts` `schemas:`. Studio operates those modules via package sources, saved imports, and `defineStudio` collections. Planned modules stay in `futureModules` only.

Phase 4 adds `registerProjectPackage` / `loadProjectPackage` helpers in `@aurii/core`. That is not a second tenancy model and **not** a Product Runtime. Core does not learn “product” as an object (N3.4 — no ADR).

---

## Reference verticals and fitness tests

| Vertical / test | Purpose | Status |
|-----------------|---------|--------|
| **Norwegian Geo** | Canonical import, schema, query, storage, SDK, Studio project package, and delivery testbed | Implemented core path; project Studio / routes / sources **beta**; Phase 4 strengthens delivery |
| **Editorial** (planned) | Canonical authoring, revision, publishing, preview, workflow, media, **Context** | Not built; post–Phase 4 roadmap in [`Phase5.md`](../Phase5.md) |
| **Architecture fitness tests** | Kampbart, playgrounds, Gaselle, Geo as design tests for the unified platform | Documentation — [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md). Do not implement those products unless assigned. |
| **Platform validation portfolio** | Prove a shared Core across diverse real products; discovery loop; maturity model; 6–12 month evidence/decision gates | Process + register — [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md). Phase 4 data-product slice alone is not full validation. Convergence over early stability. |

Use the vertical that matches the capability under change. Cross-cutting Runtime changes must eventually be validated against both implemented/planned verticals **and** must still answer the four fitness questions. See `AGENTS.md`.

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
| [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md) | Source values vs editorial overrides; Core provenance metadata |
| [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md) | Generated UI default; replaceable editors/views |

---

## Related documents

- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) — open Core, product boundaries, Studio audience, customer-led evolution
- [PLATFORM_VALIDATION.md](./PLATFORM_VALIDATION.md) — real-project portfolio and whether Aurii should remain a platform
- [ARCHITECTURE_FITNESS.md](./ARCHITECTURE_FITNESS.md) — Kampbart, playgrounds, Gaselle, Geo as architecture tests
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
