# Norwegian Geo

Production-quality Norwegian reference data built on [Aurii](../../README.md).

Norwegian Geo serves three roles:

1. **Aurii's primary reference implementation** — validates the full Runtime loop against real open data
2. **Reusable reference data platform** — stable counties, municipalities, and postal codes for any application
3. **Foundation for domain datasets** — schools, hospitals, holidays today; tax, elections, companies tomorrow

---

## Architecture

```
Aurii Core (packages/core)
        ↓
Norwegian Geo Core (core/)
        ↓
Dataset Modules (modules/)
```

Full documentation: [`docs/NORWEGIAN_GEO.md`](../docs/NORWEGIAN_GEO.md)

---

## Layout

```
demo/norwegian-geo/
├── product.yaml          # Product manifest — schemas, modules, import order
├── lib/                  # Shared paths and manifest loader
├── scripts/              # fetch, import, enrich-population
├── core/                 # Counties, municipalities, postal codes, history
│   ├── schemas/
│   ├── imports/
│   ├── data/
│   ├── raw/              # Reserved for raw source capture
│   └── historical/       # Wikipedia pipeline + historical data
└── modules/
    ├── education/        # Schools, kindergartens (UDIR)
    ├── health/           # Hospitals (Brreg)
    └── calendar/         # Public holidays (Nager.Date)
```

Dataset ID: **`norwegian-geo`**

---

## Quick start

```bash
# Import Core + all modules into Aurii (offline, uses committed snapshots)
bun run import:norwegian-geo

# Refresh from live APIs (network required)
bun run fetch:norwegian-geo

# Run integration tests
bun run test

# Public demo site
cd apps/geo && bun run dev
```

---

## Entities

### Norwegian Geo Core

| Schema | Records | Source |
|--------|---------|--------|
| `county` | 15 | Kartverket/GeoNorge |
| `municipality` | 357 | Kartverket/GeoNorge |
| `postal-code` | 5,122 | Bring |

### Dataset modules

| Module | Schemas | Records | Source |
|--------|---------|---------|--------|
| education | `school`, `kindergarten` | ~5,683 / ~5,541 | UDIR |
| health | `hospital` | ~115 | Brreg |
| calendar | `public-holiday` | 84 | Nager.Date |

---

## Query examples

```bash
cd packages/core

bun run cli query 'from municipality where countyId == "03"' --dataset norwegian-geo
bun run cli query 'from school where municipalityId == "0301" limit 10' --dataset norwegian-geo
bun run cli query 'from public-holiday where year == 2026 order by date asc' --dataset norwegian-geo
```

---

## Adding a dataset module

1. Create `modules/<id>/` with `module.yaml`, schemas, imports, and `data/`
2. Add the module to `product.yaml`
3. Extend `scripts/fetch.ts` if needed
4. Run `bun run import:norwegian-geo`

See [`docs/NORWEGIAN_GEO.md`](../docs/NORWEGIAN_GEO.md) for boundaries and import principles.
