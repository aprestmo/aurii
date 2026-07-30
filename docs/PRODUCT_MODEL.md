# Aurii Product Model

> Canonical description of how Aurii is composed as a product platform.
>
> This document defines terms, boundaries, and supported product modes.
> It distinguishes **implemented** concepts from **planned** ones.
> Implementation plans live in `Phase4.md` and later phase documents.

---

## One-sentence definition

Aurii is a schema-driven runtime for importing, creating, relating, transforming, querying, and delivering structured data. Data may come from external sources, people, automation, or AI. Studio provides generic data administration. Products that need manual authoring may add an optional schema- and capability-driven authoring workspace. Frontends and other consumers communicate with Core through public APIs and SDKs.

---

## Architectural clarification

```text
                    ┌─────────────────────────────┐
                    │  Optional clients           │
                    │  Studio (data workspace)    │
                    │  Authoring workspace / CMS  │
                    │  CLI, AI agents, tools      │
                    └──────────────┬──────────────┘
                                   │ public APIs / SDK
                                   ▼
                            Aurii Core
                                   │
                    ┌──────────────┴──────────────┐
                    │ public APIs / SDK / events  │
                    ▼                             ▼
              Consumers                     Storage
         (web, apps, APIs,                (PostgreSQL,
          AI, print, export)               SQLite, …)
```

**A CMS or authoring interface is an optional client of Aurii Core. It is not a required layer between Core and a frontend.**

- Core is the system of record.
- Studio is one client.
- An authoring workspace, if present, is another client.
- Frontends, apps, export adapters, and AI clients consume Core directly.
- They do not read through a CMS UI.

