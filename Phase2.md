# Phase 2 — PostgreSQL + Studio

> Phase 1 proved the loop: external data → declarative mapping → entity storage → query.
>
> Phase 2 makes it real for an actual customer: real storage, real datasets, a real user interface.

---

# Goals

1. **PostgreSQL as production storage** — JSONB-based entity storage behind a storage adapter, so SQLite (zero-config dev) and PostgreSQL (production) are interchangeable.
2. **Datasets** — a project can hold multiple datasets with different kinds of data, queryable across.
3. **Studio** — an Astro-based web client with an Import Wizard, a Dashboard, and an Entity Browser.
4. **Import analysis** — automatic format, delimiter, column, and type detection with schema suggestion.
5. **Dry run** — imports validate everything before anything is written.
6. **Authentication (minimal)** — a single API token protecting the HTTP API.

---

# Non-goals (deferred)

- Shared datasets / superadmin catalogue (Phase 3)
- Scheduled imports and HTTP connectors (Phase 3)
- pgvector / semantic search (Phase 3+)
- Multi-user, roles, permissions model
- Plugin runtime
- AI Engine

---

# Architecture

```
packages/studio  (Astro)          ← client, consumes public API only
        │  HTTP + Bearer token
        ▼
packages/core    (Bun)
├── api/         HTTP API (REST, CORS, auth)
├── schema/      Schema Language v0
├── entity/      Entity operations
├── query/       Query Language v0 (parser is storage-agnostic)
├── import/      Import Engine (sources, analysis, dry run)
├── pipeline/    Pipeline steps and transforms
└── storage/     Storage adapters
    ├── sqlite   (bun:sqlite, json_extract)
    └── postgres (Bun.sql, JSONB ->>, @>)
```

The Query Language parser produces an AST.
Each storage adapter translates the AST to its own SQL dialect.
No other layer knows which storage is active.

---

# Domain model changes

## Dataset

A Dataset is a named collection of schemas and entities within a project.

```
Dataset
├── id          (slug, e.g. "editorial", "reference-data")
├── name
├── description
└── created_at
```

- Schemas belong to a dataset: `(schema_id, dataset_id)` is the unique key.
- Entities belong to a dataset.
- A `default` dataset always exists; CLI and API use it when none is specified.
- Cross-dataset queries are possible because all entities live in one table.

## Storage selection

| Variable          | Values                     | Default   |
|-------------------|----------------------------|-----------|
| `AURII_STORAGE`   | `sqlite` \| `postgres`     | `sqlite`  |
| `AURII_DB_PATH`   | SQLite file path           | `aurii.db`|
| `DATABASE_URL`    | PostgreSQL connection URL  | —         |

## PostgreSQL schema

