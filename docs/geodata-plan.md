# Geodata-plan for Norwegian Geo

> Konkret plan for geodata-modul som støtter kart over fylker, kommuner og postnummer i Aurii.
>
> Relatert: [geodata-sources.md](./geodata-sources.md), [NORWEGIAN_GEO.md](./NORWEGIAN_GEO.md)

---

## Mål

Norwegian Geo har i dag attributtdata (fylker, kommuner, postnummer) uten geometri. Denne planen legger grunnlaget for:

1. **Fylkeskart** — markere valgt fylke i Norge
2. **Kommunekart** — vise kommuner innenfor et fylke
3. **Postnummerkart** — punkter eller områder per kommune
4. **Historikk** — tidligere fylker/kommuner der praktisk mulig

Prinsipp: **Start smalt.** Første versjon = dagens fylker + kommuner + postnummerpunkter + offisielle grenser.

---

## Utgangspunkt i dagens kodebase

Norwegian Geo har allerede:

| Komponent | Status |
|-----------|--------|
| `county`, `municipality`, `postal-code` schemas | ✅ Importert |
| `fetch:norwegian-geo` (Kartverket API + Bring TSV) | ✅ |
| Historisk pipeline (Wikipedia + SSB Klass) | ✅ Build-time i `apps/geo` |
| Grensegeometri | ❌ Mangler |
| Postnummerkoordinater | ❌ Mangler |
| Kart i `apps/geo` | ❌ Ingen interaktive kart ennå |

Geometri hører **ikke** i Aurii Core. Den implementeres som produktlag under Norwegian Geo, med gjenbrukbare transformasjonsverktøy i `packages/geodata/`.

---

## Anbefalte primærkilder (beslutning)

| Behov | Primærkilde | Begrunnelse |
|-------|-------------|-------------|
| Kommunegrenser | **Kartverket / GeoNorge** (`041f1e6e-…`) | Offisiell, presis, GeoJSON, historiske versjoner |
| Fylkesgrenser | **Kartverket / GeoNorge** (`6093c8a8-…`) | Samme kilde, avledet fra kommunegrenser |
| Postnummerregister | **Bring** | Allerede integrert; autoritativ for gyldighet |
| Postnummerkoordinater | **Bring Mybring** (prod), **Erik Bolstad** (CI/dev) | Bring er offisiell; Bolstad er auth-fri bulk |
| Postnummerområder | **GeoNorge** (`462a5297-…`) | Fase 2; offisielle polygoner |
| Historiske koder | **SSB Klass** (131, 104) | Allerede delvis implementert |
| Historisk geometri | **Kartverket historiske versjoner** | Fase 2+ |

---

## Datamodell

Modellen utvider Norwegian Geo uten å duplisere administrativ informasjon. Attributter (navn, koder) forblir i eksisterende entiteter; geometri lagres separat.

### Eksisterende entiteter (utvides)

```yaml
# county — tilleggsfelt
centroid: { lat, lon }      # avledet fra geometri
bbox: [west, south, east, north]
geometryRef: reference → geo-boundary

# municipality — tilleggsfelt
centroid: { lat, lon }
bbox: [west, south, east, north]
geometryRef: reference → geo-boundary

# postal-code — tilleggsfelt
lat: number | null
lon: number | null
utm: { x, y, zone } | null
coordinateSource: reference → geo-source
coordinatePrecision: official | approximate | unknown
geometryRef: reference → geo-boundary   # fase 2
secondaryMunicipalityIds: reference[]   # fra Bring tilleggskommuner
```

### Nye entiteter

#### `geo-boundary`

```yaml
id: string                    # f.eks. "municipality-0301-2026"
entityType: county | municipality | postal-area | country
entityCode: string            # fylkes-/kommunenummer eller postnummer
validFrom: date | null
validTo: date | null
precision: official | simplified | approximate
format: geojson | topojson
geometry: object              # eller filreferanse i processed/
bbox: [west, south, east, north]
centroid: { lat, lon }
sourceRefs: reference[] → geo-source
```

#### `geo-source`

