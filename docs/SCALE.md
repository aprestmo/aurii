# Scale and query honesty

> Phase 4 N4. Measure what Norwegian Geo actually does. Do not claim tax-list or million-row readiness.
>
> Parent: [`Phase4.md`](../Phase4.md) workstream D. Query contract: [`Query-Language-v1.md`](Query-Language-v1.md). Delivery: [`DELIVERY.md`](DELIVERY.md).

---

## Dataset sizes (Norwegian Geo)

Committed snapshots, imported into Core:

| Schema | Rows | Layer |
|--------|------|-------|
| `county` | 15 | Core |
| `municipality` | 357 | Core |
| `postal-code` | 5,122 | Core |
| `school` | ~5,683 | education |
| `kindergarten` | ~5,541 | education |
| `hospital` | ~115 | health |
| `public-holiday` | 84 | calendar |
| **Total** | **~17,900** | |

This is the **proven** size. A future tax-list product is the stress target (hundreds of thousands to millions of rows). It is not in the repository and is **not** claimed to work.

---

## Measured query times (N4.1)

Environment: SQLite `:memory:`, in-process `executeQuery` / `findEntityByField`, no HTTP, no Postgres network. Recorded 2026-08-15 in `packages/core/src/__tests__/scale-benchmark.test.ts`.

| Query | Rows touched | Time |
|-------|----------------|------|
| `count municipality` | 357 (SQL `COUNT(*)`) | 0.05 ms |
| `count municipality where countyId == "03"` | filter + COUNT | 0.26 ms |
| `count postal-code` | 5,122 (SQL `COUNT(*)`) | 0.16 ms |
| `from municipality join county on …` | 357 + 15, in-memory hash join | 0.91 ms |
| same join `where municipality.id == "0301"` | still full-scans both sides, then filters | 0.92 ms |
| `from postal-code order by code asc limit 100 offset 5000` | SQL scan + offset | 4.02 ms |
| `findEntityByField(municipality, id, "0301")` | SQL `json_extract` + `LIMIT 1` | 0.08 ms |

**How to read this:** at Norwegian Geo size, everything is fast. Latency is not the story. The story is **algorithmic cost** that will appear when a side of a join or an offset walk grows two or three orders of magnitude.

HTTP published-route and Studio list APIs add serialization and process overhead on top of these numbers. They were not re-benchmarked here; N1 already proves correctness of the live path.

---

## What shipped in the N4 spike (N4.2)

Reuse the existing planner → adapter contract. No second query engine. No client SQL.

| Path | Before | After |
|------|--------|--------|
| `count <schema> [where …]` | Materialize matching rows, return `.length` | SQL `COUNT(*)` when `canPushdownWhere` (no `NOT`, no `EXISTS`) |
| Import / plan `findByField` | `listEntities(..., 10000)` + JS `.find` | `findEntityByField`: JSON-path equality + `LIMIT 1` |
| Import reference checks | Repeat full scans, silent miss past 10k | SQL lookup + per-run cache |
| Natural-key index | `(dataset_id, schema_id)` only | Plus expression index on `data.id` (SQLite `json_extract`, Postgres `data->>'id'`) |

Single-schema filter / sort / limit was already partially pushed to SQL (Phase 3). Joins stay in-memory.

---

## Not ready for N rows (N4.4)

| Operation | Proven N | Not a product contract at |
|-----------|----------|---------------------------|
| In-memory hash join (full scan both sides) | 357 ⨝ 15 | **100,000+ rows on either side** (memory + two full scans; post-join filter does not shrink the scans) |
| Offset pagination | `offset 5000` on 5,122 postal codes | **Offset walks past ~100,000** (cost grows with offset) |
| Published route single `limit` dump | ~5,122 postal codes in one response | **Tax-list / million-row schemas** — do not copy the postal-code `limit: 10000` pattern |
| COUNT with `NOT` / `EXISTS` | 357 municipalities | Same as a full scan of the schema (fallback still materializes rows) |
| `GET /entities` offset list | SDK default 50 | Fine for Studio pages; not a large-export API |

**One-sentence honesty:** Aurii Query Language and delivery are correct at Norwegian Geo scale (~18k entities, largest schema ~5.7k). They are **not ready** for million-row joins, million-row offset pagination, or a tax-list dump over a published route.

---

## Named next bottlenecks

1. **In-memory joins** — left WHERE is stripped; both schemas are fully scanned. Next spike: SQL equijoin *or* push left-only predicates onto the left scan.
2. **Offset pagination** — see cursor design below.
3. **Published routes** — `listEntities` + in-memory filter/sort; one `limit`, no cursor query param.
4. **Double WHERE on scans** — SQL clauses plus JS `evaluateWhere` for NOT/EXISTS safety.
5. **No GROUP BY / SUM / AVG** — COUNT only.
6. **SQLite JSON extract** — expression index helps `id`; arbitrary field filters still scan the schema partition.

---

## Cursor / keyset pagination (N4.3 — design only)

Offset `LIMIT n OFFSET k` must skip `k` rows. That is acceptable for Studio pages and for Norwegian Geo postal codes. It is the wrong contract for a tax-list or any list whose callers walk far into the set.

### Proposed shape (not implemented)

**Query Language (later):**

```text
from postal-code
order by code asc
after code "5001" id "<entity-uuid>"
limit 100
```

Opaque alternative for published routes:

```http
GET /public/norge-data/v1/postal-codes?limit=100&cursor=<opaque>
```

```json
{ "data": [ … ], "nextCursor": "<opaque or null>" }
```

**Cursor payload** (server-opaque; conceptually):

```ts
{ sortField: "code", sortValue: "5001", id: "<entity-uuid>" }
```

**Keyset predicate** (stable, unique):

```sql
WHERE (sort_field > :v)
   OR (sort_field = :v AND id > :id)
ORDER BY sort_field ASC, id ASC
LIMIT :n
```

Natural keys already unique in Norwegian Geo (`county.id`, `municipality.id`, `postal-code.code`). Tie-break on entity `id` anyway so equal sort values cannot skip or repeat rows.

### Rules for a later implementation

- Keep the planner → adapter contract. Add an `after` (or `cursor`) field on `ScanStep`; adapters emit keyset SQL. Do not add a second pagination API.
- Published routes may expose `?cursor=` + `?limit=` **without** changing the declarative query language first — but the route executor should call the same scan path, not invent a parallel pager.
- Default sort must be unique (sort field + entity id).
- Do not implement cursor pagination just to decorate Norwegian Geo. Implement when a consumer must page a schema larger than the postal-code dump.
- Offset remains valid for small pages (`GET /entities`, Studio, `limit`/`offset` in Query Language).

---

## How to re-measure

```bash
bun test packages/core/src/__tests__/scale-benchmark.test.ts
```

Logs lines prefixed `N4 `. Update the table in this file when the numbers change in a meaningful way (new adapter, new dataset size). Do not treat CI flake of a few milliseconds as a regression; the test uses generous upper bounds.

---

## Related

- [ADR-0009](../adr/ADR-0009%20—%20Query%20Planner%20and%20Relational%20Execution.md) — planner / adapter boundary
- [`Query-Language-v1.md`](Query-Language-v1.md) — syntax and remaining join limitation
- [`DELIVERY.md`](DELIVERY.md) — published-route pagination
- [`NEXT_AFTER_STUDIO_BETA.md`](NEXT_AFTER_STUDIO_BETA.md) — N4 checklist
