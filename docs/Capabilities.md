# Capabilities

> **Status: architectural vision / partially unrealized.**
>
> This document describes the capability *idea*: schemas declare behaviour, runtimes and products implement it.
> Listing a capability here does **not** mean Core implements it today, and does **not** imply every capability belongs in Core.
>
> Implementations follow the promotion ladder: product-local → experimental shared capability → candidate → Core only when proven fundamental.
> See [`COMPETITIVE_GUARDRAILS.md`](COMPETITIVE_GUARDRAILS.md), [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md), [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md), [`Phase5.md`](../Phase5.md).

> Capabilities define what an Entity can do.
>
> Schemas describe what an Entity is.
>
> Capabilities describe how an Entity behaves.
>
> Together they define the platform.

---

# Purpose

Most platforms mix structure and behavior.

An Article is publishable because developers hardcoded publishing.

A Product supports localization because someone implemented localization.

An Image supports variants because the Asset module says so.

Aurii takes a different approach.

Behavior is declarative.

Schemas may declare capabilities.

**Proven, fundamental** capabilities may execute in Core.
Others stay product-local, live as plugins/extensions, or remain Experimental / Candidate until reuse is proven.

Applications and products consume declared behaviour through public APIs — they do not invent private forks of Core contracts when a shared capability already exists.

---

# Philosophy

A Schema answers:

> What is this?

Capabilities answer:

> What can it do?

Those are different questions.

Keeping them separate keeps Core generic.

---

# Declarative Behavior

Instead of writing application code like:

```ts
if (entity.type === "article") {
    enablePublishing();
}
```

Aurii should express intent.

```yaml
capabilities:

- publish

- version

- workflow

- localization
```

Where a capability is registered and proven, Core (or a shared package) understands it.

Applications should prefer capability/schema contracts over hardcoding entity-type special cases — without requiring every product behaviour to live in Core first.

---

# The Capability Model

```
Schema

↓

Capabilities

↓

Core Runtime

↓

Applications
```

Every application observes the same behavior.

---

# Categories

Capabilities fall into categories.

> Listing a category does **not** mean Core implements it. Prefer maturity labels:
> Implemented / Beta / Designed / Planned / Visionary / Product-local candidate.

## Lifecycle

> **Maturity: product-local candidate for draft/publish; Planned as generic capability exploration (ADR-0010).** Not automatically Core-owned.

Examples:

```
create

update

delete

archive

restore

publish

schedule
```

---

## Versioning

> **Maturity: Pre–Phase 5 implements `entityRevision` + snapshots for concurrency/pinned refs. Full authored revision/publication UX is Planned.** See [`HISTORY_MODEL.md`](HISTORY_MODEL.md).

Examples:

```
drafts

revisions

history

compare

rollback
```

Do not collapse provenance, audit, revision, and publication into one generic “history” capability.

---

## Localization

> **Maturity: visionary / product-local until proven across products.**

Examples:

```
localized

fallback

translation

locale inheritance
```

---

## Workflow

> **Maturity: product-local candidate. Do not promote into Core for Editorial alone.**

Examples:

```
review

approval

editorial workflow

publish gates
```

---

## Search

Examples:

```
searchable

autocomplete

facets

boosting
```

---

## AI

Examples:

```
summarize

generate metadata

extract entities

semantic search

classification
```

---

## Assets

Examples:

```
thumbnails

variants

transcoding

metadata extraction
```

---

## Collaboration

Examples:

```
comments

presence

real-time editing

mentions
```

---

## Security

Examples:

```
ownership

sharing

auditing

retention
```

---

## Automation

Examples:

```
webhooks

events

scheduled tasks

notifications
```

---

# Capabilities Are Composable

Capabilities should compose naturally.

Example:

```
Article

Capabilities

Publish

Version

Workflow

Localization

Search
```

Another Schema may choose:

```
Municipality

Capabilities

Version

Search

API

Nothing else.
```

Nothing is hardcoded.

---

# Capabilities Are Optional

No capability should be mandatory.

Projects should remain lightweight.

Small installations may only use:

```
CRUD

Search
```

Enterprise installations may use:

```
Workflow

Localization

AI

Publishing

Automation

Audit

Retention
```

The platform grows with the user.

---

# Plugins

Plugins contribute capabilities.

Examples:

```
Digital Signatures

↓

Capability

----------------

Geospatial

↓

Capability

----------------

Commerce

↓

Capability
```

Core does not need to know them beforehand.

---

# Runtime

Capabilities may execute in Core when they are fundamental and proven.

Schemas declare them when behaviour is declarative.

Core enforces Core-owned capabilities.

Applications and products consume public contracts.

Products **may** implement product-local behaviour until promotion is justified.
Do not fork or bypass Core contracts when a shared capability already exists.
Do **not** treat publish, workflow, comments, localization, or similar commodity CMS features as automatically Core-owned — apply the Kyro test first.

---

# API

Capabilities become visible through APIs.

Example:

```
GET Entity

↓

Capabilities

↓

publish

archive

restore

compare
```

Applications adapt automatically.

---

# Studio

Studio should never contain hardcoded assumptions.

Instead:

```
Capability

↓

UI Component

↓

Toolbar

↓

Action
```

Studio may *eventually* map known capabilities to UI via configuration and extensions ([ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)).
Automatic UI for every capability is **not** guaranteed and must not imply Studio is a universal CMS.

---

# AI

AI should understand capabilities.

Instead of asking:

"What is an article?"

AI should ask:

"What capabilities does this Entity have?"

Capabilities explain behavior.

Schemas explain structure.

Together they explain intent.

---

# Examples

## News Article

Capabilities:

```
publish

workflow

version

localization

search

comments
```

---

## Municipality

Capabilities:

```
search

version

api
```

---

## Asset

Capabilities:

```
variants

metadata

transcoding

search
```

---

## Company

Capabilities:

```
search

history

imports

api
```

---

# Capability Registry

Projects maintain a registry.

```
Capability

↓

Definition

↓

Implementation

↓

Documentation
```

Capabilities become discoverable.

Plugins extend the registry.

---

# Why Capabilities Matter

Without Capabilities:

Applications ask:

"What kind of Entity is this?"

With Capabilities:

Applications ask:

"What can this Entity do?"

The second question scales indefinitely.

---

# Guiding Principle

Schemas define structure.

Capabilities define behavior where behaviour is declarative and reusable.

Core executes **proven fundamental** behaviour.

Applications and products observe public contracts.

Every new feature should first be considered as:

1. product-local behaviour, or
2. a Capability / plugin / extension,

before becoming hardcoded Core functionality.

Do **not** skip the promotion ladder:

```text
product-local → experimental shared → candidate → Core only if fundamental
```

Commodity CMS capabilities stay outside Core by default ([`COMPETITIVE_GUARDRAILS.md`](COMPETITIVE_GUARDRAILS.md)).