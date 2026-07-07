# Norwegian Geo — Reference Data Product

> Norwegian Geo is Aurii's primary real-world reference implementation and a reusable Norwegian reference data platform built on top of Aurii.

This document defines **what belongs where** — for human contributors and AI agents.

---

## Three-layer architecture

```
Aurii Core
    ↓
Norwegian Geo Core
    ↓
Dataset Modules
```

| Layer | Owner | Location | Responsibility |
|-------|-------|----------|----------------|
| **Aurii Core** | Aurii platform | `packages/core/` | Generic runtime: schemas, import engine, query language, API, pipelines, storage |
| **Norwegian Geo Core** | Norwegian Geo product | `demo/norwegian-geo/core/` | Stable geographic reference: counties, municipalities, postal codes, history, heraldry |
| **Dataset Modules** | Norwegian Geo product | `demo/norwegian-geo/modules/` | Domain datasets that reference Core entities |

**Aurii remains the platform. Norwegian Geo is a product built on Aurii.**

Norwegian Geo does not move Norwegian logic into Core. Domain schemas, imports, fetch scripts, and data live under `demo/norwegian-geo/`.

---

## What belongs to Aurii

- Import engine (`packages/core/src/import/`)
- Schema registry and `reference` field type
- Query Language and REST API
- Pipeline steps: `map`, `validate`, `persist`
- Storage backends (SQLite, PostgreSQL)
- Generic CLI (`packages/core/src/cli/`)

Aurii Core must stay **domain-agnostic**. It validates that Norwegian Geo works; it does not encode Norwegian geography.

---

## What belongs to Norwegian Geo Core

Permanent foundation data that almost every Norwegian application can reuse:

| Entity | Schema | Records | Source |
|--------|--------|---------|--------|
| Counties | `county` | 15 | Kartverket/GeoNorge |
| Municipalities | `municipality` | 357 | Kartverket/GeoNorge |
| Postal codes | `postal-code` | 5,122 | Bring |

**Historical extension** (build-time enrichment, not yet in Core dataset):

| Data | Location | Source |
|------|----------|--------|
| Historical municipalities | `core/historical/data/municipalities.json` | Wikipedia |
| Historical counties | `core/historical/data/counties.json` | Wikipedia |
| Administrative changes | `core/historical/data/administrative-changes.json` | Wikipedia |
| Municipality enrichment | `core/historical/data/municipality-enrichment.json` | Wikipedia |
| Heraldry assets | `apps/geo/public/assets/heraldry/` | Wikimedia Commons |

Core layout:

```
demo/norwegian-geo/core/
├── schemas/          # county, municipality, postal-code
├── imports/          # declarative import YAML
├── data/             # published JSON snapshots (deterministic)
├── raw/              # reserved for future raw source separation
└── historical/       # Wikipedia pipeline + output data/
```

**Rule:** Other datasets never duplicate municipality information. They reference the same `municipality` and `county` entities via Aurii `reference` fields.

---

## What belongs to dataset modules

Domain-specific datasets that depend on Core through relations:

| Module | Schemas | Depends on |
|--------|---------|------------|
| `education/` | `school`, `kindergarten` | Core (`municipalityId`, `countyId`) |
| `health/` | `hospital` | Core (`municipalityId`) |
| `calendar/` | `public-holiday` | — (national calendar) |

Module layout:

```
demo/norwegian-geo/modules/<module-id>/
├── module.yaml       # manifest: schemas, imports, sources, dependencies
├── schemas/
├── imports/
└── data/             # published snapshots
```

### Adding a future module

Examples planned in `product.yaml`: Tax Administration, Gaselle companies, Elections, SSB datasets, Company register, Property data.

To add a module:

1. Create `modules/<id>/` with `module.yaml`, schemas, imports, and `data/`
2. Declare `dependsOn: [norwegian-geo-core]` when entities reference municipalities/counties
3. Register the module in `demo/norwegian-geo/product.yaml`
4. Extend `scripts/fetch.ts` if the module has a live API source
5. Run `bun run import:norwegian-geo` — the manifest drives registration order

---

## Data principles

Reference entities should eventually expose consistent metadata:

| Field | Purpose |
|-------|---------|
| `id` | Stable natural key |
| `source` | Source system identifier |
| `sourceUrl` | Canonical URL for the record |
| `retrievedAt` | When data was fetched |
| `validFrom` / `validTo` | Temporal validity (especially history) |
| `confidence` | Match or enrichment confidence |
| `version` | Dataset or schema version |

Today most entities expose `source`. Additional metadata fields will be adopted incrementally without breaking existing schemas.

---

## Import principles

Separate raw source data from enriched, published datasets:

```
External API / Wikipedia
        ↓
   Raw capture (future: core/raw/, module raw/)
        ↓
   Normalization (fetch scripts)
        ↓
   Entity matching (historical pipeline)
        ↓
   Relationship building
        ↓
   Published snapshot (core/data/, modules/*/data/)
        ↓
   Declarative import → Aurii Core
```

Published snapshots are **committed to git** so imports are deterministic and CI runs offline.

Import order (enforced by `product.yaml` and `scripts/import.ts`):

1. Core: counties → municipalities → postal-codes
2. Modules: education → health → calendar (each after Core)

---

## Product manifest

`demo/norwegian-geo/product.yaml` is the single source of truth for:

- Dataset ID (`norwegian-geo`)
- Core schemas and imports
- Module list, dependencies, and import order
- Planned future modules
- Target metadata fields

`demo/norwegian-geo/lib/manifest.ts` loads the manifest for scripts and tests.

---

## Commands

```bash
# Refresh all snapshots from live APIs
bun run fetch:norwegian-geo

# Import Core + all modules into Aurii
bun run import:norwegian-geo

# Historical pipeline (Core extension)
bun run fetch:historical-norwegian-geo
bun run build:municipality-enrichment
bun run validate:historical-norwegian-geo

# Integration tests
bun run test
```

With PostgreSQL:

```bash
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo
```

---

## Consumers

| Consumer | How it uses Norwegian Geo |
|----------|---------------------------|
| **Aurii Core** | `bun run import:norwegian-geo` loads dataset `norwegian-geo` |
| **Studio** | Select dataset `norwegian-geo` after import |
| **apps/geo** | Reads `core/data/` and `modules/*/data/` at build time; historical from `core/historical/data/` |
| **Integration tests** | `packages/core/src/__tests__/` via manifest paths |

---

## Deployment goal

Norwegian Geo is structured so it can eventually deploy independently:

- **Engine:** Aurii Core (PostgreSQL, REST API)
- **Data:** `bun run fetch:norwegian-geo && bun run import:norwegian-geo`
- **Frontend:** `apps/geo` (static Astro site) or any SDK consumer
- **Hosting:** Docker, Coolify, self-hosted

The product boundary is `demo/norwegian-geo/` plus its consumer apps. Aurii Core is the engine behind it.

---

## Related documentation

| Document | Purpose |
|----------|---------|
| [`demo/norwegian-geo/README.md`](../demo/norwegian-geo/README.md) | Product quick start |
| [`docs/REFERENCE_DEMO.md`](REFERENCE_DEMO.md) | Agent workflow and test IDs |
| [`docs/Public Reference Datasets.md`](Public%20Reference%20Datasets.md) | Source survey and selection rationale |
| [`demo/norwegian-geo/core/historical/README.md`](../demo/norwegian-geo/core/historical/README.md) | Historical pipeline details |
| [`AGENTS.md`](../AGENTS.md) | Architectural philosophy |
