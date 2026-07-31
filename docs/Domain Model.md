# Domain Model

> Everything in Aurii is an Entity.
>
> The Domain Model defines the logical concepts that make up the platform.
> These concepts are independent of storage, APIs and user interfaces.
>
> The Domain Model is the conceptual heart of Aurii.

---

# Philosophy

Traditional CMS platforms are document-centric.

Traditional databases are table-centric.

Traditional file systems are file-centric.

Aurii is entity-centric.

Every piece of information is represented as an Entity.

An article is an Entity.

A municipality is an Entity.

A customer is an Entity.

An image is an Entity.

A dataset is an Entity.

A schema is an Entity.

Everything begins with an Entity.

---

# The Entity

An Entity represents one identifiable object within the platform.

Every Entity has:

- an identifier
- a schema
- metadata
- lifecycle information
- relationships
- permissions

An Entity may also contain data.

```
Entity

├── ID
├── Schema
├── Values
├── Metadata
├── Relations
├── State
└── History
```

Entities are immutable in identity.

Their contents may evolve.

---

# Identity

Every Entity owns a globally unique identifier.

The identifier never changes.

It survives:

- renaming
- moving
- publishing
- importing
- schema evolution

Identity should never depend on titles, slugs or filenames.

---

# Schema

Every Entity belongs to exactly one Schema.

The Schema defines:

- available fields
- validation
- relationships
- indexing
- permissions
- editor behaviour
- API exposure

Changing a Schema affects every Entity using it.

---

# Values

Values contain the actual business data.

Examples:

Article

```
Title

Ingress

Body

Author

PublishedAt
```

Municipality

```
Name

Population

Area

County

Coordinates
```

Company

```
Name

Organization Number

Address

Industry
```

The platform does not distinguish between these internally.

They are all values attached to an Entity.

---

# Metadata

Metadata describes the Entity itself.

Typical metadata includes:

- created
- updated
- creator
- editor
- language
- status
- revision
- tags

Metadata is separate from business data.

---

# State

Entities move through states.

Example:

```
Draft

↓

Review

↓

Approved

↓

Published

↓

Archived

↓

Deleted
```

State transitions should be configurable.

---

# History

Aurii keeps history.

History includes:

- revisions
- imports
- edits
- publishing
- schema migrations

History should be append-only.

Nothing important should disappear.

---

# Relationships

Entities rarely exist alone.

Relationships are first-class.

Examples:

```
Article

↓

Author

↓

Person
```

```
Company

↓

Municipality
```

```
Image

↓

Photographer
```

Relationships are typed.

Examples:

```
owns

references

belongs_to

contains

depends_on

located_in
```

Relationships should always be queryable.

---

# Assets

Assets are Entities.

An image is not special.

It simply has another Schema.

Example:

```
Asset

Filename

MimeType

Width

Height

Checksum

StorageReference
```

The binary file itself lives in object storage.

The metadata lives inside Core.

---

# Schemas

Schemas are also Entities.

This allows:

- versioning
- permissions
- history
- documentation

Schemas describe other Entities.

---

# Datasets

Datasets are Entities.

A Dataset groups Entities.

Examples:

```
Norwegian Municipalities

↓

Entity

↓

Entity

↓

Entity
```

Datasets provide:

- ownership
- organization
- indexing
- permissions

---

# Imports

Imports are Entities.

An Import contains:

- source
- mapping
- pipeline
- validation
- execution history

Imports become reusable resources.

---

# Pipelines

Pipelines are Entities.

Each Pipeline defines a sequence of transformations.

```
Import

↓

Normalize

↓

Validate

↓

Enrich

↓

Store
```

Pipelines can be reused by many Imports.

---

# Connectors

Connectors are Entities.

Examples:

- PostgreSQL
- S3
- REST
- GraphQL
- Git
- Google Sheets

A Connector stores configuration and capabilities.

---

# Users

Users are Entities.

Authentication is separate.

A User Entity represents information about a person.

Identity providers may include:

- Entra ID
- Google
- GitHub
- Local Accounts

Authentication may change.

The User Entity remains.

---

# Organizations

Organizations are Entities.

Organizations own:

- projects
- datasets
- users
- assets
- permissions

Aurii should support multi-tenancy through Organizations.

---

# Projects

Projects are the top-level administrative and security boundary in Aurii.

A Project is identified by a stable UUID. A unique slug provides human-readable addressing. Name and slug may change without breaking identity.

Status values: `active`, `inactive`, `archived`.

A Project may contain (as future resources attach to `projectId`):

- datasets
- schemas
- imports
- relations
- API routes and keys
- saved queries and data views
- assets
- connectors
- pipelines

Projects provide logical separation. Cross-project references must be explicit (stable ids or declarative queries)—data is not copied between projects by default.

See [`PROJECTS.md`](PROJECTS.md) and [ADR-0011](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md).

Note: Project is implemented as a platform resource (dedicated table), not as a Schema-backed Entity. Content Entities remain schema-typed; Project organizes them.

---

# Collections

Collections are logical views.

Collections are not storage.

Examples:

```
Published Articles

Recent Imports

Images

Products
```

Collections are generated through queries.

---

# Tags

Tags are Entities.

Not strings.

This enables:

- localization
- metadata
- hierarchy
- permissions

---

# Taxonomies

Taxonomies are Entities.

Examples:

Categories

Topics

Departments

Regions

Languages

Taxonomies provide controlled vocabularies.

---

# AI Knowledge

AI should reason about Entities.

Not documents.

This allows one model to understand:

- articles
- products
- municipalities
- organizations
- events
- assets

using the same conceptual framework.

---

# Why Everything Is An Entity

This simplifies the platform enormously.

Instead of building special cases for:

- articles
- images
- products
- users
- imports
- assets
- schemas

Core understands one primitive:

Entity.

Everything else is behavior defined by Schemas.

---

# Domain Hierarchy

```
Organization

└── Project

    ├── Schema

    ├── Dataset

    │     ├── Entity

    │     ├── Entity

    │     └── Entity

    ├── Import

    ├── Pipeline

    ├── Connector

    └── Asset
```

Every resource ultimately becomes an Entity.

---

# Summary

Aurii is not document-centric.

Aurii is entity-centric.

Every object in the platform is represented by the same conceptual primitive.

Schemas define behavior.

Entities hold information.

Everything else emerges from those two concepts.