```sql
CREATE TABLE aurii_datasets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aurii_schemas (
  id          TEXT NOT NULL,
  dataset_id  TEXT NOT NULL REFERENCES aurii_datasets(id),
  name        TEXT NOT NULL,
  description TEXT,
  version     INTEGER NOT NULL DEFAULT 1,
  definition  JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, dataset_id)
);

CREATE TABLE aurii_entities (
  id          UUID PRIMARY KEY,
  dataset_id  TEXT NOT NULL REFERENCES aurii_datasets(id),
  schema_id   TEXT NOT NULL,
  data        JSONB NOT NULL,
  state       TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON aurii_entities (dataset_id, schema_id);
CREATE INDEX ON aurii_entities USING GIN (data);

CREATE TABLE aurii_import_runs (
  id            UUID PRIMARY KEY,
  definition_id TEXT,
  dataset_id    TEXT,
  schema_id     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  dry_run       BOOLEAN NOT NULL DEFAULT false,
  total         INTEGER NOT NULL DEFAULT 0,
  imported      INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  errors        JSONB NOT NULL DEFAULT '[]',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

pgvector is intentionally absent. It arrives in Phase 3 as a storage capability.

---

# Import analysis

`POST /import/analyze` accepts a file upload and returns everything the wizard needs:

```json
{
  "uploadId": "…",
  "format": "csv",
  "delimiter": ";",
  "columns": ["Tittel", "Publisert", "Dato"],
  "rowCount": 234,
  "preview": [ { "Tittel": "…", "Publisert": "true", "Dato": "01.03.2024" } ],
  "inferredTypes": { "Tittel": "string", "Publisert": "boolean", "Dato": "date" },
  "suggestedSchema": {
    "id": "tittel-import",
    "fields": [
      { "name": "tittel", "type": "string" },
      { "name": "publisert", "type": "boolean" },
      { "name": "dato", "type": "date" }
    ]
  },
  "suggestedTransforms": [
    { "field": "publisert", "fn": "toBoolean" },
    { "field": "dato", "fn": "toDate" }
  ]
}
```

Detection rules (v0):

- **Format**: file extension, then content sniffing (`[` / `{` → JSON, otherwise CSV).
- **Delimiter**: the character (`,` `;` `\t` `|`) producing the most consistent column count across sample lines.
- **Types**: sample up to 100 values per column; if all parse as boolean → boolean, all parse as number → number, all parse as date → date; otherwise string.
- **Field names**: source columns are slugified (`"Published Date"` → `publishedDate`).

---

# Dry run

Every import can run without persisting:

```
POST /import/run  { …, "dryRun": true }
```

The pipeline executes fully — map, transform, validate — but the persist step is skipped.
The response reports per-row results so the user can fix mapping before committing.

The wizard always dry-runs before offering the real import.

---

# HTTP API (Phase 2 surface)

```
GET  /health

GET  /datasets
POST /datasets                      { id, name, description? }

GET  /schemas?dataset=
POST /schemas?dataset=              schema definition
GET  /schemas/:id?dataset=

GET  /entities?schema=&dataset=&limit=&offset=
GET  /entities/:id

GET  /query?q=&dataset=

POST /import/analyze                multipart file
POST /import/run                    { uploadId, schemaId, datasetId, mapping,
                                      transforms, dryRun }
POST /import                        { path } (Phase 1 compatibility)

GET  /stats?dataset=                dashboard aggregates
GET  /imports?dataset=              import run history
```

## Authentication

If `AURII_API_TOKEN` is set, every route except `/health` requires
`Authorization: Bearer <token>`.

Studio stores the token in localStorage after a login screen.

If the variable is unset (local development), the API is open.

This is deliberately minimal. Real identity arrives in a later phase — as a
capability, not as middleware sprawl.

---

# Studio (Astro)

`packages/studio` — an Astro application. Static output, client-side data fetching against the Core API. Studio never touches storage.

## Pages

| Route        | Purpose |
|--------------|---------|
| `/`          | Dashboard: entity counts per schema, field coverage, recent imports, dataset switcher |
| `/import`    | Import Wizard (upload → analyze → schema → mapping → dry run → import) |
| `/entities`  | Entity Browser: filter by schema, paginate, inspect entity JSON |
| `/schemas`   | Schema list and detail |
| `/login`     | Token entry (only when API requires auth) |

## Import Wizard flow

```
1  Upload        drag-and-drop CSV/JSON
2  Analyze       server detects format, columns, types; preview shown
3  Schema        pick existing schema or accept generated suggestion
4  Mapping       map source columns to schema fields; per-field transforms
5  Dry run       validation report per row; nothing written
6  Import        real run; result summary with error report
```

Nothing is written to storage before step 6.

## Dashboard widgets (v0)

- Entities per schema (count)
- Field coverage per schema (% of entities with each field populated)
- Import history (status, imported/failed, duration)
- Total entities per dataset

Widgets are derived from schemas and data — not hardcoded per customer.

---

# Success criteria

Phase 2 is complete when:

1. `AURII_STORAGE=postgres` passes the same end-to-end flow as SQLite:
   schema apply → import → query, via CLI and API.
2. A user can open Studio, upload a CSV they have never seen documented,
   walk through the wizard, and query the imported entities — without
   touching a terminal.
3. The dashboard reflects the imported data immediately.
4. The API rejects unauthenticated requests when a token is configured.

---

# What Phase 2 teaches us

Phase 2 exists to answer:

- Does the storage abstraction actually hold? (Two dialects, one AST.)
- Is the Import Wizard flow right for non-technical users?
- Which dashboard widgets do users actually look at?

Phase 3 (shared datasets, connectors, scheduling) builds on those answers.

---

# Phase 2 — Complete

**Status: closed** (including Phase 2.1 hardening and Phase 2.2 reality check).

## What was delivered

| Phase | Focus | Status |
|-------|-------|--------|
| 2.0 | PostgreSQL, Studio, import wizard, datasets | Complete |
| 2.1 | Capability registry, domain events, dedup imports, Docker, SDK | Complete |
| 2.2 | Real-world vertical slice, Norwegian geo demo, website validation | Complete |

## Reference demo for future work

The **Norwegian geographic reference demo** (`demo/norwegian-geo/`, `apps/geo`) is the canonical testbed for validating new features. Agents and contributors should extend this demo rather than creating parallel examples.

See:
- `docs/REFERENCE_DEMO.md` — agent guide
- `AGENTS.md` — Reference Demo Project section
- `Phase2.2.md` — reality check report

## Handoff to Phase 3

Known gaps documented in `Phase2.2.md` (join queries, enum types, reference validation, Query Language v1, RBAC, plugins, AI). Phase 3 planning should start from those findings.
