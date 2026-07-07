# Dataset Modules

Domain-specific Norwegian public datasets that build on [Norwegian Geo Core](../core/).

Each module is an independent unit that can be added, refreshed, or eventually deployed separately — while sharing the same municipality and county entities from Core.

---

## Active modules

| Module | Schemas | Depends on Core | Source |
|--------|---------|-----------------|--------|
| [`education/`](education/) | `school`, `kindergarten` | Yes | UDIR NSR/NBR |
| [`health/`](health/) | `hospital` | Yes | Brreg Enhetsregisteret |
| [`calendar/`](calendar/) | `public-holiday` | No | Nager.Date |

---

## Module structure

Every module follows the same layout:

```
modules/<id>/
├── module.yaml     # Manifest: schemas, imports, sources, dependsOn
├── schemas/
├── imports/
└── data/           # Published snapshots
```

---

## Adding a new module

1. Copy the structure from an existing module (e.g. `health/`)
2. Define schemas with `reference` fields to `municipality` or `county` where needed
3. Set `dependsOn: [norwegian-geo-core]` in `module.yaml`
4. Register the module in `../product.yaml` under `modules:`
5. Add fetch logic to `../scripts/fetch.ts` if the module has a live API
6. Run `bun run import:norwegian-geo`

Planned modules are listed in `../product.yaml` under `futureModules`.

---

## Design rules

- **Never duplicate geography** — reference `municipality.id` and `county.id`
- **Published data is deterministic** — commit normalized JSON to `data/`
- **Imports are declarative** — YAML mappings only, no Core hardcoding
- **One module per domain** — tax, elections, and companies each get their own directory

See [`docs/NORWEGIAN_GEO.md`](../../docs/NORWEGIAN_GEO.md) for the full architecture.
