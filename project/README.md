# Norwegian Geo project package

Aurii project package for this standalone product: schemas, sources, imports, routes, Studio config, and committed snapshots.

See the [repository README](../README.md) for architecture, install, and how this product consumes Aurii.

## Layout

```
project/
├── product.yaml          # Product manifest — modules, dependsOn, CLI import order
├── aurii.config.ts       # Project package — Studio/ops sources, imports, routes
├── studio/               # defineStudio collections and import groups
├── lib/                  # Shared paths and manifest loader
├── scripts/              # fetch, import, register-via-api, enrich-population
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

Dataset ID: **`norwegian-geo`**. Project slug: **`norge-data`**.

## Quick start

```bash
# from repository root
bun run import            # schemas + entities into a running/local Runtime
bun run fetch             # refresh snapshots from live APIs
bun run register          # register the package via HTTP
bun run test
```

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

## Adding a dataset module

1. Create `modules/<id>/` with `module.yaml`, schemas, imports, and `data/`
2. Add the module to `product.yaml` **and** `lib/manifest.ts` (CLI import order)
3. Add source + saved-import descriptors; list them in `aurii.config.ts`
4. Add Studio collections / `importGroups` in `studio/studio.config.ts`
5. Extend `scripts/fetch.ts` if needed
6. `bun run import` then `bun run register`
