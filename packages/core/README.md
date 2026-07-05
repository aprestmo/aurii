# @aurii/core — Phase 1

> The smallest possible Aurii that works.

This is the Phase 1 implementation of Aurii: an import-first Core that proves the fundamental loop:

**External data → Declarative mapping → Entity storage → Query**

---

## Quick start

```bash
# Install
bun install

# Register a schema
bun run cli schema apply examples/schemas/article.yaml

# Import real data
bun run cli import run examples/imports/articles.yaml

# Query it
bun run cli query "from article where published == true"
bun run cli query "from article select title, author order by publishedAt desc"
bun run cli query "from article where title contains 'Import'"
```

## What's included

| Component | Description |
|-----------|-------------|
| **Schema Language v0** | YAML-based schema definitions (fields, types, validation) |
| **Import Engine v0** | CSV and JSON sources, declarative field mapping |
| **Pipeline v0** | map → transform → validate → persist steps |
| **Query Language v0** | Readable text queries with `from`, `where`, `select`, `order by`, `limit` |
| **Entity Store** | SQLite-backed entity storage (zero config) |
| **CLI** | `schema`, `import`, `query`, `entity` commands |
| **HTTP API** | Minimal REST API for programmatic access |

## CLI reference

```bash
# Schemas
bun run cli schema apply <file.yaml>
bun run cli schema list
bun run cli schema get <id>

# Imports
bun run cli import run <file.yaml>

# Queries
bun run cli query "from <schema> [select <fields>] [where <conditions>] [order by <field>] [limit <n>]"

# Entities
bun run cli entity get <id>
bun run cli entity list <schema> [--limit <n>]

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
```

### Operators

`==`  `!=`  `>`  `<`  `>=`  `<=`  `contains`

## Schema format

```yaml
id: article
name: Article
description: A published article
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
source:
  type: csv        # or: json
  path: ./examples/data/articles.csv
pipeline:
  steps:
    - type: map
      mapping:
        title: Title           # schema field: source column
        published: Published
    - type: transform
      transforms:
        - field: published
          fn: toBoolean        # toBoolean | toNumber | toDate | toSlug | trim | ...
    - type: validate
    - type: persist
```

## HTTP API

```
GET  /health
GET  /schemas
POST /schemas              { ...schema definition }
GET  /schemas/:id
GET  /entities/:id
GET  /query?q=<query>
POST /import               { "path": "./examples/imports/articles.yaml" }
```

## Storage

Phase 1 uses SQLite (`aurii.db` in working directory). The storage layer is abstracted — PostgreSQL is the production target for Phase 2.

Set `AURII_DB_PATH` to use a custom database file location.

## What Phase 1 proves

The Phase 1 success criterion (from `Phase1.md`):

```bash
bun run cli schema apply examples/schemas/article.yaml
bun run cli import run examples/imports/articles.yaml
bun run cli query "from article where published == true"
```

Returns a valid JSON array of entities. ✓

---

*Phase 1 is intentionally minimal. No Studio. No AI. No plugins. No enterprise abstractions. Just the core loop — working.*
