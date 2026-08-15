# Aurii

> A schema-driven platform for structured data and editorial content—model, ingest, edit, enrich, relate, and publish.

---

## What is Aurii?

Aurii is a platform for **modeling, ingesting, editing, enriching, relating, and publishing structured data and editorial content**. Data may arise through import, synchronization, manual registration, automation, AI, or external products. **Aurii Core is the system of record** and remains usable without Studio or any commercial product. Studio is a customizable **developer/operator** project workspace on that same model (generated UI by default; replaceable by extensions). Opinionated products — including a possible future publication CMS — use Aurii; they are **not** Aurii, and they are not Studio renamed.

The same Core is intended to support publication CMS, Kampbart, playground directories, DN Gaselle, Geo datasets, LiveCenter, documentation, and other structured-data applications without each project inventing its own backend. Those examples are tests and possible products, not a closed list. **Products discover requirements. Core absorbs durable generalizations.**

Aurii is **not** a traditional CMS, database, or API framework.

Canonical product vocabulary: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md).  
Product strategy (open Core, product boundaries, Studio audience): [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md).  
Architecture fitness tests: [`docs/ARCHITECTURE_FITNESS.md`](docs/ARCHITECTURE_FITNESS.md).  
Optional authoring decision: [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).  
Project packages: [`adr/ADR-0014 — Project Configuration Package.md`](adr/ADR-0014%20—%20Project%20Configuration%20Package.md).  
**Next after Studio beta:** [`docs/NEXT_AFTER_STUDIO_BETA.md`](docs/NEXT_AFTER_STUDIO_BETA.md).  
**Delivery contract:** [`docs/DELIVERY.md`](docs/DELIVERY.md).  
**Phase 5 (planned):** [`Phase5.md`](Phase5.md) — Editorial & Context; not implemented in this phase.

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
         (extensible         (talk to Core)      (future CMS, …)
          workspace)
```

- **Core** is system of record — usable without Studio or commercial products.
- **Studio** is a developer/operator workspace. It reads and writes through public Core APIs and the SDK—never the database. Generated UI is the default; custom editors/views are extensions. It is not the journalist’s or editor’s CMS.
- **Products** may be separate opinionated applications over the same Core. They do not need one universal UI.
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
| **Studio app** (`apps/studio` / `@aurii/studio-app`) | Developer/operator workspace UI (local + static host) |
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
AURII_PROJECT_ROOT=demo/norwegian-geo \
bun run studio                 # project Studio locally (loads defineStudio from package)

bun run studio:build           # static Studio for hosting
# After import: register sources/imports/routes:
#   bun run register:norwegian-geo-platform

# Live geo consumer (after import + serve + register + enable routes):
#   cd apps/geo && AURII_CORE_URL=http://localhost:3000 bun run dev
# Snapshot / offline geo (no Core):
#   cd apps/geo && bun run dev
```

Do **not** put API tokens into a public Studio build.

Norwegian Geo project package: `demo/norwegian-geo/aurii.config.ts`.

---

## Status

**Current state: Phase 3 complete; Phase 4 (data products + delivery) in progress.**

| Phase | Focus | Status |
|-------|--------|--------|
| Phase 1–3 | Import, storage, query, references | Complete |
| Phase 4 | Data products, Studio ops, published routes, live delivery | In progress — [`Phase4.md`](Phase4.md), [`docs/DELIVERY.md`](docs/DELIVERY.md) |
| Phase 5 | Editorial & Context (separate client on generic Core) | **Planned** — [`Phase5.md`](Phase5.md) |

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

1. Schema is the source of truth (the domain, not only Studio forms).
2. Capabilities before hardcoded features.
3. Plugins / Studio extensions before Core domain logic.
4. Queries before SQL in applications.
5. Documentation before large architecture changes (ADRs).
6. One entity model for structured data, editorial content, and hybrids.
7. Sources, relations, provenance, and Studio extensibility are foundations.
8. Products discover requirements; Core absorbs durable generalizations.

---

## License

See repository license file.
