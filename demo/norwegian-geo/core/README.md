# Norwegian Geo Core

Stable Norwegian geographic and administrative reference data.

This is the **permanent foundation** of the Norwegian Geo product. Domain-specific datasets in `../modules/` reference these entities — they never duplicate municipality or county information.

---

## Entities

| Schema | Natural key | References |
|--------|-------------|------------|
| `county` | `id` | — |
| `municipality` | `id` | `countyId` → `county` |
| `postal-code` | `code` | `municipalityId` → `municipality` |

Population on counties and municipalities comes from SSB Statbank (merged during fetch).

---

## Directories

| Path | Purpose |
|------|---------|
| `schemas/` | Aurii schema definitions |
| `imports/` | Declarative import YAML |
| `data/` | Published JSON snapshots (committed, offline CI) |
| `raw/` | Reserved for future raw source separation |
| `historical/` | Wikipedia-based historical admin pipeline |

---

## Historical data

The `historical/` pipeline extends Core with:

- Historical municipalities and counties
- Administrative change history
- Municipality enrichment (timeline, predecessors, area, language form)
- Heraldry (coat of arms SVGs)

Historical data is consumed by `apps/geo` at build time. It is not yet imported into the Aurii `norwegian-geo` dataset.

See [`historical/README.md`](historical/README.md).

---

## Import order

Core imports run first, before any dataset module:

```
counties → municipalities → postal-codes
```

Managed by `../product.yaml` and `../scripts/import.ts`.
