# Aurii

> A composable content and data platform built for the next generation of applications.

---

## What is Aurii?

Aurii is a schema-first, API-first and AI-first platform for storing, managing, enriching and delivering structured content and data.

Aurii is **not** a traditional CMS.

It is a platform for building systems that happen to manage content.

At its core, Aurii provides a flexible Content Lake capable of powering everything from websites and newsrooms to public datasets, internal business systems, documentation platforms, APIs, AI applications and print workflows.

The goal is simple:

> Store data once. Use it everywhere.

---

# Vision

Modern organizations manage much more than pages and articles.

They manage products, customers, maps, media assets, datasets, taxonomies, events, AI-generated content, analytics, structured documents and countless integrations.

Traditional CMS platforms were designed around publishing web pages.

Aurii is designed around managing information.

Everything is modeled as data.

Everything is queryable.

Everything is reusable.

---

# Philosophy

Aurii is built around a few fundamental principles.

## Schema First

Every dataset begins with a schema.

Schemas define:

- structure
- validation
- relationships
- permissions
- editing capabilities
- APIs
- search
- AI understanding

Schemas are the foundation of the platform.

---

## API First

Everything inside Aurii is available through APIs.

The Studio itself communicates with Core exclusively through public APIs.

If something cannot be accessed through an API, it probably does not belong inside Core.

---

## AI First

Artificial Intelligence is not an add-on.

AI is part of the platform.

AI should assist with:

- schema creation
- data modeling
- validation
- import
- search
- transformation
- enrichment
- automation

The human always remains in control.

---

## Data Before Presentation

Content should never depend on a frontend.

Instead:

```
Data

↓

API

↓

Frontend
```

A website is simply one consumer.

A mobile app is another.

A print workflow is another.

An AI agent is another.

---

## Composable

Aurii is built as independent engines.

Every subsystem should be replaceable.

Every feature should be reusable.

Avoid tightly coupled functionality.

---

## Open by Design

Aurii should embrace open standards whenever possible.

Examples include:

- JSON
- OpenAPI
- OAuth
- OpenID Connect
- S3
- PostgreSQL
- Markdown
- GraphQL (optional)
- RSS
- XML

Vendor lock-in should never be required.

---

# What can Aurii build?

Aurii should be capable of powering systems such as:

- Headless CMS
- News publishing
- Documentation platforms
- Public data portals
- Internal business systems
- Customer portals
- Product catalogs
- AI knowledge bases
- Geographic information systems
- Print production
- Digital archives
- Media asset management
- Event systems
- Live coverage
- Public APIs

All using the same Core.

---

# Core Architecture

Aurii is composed of several independent engines.

```
                    Studio

                      │

        ┌─────────────┴─────────────┐

        │                           │

      REST                      Query API

        │                           │

        └─────────────┬─────────────┘

                      │

                    Core

──────────────────────────────────────────

Schemas

Datasets

Documents

Assets

Imports

Connectors

Pipelines

Search

Events

Permissions

AI

──────────────────────────────────────────

                PostgreSQL
```

Core is the product.

Studio is one client.

---

# Technology

The initial implementation uses:

Frontend

- Astro

Backend

- Bun
- Elysia

Language

- TypeScript

Database

- PostgreSQL
- JSONB

Infrastructure

- Docker
- Coolify
- S3 compatible object storage

Hosting

Self-hosted by default.

Cloud deployments should also be possible.

---

# Why Aurii?

Many existing CMS platforms assume that websites are the primary product.

Aurii assumes that structured information is the primary product.

Websites are simply one output.

This distinction influences every architectural decision.

---

# Import Philosophy

Importing data is a core capability.

Import is not simply uploading a CSV.

Aurii should understand incoming information.

Supported sources include:

- CSV
- Excel
- JSON
- XML
- APIs
- Databases
- Cloud storage
- Git repositories
- Google Sheets
- AI extracted documents

Every import should be:

- analyzable
- repeatable
- auditable
- versioned
- resumable

---

# AI Philosophy

AI should augment—not replace—the user.

AI may suggest:

- schemas
- field types
- mappings
- relationships
- validation rules
- import strategies
- search queries

Every suggestion should be reviewable.

Nothing important should happen automatically without user approval.

---

# Documentation

The project documentation is organized as follows:

```
docs/

README.md

VISION.md

CONSTITUTION.md

ARCHITECTURE.md

DOMAIN_MODEL.md

CORE.md

SCHEMA_ENGINE.md

IMPORT_ENGINE.md

QUERY_ENGINE.md

API.md

AI.md

AGENTS.md
```

Each document builds upon the previous one.

Together they form the complete Aurii Specification.

---

# Development Principles

When contributing to Aurii:

- Keep Core generic.
- Avoid application-specific features.
- Prefer composition over inheritance.
- Prefer configuration over hardcoding.
- Build reusable primitives.
- Design APIs before interfaces.
- Keep business logic out of the UI.
- Think in datasets instead of pages.
- Think in schemas instead of forms.
- Think in APIs instead of components.

---

# Long-term Goal

Aurii aims to become a complete platform for structured information.

Not merely a CMS.