```yaml
id: string
name: string
url: string
publisher: string
license: string               # f.eks. "CC-BY-4.0", "NLOD-2.0", "CC-BY-3.0"
attribution: string
retrievedAt: datetime
validForYear: number | null
notes: string | null
```

### Relasjonsdiagram

```
geo-source
    ↓ sourceRefs
geo-boundary ←── geometryRef ── county
              ←── geometryRef ── municipality
              ←── geometryRef ── postal-code (fase 2)

postal-code ── municipalityId ──→ municipality ── countyId ──→ county
```

### Versjonering

Geometri versjoneres per **referanseår** (f.eks. `2026`), ikke per importkjøring:

- `municipality-0301-2026` — offisiell geometri med referansedato 1.1.2026
- `municipality-0301-2024` — historisk versjon ved behov

Attributtdata (navn, poststed) følger Bring/Kartverket sine oppdateringscykler uavhengig av geometriår.

---

## Mappestruktur

```
docs/
  geodata-sources.md          # denne katalogen
  geodata-plan.md             # denne planen

data/
  sources/
    geodata/
      kartverket/             # rå GeoJSON/GML fra GeoNorge
      geonorge/               # postnummerområder (fase 2)
      bring/                  # postnummer TSV + koordinat-CSV
      erik-bolstad/           # supplementær CSV
      ssb/                    # Klass JSON-snapshots
  processed/
    geodata/
      counties/
        official-2026.geojson
        simplified-2026.topojson
      municipalities/
        official-2026.geojson
        simplified-2026.topojson
      postal-codes/
        points-2026.json
      boundaries/
        manifest.json

demo/norwegian-geo/
  geodata/                    # produktspesifikk import
    schemas/
      geo-boundary.yaml
      geo-source.yaml
    imports/
    data/                     # publiserte snapshots for Aurii-import

packages/geodata/
  src/
    import/                   # fetch fra GeoNorge, Bring, Bolstad
    transform/                # GeoJSON → TopoJSON, forenkling, bbox/centroid
    validate/                 # topologi, kodekobling, koordinatsjekk
    export/                   # skriv processed/ og demo-snapshots
```

**Merk:** `data/` holdes utenfor git for store råfiler der det er hensiktsmessig. Publiserte, forenklede snapshots committes i `demo/norwegian-geo/geodata/data/` og `apps/geo/public/geodata/`.

---

## Importflyt

