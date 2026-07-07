# Reference Demo Project

> **For AI agents:** This is the canonical demo for validating Aurii features. Read this before adding new capabilities. Also see the **Reference Demo Project** section in `AGENTS.md` and [`docs/NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md) for product architecture.

---

## Overview

**Norwegian Geo** is Aurii's primary real-world reference implementation — a reusable Norwegian reference data product, not just a demo.

```
Kartverket + Bring + UDIR + Brreg  →  import  →  storage  →  query  →  API  →  SDK  →  Studio / apps/geo
```

### Three layers

```
Aurii Core (packages/core)
        ↓
Norwegian Geo Core (demo/norwegian-geo/core/)
        ↓
Dataset Modules (demo/norwegian-geo/modules/)
```

| Component | Path |
|-----------|------|
| Product manifest | `demo/norwegian-geo/product.yaml` |
| Architecture guide | `docs/NORWEGIAN_GEO.md` |
| Norwegian Geo Core | `demo/norwegian-geo/core/` |
| Dataset modules | `demo/norwegian-geo/modules/` |
| Fetch / import scripts | `demo/norwegian-geo/scripts/` |
| Dataset survey & strategy | `docs/Public Reference Datasets.md` |
| Import | `bun run import:norwegian-geo` |
| Refresh from live APIs | `bun run fetch:norwegian-geo` |
| Core integration tests | `packages/core/src/__tests__/vertical-slice.test.ts` |
| Public reference datasets test | `packages/core/src/__tests__/public-reference-datasets.test.ts` |
| Route feasibility tests | `packages/core/src/__tests__/geo-website-routes.test.ts` |
| Live API import test | `packages/core/src/__tests__/norwegian-geo-import.test.ts` |
| SDK vertical slice | `packages/sdk/src/__tests__/vertical-slice.test.ts` |
| Public website demo | `apps/geo` |
| Phase 3 relational tests | `packages/core/src/__tests__/phase-3-relational.test.ts` |

---

## Dataset

### Norwegian Geo Core

| Schema | Records | Natural key | Relationships |
|--------|---------|-------------|---------------|
| `county` | 15 | `id` | — |
| `municipality` | 357 | `id` | `countyId` → `county` (reference) |
| `postal-code` | 5,122 | `code` | `municipalityId` → `municipality` (reference) |

### Dataset modules

| Module | Schema | Records | Relationships |
|--------|--------|---------|---------------|
| education | `school` | ~5,683 | `municipalityId`, `countyId` → geography |
| education | `kindergarten` | ~5,541 | `municipalityId`, `countyId` → geography |
| health | `hospital` | ~115 | `municipalityId` → `municipality` |
| calendar | `public-holiday` | 84 | — (national calendar) |

Dataset ID: **`norwegian-geo`**

---

## Quick commands

```bash
# Import into SQLite (local dev)
bun run import:norwegian-geo

# Import into PostgreSQL (after docker compose up)
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo

# Run all integration tests
bun run test

# Run geo website demo
cd apps/geo && bun run dev    # http://localhost:4322
cd apps/geo && bun run build

# Studio
# Open http://localhost:4321/login → dataset: norwegian-geo
```

---

## When adding a new feature

Use this checklist:

1. **Does it affect Core geography?** → Extend `demo/norwegian-geo/core/`
2. **Does it affect a domain dataset?** → Add or extend a module under `demo/norwegian-geo/modules/`
3. **Does it affect import?** → Update `product.yaml` and `scripts/import.ts`; add tests in `vertical-slice.test.ts` or `public-reference-datasets.test.ts`
4. **Does it affect query?** → Add cases to `geo-website-routes.test.ts` using real county/municipality IDs
5. **Does it affect the API/SDK?** → Extend `packages/sdk/src/__tests__/vertical-slice.test.ts`
6. **Does it affect public consumers?** → Update `apps/geo`
7. **Does it affect Studio?** → Verify against dataset `norwegian-geo` after import

### Test IDs (stable)

| Entity | ID | Name |
|--------|-----|------|
| County | `03` | Oslo |
| Municipality | `0301` | Oslo |
| Postal code | `0001` | Oslo |

### Example validation queries

```bash
cd packages/core

bun run cli query 'from municipality where countyId == "03"' --dataset norwegian-geo
bun run cli query 'from municipality join county on municipality.countyId = county.id where municipality.id == "0301"' --dataset norwegian-geo
bun run cli query 'count municipality where countyId == "03"' --dataset norwegian-geo
bun run cli query 'from postal-code where code == "0001"' --dataset norwegian-geo
bun run cli query 'from school where municipalityId == "0301" limit 10' --dataset norwegian-geo
```

---

## Website routes (`apps/geo`)

| Route | Description |
|-------|-------------|
| `/` | Dataset index |
| `/fylker/[id]` | County + municipalities |
| `/kommuner/[id]` | Municipality + postal codes + linked module data |
| `/skoler/`, `/barnehager/`, `/sykehus/`, `/helligdager/` | Module datasets |
| `/historikk/` | Historical admin (from `core/historical/data/`) |

Build validates routes resolve. See `apps/geo/README.md`.

---

## What not to use this for

- Performance benchmarking at scale (dataset is small by design)
- Features explicitly deferred to Phase 4+ (RBAC, plugins, AI, full-text search, dot-notation traversal)
- Domain-specific Core hacks — behaviour belongs in schemas, imports, or the Norwegian Geo product

---

## Maintaining the product

Refresh data periodically from authoritative sources:

```bash
bun run fetch:norwegian-geo
bun run import:norwegian-geo
bun run test
cd apps/geo && bun run build
```

Commit updated snapshots under `demo/norwegian-geo/core/data/` and `demo/norwegian-geo/modules/*/data/` when sources publish changes.
