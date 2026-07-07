# AGENTS.md

> This document defines how AI agents should reason about, design and implement Aurii.
>
> It is not merely a coding guide.
>
> It is the architectural philosophy of the project.

---

# Mission

Your mission is not to write code.

Your mission is to build Aurii.

Every decision should move the platform closer to becoming the best runtime for structured knowledge.

Never optimize for short-term implementation if it compromises long-term architecture.

---

# Understand Aurii

Aurii is **not** a CMS.

Aurii is **not** a database.

Aurii is **not** an API framework.

Aurii is a **Declarative Runtime for Structured Knowledge**.

Everything you build should reinforce that vision.

---

# Before Writing Code

Before implementing anything, ask yourself:

1. Does this belong in the Runtime?
2. Does this belong in Schema Language?
3. Does this belong in Query Language?
4. Does this belong in Pipeline Language?
5. Does this belong in the Capability Model?
6. Can this be implemented as a Plugin?
7. Does this make Aurii more generic?

If you cannot answer these questions, stop and think before writing code.

---

# Runtime First

The Runtime is the heart of Aurii.

Applications exist because the Runtime exists.

Never allow application-specific requirements to shape the Runtime unnecessarily.

Applications adapt to Runtime.

Never the opposite.

---

# Everything Is An Entity

Never introduce special object types unless absolutely necessary.

Whenever you encounter something new, ask:

> Can this simply be another Entity with another Schema?

Prefer one generic abstraction over many specialized ones.

---

# Schema Is The Source Of Truth

Schemas define:

- structure
- validation
- relationships
- capabilities
- API behavior
- search behavior
- AI context

Never duplicate information already present in a Schema.

Whenever behavior can be expressed declaratively, prefer the Schema.

---

# Think Declaratively

Avoid imperative designs.

Instead of asking:

> "How should this feature work?"

Ask:

> "How can this behavior be declared?"

Declarative systems are easier to evolve.

---

# Capabilities Before Features

Never introduce hardcoded functionality.

Instead ask:

> Is this a Capability?

Example:

Wrong:

```
Article supports publishing.
```

Correct:

```
Schema declares Publish capability.
```

Capabilities scale.

Special cases do not.

---

# Pipelines Before Scripts

Never solve recurring transformations using custom scripts.

Instead ask:

Can this become a Pipeline?

Reusable Pipelines improve the entire platform.

---

# Queries Before SQL

Applications should never think about storage.

Whenever data retrieval is needed, ask:

Can this be expressed using Query Language?

Storage is an implementation detail.

---

# Plugins Before Core

Whenever implementing functionality, ask:

Can this live outside Core?

If yes,

prefer a Plugin.

Core should become smaller over time.

---

# AI Is A User

Treat AI as another client of the Runtime.

AI never bypasses:

- permissions
- validation
- schemas
- queries

AI consumes the same platform as humans.

---

# Keep Runtime Small

The Runtime should know as little as possible.

Whenever logic becomes domain-specific,

move it:

- to Schemas
- to Plugins
- to Capabilities
- to Pipelines

Generic Runtime.

Specific Plugins.

---

# APIs Are Products

Never expose databases.

Expose concepts.

Applications should consume Runtime concepts.

Not implementation details.

---

# Events Connect The Platform

Whenever two systems need to communicate,

consider Events first.

Prefer loose coupling.

Avoid direct dependencies.

---

# Explain Your Reasoning

When proposing architectural changes:

Explain:

- why
- tradeoffs
- consequences
- future implications

Never optimize blindly.

Architecture matters.

---

# Respect Existing Decisions

Before introducing a new abstraction, ask:

Does something already solve this?

Avoid duplication.

One concept.

One responsibility.

---

# Documentation Comes First

If architecture changes,

update documentation first.

Then update code.

The specification is the source of truth.

Code implements the specification.

---

# Think In Decades

Do not optimize for today's requirements.

Design for:

- future datasets
- future AI
- future applications
- future protocols
- future storage engines

