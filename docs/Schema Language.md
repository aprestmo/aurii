# Schema Language

> Schemas are the language of Aurii.
>
> They describe structure, behavior and meaning.
> Every part of the platform derives its behavior from schemas.

---

# Project write policy

Schemas are stored per dataset (`id` + `dataset_id`). Project is derived as `Schema → Dataset → Project`.

Runtime mutations (`registerSchema`, `deleteSchema`, project-scoped `POST .../schemas`) require an **active** project. Reads remain available for inactive and archived projects.

Static product YAML files are not runtime mutations until Core registration runs. See [ADR-0013](../adr/ADR-0013%20—%20Project%20Write%20Policy%20for%20Dataset-Bound%20Resources.md).

---

# Purpose

Schemas are the foundation of Aurii.

Nothing exists inside Core without a Schema.

Schemas are not validation files.

Schemas are not database definitions.

Schemas are executable specifications.

They describe how information behaves throughout the platform.

---

# Philosophy

Most systems use schemas to describe storage.

Aurii uses schemas to describe reality.

A Schema answers questions such as:

- What is this?
- What fields exist?
- How are they validated?
- How are they related?
- How should they be edited? (default generated UI; replaceable)
- How should they be queried?
- How should they be indexed?
- How should AI understand them?
- Who may access them?
- How are they imported?
- How are they exported?
- Which fields are relations, and to which schemas?

One Schema drives the entire platform. It describes the **domain**, not merely the schema of a Studio form.

---

# Everything Starts With A Schema

Nothing should enter Core without a Schema.

```
Schema

↓

Entity

↓

Validation

↓

Storage

↓

Search

↓

API

↓

Applications
```

Schemas are the first object created in a project.

Everything else follows.

---

# A Schema Is Declarative

Schemas describe.

Core executes.

Schemas never contain application logic.

Instead they express intent.

Example:

```
This field is required.

This relationship is one-to-many.

This value is searchable.

This field is localized.

This entity is versioned.

This entity supports publishing.
```

Core turns those declarations into behavior.

---

# One Schema, Many Consumers

A single Schema should drive:

- validation
- storage
- editor generation
- API generation
- search indexing
- AI context
- imports
- exports
- documentation

The Schema should never be duplicated between systems.

---

# Structure

Every Schema contains:

```
Schema

├── Identity

├── Metadata

├── Fields

├── Relationships

├── Validation

├── Behaviors

├── Permissions

├── Search

├── API

├── Import

├── AI

└── Version
```

---

# Identity

Every Schema has:

- id
- name
- namespace
- version
- title
- description

Identity is immutable.

Versions evolve.

---

# Metadata

Metadata describes the Schema itself.

Examples:

- owner
- tags
- created
- updated
- documentation
- examples

Schemas should document themselves.

---

# Fields

Fields define values.

Examples:

```
string

number

boolean

date

datetime

slug

reference

array

object

json

asset

richtext

blocks
```

Field types should be extensible.

Plugins may introduce new field types.

A schema may mix scalar/structured fields and rich/free-form fields on the **same** record (playground facts + tips; match score + match report). Rich content is a field type (or plugin type), not a parallel document store.

Studio may generate default inputs from field types. Custom field inputs may replace those defaults ([ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)). The schema still describes the domain, not only the form.

---

# Relationships

Relationships define how Entities connect. They are a **foundation** of Schema Language, not merely UI metadata.

The schema must be able to declare:

- typed references (`type: reference`, `to:`)
- cardinality: one-to-one, many-to-one, one-to-many (`multiple`), many-to-many (planned)
- reverse / incoming references (planned)
- integrity expectations (required, on-delete behavior—planned)

Implemented reference fields: [`Schema-Language-References.md`](Schema-Language-References.md).

Examples:

```
Author → Article
Municipality → County
Company → Region
Article → Company   (content references data without owning it)
Match → events[] → Player
```

Relationships should always be typed.

Schemas describe the relationship.

Core enforces it.

Studio may generate default relation pickers and later show reverse-reference context. That UI is derived from the schema; the schema is not derived from Studio.

---

# Validation

Validation belongs inside Schemas.

Examples:

```
required

minimum

maximum

pattern

enum

unique

custom validator
```

Validation should be deterministic.

AI may assist.

Core decides.

---

# Behaviors

Behaviors define platform capabilities.

Examples:

```
Versioned

Publishable

Localized

Searchable

Auditable

Soft Delete

Immutable
```

Instead of hardcoding these capabilities,

Schemas declare them.

---

# Permissions

Schemas may declare permission models.

Examples:

```
Editors

Administrators

Readers

API Clients
```

Permissions should inherit from Core.

Schemas may specialize.

---

# Search

Schemas define search behavior.

Examples:

```
Searchable Fields

Boosting

Facets

Autocomplete

Synonyms
```

Search should be generated automatically.

---

# API

Schemas define how APIs behave.

Examples:

```
Readable

Writable

Public

Private

Rate Limited
```

The API should emerge from the Schema.

Not the opposite.

---

# Imports

Schemas guide imports.

Examples:

```
Required Fields

Default Mapping

Transforms

Normalization

Duplicate Detection
```

Imports become predictable.

---

# AI

Schemas provide context for AI.

Examples:

```
Meaning

Relationships

Examples

Descriptions

Allowed Values
```

The richer the Schema,

the better AI understands the domain.

---

# Versioning

Schemas evolve.

Entities remain.

Schema changes should be versioned.

Migration strategies should be explicit.

Breaking changes should be detectable.

---

# Extensions

Plugins may extend Schemas.

Examples:

```
Geographic Field

Markdown Field

Rich Text

AI Prompt

Money

Color

Measurement
```

Core should not know these field types.

Plugins provide them.

---

# Derived Capabilities

One Schema should generate:

```
Editor

↓

REST API

↓

OpenAPI

↓

Validation

↓

Search

↓

Documentation

↓

SDK

↓

AI Context
```

Developers should write one definition.

Core generates the rest.

---

# Documentation

Schemas should document themselves.

Documentation should never become disconnected.

Examples:

```
Description

Examples

Deprecation

Migration Notes
```

This documentation becomes part of:

- Studio
- APIs
- SDKs
- AI prompts

---

# Schema Registry

Projects contain many Schemas.

Core should maintain a Schema Registry.

The Registry provides:

- discovery
- lookup
- dependency tracking
- version history
- validation
- migrations

Every Schema belongs to the Registry.

---

# Schema Evolution

Schemas should evolve safely.

Changes may include:

- new fields
- removed fields
- renamed fields
- changed validation
- new relationships

Core should understand the impact before changes are applied.

---

# Why Schemas Matter

Schemas are not configuration.

Schemas are not metadata.

Schemas are not code generation.

Schemas are the language that defines Aurii.

Everything else derives from them.

Without Schemas,

Core is only storage.

With Schemas,

Core becomes a platform.

---

# Guiding Principle

Whenever new functionality is added,

ask one question:

> Should this capability be expressed by the Schema?

If the answer is yes,

the platform becomes simpler.

If the answer is no,

the capability probably belongs somewhere else.