# Phase 1 — Import-first Core

> Aurii is not a system yet.
> Aurii is an unusually well-formulated hypothesis.
>
> Phase 1 exists to test that hypothesis against reality.

---

# The Test

The single question that Phase 1 must answer:

> Can Aurii take an external dataset, map it declaratively to an Entity model,
> validate it, store it, and expose it through a Query?

If yes — a product seed exists.

If no — everything else is decoration.

---

# Scope

## What Phase 1 includes

- Entity storage
- Schema Language v0
- Import definition v0
- Pipeline steps v0 (map, transform, validate, persist)
- Query Language v0
- CLI
- Minimal HTTP API

## What Phase 1 deliberately excludes

- Studio
- AI Engine
- Search Engine
- Plugin Runtime
- Multi-tenancy
- Authentication
- Event system
- Asset Engine
- Workflow Engine
- Enterprise abstractions of any kind

These are not forgotten.

They are deferred until the core loop is proven.

---

# Architecture

```
External Data Source (CSV, JSON)
         │
         ▼
  Import Definition (YAML)
         │
         ▼
   Pipeline Runner
    ├── map        (rename fields from source to schema)
    ├── transform  (coerce types: string → boolean, string → date)
    ├── validate   (check required fields, type correctness)
    └── persist    (write Entity to store)
         │
         ▼
   Entity Store (SQLite)
         │
         ▼
   Query Engine (v0 query language)
         │
         ▼
   Result (JSON)
```

---

# Schema Language v0

Schemas are declared in YAML.

```yaml
id: article
name: Article
description: A published article or blog post
fields:
  - name: title
    type: string
    required: true
  - name: slug
    type: string
    required: true
  - name: body
    type: string
  - name: published
    type: boolean
    default: false
  - name: publishedAt
    type: date
  - name: author
    type: string
```

## Supported field types (v0)

| Type       | Description                        |
|------------|------------------------------------|
| `string`   | Plain text value                   |
| `number`   | Integer or float                   |
| `boolean`  | true or false                      |
| `date`     | ISO 8601 date string               |
| `string[]` | Array of strings                   |

---

# Import Definition v0

Import definitions are declared in YAML.

```yaml
id: import-articles
name: Import Articles
schema: article
source:
  type: csv
  path: ./examples/data/articles.csv
pipeline:
  steps:
    - type: map
      mapping:
        title: Title
        slug: Slug
        body: Body
        published: Published
        publishedAt: "Published Date"
        author: Author
    - type: transform
      transforms:
        - field: published
          fn: toBoolean
        - field: publishedAt
          fn: toDate
    - type: validate
    - type: persist
```

## Supported source types (v0)

| Type   | Description            |
|--------|------------------------|
| `csv`  | CSV file with headers  |
| `json` | JSON file (array)      |

## Supported pipeline steps (v0)

| Step        | Description                                      |
|-------------|--------------------------------------------------|
| `map`       | Rename source fields to schema field names       |
| `transform` | Apply type coercions to field values             |
| `validate`  | Validate all fields against the schema           |
| `persist`   | Write validated entities to the store            |

## Supported transform functions (v0)

| Function      | Description                          |
|---------------|--------------------------------------|
| `toBoolean`   | "true"/"1"/"yes" → true, else false  |
| `toNumber`    | Parse numeric string                 |
| `toDate`      | Parse date string to ISO 8601        |
| `toSlug`      | Lowercase, replace spaces with dashes|
| `trim`        | Remove leading/trailing whitespace   |
| `toLowerCase` | Convert string to lowercase          |
| `toUpperCase` | Convert string to uppercase          |

---

# Query Language v0

Queries are expressed as plain text.

```
from article
from article limit 10
from article where published == true
from article where published == true order by publishedAt desc limit 20
from article where title contains "hello" limit 5
from article select title, slug, author where published == true limit 10 offset 20
```

## Syntax

```
from <schema>
[select <field>[, <field>]*]
[where <condition> [and <condition>]*]
[order by <field> [asc | desc]]
[limit <n>]
[offset <n>]
```

## Condition operators

| Operator   | Description              |
|------------|--------------------------|
| `==`       | Equal                    |
| `!=`       | Not equal                |
| `>`        | Greater than             |
| `<`        | Less than                |
| `>=`       | Greater than or equal    |
| `<=`       | Less than or equal       |
| `contains` | String contains (LIKE)   |

---

# CLI Reference

```bash
# Register a schema
bun run cli schema apply <file.yaml>

# List registered schemas
bun run cli schema list

# Run an import
bun run cli import run <file.yaml>

# Execute a query
bun run cli query "from article where published == true limit 10"

# Get an entity by ID
bun run cli entity get <id>

# Start HTTP API server
bun run cli serve [--port 3000]
```

---

# HTTP API Reference

```
GET  /health
GET  /schemas
POST /schemas            body: schema definition (JSON)
GET  /schemas/:id
GET  /query?q=<query>    Query Language via URL param
GET  /entities/:id
POST /import             body: { path: "./import.yaml" }
```

---

# Storage

Phase 1 uses SQLite via Bun's native `bun:sqlite`.

SQLite is the Phase 1 storage target because it requires zero configuration.

PostgreSQL is the production target (see Article 18).

The storage layer is an implementation detail.

Switching from SQLite to PostgreSQL should require no changes to Schema, Import, Query, or Pipeline logic.

---

# Success Criteria

Phase 1 is complete when the following command sequence works:

```bash
bun run cli schema apply examples/schemas/article.yaml
bun run cli import run examples/imports/articles.yaml
bun run cli query "from article where published == true"
```

And returns a valid JSON array of entities.

---

# What Comes After Phase 1

Phase 1 does not decide Phase 2.

Phase 2 is determined by what Phase 1 reveals.

Likely candidates:

- Real permissions model
- PostgreSQL storage adapter
- HTTP API with OpenAPI spec
- Second import source type (database, REST API)
- Schema references (relations between entities)
- Event system

The right next step will be obvious once the first vertical is working.
