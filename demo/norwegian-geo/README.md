# Norwegian Geographic Reference Data

Real-world open data from authoritative Norwegian sources, packaged as a complete Aurii vertical slice.

| Entity | Records | Source |
|--------|---------|--------|
| Counties (fylker) | 15 | [Kartverket/GeoNorge](https://ws.geonorge.no/kommuneinfo/v1/fylker) |
| Municipalities (kommuner) | 357 | [Kartverket/GeoNorge](https://ws.geonorge.no/kommuneinfo/v1/kommuner) |
| Postal codes (postnummer) | 5,122 | [Bring](https://www.bring.no/tjenester/adressetjenester/postnummer) |

Data snapshots are committed in `data/` so imports work offline. Refresh from live sources with:

```bash
bun run fetch:norwegian-geo
```

---

## Schemas

Three related entity types in dataset `norwegian-geo`:

- **county** — `id`, `name`, `source`
- **municipality** — `id`, `name`, `countyId` (→ county.id), `source`
- **postal-code** — `code`, `city`, `municipalityId` (→ municipality.id), `municipalityName`, `postalCodeType`, `source`

Relationships are expressed as string identifier fields (no join queries in v0).

---

## One-command import

With Core storage configured (SQLite by default):

```bash
bun run import:norwegian-geo
```

With PostgreSQL (e.g. after `docker compose up`):

```bash
AURII_STORAGE=postgres \
  DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii \
  bun run import:norwegian-geo
```

### Manual CLI import

```bash
cd packages/core

bun run cli dataset create norwegian-geo "Norwegian Geography"

bun run cli schema apply ../../demo/norwegian-geo/schemas/county.yaml --dataset norwegian-geo
bun run cli schema apply ../../demo/norwegian-geo/schemas/municipality.yaml --dataset norwegian-geo
bun run cli schema apply ../../demo/norwegian-geo/schemas/postal-code.yaml --dataset norwegian-geo

bun run cli import run ../../demo/norwegian-geo/imports/counties.yaml
bun run cli import run ../../demo/norwegian-geo/imports/municipalities.yaml
bun run cli import run ../../demo/norwegian-geo/imports/postal-codes.yaml
```

Import definitions include `dataset: norwegian-geo`, so `--dataset` is not required when using `import run`.

---

## Query examples

```bash
cd packages/core

# Find Oslo county
bun run cli query 'from county where name == "Oslo"' --dataset norwegian-geo

# All municipalities in Oslo county
bun run cli query 'from municipality where countyId == "03"' --dataset norwegian-geo

# Postal codes in Oslo municipality
bun run cli query 'from postal-code where municipalityId == "0301" limit 10' --dataset norwegian-geo

# Street-address postal codes only
bun run cli query 'from postal-code where postalCodeType == "B" limit 5' --dataset norwegian-geo
```

### REST API

```bash
curl "http://localhost:3000/query?q=from+county+where+name+%3D%3D+%22Oslo%22&dataset=norwegian-geo"
curl "http://localhost:3000/entities?schema=municipality&dataset=norwegian-geo&limit=5"
curl "http://localhost:3000/stats?dataset=norwegian-geo"
```

### Studio

1. Open http://localhost:4321
2. On `/login`, set API URL to `http://localhost:3000` and dataset to `norwegian-geo`
3. Browse entities, run queries, and view import history on the dashboard

---

## Idempotent imports

All three import definitions set `deduplicateBy` on their natural key (`id` or `code`). Re-running an import updates existing records in place without creating duplicates.

```bash
bun run import:norwegian-geo   # first run: inserts
bun run import:norwegian-geo   # second run: updates in place
```

Entity counts remain stable across repeated imports.
