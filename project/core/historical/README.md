# Historisk norsk administrasjon

Datasett med tidligere norske kommuner og fylker, importert fra Wikipedia og koblet mot dagens referansedata i `demo/norwegian-geo/`.

## Kilder

| Datasett | Kilde | URL |
|----------|-------|-----|
| Tidligere kommuner | Wikipedia | [Liste over tidligere norske kommuner](https://no.wikipedia.org/wiki/Liste_over_tidligere_norske_kommuner) |
| Dagens kommuner | Wikipedia | [Norges kommuner](https://no.wikipedia.org/wiki/Norges_kommuner) |
| Kommunenummer | Wikipedia | [Norske kommunenummer — 1946-nummerserien](https://no.wikipedia.org/wiki/Norske_kommunenummer#1946-nummerserien) |
| Tidligere fylker | Wikipedia | [Norges fylker — «Tidligere fylker»](https://no.wikipedia.org/wiki/Norges_fylker#Tidligere_fylker) |
| Dagens fylker (2024–) | Wikipedia | [Norges fylker — «Norges fylker 2024–»](https://no.wikipedia.org/wiki/Norges_fylker#Norges_fylker_2024–) |
| Våpenskjold | Wikimedia Commons | Hentes via Commons API fra lenker i Wikipedia-tabellene |
| Dagens sannhet | Kartverket (eksisterende) | `demo/norwegian-geo/core/data/` |

**Viktig:** Historiske data utvider — overskriver ikke — dagens kommuner og fylker.

## Output

```
demo/norwegian-geo/core/historical/data/
  municipalities.json
  counties.json              # tidligere + mellomliggende (Viken, V-T, T-F)
  current-counties.json      # dagens 15 fylker fra Wikipedia 2024–
  administrative-changes.json
  municipality-enrichment.json  # berikelse for dagens 357 kommuner
  unresolved-matches.json
  heraldry-manifest.json

apps/geo/public/assets/heraldry/
  municipalities/
  counties/
```

## Importer på nytt

```bash
bun run fetch:historical-norwegian-geo
bun run build:municipality-enrichment
```

`fetch:historical-norwegian-geo` henter tidligere kommuner og fylker.
`build:municipality-enrichment` kombinerer alle tre kommunekildene til `municipality-enrichment.json` for dagens 357 kommuner.

Skriptet for historiske enheter:

1. Henter Wikipedia-tabellene via MediaWiki API
2. Parser kommuner per fylkesseksjon (`countyNameAtSource`)
3. Normaliserer endringstyper fra merknadsfeltet
4. Kobler resultatnavn mot dagens kommuner/fylker (navn + nummer)
5. Lagrer usikre koblinger i `unresolved-matches.json`
6. Laster ned fylkesvåpen og kommunevåpen fra Wikimedia Commons (SVG der tilgjengelig)

Fylkesvåpen hentes fra miniatyrbildene i begge Wikipedia-tabellene på [Norges fylker](https://no.wikipedia.org/wiki/Norges_fylker).

## Datamodell

### `historical_municipality`

Tidligere kommune med `validFrom`/`validTo`, `changeType`, `resultNames` og valgfritt `coatOfArms`.

### `historical_county`

Tidligere fylke med `validTo`, `todayPartOfNames`, `newCountyNumber` og valgfritt `coatOfArms`.

### `administrative_change`

Relasjon med `from`/`to`-entiteter og `changeType` — ikke bare fritekst.

### `municipality_enrichment`

Berikelsesdata for dagens kommuner (`municipality-enrichment.json`), kombinert fra:

- **Norges kommuner** — administrasjonssenter, areal, målform
- **Norske kommunenummer** — opprettelsesår, forhistorie, historiske navn, dannelseskjede
- **Tidligere kommuner** — utgåtte forgjengere og sammenslåingshendelser

Felter: `administrativeCenter`, `areaKm2`, `languageForm`, `established`, `prehistory`, `historicalNames`, `directPredecessors`, `formedFrom`, `predecessors`, `timeline`.

Endringstyper:

| Type | Norsk label | Kilde i Wikipedia |
|------|-------------|-------------------|
| `merged` | Slått sammen med | «Slått sammen med …» |
| `incorporated` | Innlemmet i | «Innlemmet i …» |
| `split` | Delt i | «Delt i …» |
| `split_between` | Delt mellom | «Delt mellom …» |
| `reestablished` | Gjenopprettet | «Gjenopprettet 2024» (fylker) |
| `renamed` | Navneendring | Navneendring i merknad |
| `unknown` | Ukjent | Alt annet |

## Visning

Geo-demoen har en historikkseksjon:

- `/historikk` — faner for kommuner og fylker med søk og filtre
- `/historikk/kommuner/:id` — historielinje (f.eks. Austre Moland → Moland → Arendal)
- `/historikk/fylker/:id` — fylkesutvikling (f.eks. Hedmark → Innlandet)

## Validering

```bash
bun run --filter='@aurii/geo' test
```

Testene sjekker at:

- Alle poster har navn
- Årstall er gyldige der de finnes
- `validFrom <= validTo`
- Relasjoner har minst én `from` og én `to`
- Lokale bildefiler finnes for poster med `coatOfArms.localPath`

## Usikre koblinger

Navn som finnes flere steder (f.eks. «Nes», «Våler», «Hof») eller historiske navn som ikke finnes i dagens datasett havner i `unresolved-matches.json`. Dette er forventet i første versjon.

## Fremtidig utvidelse

Modellen er laget for å kunne suppleres med offisielle kilder (SSB, Kartverket historiske versjoner, Lovdata) uten å endre grunnstrukturen.
