# Phase 2.2 — Reality Check

> **Status: complete.** Phase 2 is closed. This document records the reality check and remains the reference for the canonical demo project.

Validate that the Phase 1–2 architecture solves a realistic problem end-to-end.

Phase 2.2 is **not** about adding platform capabilities. It proves the existing stack works as a complete vertical slice.

---

## Dataset

**Norwegian geographic reference data** — three related entity types from authoritative open sources:

| Entity | Records | Source |
|--------|---------|--------|
| Counties (fylker) | 15 | Kartverket/GeoNorge JSON API |
| Municipalities (kommuner) | 357 | Kartverket/GeoNorge JSON API |
| Postal codes (postnummer) | 5,122 | Bring ANSI TSV |

Bundled snapshots live in `demo/norwegian-geo/data/` for offline use. See `demo/norwegian-geo/README.md` for details.

---

## Definition of Done

On a clean machine:

```bash
bun install
docker compose up    # in one terminal
bun run test         # in another
```

Then:

```bash
# Import the real dataset into PostgreSQL
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo
```

Verify:

1. **PostgreSQL** — 5,494 entities across three schemas
2. **REST** — `curl http://localhost:3000/stats?dataset=norwegian-geo`
3. **SDK** — `createClient({ baseUrl, defaultDataset: "norwegian-geo" }).query.run(...)`
4. **Studio** — http://localhost:4321 → set dataset to `norwegian-geo` on `/login`

---

## Workflow Validated

```
Real dataset (demo/norwegian-geo/data/)
    ↓
Schema (demo/norwegian-geo/schemas/*.yaml)
    ↓
Import Analysis (POST /import/analyze — tested in vertical-slice.test.ts)
    ↓
Mapping (declarative YAML + Studio wizard)
    ↓
Transform Pipeline (map → validate → persist)
    ↓
Validation (schema required fields)
    ↓
Persist (PostgreSQL JSONB with deduplicateBy upsert)
    ↓
Query (Aurii Query Language v0)
    ↓
REST API (/health, /schemas, /entities, /query, /stats, /imports)
    ↓
SDK (@aurii/sdk)
    ↓
Studio (dashboard, entity browser, import wizard)
```

---

## Quick Start

### 1. Start the stack

```bash
docker compose up
```

- Core API: http://localhost:3000 (Swagger at `/swagger`)
- Studio: http://localhost:4321
- PostgreSQL: `postgres://aurii:aurii@localhost:5432/aurii`

### 2. Import data

```bash
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo
```

Expected output:

```
Counties:       15
Municipalities: 357
Postal codes:   5122
```

### 3. Query via REST

```bash
# Oslo county
curl -s "http://localhost:3000/query?q=from+county+where+name+%3D%3D+%22Oslo%22&dataset=norwegian-geo" | jq .

# Municipalities in Oslo county
curl -s "http://localhost:3000/query?q=from+municipality+where+countyId+%3D%3D+%2203%22&dataset=norwegian-geo" | jq '.count'

# Dataset stats
curl -s "http://localhost:3000/stats?dataset=norwegian-geo" | jq .
```

### 4. Query via SDK

```ts
import { createClient } from "@aurii/sdk";

const client = createClient({
  baseUrl: "http://localhost:3000",
  defaultDataset: "norwegian-geo",
});

const oslo = await client.query.run('FROM municipality WHERE id == "0301"');
const stats = await client.stats.get();
console.log(oslo.entities[0]?.data, stats.totalEntities);
```

### 5. View in Studio

1. Open http://localhost:4321/login
2. API URL: `http://localhost:3000`
3. Dataset: `norwegian-geo`
4. Browse `/entities` (filter by schema), check `/` dashboard for import history

### 6. Run tests

```bash
bun run test
```

Integration tests:

| Test file | Coverage |
|-----------|----------|
| `vertical-slice.test.ts` | Full workflow: schema, analyze, import, query, API, errors |
| `norwegian-geo-import.test.ts` | Live API fetch, idempotency, cross-reference validation |
| `real-world-dataset.test.ts` | Messy CSV edge cases (job postings) |
| `sdk/vertical-slice.test.ts` | SDK query, entities, stats, import history |
| `studio/api-client.test.ts` | Studio SDK integration |

---

## Refresh Data from Live Sources

```bash
bun run fetch:norwegian-geo
```

Requires network access. Updates `demo/norwegian-geo/data/*.json`.

---

## Reality Check Report

### What worked

| Area | Result |
|------|--------|
| **Schema** | Three schemas with primitives, identifiers, required validation, and `countyId`/`municipalityId` relationship fields |
| **Import Analysis** | Correctly detects JSON format, columns, row counts; suggests mapping for municipalities and postal codes |
| **Mapping** | Declarative YAML mappings in `demo/norwegian-geo/imports/` — no hardcoded transforms needed for this dataset |
| **Pipeline** | map → validate → persist runs 5,494 records in under 1 second (SQLite) |
| **Persistence** | PostgreSQL JSONB storage; `deduplicateBy` makes re-imports idempotent (updates in place) |
| **Query** | Filtering (`where countyId == "03"`), sorting (`order by code asc`), limits, and multi-step relationship navigation via code fields |
| **REST API** | All Phase 2 endpoints respond correctly for the vertical slice |
| **SDK** | Full workflow accessible without raw HTTP |
| **Studio** | Lists entities, shows stats, displays import history via SDK |
| **Docker** | `docker compose up` starts PostgreSQL + Core + Studio without manual setup |

