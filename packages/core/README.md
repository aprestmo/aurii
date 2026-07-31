# @aurii/core

> Aurii Core Runtime — schema-driven, import-first, storage-agnostic.
>
> **Status:** Phase 3 complete (relational references, joins, query planner). Next: [`Phase4.md`](../../Phase4.md). Product model: [`docs/PRODUCT_MODEL.md`](../../docs/PRODUCT_MODEL.md).

**External data → Declarative mapping → Entity storage → Query → API / SDK**

Core is the system of record. Studio and future authoring clients are optional. Frontends consume Core through public APIs—not through a CMS.

---

## Quick start

```bash
# Install
bun install

# Register a schema
bun run cli schema apply examples/schemas/article.yaml

# Import real data (dry run first)
bun run cli import run examples/imports/articles.yaml --dry-run
bun run cli import run examples/imports/articles.yaml

# Query it
bun run cli query "from article where published == true"
bun run cli query "from article select title, author order by publishedAt desc"

# Serve the HTTP API (used by Studio) — prefer @aurii/api for project routes
bun run --filter='@aurii/api' serve
```

## Storage

Two interchangeable storage adapters behind one interface. The Query Language
parser produces an AST; each adapter translates it to its own SQL dialect.

| Variable          | Values                     | Default    |
|-------------------|----------------------------|------------|
| `AURII_STORAGE`   | `sqlite` \| `postgres`     | `sqlite`   |
| `AURII_DB_PATH`   | SQLite file path           | `aurii.db` |
| `DATABASE_URL`    | PostgreSQL connection URL  | —          |
| `AURII_API_TOKEN` | Protect the HTTP API       | (open)     |

```bash
# PostgreSQL
export AURII_STORAGE=postgres
export DATABASE_URL="postgres://user:pass@localhost:5432/aurii"
bun run db:migrate   # creates projects (+ future Drizzle tables)
bun run --filter='@aurii/api' serve
```

SQLite is for zero-config development. PostgreSQL (JSONB) is the production target.

## Projects

Projects are the top-level administrative boundary (`ProjectService` in this package).
See [`docs/PROJECTS.md`](../../docs/PROJECTS.md). Entity datasets are not yet scoped
to `projectId` — that is the next attach point.

## Datasets

A deployment can hold multiple datasets with different kinds of data:

```bash
bun run cli dataset create editorial "Editorial content"
bun run cli schema apply examples/schemas/article.yaml --dataset editorial
bun run cli import run examples/imports/articles.yaml --dataset editorial
bun run cli query "from article limit 10" --dataset editorial
```

A `default` dataset always exists and is used when `--dataset` is omitted.

## What's included

| Component | Description |
|-----------|-------------|
| **Projects** | Top-level tenancy boundary (`ProjectService`); HTTP via `@aurii/api` |
| **Schema Language v0** | YAML-based schema definitions (fields, types, validation) |
| **Import Engine v0** | CSV and JSON sources, declarative field mapping, dry run |
| **Import analysis** | Format, delimiter, column, and type detection; schema suggestion |
| **Pipeline v0** | map → transform → validate → persist steps |
| **Query Language v1** | `from`, `where`, `join`, `select`, `order by`, `limit`, `offset`, `count`, explain |
| **Schema references** | `type: reference` with import-time validation |
| **Storage adapters** | SQLite (dev) and PostgreSQL JSONB (production) |
| **Datasets** | Multiple named datasets per deployment |
| **CLI** | `dataset`, `schema`, `import`, `query`, `entity`, `serve` |
| **HTTP API** | REST API with token auth, uploads, dry runs, and stats |

## CLI reference

```bash
# Datasets
bun run cli dataset create <id> <name>
bun run cli dataset list

# Schemas
bun run cli schema apply <file.yaml> [--dataset <id>]
bun run cli schema list [--dataset <id>]
bun run cli schema get <id> [--dataset <id>]

# Imports
bun run cli import run <file.yaml> [--dataset <id>] [--dry-run]

# Queries
bun run cli query "<query>" [--dataset <id>]

# Entities
bun run cli entity get <id>
bun run cli entity list <schema> [--dataset <id>] [--limit <n>]

# HTTP API server
bun run cli serve [--port 3000]
```

## Query Language

```
from article
from article limit 10
from article where published == true
from article where published == true order by publishedAt desc limit 20
from article where title contains "hello"
from article select title, slug, author where published == true
from product where price > 100 order by price desc
```

**Operators:** `==` `!=` `>` `<` `>=` `<=` `contains`

## HTTP API

```
GET  /health                        (no auth)
GET  /datasets
POST /datasets                      { id, name, description? }
GET  /schemas?dataset=
POST /schemas?dataset=
GET  /schemas/:id?dataset=
GET  /entities?schema=&dataset=&limit=&offset=
GET  /entities/:id
GET  /query?q=<query>&dataset=
POST /import/analyze                multipart file → analysis + uploadId
POST /import/run                    { uploadId, schemaId, datasetId, mapping, transforms, dryRun }
POST /import                        { path } — YAML definition (Phase 1)
GET  /imports?dataset=              import history
GET  /stats?dataset=                dashboard aggregates
```

If `AURII_API_TOKEN` is set, all routes except `/health` require
`Authorization: Bearer <token>`.

## Schema format

```yaml
id: article
name: Article
fields:
  - name: title
    type: string
    required: true
  - name: published
    type: boolean
    default: false
  - name: publishedAt
    type: date
```

**Field types:** `string` `number` `boolean` `date` `reference` `string[]` `number[]`

## Import definition format

```yaml
id: import-articles
name: Import Articles
schema: article
dataset: editorial          # optional, defaults to "default"
source:
  type: csv                 # or: json
  path: ./examples/data/articles.csv
pipeline:
  steps:
    - type: map
      mapping:
        title: Title        # schema field: source column
    - type: transform
      transforms:
        - field: published
          fn: toBoolean     # toBoolean | toNumber | toDate | toSlug | trim | …
    - type: validate
    - type: persist
```

## Studio

The visual **data workspace** lives in [`apps/studio`](../../apps/studio) — an Astro app with an Import Wizard, Dashboard, Entity Browser, and Query playground. It consumes only this API. It is not a required CMS layer for frontends.

---

*See `Phase1.md`–`Phase3.md` (historical) and `Phase4.md` (plan) in the repository root. Product model: `docs/PRODUCT_MODEL.md`.*
