# Public Reference Datasets

Norwegian open data catalogue for the Aurii reference demo (`dataset: norwegian-geo`).

This document records the dataset survey, selection rationale, import strategy, and known limitations. All imports use the standard Aurii pipeline — schemas, import definitions, mapping, validation, and persistence — with no dataset-specific Core code.

---

## Selected canonical datasets

| Schema | Records | Source | data.norge.no |
|--------|---------|--------|---------------|
| `county` | 15 | Kartverket/GeoNorge | [Kommuneinfo API](https://ws.geonorge.no/kommuneinfo/v1/fylker) |
| `municipality` | 357 | Kartverket/GeoNorge | [Kommuneinfo API](https://ws.geonorge.no/kommuneinfo/v1/kommuner) |
| `postal-code` | 5,122 | Bring | [Postnummer](https://www.bring.no/tjenester/adressetjenester/postnummer) |
| `school` | ~5,683 | UDIR NSR | [Nasjonalt skoleregister](https://data.norge.no/en/datasets/d8431635-2ae6-40af-b0ec-8869a2fa3f89/national-school-register-nsr) |
| `kindergarten` | ~5,541 | UDIR NBR | [Nasjonalt barnehageregister](https://data.norge.no/en/datasets/af15237b-c5d7-421d-bb29-ca05f3c458ff/national-kindergarten-register-nbr) |
| `hospital` | ~115 | Brønnøysundregistrene | [Enhetsregisteret](https://data.norge.no/en/data-services/5e6f139b-8f4e-337f-a231-dec687791f5d/apne-data-fra-enhetsregisteret-api-dokumentasjon) |
| `public-holiday` | 84 | Nager.Date (derived) | [Helligdagskalender](https://data.norge.no/nb/datasets/161afe4e-7c18-4701-a353-c57fdc5ad830/helligdagskalender) (static, outdated) |

### Why these were chosen

1. **Geographic backbone** (counties, municipalities, postal codes) — already proven; every other dataset references administrative geography.
2. **Schools & kindergartens** — high reuse across education, planning, and civic apps; paginated REST APIs; `municipalityId` and `countyId` references; daily Brreg sync.
3. **Hospitals** — demonstrates Brreg industry-code filtering and a different API shape; links to municipalities; manageable size for verification.
4. **Public holidays** — demonstrates non-geographic reference data with date types and multi-year snapshots; useful for scheduling across domains.

Together they cover **JSON list APIs**, **paginated search APIs**, **TSV downloads**, and **derived calendar data** — without custom application logic.

---

## Dataset survey (evaluated sources)

### Included in reference demo

| Rank | Title | Owner | URL | Update | Format | Size | License | Use cases |
|------|-------|-------|-----|--------|--------|------|---------|-----------|
| 1 | Counties & municipalities | Kartverket | GeoNorge kommuneinfo | Continuous | JSON | 372 | NLOD | Geography, admin boundaries |
| 2 | Postal codes | Bring | bring.no/postnummer | Regular | TSV | 5,122 | NLOD | Address, logistics |
| 3 | National school register | UDIR | data-nsr.udir.no | Daily (Brreg sync) | JSON | ~18k raw / ~5.7k active | NLOD | Education, maps, planning |
| 4 | National kindergarten register | UDIR | data-nbr.udir.no | Daily | JSON | ~16k raw / ~5.5k active | NLOD | Childcare, demographics |
| 5 | Enhetsregisteret (hospitals) | Brønnøysundregistrene | data.brreg.no | Daily | JSON | ~115 (86.10) | NLOD | Health, procurement |
| 6 | Public holidays | Nager.Date* | date.nager.at | Annual rules | JSON | ~12/year | Open API terms | Scheduling, payroll |

\*No maintained machine-readable helligdags-API on data.norge.no; static Helligdagskalender covers 2019–2022 only.

### Shortlist (not yet imported — ranked by long-term usefulness)

| Rank | Title | Owner | URL | Update | Format | Est. size | License | Use cases | Notes |
|------|-------|-------|-----|--------|--------|-----------|---------|-----------|-------|
| 7 | Enhetsregisteret (full) | Brønnøysundregistrene | data.brreg.no | Daily | JSON/CSV | ~2M | NLOD | Business registers | Large; use `/oppdateringer/enheter` for incremental sync |
| 8 | Railway stations | Entur | api.entur.io | Continuous | JSON | ~500+ | NLOD | Transport, accessibility | API pagination limited; needs NSR StopPlace filter |
| 9 | Protected areas | Miljødirektoratet | Geonorge | Periodic | GeoJSON/GML | Large | NLOD | Environment, planning | Geometry-heavy; better as Phase 3+ plugin |
| 10 | Cultural heritage (Askeladden) | Riksantikvaren | api.ra.no / kart.ra.no | Continuous | OGC/WFS | 200k+ | NLOD | Tourism, planning | Large; spatial import patterns |
| 11 | Electoral districts | Valgdirektoratet | Geonorge | Per election | GeoJSON | 19 districts | NLOD | Elections, civic tech | Boundaries change with reform |
| 12 | Government agencies | DFO / Brreg | data.brreg.no | Daily | JSON | Thousands | NLOD | Public sector maps | Filter `institusjonellSektorkode` |
| 13 | RESH (hospitals clinical) | Norsk helsenett | register.nhn.no | Continuous | SOAP/WS | — | Restricted | Clinical systems | Requires Helsenett; not public API |
| 14 | Museums (Norvegiana) | KulturIT | norvegiana.no | Varies | JSON | 7M+ objects | Per-object | Culture, tourism | Aggregated metadata; mixed licenses |
| 15 | Weather stations | MET Norway | frost.met.no | Continuous | JSON | Thousands | NLOD | Climate, agriculture | API key for some endpoints |

### Rejected or deferred

| Dataset | Reason |
|---------|--------|
| Norsk pasientregister | Not public; no open API |
| Covid-19 hospital stats | Event-specific; superseded |
| Lovdata helligdager | No dedicated holiday endpoint |
| SEFRAK buildings | 200k+ records; spatial complexity |
| Company register (full download) | Too large for default demo snapshot |

---

## Import strategy

### Pipeline order

Imports run in dependency order (parents before children):

```
counties → municipalities → postal-codes → schools → kindergartens → hospitals → public-holidays
```

### Fetch layer (`bun run fetch:norwegian-geo`)

External APIs are normalized into committed JSON snapshots under `demo/norwegian-geo/core/data/` and `demo/norwegian-geo/modules/*/data/`:

| File | Normalization |
|------|---------------|
| `schools.json` | Paginate NSR `/v4/enheter`; filter test entities (`kommune 2599`, orgnr `U*`); map to schema fields |
| `kindergartens.json` | Paginate NBR `/v4/enheter`; same filters |
| `hospitals.json` | Paginate Brreg `naeringskode=86.10`; extract `kommunenummer` |
| `public-holidays.json` | Fetch years 2024–2030 from Nager.Date |

UDIR and Bring records outside the Kartverket municipality list (e.g. Svalbard `2100`) are excluded at fetch time.

### Import layer (`bun run import:norwegian-geo`)

Each entity type has a schema YAML and import YAML using `map → validate → persist`. Reference fields:

```
school.municipalityId        → municipality.id
school.countyId              → county.id
kindergarten.municipalityId  → municipality.id
kindergarten.countyId        → county.id
hospital.municipalityId      → municipality.id
postal-code.municipalityId   → municipality.id (warning mode for Bring mismatches)
```

### Reference validation

- **Strict** for schools, kindergartens, hospitals (fail on missing municipality/county).
- **Warning** for postal codes (Bring may reference retired municipality codes).

---

## Update strategy

| Dataset | Recommended refresh | Command |
|---------|---------------------|---------|
| All snapshots | Before releases or monthly | `bun run fetch:norwegian-geo` |
| Core storage | After fetch | `bun run import:norwegian-geo` |
| Geo demo site | After fetch | `cd apps/geo && bun run build` |

### Incremental sync (stretch goal — no architecture change)

| Source | Incremental mechanism | Aurii approach |
|--------|----------------------|----------------|
| Brreg Enhetsregisteret | `GET /api/oppdateringer/enheter?dato=...` | Scheduled fetch writes delta JSON; same import with `deduplicateBy: id` |
| UDIR NSR/NBR | `GET /v4/enheter/endretetter?dato=...` | Fetch changed orgs since last run; merge into snapshot or import directly |
| Kartverket | Stable codes; rare changes | Full refresh sufficient |
| Public holidays | Annual computation | Extend year range in fetch script |

A future **scheduled pipeline** (cron or Aurii event) would:

1. Call source update API with `lastSync` timestamp stored as a dataset entity or import metadata.
2. Write delta file or append to snapshot.
3. Run standard `import run` — idempotent upserts handle updates without new Core code.

---

## Known limitations

1. **Svalbard** — UDIR includes entities in municipality `2100`; Kartverket kommuneinfo does not. These are excluded to preserve strict reference validation.
2. **Postal codes** — ~8 Bring rows reference retired municipality codes (`2100`, `2211`); imported with warnings.
3. **Public holidays** — Derived via Nager.Date from Helligdagsloven rules; not an official government API. The data.norge.no Helligdagskalender dataset is static (2019–2022).
4. **Hospitals** — Brreg `86.10` captures hospital activity entities, not clinical RESH units (which require Helsenett).
5. **Schools/kindergartens** — List endpoints include owners and inactive units; fetch filters to active `ErSkole` / `ErBarnehage` only.
6. **Demo site** — Static build reads bundled JSON; production apps should use `@aurii/sdk` against Core.

---

## Commands

```bash
# Refresh all snapshots from live APIs
bun run fetch:norwegian-geo

# Import into Core (SQLite or Postgres)
bun run import:norwegian-geo

# Integration tests
cd packages/core && bun test public-reference-datasets vertical-slice geo-website-routes

# Public demo site
cd apps/geo && bun run dev
```

### Example queries

```
from school where municipalityId == "0301" and isPublic == true limit 10
from kindergarten where municipalityId == "0301" limit 10
from hospital where municipalityId == "0301"
from public-holiday where year == 2026 order by date asc
```

---

## Success criteria

- [x] Multiple independent public datasets through one import pipeline
- [x] No dataset-specific Core or application logic
- [x] Cross-dataset references validated at import time
- [x] Norwegian reference demo expanded into a reusable public data catalogue
- [x] Integration tests and documentation