Not merely a database.

Not merely an API.

Aurii should become the foundation upon which entirely new classes of applications can be built.

---

## Status

**Current state: Phase 2 complete.**

Phase 2.2 validated the architecture with the Norwegian geographic reference demo. Phase 3 work begins from here. See `Phase2.2.md`, `docs/REFERENCE_DEMO.md`, and `AGENTS.md` (Reference Demo Project).

### Repository layout

```
apps/
  studio/          @aurii/studio — Astro admin client
  geo/             @aurii/geo    — Norwegian counties/municipalities demo site
packages/
  core/            @aurii/core   — Runtime (Bun + Elysia)
  sdk/             @aurii/sdk    — Typed HTTP client (browser + server)
demo/              Ready-to-import example datasets
docs/              Architecture specifications and design documents
adr/               Architecture Decision Records
```

### What exists and is verified

| Component | Status |
|-----------|--------|
| `packages/core` — CLI, HTTP API, schema, import, query, pipeline | Running |
| `packages/sdk` — Typed HTTP client wrapping all API endpoints | Built, tested |
| SQLite storage adapter | Verified end-to-end |
| PostgreSQL storage adapter | **CI-verified** — runs against `postgres:16` on every push |
| Query Language v0 (parser + executor) | Unit tests passing |
| Import pipeline (CSV/JSON, mapping, transforms, validation) | E2E tests passing |
| HTTP API (datasets, schemas, entities, query, import, stats) | Integration tests passing |
| OpenAPI / Swagger UI | Available at `/swagger` when Core is running |
| Capability Registry | Self-registering internal subsystem declarations |
| Internal domain events | `dataset.created`, `entity.*`, `import.*` |
| Studio (Astro) — dashboard, import wizard, entity browser | Builds, uses SDK |
| Studio automated tests | SDK integration tests against in-process Core |
| Docker developer environment | `docker compose up` starts Core + Studio + PostgreSQL |
| Demo datasets | news, products, municipalities, companies in `demo/` |
| **Norwegian geo vertical slice** | `demo/norwegian-geo/` — real counties, municipalities, postal codes |

### Continuous Integration

Every push and pull request runs four jobs:

- **core** — typecheck, lint, and full test suite (SQLite)
- **core-postgres** — same test suite against a real PostgreSQL/JSONB service container
- **sdk** — typecheck and SDK tests
- **studio** — build check + API integration tests

### Quick start (one command)

```bash
docker compose up
```

This starts:
- Core API at **http://localhost:3000** (Swagger UI at /swagger)
- Studio at **http://localhost:4321**
- PostgreSQL on port 5432

### Running locally without Docker

**Install dependencies:**

```bash
bun install   # installs all workspace packages
```

**Core (HTTP API):**

```bash
cd packages/core
bun run serve          # starts on http://localhost:3000
```

**Studio:**

```bash
cd apps/studio
bun run dev            # starts on http://localhost:4321
```

**Root workspace scripts:**

```bash
bun run build      # typecheck all packages
bun run test       # run all test suites
bun run lint       # lint all packages
bun run typecheck  # TypeScript check all packages
```

### Environment variables for Core

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `AURII_STORAGE` | `sqlite` | `sqlite` or `postgres` |
| `AURII_DB_PATH` | `aurii.db` | SQLite file path |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `AURII_API_TOKEN` | — | Bearer token (unset = open) |

### Running tests

```bash
# Core (all tests, SQLite)
cd packages/core && bun run test

# Core with PostgreSQL adapter
DATABASE_URL=postgres://user:pass@localhost:5432/aurii_test bun run test

# SDK
cd packages/sdk && bun run test

# Studio
cd apps/studio && bun run test
```

### Using the SDK

```ts
import { createClient } from "@aurii/sdk";

const client = createClient({
  baseUrl: "http://localhost:3000",
  token: process.env.AURII_API_TOKEN,
  defaultDataset: "my-dataset",
});

const datasets = await client.datasets.list();
const schemas  = await client.schemas.list();
const result   = await client.query.run("FROM article LIMIT 10");
```

### Norwegian geographic dataset (Phase 2.2)

Import real Norwegian reference data (counties, municipalities, postal codes):

```bash
# After docker compose up:
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo
```

See `Phase2.2.md` and `demo/norwegian-geo/README.md` for query examples and Studio setup.

### Demo datasets

Load ready-made example data:

```bash
cd packages/core
bun run cli schema apply ../demo/news/schema.yaml
bun run cli import run ../demo/news/import.yaml
```

See `demo/README.md` for the full list and usage instructions.

### What is not built yet

- Real permission system (only a single bearer token today)
- Relation support in queries
- Plugin system
- AI integration
- Phase 3 features (pgvector, semantic search, scheduled imports, RBAC)

### Specification

Architecture design documents live in `docs/`:

- `docs/Architecture.md`, `docs/API.md`, `docs/Core.md`
- `docs/Schema Language.md`, `docs/Query Language.md`, `docs/Pipeline Language.md`
- `adr/` — Architecture Decision Records
- `Phase1.md`, `Phase2.md`, `Phase2.2.md` — implementation phase records