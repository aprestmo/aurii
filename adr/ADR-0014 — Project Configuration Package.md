ADR-0014 — Project Configuration Package

Status: Accepted
Date: 2026-08-01
Decision Makers: Aurii Project
Related: ADR-0010 (Optional Authoring Layer), ADR-0011 (Project as Top-Level Boundary), ADR-0012 (Project-Scoped Datasets)

⸻

Context

Aurii needs a versioned, declarative way for a developer to describe an installable project: schemas, data sources, imports, sync definitions, published routes, and Studio configuration. Norwegian Geo already uses `product.yaml` / `module.yaml` / `lib/manifest.ts` as a **product composition** convention. Core already has a **Project** tenancy type (ADR-0011).

Without a clear decision, agents risk inventing a parallel “Product Runtime” that duplicates Project, Dataset, and product.yaml.

⸻

Decision

1. **Introduce `aurii.config.ts` as the project package entry** via `defineProject()` from `@aurii/core`. The config is versioned (`version: 1`), typesafe, and validatable without starting Studio.

2. **Project package ≠ Core Project ≠ Product ≠ Dataset**

| Concept | Role |
|---------|------|
| **Project package** (`aurii.config.ts`) | Files on disk: schemas, sources, imports, routes, studio config |
| **Core Project** | Runtime tenancy / admin boundary (UUID + slug) |
| **Product** (`product.yaml`) | Shipping composition (modules, layers, consumers) — remains convention |
| **Dataset** | Storage / query boundary owned by a Core Project |

3. **Link by slug.** `core.projectSlug` binds the package to a Core Project. `core.defaultDataset` selects the default Dataset. No new Core “Product” table.

4. **Do not invent a Product Runtime.** `product.yaml` remains complementary documentation/composition. Phase 4 may add SDK helpers to load manifests; that is not a second tenancy model.

5. **Validation is offline.** Invalid schema/studio/route references fail at load/validate time with path-scoped issues. Duplicate ids are rejected.

⸻

Consequences

Positive

* Clear developer install path: clone project → point at Core → run Studio
* Reuses Project / Dataset / import engines
* Norwegian Geo can keep `product.yaml` while gaining `aurii.config.ts`

Tradeoffs

* Two manifests (`product.yaml` and `aurii.config.ts`) until consolidation later — document the relationship rather than force a breaking merge now
* File references are relative paths; resolution depends on package root

Non-goals

* Replacing Core Project rows with files
* Embedding Studio business logic in the config
* Full plugin marketplace

⸻

Norwegian Geo

`demo/norwegian-geo/aurii.config.ts` is the reference project package. It points at project slug `norge-data` and dataset `norwegian-geo`, and coexists with `product.yaml`.