### What required changes

| Change | Reason |
|--------|--------|
| `demo/norwegian-geo/` package | Bundled real data + schemas + imports for reproducible offline workflow |
| `bun run import:norwegian-geo` script | Single documented command for the full import |
| CLI: respect import YAML `dataset` when `--dataset` omitted | Import definitions already declare `dataset: norwegian-geo` |
| `vertical-slice.test.ts` + SDK vertical slice tests | Automated proof of end-to-end workflow |
| Root `bun run test` includes Studio | Matches Definition of Done (`bun run test` runs all suites) |

No major platform features were added. Changes are packaging, documentation, tests, and one small CLI fix.

### Architectural weaknesses discovered

Documented honestly — these are known gaps, not hidden behind new abstractions:

| Weakness | Impact | Recommendation (Phase 3+) |
|----------|--------|---------------------------|
| **No join queries** | County → municipality → postal-code requires 3 separate queries | Add relation-aware query syntax or application-level graph queries |
| **Relationships are string fields only** | `countyId` is not enforced as a foreign key; orphaned references possible | Schema-level `reference` type with validation at import time |
| **Type inference misclassifies numeric-looking IDs** | Municipality `id` inferred as `number` in analyzer | Majority-wins heuristic or explicit identifier detection | **Fixed** — identifier columns infer as `string` |
| **`imported` count includes updates** | Second idempotent run reports `imported: 357` even though rows were updated | Separate `inserted` vs `updated` in `ImportResult` reporting | **Fixed** — `inserted` and `updated` reported separately |
| **`toBoolean` drops multi-state values** | "Hybrid" remote work values silently lost | Add `enum` field type (see `docs/RealWorldTest.md`) |
| **`toNumber` corrupts locale-formatted numbers** | `"1,500"` → `1` | Locale-aware number parsing transform |
| **No OR / aggregate queries** | Cannot express `where A or B` or `count(*)` | Extend Query Language v1 |
| **Bring TSV requires manual header injection** | Live postal code fetch needs preprocessing | Add TSV source type with `hasHeader: false` option |
| **Studio has no dedicated query UI** | Queries work via entity browser but no query builder | Phase 3 Studio enhancement |
| **Single bearer token auth only** | Not suitable for multi-user production | RBAC in Phase 3 |

### Recommendations before Phase 3

1. **Add `reference` field validation at import** — reject or warn when `municipalityId` does not match a known municipality.
2. **Improve `ImportResult` semantics** — distinguish `inserted`, `updated`, and `skipped` counts.
3. **Extend Query Language** — OR conditions and basic aggregates (`count`, `group by`) are the highest-value query gaps surfaced by real data.
4. **Add `enum` field type** — boolean transforms cannot represent real-world categorical data.
5. **TSV as first-class source** — Norwegian public data frequently ships as tab-separated files without headers.

---

## Non-Goals (confirmed not implemented)

- Authentication systems beyond bearer token
- Plugin runtime extensions
- AI features
- Permission systems / RBAC
- Asset pipeline
- Realtime collaboration
- Search indexing
- Multi-node architecture
- Background workers
- Event streaming (external)
- GraphQL
- UI redesigns

---

## Files Added / Changed

| Path | Purpose |
|------|---------|
| `demo/norwegian-geo/` | Real dataset vertical slice (data, schemas, imports) |
| `packages/core/scripts/import-norwegian-geo.ts` | One-command import |
| `packages/core/scripts/fetch-norwegian-geo.ts` | Refresh data from live APIs |
| `packages/core/src/__tests__/vertical-slice.test.ts` | Integration tests |
| `packages/sdk/src/__tests__/vertical-slice.test.ts` | SDK integration tests |
| `Phase2.2.md` | This document |
| `docs/REFERENCE_DEMO.md` | Agent guide for the canonical demo project |
| `AGENTS.md` | Reference Demo Project section for agents |
| `apps/geo/` | Public website demo (373 routes) |

---

## Website validation

A public county/municipality website is feasible with the current data and API.

### Data completeness

| Check | Result |
|-------|--------|
| Counties (Kartverket) | 15 — all have municipalities |
| Municipalities (Kartverket) | 357 — all linked to a valid county |
| Postal codes (Bring) | 5,122 — linkable via `municipalityId` |
| Unique routable IDs | County `03`, municipality `0301` — URL-safe, no slugs required |

### Route map

| URL | Aurii query |
|-----|-------------|
| `/fylker` | `from county order by name asc` |
| `/fylker/03` | `from county where id == "03"` + `from municipality where countyId == "03"` |
| `/kommuner/0301` | `from municipality where id == "0301"` + `from postal-code where municipalityId == "0301"` |

### Demo site

`apps/geo` is a minimal Astro consumer that builds **373 static pages** (1 index + 15 counties + 357 municipalities):

```bash
cd apps/geo && bun run dev    # http://localhost:4322
cd apps/geo && bun run build  # generates all routes
```

Automated validation: `packages/core/src/__tests__/geo-website-routes.test.ts` (queries every county and municipality via Core).

### Limitations for a production website

- **No join queries** — county name on a municipality page requires a second query (or denormalization at import)
- **Entity list pagination** — default API limit is 50; use Query Language with explicit `limit` for full lists
- **Pretty URLs** — IDs work (`/kommuner/0301`); human-readable slugs would need a `slug` field added to schemas
- **No search** — filtering is query-based only; full-text search is Phase 3
