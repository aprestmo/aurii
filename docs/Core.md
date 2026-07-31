# Core

> Core is the runtime of Aurii.
>
> Every capability exposed by the platform ultimately flows through Core.
> Core owns the data model, enforces the rules, coordinates the engines and exposes the platform.
>
> Core is the product.

---

# Purpose

Core exists to answer one question:

> How should structured information behave?

Core does **not** exist to render websites.

It does **not** exist to edit pages.

It does **not** exist to build user interfaces.

Core exists to manage information.

---

# The Runtime

Aurii Core should be viewed as a runtime rather than a backend.

Applications interact with Core.

Schemas configure Core.

Entities live inside Core.

Plugins extend Core.

Everything else is built on top.

```
          Applications

                │

                ▼

          Aurii Runtime

                │

        ┌───────┴────────┐

        │                │

     Schemas         Plugins

        │                │

        └───────┬────────┘

                │

             Entities

                │

         PostgreSQL Storage
```

Core is responsible for making this ecosystem work.

---

# Responsibilities

Core owns:

- Entity lifecycle
- Schema execution
- Validation
- Relationships
- Query execution
- Transactions
- Permissions
- Events
- Plugins
- APIs
- AI integration

Everything else builds on these capabilities.

---

# Core Is Generic

Core must never contain business-specific knowledge.

Core should not know about:

- Articles
- Products
- Municipalities
- Companies
- Employees
- Customers

Core only understands:

- Entities
- Schemas
- Relationships

Business concepts belong in schemas.

---

# Core Concepts

Core consists of a very small set of primitives.

```
Project

Entity

Schema

Field

Relationship

Query

Event

Plugin
```

**Project** is the administrative and security boundary for future resources (datasets, imports, API routes, keys). See [`PROJECTS.md`](PROJECTS.md) and [ADR-0011](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md). Content remains Entity/Schema-centric within that boundary.

Everything else is built from these primitives.

The fewer primitives Core requires, the more powerful it becomes.

---

# Entity Lifecycle

Every Entity follows the same lifecycle.

```
Create

↓

Validate

↓

Persist

↓

Index

↓

Publish Event

↓

Available Through API
```

Updates follow the same flow.

Deleting an Entity should also follow the lifecycle.

No subsystem should bypass Core.

---

# Schema Execution

Schemas are executable.

They are not passive definitions.

Core executes schemas during:

- validation
- imports
- querying
- indexing
- editing
- API generation

Schemas influence nearly every subsystem.

---

# Validation

Validation belongs inside Core.

Not Studio.

Not APIs.

Not importers.

Every Entity entering Core must pass validation.

Validation rules come from Schemas.

---

# Relationships

Relationships are owned by Core.

Core understands:

```
Entity

↓

Relationship

↓

Entity
```

Relationship types are configurable.

Examples:

- references
- owns
- belongs_to
- contains
- parent_of

Core should never hardcode relationship semantics.

---

# Transactions

Core guarantees consistency.

Operations should be transactional whenever possible.

Examples:

```
Import

↓

Validation

↓

Store

↓

Index

↓

Publish Event
```

Either everything succeeds,

or nothing succeeds.

---

# Query Execution

Queries execute inside Core.

Core understands:

- filtering
- sorting
- pagination
- projections
- relationships
- aggregations

Applications should never query the database directly.

Everything flows through Core.

---

# Events

Core publishes events.

Examples:

```
EntityCreated

EntityUpdated

EntityDeleted

SchemaUpdated

ImportCompleted
```

Events are immutable.

Consumers react to events.

Core never reacts to itself through APIs.

---

# Permissions

Permissions belong inside Core.

Not Studio.

Not REST.

Not GraphQL.

Permissions protect Entities.

Applications consume permission decisions.

They do not implement them.

---

# Search

Search is built from Entity data.

Core is responsible for maintaining search indexes.

Search should not own the canonical data.

Search is derived.

Core is authoritative.

---

# Assets

Assets are Entities.

Object storage stores binaries.

Core stores metadata.

```
Object Storage

↓

Binary

↓

Asset Entity

↓

Relationships

↓

API
```

Core should never assume a specific storage provider.

---

# Imports

Imports never write directly to storage.

Imports submit Entities to Core.

Core performs:

- validation
- transactions
- indexing
- events

This guarantees consistent behavior.

---

# AI

AI never bypasses Core.

AI consumes the same APIs available to developers.

AI may suggest.

Core decides.

This keeps AI predictable.

---

# Plugins

Plugins extend Core.

Plugins may contribute:

- field types
- schema rules
- importers
- connectors
- pipeline stages
- AI capabilities
- API extensions

Plugins should extend.

Never modify.

---

# Storage

Core owns logical persistence.

Storage engines own physical persistence.

```
Core

↓

Storage Adapter

↓

PostgreSQL

or

Future Storage
```

Core should depend on abstractions.

Not implementations.

---

# Scaling

Core should support horizontal scaling.

Heavy workloads should execute asynchronously.

Examples:

- imports
- AI jobs
- indexing
- exports
- image processing

Interactive requests should remain lightweight.

---

# Observability

Core should expose:

- logs
- metrics
- traces
- health
- events

Every important operation should be observable.

Production systems require visibility.

---

# API Generation

Core should be capable of generating APIs automatically from Schemas.

Examples:

```
Schema

↓

REST

↓

OpenAPI

↓

SDK
```

Developers should write schemas.

Not repetitive CRUD endpoints.

---

# Why Core Exists

Core exists to remove complexity from applications.

Applications should not implement:

- validation
- permissions
- schema execution
- indexing
- relationships
- events

Core provides these once.

Every application benefits.

---

# Guiding Principle

If functionality can be generalized into Core,

it probably belongs in Core.

If functionality exists only because one application needs it,

it probably belongs outside Core.

Core should become smaller,

more generic,

and more powerful over time.