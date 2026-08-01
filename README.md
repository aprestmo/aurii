# Aurii

> A schema-driven platform for structured data—import, relate, query, and deliver.

---

## What is Aurii?

Aurii is a **schema-driven platform for structured data**. Data may arise through import, synchronization, manual registration, automation, AI, or external products. **Aurii Core is the system of record.** Studio is the project-specific workspace for administering data, data sources, data streams, relations, and published interfaces. A CMS is a possible future product that uses Aurii—it is **not** Aurii.

Aurii is **not** a traditional CMS, database, or API framework.

Canonical product vocabulary: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md).  
Optional authoring decision: [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).  
Project packages: [`adr/ADR-0014 — Project Configuration Package.md`](adr/ADR-0014%20—%20Project%20Configuration%20Package.md).

---

## Architecture

```text
Files / CSV / JSON ───────────────┐
External APIs ────────────────────┤
Scheduled sync / cron ────────────┤
External databases ───────────────┤
Studio manual operations ─────────┤
Automation / AI ──────────────────┤
Future CMS product ───────────────┘
                                  ▼
                            Aurii Core
                 ┌────────────────┼─────────────────┐
            Query API      Mutation API     Published APIs
                 └────────────────┼─────────────────┘
                                  ▼
                       SDK / HTTP / Events
              ┌───────────────────┼───────────────────┐
         Aurii Studio        Astro/frontend      Other products
```

- **Core** is system of record.
- **Studio** reads and writes through public Core APIs and the SDK—never the database.
- **Frontends** talk to Core (or published routes), not Studio.
- A **CMS is never** a required middle layer between Core and a frontend.

---

## Product modes

### 1. Data product (no CMS) — primary path today

```text
External sources → Import / sync → Aurii Core → API / SDK / published routes → Frontend
```

Examples: Norwegian Geo, tax lists, company data, election data.

### 2. Authored content (optional future CMS client)

```text
Editor → Optional authoring workspace → Aurii Core → API / SDK → Frontend
```

### 3. Hybrid

Imports + editors + automation → Core → many consumers.

---

## Core vs Studio vs project package

| Piece | Role |
|-------|------|
| **Core** (`packages/core`) | Domain-agnostic runtime and system of record |
| **SDK** (`packages/sdk`) | Typed HTTP client |
| **Studio config** (`packages/studio` / `@aurii/studio`) | `defineStudio`, navigation helpers |
| **Studio app** (`apps/studio` / `@aurii/studio-app`) | Data workspace UI (local + static host) |
| **Project package** (`aurii.config.ts`) | Declarative schemas, sources, imports, routes, studio config |
| **Product** (`product.yaml`) | Shipping composition (modules)—complementary convention |
| **Consumers** | Sites/apps—talk to Core, not Studio |

Each project can configure its Studio. Frontends never depend on Studio running.

---

## Quick start (developer beta)

```bash
bun install
bun run import:norwegian-geo   # schemas + entities into Core
bun run serve                  # Core API (default :3000)
AURII_CORE_URL=http://localhost:3000 \
AURII_PROJECT_SLUG=norge-data \
AURII_DEFAULT_DATASET=norwegian-geo \
bun run studio                 # project Studio locally

bun run studio:build           # static Studio for hosting
```

Do **not** put API tokens into a public Studio build.

Norwegian Geo project package: `demo/norwegian-geo/aurii.config.ts`.

---

## Status

**Current state: Phase 3 complete; Phase 4 (data products + delivery) in progress.**

| Phase | Focus | Status |
|-------|--------|--------|
| Phase 1–3 | Import, storage, query, references | Complete |
| Phase 4 | Data products, Studio ops, published routes, live delivery | In progress — [`Phase4.md`](Phase4.md) |

### Repository layout

```
apps/
  api/             @aurii/api         — HTTP API + published public routes
  studio/          @aurii/studio-app  — Astro data workspace
  geo/             @aurii/geo         — Norwegian Geo consumer (Core/snapshots)
packages/
  core/            @aurii/core        — Runtime + defineProject / defineRoute
  studio/          @aurii/studio      — defineStudio helpers
  sdk/             @aurii/sdk         — Typed HTTP client
  types/           @aurii/types       — Shared domain types
  validation/      @aurii/validation  — Shared validation
  db/              @aurii/db          — Drizzle schema / migrations
demo/norwegian-geo/                   — Reference project package + product.yaml
```

Projects: [`docs/PROJECTS.md`](docs/PROJECTS.md). Studio: [`docs/Studio.md`](docs/Studio.md).

### What exists

| Component | Status |
|-----------|--------|
| Schemas, entities, datasets, Project | Implemented |
| Import engine (CSV/JSON), run history | Implemented |
| Query language + planner | Implemented |
| DataSource, saved imports, cron schedule | Beta |
| Published routes (`/public/:slug/v1/...`) | Beta |
| Project-configured Studio | Beta |
| Authoring CMS / drafts / LiveCenter | Not in this phase |

---

## Principles

1. Schema is the source of truth.
2. Capabilities before hardcoded features.
3. Plugins before Core domain logic.
4. Queries before SQL in applications.
5. Documentation before large architecture changes (ADRs).

---

## License

See repository license file.
