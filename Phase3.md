# Phase 3 — Relational Core

> Engineering report for Phase 3 completion.
>
> **Status: complete.** Current platform status and next work: repository [`README.md`](README.md), product model [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md), plan [`Phase4.md`](Phase4.md). This file remains a historical engineering record.

## Objective

Transform Aurii from a document-oriented runtime into a relationship-aware platform without application-specific coupling.

## Delivered

| Workstream | Status | Key files |
|------------|--------|-----------|
| Reference fields | Done | `schema/types.ts`, `demo/norwegian-geo/schemas/` |
| Import validation | Done | `import/reference-validator.ts`, `import/engine.ts` |
| Query Language v1 | Done | `query/parser.ts`, `query/ast.ts` |
| Query planner | Done | `query/planner.ts`, `query/plan.ts`, `storage/plan-executor.ts` |
| Studio | Done | `apps/studio/src/pages/query.astro`, entities relation links |
| Tests | Done | `phase-3-relational.test.ts`, updated vertical-slice |

## Architectural decisions

### 1. Plans, not strings, at the storage boundary

Clients send query strings. The parser produces an AST; the planner produces an `ExecutionPlan`; adapters call `executePlan()`. This keeps SQLite and PostgreSQL aligned and enables `/query/explain`.

### 2. References are IDs in JSON, not embedded objects

Reference fields store string IDs (or `string[]` for one-to-many). This preserves the Phase 2 entity model while making relationships schema-declared and import-validatable.

### 3. In-memory joins for correctness first

Joins hash the right side by join key and merge in application code. Correct for the Norwegian geo dataset (15 + 357 + 5,122 rows) and identical across storage engines. SQL join pushdown is deferred.

### 4. Import reference validation is opt-in per definition

Default `strict` mode fails rows with missing targets. `warning` and `skip` modes support messy real-world sources. Validation requires ordered imports (counties → municipalities → postal codes).

## Tradeoffs

| Choice | Benefit | Cost |
|--------|---------|------|
| In-memory joins | Storage-agnostic, fast to ship | Won't scale to millions of rows |
| Post-filter WHERE after SQL scan | Handles NOT, EXISTS, OR reliably | Double evaluation on some queries |
| `count` as separate query form | Simple grammar | Different from SQL `SELECT COUNT(*)` |
| Qualified join fields (`municipality.id`) | Explicit join queries | Verbose compared to future dot traversal |

## Discovered limitations

1. **EXISTS in queries** checks field population, not that the referenced entity exists in the target schema (import validation covers writes).
2. **Aggregates** limited to COUNT; no GROUP BY, SUM, or AVG.
3. **No dot-notation traversal** (`county.name` without JOIN) — ADR-0004 vision, not yet implemented.
4. **Reference lookup during import** scanned up to 10,000 entities per check in Phase 3 — acceptable for demo scale. **N4:** SQL `findEntityByField` + per-run cache; see [`docs/SCALE.md`](docs/SCALE.md).
5. **Parallel multi-schema imports** race reference validation — imports must be ordered (documented).

## Design assumption corrected

Phase 2 treated `countyId` and `municipalityId` as plain strings. Phase 3 promotes them to `type: reference` with `to:` declarations. **Stored data is unchanged** — only schema semantics and validation improved.

## Definition of done

```
Import Norwegian data        ✓  bun run import:norwegian-geo
Validate references          ✓  strict/warning/skip modes
Persist                      ✓  unchanged upsert path
Execute joins                ✓  municipality ⨝ county
Execute aggregates           ✓  count municipality
Consume through SDK          ✓  query.run + query.explain
Render in Studio             ✓  Query playground + relation links
Run in Docker                ✓  no new manual steps
Pass CI                      ✓  337 tests pass
```

## Recommended Phase 4 scope

Superseded in detail by [`Phase4.md`](Phase4.md) (Data Products and Delivery). Phase 3’s technical recommendations map as follows:

1. **SQL pushdown** for joins and COUNT — Phase 4 workstream D
2. **Reference indexes** and O(1) lookup by natural key during import — Phase 4 workstream D
3. **Dot-notation traversal** as planner rewrite to joins — candidate under D / later query work
4. **GROUP BY** and additional aggregates — Phase 4 workstream D
5. **Schema-generated Studio forms** with relation picker — **out of Phase 4 scope** as authoring/CMS (see ADR-0010); read-only relation display already shipped
6. **Enum field type** — may land if it unblocks data products; not a CMS feature

## Documentation

- `docs/Query-Language-v1.md`
- `docs/Schema-Language-References.md`
- `adr/ADR-0009 — Query Planner and Relational Execution.md`
- Updated `docs/REFERENCE_DEMO.md`
