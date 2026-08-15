# Architecture

> Architecture describes how Aurii is organized internally.
>
> It does not describe implementation details.
> It describes responsibilities, boundaries and interactions between the major parts of the platform.
>
> **Product boundaries** (Core vs Studio vs optional authoring vs consumers): [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md).  
> **Fitness tests** (Kampbart, playgrounds, Gaselle, Geo): [`ARCHITECTURE_FITNESS.md`](ARCHITECTURE_FITNESS.md).  
> **Status:** Phase 3 complete; many engines below are visionary. Prefer README / Phase docs for what is implemented.

---

# Overview

Aurii is built as a collection of independent engines.

Each engine owns one responsibility.

Together they form a single platform.

```
                   Applications

 ┌──────────────────────────────────────────┐
 │                                          │
 │ Studio (extensible workspace; optional   │
 │         authoring product later)         │
 │ Websites                                         │
 │ Mobile Apps                                      │
 │ APIs                                             │
 │ AI Agents                                        │
 │ Print                                            │
 │ Third-party Integrations                         │
 │ Internal Systems                                 │
 │                                          │
 └──────────────────────────────────────────┘

                     │

               Public APIs

                     │

┌──────────────────────────────────────────────────────────┐

                    Aurii Core

──────────────────────────────────────────────────────────

Schema Engine

Dataset Engine

Document Engine

Asset Engine

Import Engine

Connector Engine

Pipeline Engine

Query Engine

Search Engine

Permission Engine

AI Engine

Event Engine

API Engine

Plugin Engine

──────────────────────────────────────────────────────────

              PostgreSQL + Object Storage

└──────────────────────────────────────────────────────────┘
```

The platform should evolve by adding new engines rather than increasing coupling between existing ones.

---

# Architectural Principles

Every engine must:

- own one responsibility
- expose a public API
- remain independent
- avoid circular dependencies
- communicate through well-defined interfaces

Whenever two engines begin sharing significant internal logic, their responsibilities should be reconsidered.

---

# Core

Core is the heart of Aurii.

Core is responsible for:

- storing information
- validating information
- relating information
- indexing information
- exposing information
- securing information
- transforming information
- recording provenance (planned Core metadata)

Core is **not** responsible for presentation.

Core contains no assumptions about websites, match desks, maps, or publication CMS workflows.

Core does **not** assume that records are articles. The same entity model represents `Company`, `Match`, `Player`, `Municipality`, `Playground`, `Article`, and `MatchReport`.

Core must be fully usable without Studio.

---

# Studio

Studio is an application.

It is not part of Core.

Studio consumes the same APIs available to external developers.

Its default responsibilities include:

- schema-generated (or generic) browsing and editing
- administration
- dashboards
- source / import / schedule operations
- query
- published routes

The architecture is **replaceable UI**: custom field inputs, record editors, collection views (List, Table, Cards, Map, Custom), tools, and navigation. Map and match-timeline are extensions, not Core engines. See [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md).

Everything Studio can do should also be possible through APIs.

---

# Engines

Aurii is intentionally divided into engines.

---

## Schema Engine

Responsible for:

- schemas
- field definitions
- validation rules
- references and relationship cardinality
- metadata
- versioning

Owns:

```
Schema

Field

Field Type

Validation

Reference Definition
```

Schemas describe the **domain** (structure, relations, capabilities)—not merely the form shown in Studio.

---

## Dataset Engine

Responsible for:

- datasets
- collections
- namespaces
- dataset metadata

Owns:

```
Dataset

Namespace

Collection
```

---

## Document Engine

Responsible for **entity lifecycle** capabilities that some records use:

- revisions
- drafts
- publishing
- version history

Owns:

```
Entity (canonical record)

Revision

Draft

Publication
```

This engine must not imply that all records are CMS documents. `Municipality` and `Article` share the entity primitive; publishing is a **capability**, not a separate store. Do not split “content storage” from “data storage.”

---

## Asset Engine

Responsible for:

- images
- video
- files
- metadata
- transformations

Owns:

```
Asset

Variant

Metadata

Storage Reference
```

---

## Import Engine

Responsible for:

- file imports
- database imports
- API imports
- AI imports

Owns:

```
Import

Import Job

Import Mapping

Import Result

Validation Report
```

Import Engine never modifies datasets directly.

It produces validated data for the Dataset Engine.

Conceptual ingestion path (Sources):

```
fetch → transform → identity matching → normalize → upsert/sync
```

DataSource ([ADR-0015](../adr/ADR-0015%20—%20DataSource%20Model.md)) is the Core registry. Adapter implementations are intended to live outside generic Core—see **Sources placement** below.

---

## Connector Engine

Responsible for external systems.

Examples:

- PostgreSQL
- MySQL
- REST
- GraphQL
- RSS
- S3
- Google Sheets
- Git
- Azure Blob

Connectors should be replaceable.

---

## Pipeline Engine

Responsible for transforming information.

Examples:

```
Import

↓

Validate

↓

Normalize

↓

Enrich

↓

Deduplicate

↓

Generate Slugs

↓

Publish
```

