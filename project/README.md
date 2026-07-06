# Norwegian Public Reference Data

Real-world open data from authoritative Norwegian sources, packaged as a complete Aurii vertical slice and reusable public reference catalogue.

| Entity | Records | Source |
|--------|---------|--------|
| Counties (fylker) | 15 | [Kartverket/GeoNorge](https://ws.geonorge.no/kommuneinfo/v1/fylker) |
| Municipalities (kommuner) | 357 | [Kartverket/GeoNorge](https://ws.geonorge.no/kommuneinfo/v1/kommuner) |
| Postal codes (postnummer) | 5,122 | [Bring](https://www.bring.no/tjenester/adressetjenester/postnummer) |
| Schools (skoler) | ~5,683 | [UDIR NSR](https://data-nsr.udir.no) |
| Kindergartens (barnehager) | ~5,541 | [UDIR NBR](https://data-nbr.udir.no) |
| Hospitals (sykehus) | ~115 | [Brønnøysundregistrene](https://data.brreg.no/enhetsregisteret/api) |
| Public holidays (helligdager) | 84 | [Nager.Date](https://date.nager.at) (2024–2030) |

Full survey and selection rationale: [`docs/Public Reference Datasets.md`](../../docs/Public%20Reference%20Datasets.md).

Data snapshots are committed in `data/` so imports work offline. Refresh from live sources with:

```bash
bun run fetch:norwegian-geo
```

---

## Schemas

Seven related entity types in dataset `norwegian-geo`:

- **county** — `id`, `name`, `source`
- **municipality** — `id`, `name`, `countyId` (→ county.id), `source`
- **postal-code** — `code`, `city`, `municipalityId` (→ municipality.id), …
- **school** — `id`, `name`, `municipalityId`, `countyId`, `isPublic`, `isPrimary`, `isSecondary`, `isActive`, `source`
- **kindergarten** — `id`, `name`, `municipalityId`, `countyId`, `isPublic`, `isActive`, `source`
- **hospital** — `id`, `name`, `municipalityId`, `industryCode`, `industryDescription`, `source`
- **public-holiday** — `id`, `date`, `localName`, `name`, `year`, `isNational`, `holidayType`, `source`

---

## One-command import

```bash
bun run import:norwegian-geo
```

With PostgreSQL:

```bash
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo
```

---

## Query examples

```bash
cd packages/core

bun run cli query 'from school where municipalityId == "0301" limit 10' --dataset norwegian-geo
bun run cli query 'from kindergarten where municipalityId == "0301" limit 10' --dataset norwegian-geo
bun run cli query 'from hospital where municipalityId == "0301"' --dataset norwegian-geo
bun run cli query 'from public-holiday where year == 2026 order by date asc' --dataset norwegian-geo
```

---

## Public demo site

```bash
cd apps/geo && bun run dev
```

Browse datasets at `/`, schools at `/skoler`, kindergartens at `/barnehager`, hospitals at `/sykehus`, holidays at `/helligdager`.
