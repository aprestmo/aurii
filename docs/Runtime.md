# Runtime

> The Runtime is the execution environment of Aurii.
>
> It is the engine that interprets the declarative languages,
> coordinates the platform and guarantees consistent behavior.
>
> If Schema Language is the blueprint,
> Runtime is the machine.

---

# Purpose

Aurii is not a framework.

Aurii is not a CMS.

Aurii is a declarative runtime for structured knowledge.

**Clarification:** Core is not a CMS. Records are not assumed to be articles. Optional authoring clients may power CMS products. Studio is an extensible client, not the Runtime. See `docs/PRODUCT_MODEL.md`, ADR-0010, ADR-0020.

The Runtime exists to execute the platform.

Applications describe intent.

Runtime performs execution.

---

# Philosophy

Traditional applications contain business logic.

Aurii contains execution logic.

Business behavior should be declared through:

- Schemas
- Capabilities
- Pipelines
- Queries

The Runtime interprets these declarations.

This separation keeps the platform generic.

---

# The Runtime Model

Aurii consists of six fundamental concepts.

```
Runtime

├── Schema Language
├── Query Language
├── Pipeline Language
├── Capability Model
├── Plugin Runtime
└── Entity Model
```

Everything else is built on top.

---

# Responsibilities

Runtime owns:

- execution
- orchestration
- transactions
- permissions
- event dispatch
- scheduling
- lifecycle management
- plugin execution
- caching
- consistency

Runtime does not own business logic.

---

# Declarative Execution

Applications never instruct Runtime how to perform work.

Applications declare intent.

Example:

```
Publish Entity
```

Runtime decides:

```
Validate

↓

Permissions

↓

Workflow

↓

Version

↓

Persist

↓

Index

↓

Events

↓

Notifications
```

Applications describe outcomes.

Runtime performs work.

---

# Schema Execution

Schemas are interpreted.

Runtime evaluates:

- field definitions
- validation
- defaults
- references
- capabilities
- search metadata
- API metadata

Schemas become executable specifications.

---

# Query Execution

Queries describe desired information.

Runtime performs:

- planning
- optimization
- permission filtering
- relationship traversal
- projection
- aggregation

Applications never optimize queries.

Runtime does.

---

# Pipeline Execution

Pipelines describe transformations.

Runtime schedules:

- execution order
- retries
- batching
- transactions
- parallelism
- rollback

Pipelines remain declarative.

---

# Capability Execution

Capabilities describe behavior.

Runtime decides how behavior executes.

Example:

```
Capability

↓

Publish
```

Runtime performs:

- validation
- workflow
- state transition
- indexing
- event publication

Capabilities never contain implementation.

---

# Plugin Execution

Plugins execute inside Runtime.

Runtime guarantees:

- isolation
- dependency resolution
- permissions
- lifecycle
- compatibility

Plugins extend Runtime.

They never replace it.

---

# Entity Lifecycle

Runtime owns every Entity lifecycle.

```
Create

↓

Validate

↓

Store

↓

Index

↓

Publish Event

↓

Ready
```

Every Entity follows identical principles.

---

# Transactions

Runtime guarantees consistency.

Examples:

```
Pipeline

↓

Schema Validation

↓

Storage

↓

Search Index

↓

Events
```

Either the complete operation succeeds,

or none of it does.

---

# Event Bus

Runtime owns the Event Bus.

Events connect every subsystem.

Examples:

```
Entity Published

↓

Plugins

↓

Pipelines

↓

Notifications

↓

Webhooks
```

Components communicate through events.

Not direct dependencies.

---

# Scheduling

Runtime schedules background work.

Examples:

- imports
- indexing
- AI
- asset processing
- exports

Scheduling should remain transparent.

---

# Security

Runtime evaluates:

- authentication
- authorization
- permissions
- capabilities
- ownership

Security is centralized.

Applications never implement permission logic.

---

# Storage

Runtime never depends directly on PostgreSQL.

Instead:

```
Runtime

↓

Storage Adapter

↓

Database
```

Storage becomes replaceable.

---

# Search

Runtime owns search synchronization.

Applications never update indexes directly.

Indexes derive from Entities.

---

# AI

Runtime coordinates AI.

AI never bypasses Runtime.

Instead:

```
AI

↓

Runtime

↓

Schema

↓

Entities

↓

Result
```

AI becomes predictable.

---

# Observability

Runtime exposes:

- metrics
- traces
- logs
- events
- diagnostics
- execution graphs

Every operation should be explainable.

---

# Scaling

Runtime should support:

- horizontal scaling
- background workers
- distributed execution
- queue processing
- stateless APIs

Scaling belongs inside Runtime.

Applications remain unchanged.

---

# Why Runtime Exists

Without Runtime:

Applications become responsible for:

- validation
- permissions
- workflow
- events
- transactions
- indexing

Every application becomes different.

With Runtime:

Applications describe intent.

Runtime guarantees consistency.

The platform behaves identically regardless of the client.

---

# Relationship To Other Documents

The Runtime executes:

- Schema Language
- Query Language
- Pipeline Language
- Capability Model
- Plugin Runtime

Core is the implementation.

Runtime is the concept.

---

# Guiding Principle

Applications should describe **what** they want.

The Runtime decides **how** it happens.

This separation is the architectural foundation of Aurii.