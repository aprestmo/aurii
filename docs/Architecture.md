# Architecture

> Architecture describes how Aurii is organized internally.
>
> It does not describe implementation details.
> It describes responsibilities, boundaries and interactions between the major parts of the platform.
>
> **Product boundaries** (Core vs Studio vs optional authoring vs consumers): [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md).  
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
 │ Studio (data workspace; optional authoring later) │
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
- indexing information
- exposing information
- securing information
- transforming information

Core is **not** responsible for presentation.

Core contains no assumptions about websites, editors or user interfaces.

---

# Studio

Studio is an application.

It is not part of Core.

Studio consumes the same APIs available to external developers.

Its responsibilities include:

- editing
- administration
- dashboards
- schema editing
- media browsing
- user management

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
- references
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

Responsible for:

- documents
- revisions
- drafts
- publishing
- version history

Owns:

```
Document

Revision

Draft

Publication
```

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
- graph traversal
- AI-assisted querying

The Query Engine should not modify data.

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
- UI extensions

Plugins should never modify Core directly.

---

# Data Flow

The normal lifecycle of information is:

```
External Source

↓

Import

↓

Validation

↓

Transformation

↓

Dataset

↓

Document

↓

Index

↓

API

↓

Consumers
```

Information should move forward through the system.

Backwards dependencies should be avoided.

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

- Documents
- Assets
- Schemas
- Datasets

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