# Reference Demo Project

> **For AI agents:** Norwegian Geo is the first real-world reference **product** for import, schema, query, storage, SDK, and delivery. New **platform contract** tests should use `tests/fixtures/external-product/` (see [`EXTERNAL_CONSUMERS.md`](EXTERNAL_CONSUMERS.md)). Also see **Reference Verticals** in `AGENTS.md`, [`docs/NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md), and [`docs/PRODUCT_MODEL.md`](PRODUCT_MODEL.md).
>
> Norwegian Geo does **not** validate authoring, drafts, publishing, preview, workflow, or media. Those belong to a future Editorial vertical after Phase 4 — [`Phase5.md`](../Phase5.md) (planned only). Do not invent editorial Core features to compensate.

---

## Overview

**Norwegian Geo** is Aurii's primary real-world reference implementation — a reusable Norwegian reference data product, not just a demo.

```
Kartverket + Bring + UDIR + Brreg  →  import  →  storage  →  query  →  API  →  SDK  →  Studio / norwegian-geo web
```

**Delivery note:** The product lives at [`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo). Live mode reads Core published routes via `@aurii/sdk`. Snapshots are an explicit offline/build-time mode. Contract: [`docs/DELIVERY.md`](DELIVERY.md). Aurii CI uses `tests/fixtures/external-product/`.

### Three layers

```
Aurii Core (packages/core)
        ↓
Norwegian Geo Core (aprestmo/norwegian-geo project/core/)
        ↓
Dataset Modules (aprestmo/norwegian-geo project/modules/)
```

| Component | Path |
|-----------|------|
| Product repository | [aprestmo/norwegian-geo](https://github.com/aprestmo/norwegian-geo) |
| Architecture guide | `docs/NORWEGIAN_GEO.md` |
| External-consumer contract | `docs/EXTERNAL_CONSUMERS.md` |
| Generic CI fixture | `tests/fixtures/external-product/` |
| Core integration tests | `packages/core/src/__tests__/vertical-slice.test.ts` |
| SDK vertical slice | `packages/sdk/src/__tests__/vertical-slice.test.ts` |
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
# Platform contract tests (this repo)
bun test tests/architecture tests/pack
cd packages/core && bun test src/__tests__/external-product-contract.test.ts

# Product (separate repo)
# git clone https://github.com/aprestmo/norwegian-geo.git
# bun install && bun run import && bun run test && bun run build
```

---

## When adding a new feature

Use this checklist:

1. **Does it affect Core geography?** → No. Core must stay generic. Product work belongs in `aprestmo/norwegian-geo`.
2. **Does it affect a domain dataset?** → Add or extend a module in `aprestmo/norwegian-geo`.
3. **Does it affect import/query/API/SDK contracts?** → Extend `tests/fixtures/external-product/` and `vertical-slice` / `external-product-contract` tests.
4. **Does it affect public consumers?** → Update `aprestmo/norwegian-geo`.
5. **Does it affect Studio?** → Point `AURII_PROJECT_ROOT` at a project package (fixture or the external product).

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

## Website routes ([`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo) `apps/web`)

| Route | Description |
|-------|-------------|
| `/` | Dataset index |
| `/fylker/[id]` | County + municipalities |
| `/kommuner/[id]` | Municipality + postal codes + linked module data |
| `/skoler/`, `/barnehager/`, `/sykehus/`, `/helligdager/` | Module datasets |
| `/historikk/` | Historical admin (from `core/historical/data/`) |

Build validates routes resolve in the Norwegian Geo repository.

---

## What not to use this for

- Performance benchmarking at tax-list / million-row scale (dataset is small by design; measured NG limits: [`SCALE.md`](SCALE.md))
- Authoring, drafts, publishing, preview, editorial workflow, or media libraries (future Editorial vertical)
- Features explicitly deferred past Phase 4 (full RBAC, plugins as production, AI as production, CMS/LiveCenter)
- Domain-specific Core hacks — behaviour belongs in schemas, imports, or the Norwegian Geo product

Product composition: [`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo) `project/product.yaml`. Model: `docs/PRODUCT_MODEL.md`.

---

## Maintaining the product

Refresh data periodically from authoritative sources:

```bash
# in aprestmo/norwegian-geo
bun run fetch
bun run import
bun run test
bun run build
```

Commit updated snapshots under `project/core/data/` and `project/modules/*/data/` in that repository when sources publish changes.