### Iterasjon 1 — MVP (anbefalt første implementasjon)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Hent offisiell geometri (GeoNorge Nedlastings-API)         │
│    → counties + municipalities, EPSG:4258, landsfil           │
├─────────────────────────────────────────────────────────────────┤
│ 2. Transformér til WGS84 GeoJSON + forenklet TopoJSON          │
│    → generer bbox og centroid per enhet                         │
├─────────────────────────────────────────────────────────────────┤
│ 3. Hent Bring postnummer (allerede i fetch.ts)                 │
├─────────────────────────────────────────────────────────────────┤
│ 4. Hent koordinater                                            │
│    a) Mybring CSV (prod) ELLER Erik Bolstad CSV (dev/CI)       │
│    b) Match på postnummer mot Bring                            │
│    c) Lagre coordinateSource + precision                        │
├─────────────────────────────────────────────────────────────────┤
│ 5. Valider koblinger                                           │
│    → kommunenummer, fylkesnummer, orphan coords                 │
├─────────────────────────────────────────────────────────────────┤
│ 6. Publiser snapshots + importer til Aurii                     │
├─────────────────────────────────────────────────────────────────┤
│ 7. Eksempel: Oslo fylke (03) + Oslo kommune (0301)             │
├─────────────────────────────────────────────────────────────────┤
│ 8. Dokumenter kilder, lisens, kommandoer                       │
└─────────────────────────────────────────────────────────────────┘
```

**Kommandoer (planlagt):**

```bash
bun run fetch:geodata              # last ned rå kilder
bun run build:geodata              # transform + validate + processed/
bun run import:geodata             # registrer schemas + importer
bun run fetch:norwegian-geo        # eksisterende attributtdata
bun run import:norwegian-geo       # full produktimport
```

### Iterasjon 2 — polygoner og historikk

1. Importer GeoNorge postnummerområder (GeoJSON)
2. Konverter til forenklet TopoJSON per fylke
3. Sammenlign punkt vs. polygon for utvalgte postnummer
4. Velg visningsstrategi: punkter (zoom lav), polygoner (zoom høy)
5. Koble SSB Klass endringer til historiske `geo-boundary`-versjoner
6. Vurder import av historiske kommuner til Core (ikke bare `apps/geo`)

---

## Formater og lag

| Lag | Format | Formål | Størrelse (ca.) |
|-----|--------|--------|-----------------|
| Rå | GeoJSON (EPSG:4258) | Kilde, debugging | ~50–100 MB kommuner |
| Frontend | TopoJSON (forenklet) | Webkart, liten payload | ~2–5 MB |
| Tabell | JSON | Kobling mot Aurii-entiteter | ~1 MB |
| Fremtidig | PMTiles | Store datasett, vektortiles | Varierer |

### Forenkling for web

| Nivå | Toleranse | Bruk |
|------|-----------|------|
| `official` | 0 m | Lagring, nøyaktige beregninger |
| `simplified` | ~50–100 m | Fylkes- og kommunekart nasjonalt |
| `low-zoom` | ~500 m | Oversiktskart hele Norge |

Første versjon: `simplified` med `topojson-simplify` eller `mapshaper` til ~2–5 MB total for alle kommuner. Dette er godt nok for fylkes- og kommunekart på web.

---

## Kartbruksmønstre

### Fylkeside

- Bakgrunn: forenklet landgrense + alle fylker (uten fyll)
- Highlight: valgt fylke (fargefyll)
- Data: `processed/geodata/counties/simplified-{year}.topojson`

### Kommuneside (innen fylke)

- Viewport: fylkets bbox
- Alle kommuner i fylket, valgt kommune highlightet
- Data: filter `municipalities` på `countyCode`

### Postnummerside / kommunekart

- Viewport: kommunens bbox
- Punkter for postnummer i kommunen (fra `lat`/`lon`)
- Tooltip: postnummer + poststed
- Fase 2: polygoner fra postnummerområder

### Frontend-stack (anbefaling)

- **Leaflet** eller **MapLibre GL** — enkel integrasjon i Astro (`apps/geo`)
- TopoJSON lastes statisk fra `public/geodata/`
- Ingen live WMS i første versjon (unødvendig kompleksitet)

---

## Svar på åpne spørsmål

### Finnes offisielle postnummerkoordinater?

**Ja.** Bring tilbyr «Postnummer med koordinater» via Mybring (ukentlig CSV, UTM33 + lat/lon). Det finnes **ikke** et separat offentlig REST-API uten autentisering. Erik Bolstad er den beste auth-frie supplementærkilden.

### Er GeoNorge-postsoner praktisk nedlastbare?

**Ja.** Nedlastings-API støtter GeoJSON. Konvertering til TopoJSON er standard. Utfordringen er datamengde og oppdateringsfrekvens, ikke tilgjengelighet.

### Kan Bring-data mappes til dagens kommune-/fylkesstruktur?

**Ja.** Kommunenummer (4 siffer) koder fylke i posisjon 1–2. Norwegian Geo bruker allerede denne koblingen. 8 rader med utdaterte kommunekoder håndteres med advarsel.

### Hvordan håndtere postnummer i flere kommuner?

1. Lagre `municipalityId` som primærkommune (Bring)
2. Valgfritt: `secondaryMunicipalityIds` fra Bring tilleggskommuner (Mybring)
3. Ved kartvisning: vis punktet i primærkommune; merk flerkommunal i UI

### Hvordan håndtere postnummer over tid?

1. Bring endringslogger for livssyklus (ny/endret/opphørt)
2. `validFrom`/`validTo` på `postal-code` ved behov
3. Koordinater kan mangle for postnummer under utfasing (Bring-dokumentert)

### Finnes historiske kommunegrenser i brukbart format?

**Ja.** Kartverket «Administrative enheter — historiske versjoner» og SSB 1986–2019. Anbefaling: start med **relasjoner** (SSB Klass + eksisterende Wikipedia-data), legg til geometri senere.

### Skal geodata versjoneres per år?

**Ja, per referanseår** (f.eks. 2024, 2025, 2026) — ikke per importtidspunkt. Kun ett «current»-sett er aktivt i frontend; historiske sett arkiveres for `/historikk/`.

### Hvor grov kan forenklet geometri være?

For nasjonalt kommunekart: **50–100 m toleranse** er akseptabelt. For postnummerpunkter: ingen forenkling (punktdata). Brukere som trenger matrikkelpresisjon bør lenke til norgeskart.no.

---

## Første tekniske implementasjon

### Scope (minimal viable geodata)

1. **Én fetch-skript** i `packages/geodata/src/import/fetch-boundaries.ts`
   - GeoNorge Nedlastings-API for landsfil kommuner + fylker
   - EPSG:4258 GeoJSON

2. **Én transform-skript** i `packages/geodata/src/transform/`
   - Beregn bbox + centroid per feature
   - Generer forenklet TopoJSON
   - Skriv `processed/geodata/`

3. **Utvid `fetch:norwegian-geo`** eller ny `fetch:geodata-postal-coords`
   - Erik Bolstad CSV for CI (ingen Mybring-auth)
   - Merge inn `lat`/`lon` på postal-code snapshots

4. **Nye schemas** `geo-boundary`, `geo-source` under `demo/norwegian-geo/geodata/`

5. **Kartkomponent** i `apps/geo`
   - Proof-of-concept: `/fylke/oslo/` med fylkeskart
   - `/fylke/oslo/kommune/oslo/` med kommunekart + postnummermarkører

6. **Tester**
   - Vertikal test: import geo-boundary → query municipality med geometryRef
   - Geo-website-routes: sider rendrer uten kartfeil
   - Validering: alle 357 kommuner har geometri og bbox

### Hva vi bevisst utelater i v1

- Postnummerområder (polygoner)
- Historisk geometri
- Mybring-autentisering (bruk Erik Bolstad i CI, dokumenter Bring for prod)
- PMTiles / MBTiles
- Live WMS/WFS

### Arkitekturregler (fra AGENTS.md)

| Spørsmål | Svar |
|----------|------|
| Hører dette i Core? | Nei — kun generiske typer (GeoJSON-felt) |
| Hører dette i Norwegian Geo? | Ja — produktspesifikk geodata |
| Kan det være plugin? | `packages/geodata` som bibliotek; import under demo |
| Er det en Capability? | Senere: `Map` capability på schema med `geometryRef` |

---

## Acceptance criteria — status

| Krav | Leveranse |
|------|-----------|
| `docs/geodata-sources.md` | ✅ |
| `docs/geodata-plan.md` | ✅ |
| Anbefalt primærkilde kommunegrenser | Kartverket / GeoNorge |
| Anbefalt primærkilde fylkesgrenser | Kartverket / GeoNorge |
| Anbefalt primærkilde postnummerregister | Bring |
| Anbefalt kilde postnummerkoordinater | Bring Mybring (primær), Erik Bolstad (supplement) |
| Vurdering GeoNorge-postsoner | Fase 2 — praktisk og anbefalt |
| Foreslått datamodell | `geo-boundary`, `geo-source` + utvidelser |
| Foreslått importflyt | Iterasjon 1 og 2 |
| Foreslått mappestruktur | Se over |
| Lisens og attribusjon | Se geodata-sources.md §7 |
| Første tekniske implementasjon | Se «Første tekniske implementasjon» |

---

## Neste steg

1. Godkjenn planen
2. Implementer `packages/geodata` med fetch + transform for Oslo (03) og Oslo kommune (0301) som vertikal slice
3. Legg til kartkomponent i `apps/geo`
4. Utvid til hele Norge
5. Start fase 2 (postnummerområder) når kartgrunnlaget er stabilt
