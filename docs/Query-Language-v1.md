# Query Language v1 — Implementation Reference

> Phase 3 implementation status. See `docs/Query Language.md` for the full vision.

## Architecture

```
Query string
    ↓
Parser (packages/core/src/query/parser.ts)
    ↓
AST (packages/core/src/query/ast.ts)
    ↓
Planner (packages/core/src/query/planner.ts)
    ↓
ExecutionPlan (packages/core/src/query/plan.ts)
    ↓
Storage adapter (executePlan)
```

Storage adapters never receive raw query strings from clients.

## Syntax (v1)

### Select

```
from <schema>
[join <schema> on <alias>.<field> = <alias>.<field>]
[select <field>[, <field>]*]
[where <expr>]
[order by <field> [asc | desc]]
[limit <n>] [offset <n>]
```

### Aggregate

```
count <schema> [where <expr>]
```

### Where expressions

| Feature | Example |
|---------|---------|
| Comparison | `countyId == "03"` |
| AND | `a == 1 and b == 2` |
| OR | `countyId == "03" or countyId == "11"` |
| NOT | `not status == "draft"` |
| IN | `countyId in ("03", "11")` |
| EXISTS | `countyId exists` (field is populated) |
| contains | `name contains "Oslo"` |

### Join

```
from municipality
join county
on municipality.countyId = county.id
```

Joined right-side fields appear in results as `county.<field>`.

## API

```
GET /query?q=<query>&dataset=<id>
GET /query?q=<query>&dataset=<id>&explain=true
GET /query/explain?q=<query>
```

## Migration from v0

v0 queries remain valid. The parser now returns a typed AST (`QueryAST`) instead of a flat `ParsedQuery`. Legacy `ParsedQuery` is available via `toLegacyParsedQuery()` for single-entity AND-only queries.

## Known limitations

- Joins execute in-memory after two full scans (correct at Norwegian Geo size; **not** a 100k+ join contract — [`SCALE.md`](SCALE.md))
- `count` uses SQL `COUNT(*)` when WHERE is pushdown-safe; `NOT` / `EXISTS` still scan then count
- EXISTS checks field population, not referential integrity against target schema
- Aggregates: COUNT only (SUM, AVG, GROUP BY deferred)
- Dot-notation traversal (`author.name`) not yet supported — use JOIN
- NOT with complex sub-expressions may be evaluated in-memory only
- Pagination is `limit` / `offset`. Cursor/keyset is designed, not implemented ([`SCALE.md`](SCALE.md))