This preserves the principle “Aurii is not a CMS” for Core, while allowing Aurii to power CMS products through an optional authoring layer. See [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

## Glossary

### Core / Runtime

The domain-agnostic engine and system of record. Core owns schemas, entities, datasets, imports, pipelines, queries, events, and the public HTTP API. It does not encode product-specific domain logic (Norwegian geography, newsroom workflow, LiveCenter layouts, and so on).

Location today: `packages/core/`.

### Deployment

A running Aurii instance and its infrastructure boundary: process(es), storage, configuration, network exposure, and auth settings. One deployment may host one or more datasets. “Deployment” is an operational concept; it is not a Core domain object that applications must model.

### Dataset

A logical data boundary inside Core. Entities and schemas are scoped to a dataset. Norwegian Geo uses dataset id `norwegian-geo`. A product may use one dataset or several; a dataset alone is not a product.

### Schema

Declarative definition of structure, validation, relationships, and declared behavior for a class of entities. Schemas are the source of truth for fields, reference targets, capabilities, and related platform behavior.

### Entity

A stored instance of a schema. Everything durable in Core should preferably be an entity (or a schema/import/pipeline definition that the Runtime understands), rather than a special-cased object type.

### Source

The origin of imported data: a file, API, database, cloud object, spreadsheet, or other external system. Sources are described by import definitions; they are not Core domain entities unless a product chooses to model them that way.

### Import Definition

A repeatable, declarative mapping from a source into schemas and entities (field maps, transforms, validation, persist). Import definitions are first-class product surfaces for data products.

### Pipeline

Declared transforms, validation, enrichment, and persistence steps. Imports use pipelines today; broader automation pipelines remain part of the platform vocabulary.

### Product

A coherent solution composed from datasets, schemas, imports, capabilities, modules, and consumers. A product is **not** merely another name for a dataset.

Examples:

| Product | Nature |
|---------|--------|
| Norwegian Geo | Data product (import → Core → delivery) |
| Tax-list explorer | Data product + visualization consumer |
| Classic blog | Authored product (optional CMS client) |
| News CMS | Authored / hybrid product |
| LiveCenter | Hybrid realtime product (later phase) |

Products live outside generic Core as compositions: manifests, schemas, imports, modules, and client applications.

### Product Module / Dataset Module

Domain data packaged for a product—for example education or health under Norwegian Geo. Modules declare schemas, imports, sources, and dependencies (often on a product’s core reference data).

A product module is **not** a runtime plugin.

Norwegian Geo convention: `demo/norwegian-geo/product.yaml` and `modules/<id>/module.yaml`. Phase 4 formalizes the useful generic parts of this convention without inventing a large new Core abstraction prematurely.

### Plugin

A runtime extension mechanism that adds engines, connectors, field types, pipeline steps, or Studio surfaces to Core. Plugins extend the Runtime; dataset modules package domain data for a product. Do not conflate the two.

Plugin Runtime is largely **planned**; dataset modules for Norwegian Geo are **implemented** as product packaging.

### Studio

The generic administrative client that uses public Core APIs and the SDK. Today Studio provides a **data workspace**: dashboard, import wizard, entity browser, schema inspection, and query playground.

Studio is not the platform. It must not own business logic.

### Data Workspace

The Studio (or equivalent) surfaces for imports, schemas, data browsing, queries, API access, and operations. Sufficient for data-only products. No editorial authoring UI is required.

### Authoring Workspace

An **optional** content creation, editing, preview, and publishing client. It writes to Core through public APIs. It may share a Studio shell with the data workspace, but it remains a client of Core. Not implemented as of Phase 3; planned for later phases after Phase 4 proves delivery.

### Consumer

Any frontend, app, public API façade, AI client, export adapter, or print workflow that uses Core outputs through APIs, SDK, events, or explicitly documented offline/build-time modes (for example snapshot files).

Consumers must not depend on Studio or an authoring UI being deployed.

---

## Three supported modes

### 1. Data product without a CMS

Examples: Norwegian Geo, tax lists, company and bankruptcy data, SSB datasets, election data, public APIs and visualizations.

```text
External sources
      ↓
Import definitions and pipelines
      ↓
Aurii Core
      ↓
Delivery API / SDK
      ↓
Frontend, visualization, API consumer, AI, or print
```

Studio’s data workspace configures and inspects imports, schemas, entities, queries, runs, errors, and access. No editorial authoring interface is required.

**Status:** Path proven through import, Core, query, API, and SDK (Norwegian Geo). Live frontend delivery via SDK is the Phase 4 contract; `apps/geo` may still use committed snapshots as an explicit offline/build-time mode.

### 2. Authored content with an optional CMS layer

Examples: classic blog CMS, documentation CMS, magazine or publication CMS, news CMS.

```text
Editor
   ↓
Optional authoring workspace / CMS client
   ↓
Aurii Core
   ↓
Delivery API / SDK
   ↓
Frontend and other consumers
```

The authoring interface writes to Core through public APIs. The frontend reads from Core through delivery APIs or the SDK. The frontend does **not** read through the CMS client.

**Status:** Architecturally supported; authoring workspace and editorial reference vertical are **not** implemented in Phase 4. Prerequisites are defined in `Phase4.md` workstream E.

### 3. Hybrid product

Examples: a newsroom article referencing municipalities or companies; a live event enriched with structured reference data; an editorial package producing web, NewsML-G2, visualizations, and print from the same entities.

```text
External data ──→ Imports and pipelines ──┐
                                           │
Editors ────────→ Authoring workspace ─────┼──→ Aurii Core
                                           │         ↓
Automation / AI ───────────────────────────┘   API / SDK / events
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
| **Norwegian Geo** | Data-only | Stores counties, municipalities, postal codes, module entities | Studio data workspace; `apps/geo` consumer | Canonical import/data/delivery vertical |
| **Tax-list exploration** | Data-only | Large imported tables, queries, exports | Studio + visualization frontend | Future scale stress case (Phase 4) |
| **Classic blog** | Authored | Article/page entities, schemas, delivery API | Optional authoring workspace + site | CMS optional; site reads Core |
| **News CMS** | Authored / hybrid | Articles, related reference data | Authoring workspace + news site | Editorial vertical (post–Phase 4) |
| **LiveCenter** | Hybrid | Structured events + reference enrichment | Live UI + authoring | Later phase; composition on Runtime, not Core special case |

---

## Product vs Dataset vs Module vs Plugin

```text
Product
  ├── one or more Datasets (Core data boundaries)
  ├── Schemas, Import Definitions, Pipelines
  ├── Product Modules (domain packages; optional)
  ├── Capabilities / Plugins used by the deployment (optional)
  └── Consumers (web, API, AI, print, …)
```

| Concept | What it is | What it is not |
|---------|------------|----------------|
| **Dataset** | Logical storage/query boundary in Core | A full product, marketing site, or module pack |
| **Product** | Coherent solution spanning data, packaging, and consumers | A Core primitive that must exist before shipping data |
| **Product module** | Domain data package for a product | A Runtime plugin |
| **Plugin** | Runtime extension | A folder of schemas and CSV/JSON imports |

Do **not** introduce a new `Project` abstraction into Core unless a concrete implementation need is demonstrated. Norwegian Geo already uses dataset + product manifest (documentation/convention). Prefer evolving that convention before adding Core types.

---

## Boundaries that must not blur

1. **Core stays domain-agnostic.** Norwegian geo rules, newsroom rules, and LiveCenter UX stay outside Core.
2. **Schemas remain the source of truth** for structure, validation, and relationships.
3. **Applications do not read the database directly.**
4. **Studio and authoring clients use public APIs and the SDK only.**
5. **Frontends do not depend on Studio.**
6. **CMS/authoring is optional** and never an intermediary for delivery.
7. **Document implemented behavior separately from plans.** Phase docs and ADRs record decisions; do not present planned CMS, workflow, assets, realtime, RBAC, or AI features as complete.

---

## Relationship to Norwegian Geo’s product.yaml

`demo/norwegian-geo/product.yaml` is the working example of product composition:

- product id and dataset id
- layered ownership (Aurii / Norwegian Geo Core / dataset modules)
- module list with schemas, imports, sources, and `dependsOn`
- future modules as documentation

Phase 4 asks which parts of this convention should remain documentation and which should become SDK or Core helpers—validated against Norwegian Geo before inventing a large generic product runtime.

---

## Reference verticals

| Vertical | Purpose | Status |
|----------|---------|--------|
| **Norwegian Geo** | Canonical import, schema, query, storage, SDK, and delivery testbed | Implemented; Phase 4 strengthens delivery |
| **Editorial** (planned) | Canonical authoring, revision, publishing, preview, workflow, media | Not built in this documentation phase; later |

Use the vertical that matches the capability under change. Cross-cutting Runtime changes must eventually be validated against both. See `AGENTS.md`.

---

## Related documents

- [ADR-0010 — Optional Authoring Layer](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [Phase4.md](../Phase4.md) — Data Products and Delivery plan
- [NORWEGIAN_GEO.md](./NORWEGIAN_GEO.md) — Norwegian Geo layer boundaries
- [REFERENCE_DEMO.md](./REFERENCE_DEMO.md) — agent/contributor demo guide
- [Studio.md](./Studio.md) — Studio design vision (includes future capabilities; not all implemented)
- [Architecture.md](./Architecture.md) — engine-level architecture
- [AGENTS.md](../AGENTS.md) — agent reasoning rules