Aurii should evolve without rewriting its foundations.

---

# Simplicity Is Power

Prefer:

One concept

over

Three similar concepts.

Prefer:

One language

over

Five APIs.

Prefer:

One abstraction

over

Many implementations.

Complexity compounds.

Simplicity scales.

---

# Naming Matters

Names define architecture.

Prefer names that describe concepts.

Avoid names tied to current implementation.

Good examples:

- Runtime
- Entity
- Schema
- Capability
- Pipeline

Avoid names tied to frameworks or technologies.

---

# Think Like A Platform Engineer

You are not building pages.

You are not building forms.

You are not building CRUD.

You are building infrastructure that allows others to build those things.

Always think one level lower.

---

# Long-Term Compatibility

Breaking changes should be rare.

When changing concepts:

- preserve compatibility
- provide migrations
- document rationale

Architecture should evolve carefully.

---

# Challenge Assumptions

Never assume previous decisions are correct.

Respect them.

Question them.

Improve them when necessary.

The goal is not consistency with history.

The goal is a better platform.

---

# When Unsure

If two solutions appear valid:

Choose the one that:

- removes concepts
- removes duplication
- increases reuse
- improves declarative behavior
- reduces coupling
- improves future extensibility

Aurii should become simpler over time.

Never more complicated.

---

# Reference Demo Project

When adding features, fixing bugs, or validating architecture changes, use **Norwegian Geo** as the canonical end-to-end testbed. It is Aurii's primary reference implementation and a reusable Norwegian reference data product. Do not invent new synthetic datasets when this one already exercises the platform.

## What it is

A three-layer product built on Aurii:

```
Aurii Core → Norwegian Geo Core → Dataset Modules
```

| Layer | Location | Purpose |
|-------|----------|---------|
| **Aurii Core** | `packages/core/` | Generic runtime (no Norwegian logic) |
| **Norwegian Geo Core** | `demo/norwegian-geo/core/` | Counties, municipalities, postal codes, history |
| **Dataset modules** | `demo/norwegian-geo/modules/` | Schools, kindergartens, hospitals, holidays (+ future domains) |
| **Import** | `bun run import:norwegian-geo` | One-command import into Core (dataset: `norwegian-geo`) |
| **Tests** | `vertical-slice.test.ts`, `geo-website-routes.test.ts`, `public-reference-datasets.test.ts` | Integration coverage |
| **Consumer site** | `apps/geo` | Public website |
| **Admin client** | `apps/studio` | Entity browser (dataset: `norwegian-geo`) |

Full documentation: `docs/NORWEGIAN_GEO.md`, `docs/REFERENCE_DEMO.md`, and `Phase2.2.md`.

## When to use it

**Always extend Norwegian Geo when:**

- Adding import, query, schema, or API capabilities
- Changing SDK or storage behaviour
- Validating that a feature works end-to-end

**Workflow for agents:**

1. Read `docs/NORWEGIAN_GEO.md` to understand layer boundaries
2. Import the dataset: `bun run import:norwegian-geo`
3. Run relevant tests: `bun test` (especially `vertical-slice`, `geo-website-routes`, `public-reference-datasets`)
4. If the feature affects public consumers, update `apps/geo` or add a test there
5. New domain data → add a module under `demo/norwegian-geo/modules/`, not Core hacks

**Do not:**

- Create parallel demo datasets for the same purpose
- Hardcode Norwegian geo logic in Core (keep it in schemas, imports, and the Norwegian Geo product)
- Skip integration tests and rely only on unit tests

## Example queries (copy-paste)

```
from county order by name asc
from municipality where countyId == "03"
from postal-code where municipalityId == "0301" limit 10
```

---

# The Final Question

Before every pull request, every design decision and every implementation, ask one question:

> Does this make Aurii a better Declarative Runtime for Structured Knowledge?

If the answer is yes,

continue.

If the answer is no,

rethink the design.

Everything else is secondary.