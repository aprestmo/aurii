# Aurii

> A schema-driven runtime for structured knowledge—import, relate, query, and deliver.

---

## What is Aurii?

Aurii is a schema-driven runtime for importing, creating, relating, transforming, querying, and delivering structured data. Data may come from external sources, people, automation, or AI. Studio provides generic data administration, while products that need manual authoring may add an optional schema- and capability-driven authoring workspace. Frontends and other consumers communicate with Core through public APIs and SDKs.

Aurii is **not** a traditional CMS, database, or API framework.

**Aurii Core is not a CMS.** Aurii can power CMS products through an optional authoring layer. A CMS is never required between Core and a frontend.

Canonical product vocabulary: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md).  
Optional authoring decision: [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

## Product modes

Aurii supports three modes. Only the **data product** path is fully exercised today (Norwegian Geo). Authored and hybrid modes are architectural commitments for later phases—not claims of a shipping CMS.

### 1. Data product (no CMS)

```text
External sources → Import / pipelines → Aurii Core → API / SDK → Frontend, API, AI, or print
```

Examples: Norwegian Geo, tax lists, company data, SSB datasets, election data.

### 2. Authored content (optional CMS client)

```text
Editor → Optional authoring workspace → Aurii Core → API / SDK → Frontend
```

The frontend reads Core directly—not through the CMS UI.

### 3. Hybrid

```text
Imports + editors + automation/AI → Aurii Core → API / SDK / events → many consumers
```

---

## Core vs Studio

| Piece | Role |
|-------|------|
| **Core** (`packages/core`) | Domain-agnostic runtime and system of record |
| **SDK** (`packages/sdk`) | Typed HTTP client for browsers and servers |
| **Studio** (`apps/studio`) | Generic **data workspace** client (imports, schemas, entities, queries) |
| **Authoring workspace** | Optional future client for editing/publishing—not required for data products |
| **Consumers** | Sites, apps, public APIs, AI, exports—talk to Core, not to Studio |

```text
Studio / authoring / CLI / AI     →  public APIs / SDK  →  Core  →  consumers
```

---

## Foundations

### Schema first

Schemas define structure, validation, relationships, and declared behavior. Prefer declaring behavior in schemas and capabilities over hardcoding it in Core or UI.

### Import first

Importing external data is a core capability: analyzable, repeatable, auditable mappings from sources into entities. Phase 1–3 proved this loop; Phase 4 deepens it as a product surface.

### API first

Studio and every other client use the same public APIs. If something cannot be accessed through an API, it probably does not belong in Core.

### Runtime first

Applications adapt to the Runtime. Domain-specific logic belongs in product schemas, modules, plugins, pipelines, and clients—not in Core.

---

## Status

**Current state: Phase 3 complete.**

| Phase | Focus | Status |
|-------|--------|--------|
| Phase 1 | Import-first Core | Complete — [`Phase1.md`](Phase1.md) |
| Phase 2 | PostgreSQL, datasets, HTTP API, Studio | Complete — [`Phase2.md`](Phase2.md) |
| Phase 2.2 | Norwegian Geo vertical slice | Complete — [`Phase2.2.md`](Phase2.2.md) |
| Phase 3 | References, joins, query planner, Studio query playground | Complete — [`Phase3.md`](Phase3.md) |
| Phase 4 | Data products and delivery | Planned — [`Phase4.md`](Phase4.md) |

Phase 4 completes the import → Core → SDK → frontend path and product composition before newsroom/CMS work. See the product model and Phase 4 docs before opening authoring or LiveCenter issues.

### Repository layout

```
apps/
  api/             @aurii/api    — HTTP API (Core runtime + /api/projects)
  studio/          @aurii/studio — Astro data-workspace client
  geo/             @aurii/geo    — Norwegian Geo public site
packages/
  core/            @aurii/core   — Runtime (Bun + Elysia)
  db/              @aurii/db     — Drizzle schema, migrations, seed
  types/           @aurii/types  — Shared domain types
  validation/      @aurii/validation — Shared validation
  sdk/             @aurii/sdk    — Typed HTTP client (browser + server)
demo/              Example datasets; norwegian-geo reference product
docs/              Architecture specifications and design documents
adr/               Architecture Decision Records
```

Projects (top-level tenancy): [`docs/PROJECTS.md`](docs/PROJECTS.md), [ADR-0011](adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md).

### What exists and is verified

| Component | Status |
|-----------|--------|
| `packages/core` — CLI, HTTP API, schema, import, query, pipeline | Running |
| `packages/sdk` — Typed HTTP client wrapping API endpoints | Built, tested |
| SQLite storage adapter | Verified end-to-end |
| PostgreSQL storage adapter | **CI-verified** against `postgres:16` |
| Query Language v1 (joins, count, explain) | Phase 3 complete |
| Schema `reference` fields + import reference validation | Phase 3 complete |
| Import pipeline (CSV/JSON, mapping, transforms, validation) | E2E tests passing |
| HTTP API (datasets, schemas, entities, query, import, stats) | Integration tests passing |
| OpenAPI / Swagger UI | `/swagger` when Core is running |
| Capability Registry | Internal subsystem declarations |
| Internal domain events | `dataset.created`, `entity.*`, `import.*` |
| Studio — dashboard, import wizard, entity browser, query playground | Builds, uses SDK |
| Docker developer environment | `docker compose up` → Core + Studio + PostgreSQL |
| **Norwegian Geo** | `demo/norwegian-geo/` — counties, municipalities, postal codes + modules |

### What is not built yet

Do not treat these as shipping features:

- Optional authoring / CMS workspace (planned after Phase 4)
- Newsroom, LiveCenter, realtime collaboration
- Draft / publish / revision / workflow as production capabilities
- Full asset / media management
- Plugin runtime (as a loadable extension system)
- AI integration as a production feature
- RBAC (only a single bearer token today)
- SQL join pushdown at million-row scale (in-memory joins today)
- Scheduled imports and generic HTTP connectors (Phase 4 stretch / later)

### Continuous Integration

Every push and pull request runs:

- **core** — typecheck, lint, and full test suite (SQLite)
- **core-postgres** — same suite against PostgreSQL/JSONB
- **sdk** — typecheck and SDK tests
- **studio** — build check + API integration tests

### Quick start

```bash
docker compose up
```

- Core API: **http://localhost:3000** (Swagger at `/swagger`)
- Studio: **http://localhost:4321**
- PostgreSQL: port 5432

Without Docker:

```bash
bun install
cd packages/core && bun run serve    # http://localhost:3000
cd apps/studio && bun run dev        # http://localhost:4321
```

Root scripts: `bun run build` · `bun run test` · `bun run lint` · `bun run typecheck`

### Environment variables for Core

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `AURII_STORAGE` | `sqlite` | `sqlite` or `postgres` |
| `AURII_DB_PATH` | `aurii.db` | SQLite file path |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `AURII_API_TOKEN` | — | Bearer token (unset = open) |

### Using the SDK

```ts
import { createClient } from "@aurii/sdk";

const client = createClient({
  baseUrl: "http://localhost:3000",
  token: process.env.AURII_API_TOKEN,
  defaultDataset: "norwegian-geo",
});

const datasets = await client.datasets.list();
const schemas = await client.schemas.list();
const result = await client.query.run(
  'from municipality join county on municipality.countyId = county.id where municipality.id == "0301"',
);
```

### Norwegian Geo (reference data product)

```bash
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo
```

See [`docs/NORWEGIAN_GEO.md`](docs/NORWEGIAN_GEO.md), [`docs/REFERENCE_DEMO.md`](docs/REFERENCE_DEMO.md), and [`Phase2.2.md`](Phase2.2.md).

### Documentation map

| Document | Purpose |
|----------|---------|
| [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md) | **Canonical product model** (Core, datasets, products, Studio, consumers) |
| [`Phase4.md`](Phase4.md) | Next phase: data products and delivery |
| [`docs/Architecture.md`](docs/Architecture.md), [`docs/Core.md`](docs/Core.md), [`docs/API.md`](docs/API.md) | Architecture and API |
| [`docs/Schema Language.md`](docs/Schema%20Language.md), [`docs/Query-Language-v1.md`](docs/Query-Language-v1.md) | Languages (v1 status + vision docs) |
| [`adr/`](adr/) | Architecture Decision Records |
| [`AGENTS.md`](AGENTS.md) | Rules for AI agents and contributors |
| `Phase1.md` … `Phase3.md` | Historical phase records |

---

## Development principles

- Keep Core generic; avoid application-specific Core features.
- Prefer schemas, capabilities, pipelines, and plugins over hardcoded behavior.
- Design APIs before interfaces; keep business logic out of the UI.
- Think in datasets and schemas—not pages and forms.
- Distinguish **implemented** behavior from **planned** behavior in docs and PRs.
- Ask: does this make Aurii a better declarative runtime for structured knowledge?