Pipelines should be reusable.

---

## Query Engine

Responsible for reading information.

It should provide:

- filtering
- sorting
- pagination
- projections
- joins
- reverse-reference / graph traversal
- AI-assisted querying

Relations are a foundation of the query model (typed references; one-to-one, one-to-many, many-to-many over time; referential integrity on write). The Query Engine should not modify data.

---

## Search Engine

Responsible for:

- indexing
- full-text search
- autocomplete
- facets
- ranking

Search is separate from querying.

Queries return structured information.

Search returns relevant information.

---

## Permission Engine

Responsible for:

- authentication
- authorization
- roles
- permissions
- ownership

Permissions should be evaluated centrally.

Individual engines should not implement custom permission systems.

---

## Event Engine

Responsible for publishing events.

Examples:

```
Document Created

Schema Updated

Import Finished

Asset Uploaded

Pipeline Completed
```

Events should be immutable.

---

## AI Engine

Responsible for AI capabilities.

Examples:

- schema suggestions
- field detection
- relationship discovery
- import assistance
- query generation
- summarization
- semantic search

AI should consume the same APIs available to everyone else.

It should not bypass Core.

---

## API Engine

Responsible for exposing the platform.

Examples:

- REST
- Webhooks
- Streaming
- Realtime
- SDK support

API Engine should never contain business logic.

It exposes Core.

---

## Plugin Engine

Responsible for extensibility.

Plugins may contribute:

- field types
- editors
- importers
- connectors
- pipeline steps
- API endpoints
- UI extensions (Studio field inputs, record editors, collection views, tools)

Plugins should never modify Core directly.

---

# Data Flow

The normal lifecycle of information is:

```
External Source

↓

Ingest (fetch / transform / identity / normalize)

↓

Validation

↓

Dataset / Entity (source values + provenance metadata)

↓

Editorial enrichment / overrides (optional)

↓

Index

↓

API

↓

Consumers
```

Information should move forward through the system.

Backwards dependencies should be avoided.

Source values and editorial overrides remain distinct ([ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)).

---

# Sources placement (intended, not implemented)

Sources are first-class in the **architecture**. They are not a late integration.

| Location | Intended responsibility |
|----------|-------------------------|
| Core `DataSource` | Registry, secrets, status, links to import/sync definitions ([ADR-0015](../adr/ADR-0015%20—%20DataSource%20Model.md)) |
| Import / Pipeline engines | Mapping, transform, validate, persist |
| `packages/sources` (planned) | Reusable adapters: fetch, transform, identity matching, normalize, emit upserts into Core |
| `apps/worker` (planned) | Long-running / scheduled ingestion separate from the interactive API process when needed |

Illustrative adapter shape (API **not locked**):

```ts
defineSource({
  name: "ssb-population",
  target: "municipality",
  fetch: ...,
  transform: ...,
  identity: ...,
});
```

Do not implement this package layout in a docs-only change. Do not invent a second import engine.

---

# Relations (foundation)

Relations are not an optional CMS feature.

Core must support, progressively:

- typed references
- one-to-one / many-to-one
- one-to-many
- many-to-many (planned)
- reverse references (planned)
- query/filter through relations
- referential integrity on write (import validation exists; runtime policies will grow)

Example (Gaselle):

```text
Company
  ├── AnnualFinancials
  ├── GaselleQualification
  ├── Region
  └── Articles
```

Studio should later use relations to show **context around a record**. Core owns the graph; Studio only presents it.

Phase 3 shipped typed reference fields, import integrity modes, and joins. Remaining relation work is evolution of that foundation—not a new subsystem.

---

# Provenance

Provenance is planned **internal Core metadata** (origin, upstream id, fetched-at, upstream changed-at, sync status, transform, source-owned vs override). It need not appear as ordinary schema fields. See [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md).

---

# Boundaries

Every engine owns its own responsibility.

Examples:

Schema Engine defines schemas.

Dataset Engine stores datasets.

Import Engine imports.

Pipeline Engine transforms.

Query Engine reads.

API Engine exposes.

Crossing responsibilities creates technical debt.

---

# Persistence

Aurii separates logical resources from physical storage.

Logical resources include:

- Entities (records)
- Assets
- Schemas
- Datasets
- DataSources
- Provenance metadata (planned)

Physical storage may be:

- PostgreSQL
- Object Storage
- Search Index
- Cache

Engines should not depend on storage implementation.

---

# Scalability

Aurii should scale horizontally.

Long-running work should happen asynchronously.

Examples include:

- imports
- indexing
- AI processing
- image transformations
- exports

Interactive requests should remain fast.

---

# Future Architecture

Future engines may include:

- Workflow Engine
- Automation Engine
- Collaboration Engine
- Localization Engine
- Analytics Engine
- Billing Engine
- Marketplace Engine

These should integrate without requiring changes to existing engines.

---

# Summary

Aurii is designed as a modular platform.

Each engine owns one responsibility.

Every engine communicates through public contracts.

Core remains independent from applications.

This architecture enables Aurii to evolve from a single self-hosted installation to a distributed enterprise platform without changing its fundamental design.