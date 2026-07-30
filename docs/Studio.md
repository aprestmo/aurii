# Studio

> Studio is Aurii's primary administrative user interface.
>
> It is not the platform.
>
> It is a client of the platform.
>
> **Implemented today:** a generic **data workspace** (dashboard, import wizard, entity browser, schemas, query playground).
>
> **Planned / visionary (not all implemented):** schema-generated editors, authoring workflows, AI assistants, collaboration, plugins. Treat sections below that describe those capabilities as design intent unless marked implemented. Product boundaries: [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md). ADR: [ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

# Purpose

Studio exists to make the Runtime accessible to humans.

Everything available inside Studio should ultimately be available through the Runtime.

Studio should never contain business logic.

Studio visualizes the platform.

The Runtime executes it.

A future **authoring workspace** may share a Studio shell; it remains an optional client. Frontends never read through Studio or a CMS UI.

---

# Philosophy

Traditional CMS platforms are editor-first.

Aurii is Runtime-first.

Studio should therefore be built exactly like any other application.

```
Studio

↓

Runtime

↓

Entities
```

Studio never talks directly to storage.

Studio never bypasses APIs.

Studio never owns business logic.

---

# Studio Is Generated

Studio should not be hardcoded.

Instead, Studio should emerge from:

- Schema Language
- Capability Model
- Runtime
- Plugins

The interface is assembled dynamically.

---

# The User Experience

Users should never think about:

- tables
- collections
- JSON
- storage
- implementation

Instead they should think about:

- information
- relationships
- workflows
- publishing

Studio hides implementation.

Runtime guarantees consistency.

---

# Navigation

Studio should be organized around knowledge.

Example:

```
Project

├── Schemas

├── Entities

├── Imports

├── Pipelines

├── Assets

├── Queries

├── AI

├── Plugins

├── Users

└── Settings
```

Every screen represents a Runtime resource.

---

# Entity Editor

The Entity Editor is generated from Schema Language.

```
Schema

↓

Fields

↓

Components

↓

Editor
```

Adding a new field type should automatically update Studio.

No manual editor implementation should be required.

---

# Capabilities Drive UI

Capabilities determine available actions.

Example:

```
Capabilities

↓

Publish

Archive

Translate

Version

Workflow
```

Studio renders actions automatically.

Applications should never inspect entity types.

---

# Views

Entities may be viewed in different ways.

Examples:

- Form
- Table
- Grid
- Kanban
- Timeline
- Calendar
- Map
- Gallery

Views are presentation.

They do not change the Entity.

---

# Relationships

Relationships should be navigable.

Example:

```
Article

↓

Author

↓

Organization

↓

Municipality
```

Users should move naturally through connected knowledge.

Studio should visualize relationships instead of hiding them.

---

# Search

Search should be global.

Users should search:

- Entities
- Assets
- Schemas
- Imports
- Pipelines
- Plugins

Search is the primary navigation mechanism.

---

# AI

AI is integrated throughout Studio.

Examples:

- Create Schema
- Explain Entity
- Generate Query
- Suggest Relationships
- Clean Imports
- Write Documentation

AI appears where it adds value.

Never as a separate product.

---

# Import Experience

Import should feel like onboarding knowledge.

Example:

```
Choose Source

↓

Analyze

↓

Review

↓

Map

↓

Transform

↓

Preview

↓

Import

↓

Done
```

Users should understand what is happening.

---

# Pipeline Builder

Studio should visualize Pipelines.

```
Import

↓

Normalize

↓

Validate

↓

Publish

↓

Notify
```

Visual editing is optional.

The Pipeline remains declarative.

---

# Schema Designer

Schema editing should focus on concepts.

Users define:

- fields
- relationships
- capabilities
- validation
- documentation

Studio generates the rest.

---

# Query Builder

Users should build queries visually.

Advanced users may edit Query Language directly.

Both interfaces produce the same Query.

---

# Runtime Inspector

Studio should expose Runtime activity.

Examples:

- events
- jobs
- queues
- imports
- pipelines
- AI activity
- logs

Users should understand why the platform behaves as it does.

---

# Collaboration

Studio should support collaboration.

Examples:

- comments
- mentions
- presence
- assignments
- review

Collaboration belongs around Entities.

Not around pages.

---

# Plugins

Plugins extend Studio automatically.

Examples:

- new editors
- dashboards
- panels
- widgets
- inspectors

Studio discovers extensions.

It never hardcodes them.

---

# Accessibility

Studio should be fully accessible.

Keyboard-first.

Screen-reader friendly.

High contrast support.

Localization support.

Accessibility is a platform requirement.

---

# Offline

Where practical, Studio should tolerate temporary network loss.

Edits should synchronize when connectivity returns.

The Runtime remains authoritative.

---

# Performance

Studio should remain responsive regardless of dataset size.

Large operations should execute asynchronously.

Users should always receive progress feedback.

---

# The Future

Eventually, Studio should become only one of many clients.

Other clients might include:

- mobile apps
- CLI
- VS Code
- AI agents
- custom dashboards
- third-party applications

Every client consumes the same Runtime.

---

# Guiding Principle

Studio should never invent behavior.

It should reveal the behavior already defined by:

- Runtime
- Schema Language
- Capability Model
- Pipeline Language
- Query Language

If Studio contains business logic,

the architecture has failed.