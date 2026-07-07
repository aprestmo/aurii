# Geodata-kilder for Norwegian Geo

> Katalog over primær- og sekundærkilder for fylker, kommuner, postnummer og kartgeometri.
>
> Relatert: [geodata-plan.md](./geodata-plan.md), [NORWEGIAN_GEO.md](./NORWEGIAN_GEO.md), [Public Reference Datasets.md](./Public%20Reference%20Datasets.md)

---

## Oppsummering — anbefalte kilder

| Domene | Primærkilde | Sekundærkilde | Merknad |
|--------|-------------|---------------|---------|
| Fylkesgrenser | Kartverket / GeoNorge | — | Offisiell geometri, CC BY 4.0 |
| Kommunegrenser | Kartverket / GeoNorge | Erik Bolstad (kun sammenligning) | Bolstad er eksplisitt grov/upresis |
| Postnummerregister | Bring / Posten | — | Allerede i bruk i `fetch:norwegian-geo` |
| Postnummerkoordinater | Bring (Mybring) | Erik Bolstad | Bring er offisiell; Bolstad er praktisk bulk-nedlasting |
| Postnummerområder | GeoNorge / Posten | — | Fase 2; offisielle polygoner |
| Kommune-/fylkeskoder og historikk | SSB Klass | Wikipedia (allerede i bruk) | Klass for koder og gyldighetsperioder |
| Historisk geometri | Kartverket historiske versjoner | SSB kart.ssb.no (1986–2019) | Fase 2+; relasjoner kan komme først |

---

## 1. Fylkes- og kommunegrenser

### Primærkilde: Kartverket via GeoNorge

Kartverket leverer offisielle administrative grenser basert på matrikkelen, riksgrense, territorialgrense og avtalte sjøgrenser. Kommunefilene inkluderer grunnlinje og 1 nautisk mil langs kysten.

| Datasett | Metadata-UUID | data.norge.no |
|----------|---------------|---------------|
| Administrative enheter kommuner | `041f1e6e-bdbc-4091-b48f-8a5990f3cc5b` | [Lenke](https://data.norge.no/en/datasets/3557d23d-8188-4136-b227-c854f89a6e8e/administrative-enheter-kommuner) |
| Administrative enheter fylker | `6093c8a8-fa80-11e6-bc64-92361f002671` | [Lenke](https://data.norge.no/en/datasets/cffde12f-3530-4406-9aa0-d6d4519ef077/administrative-enheter-fylker) |
| Administrative enheter Norge (samlet) | `041f1e6e-bdbc-4091-b48f-8a5990f3cc5b` | Kommune-datasettet dekker også fylkesinndeling |
| Historiske versjoner | `13ea4d17-4d51-33e3-a950-200dacbdc647` | [Lenke](https://data.norge.no/en/datasets/13ea4d17-4d51-33e3-a950-200dacbdc647/administrative-enheter-historiske-versjoner) |

**Landingssider:**

- Grensedata: https://kartverket.no/api-og-data/grensedata
- Kartkatalog: https://kartkatalog.geonorge.no/metadata/uuid/041f1e6e-bdbc-4091-b48f-8a5990f3cc5b

### Nedlastingsformater (verifisert via Nedlastings-API)

`GET https://nedlasting.geonorge.no/api/capabilities/{metadataUuid}`

| Format | Tilgjengelig | Anbefalt bruk i Aurii |
|--------|--------------|----------------------|
| GeoJSON | Ja (EPSG:4258, 25832/33/35, 3035) | **Primær** for web og import (bruk EPSG:4258 / WGS84) |
| GML | Ja | Interoperabilitet, INSPIRE |
| FGDB | Ja | GIS-arbeidsflyt |
| PostGIS | Ja | Database-import |
| SOSI | Ja | Norsk standardformat; krever konvertering |

**WFS/WMS:**

- WMS og WFS er tilgjengelige for kommune- og fylkesgrenser
- WFS leverer GML-binding
- Egnet for kartbakgrunn og validering, ikke som primær importkilde for statiske snapshots

**REST-API (attributter uten geometri):**

- `https://ws.geonorge.no/kommuneinfo/v1/fylker`
- `https://ws.geonorge.no/kommuneinfo/v1/kommuner`

Dette API-et brukes allerede i `demo/norwegian-geo/scripts/fetch.ts` for fylkes- og kommunenavn. Det leverer **ikke** grensegeometri — kun metadata.

### Oppdateringsfrekvens

- Kontinuerlig ajourføring via matrikkelen
- Referansedato oppgis i metadata (f.eks. 1.1.2026 for gjeldende versjon)
- Historiske versjoner publiseres som egne datasett/år

### Lisens og attribusjon

| Kilde | Lisens | Attribusjon |
|-------|--------|-------------|
| Kartverket grensedata | CC BY 4.0 (Kartverket gratisprodukter) | `© Kartverket` + lenke til https://kartverket.no der mulig |
| data.norge.no-registrering | NLOD 2.0 | Navngi lisensgiver som angitt i metadata |

Kartverkets vilkår: https://kartverket.no/api-og-data/vilkar-for-bruk

Ved systematisk uttrekk fra Sentralt stedsnavnregister (SSR) må kilden spesifiseres separat.

### Forenklet geometri

Kartverket tilbyr også **illustrasjonskart** (JPEG, EMF, PPT) — ikke egnet som maskinlesbar geometri.

For web bør vi generere egen forenklet TopoJSON fra offisiell GeoJSON (se [geodata-plan.md](./geodata-plan.md)).

---

## 2. Erik Bolstad — kommunegrenser og postnummerkoordinater

### Kommunegrenser (sekundærkilde — ikke primær)

- Side: https://www.erikbolstad.no/geo/noreg/norske-kommunegrenser/
- **Eksplisitt merket som grove og ikke nøyaktige**
- Kilder: Statens kartverk (gratiskart), OpenStreetMap, Erik Bolstad
- Formater: HTML-tabell, KML via postnummersider

**Anbefaling:** Bruk kun til visuell sammenligning eller prototyping. **Ikke** som erstatning for Kartverket.

### Postnummerkoordinater (sekundærkilde)

- Side: https://www.erikbolstad.no/postnummer-koordinatar/
- Bulk-nedlasting: https://www.erikbolstad.no/postnummer-koordinatar/txt/

| Fil | Format | Størrelse (ca.) | Sist oppdatert |
|-----|--------|-----------------|----------------|
| `postnummer.csv` | Tab-separert UTF-8 | ~829 KB | 2024-08-02 |
| `postnummer.txt` | Tab-separert UTF-8 | ~829 KB | 2024-08-02 |
| `postnummer-utm.txt` | Tab-separert UTF-8, UTM | ~846 KB | 2024-08-02 |
| `gater.txt` | Gateadresser | ~2.5 MB | 2012-10-19 |
| KML/XML | Per fylke / samlet | Varierer | Se indekssider |

**Felter i `postnummer.csv`:**

```
POSTNR, POSTSTAD, POSTNR- OG STAD, BRUKSOMRÅDE, FOLKETAL, BYDEL,
KOMMNR, KOMMUNE, FYLKE, LAT, LON, DATAKVALITET, DATAKVALITETSFORKLARING, SIST OPPDATERT
```

**Datakvalitetskoder (1–6):**

| Kode | Betydning (typisk) |
|------|-------------------|
| 1 | Postkontor / høy presisjon |
| 2 | Rettet av Erik Bolstad |
| 6 | Usikker plassering |

Koordinatgrunnlag for postsoner er hentet fra Kartverket (oppgitt per postnummer på enkeltsider).

### Lisens

- Creative Commons Attribution 3.0 (CC BY 3.0)
- **Krav:** Lenke til https://www.erikbolstad.no/postnummer/ ved attribusjon

### Kobling mot Bring

Match på `POSTNR` ↔ Bring `Postnummer`. Valider at `KOMMNR` stemmer med Bring primærkommune. Avvik skal logges — Erik Bolstad bruker historiske fylkesnavn i enkelte lister (f.eks. «Akershus» i CSV selv etter fylkesreformen).

---

## 3. Postnummerregister — Bring / Posten

### Primærkilde

| Ressurs | URL | Format |
|---------|-----|--------|
| Postnummertabell (offentlig) | https://www.bring.no/tjenester/adressetjenester/postnummer | TAB-separert ANSI |
| Veiledning | https://www.bring.no/tjenester/adressetjenester/postnummer/postnummertabeller-veiledning | — |
| data.norge.no | https://data.norge.no/nb/datasets/5e6847ba-156d-4e14-85d3-8d7f8b727523/postnummer-i-norge | NLOD |

**Eksisterende integrasjon:** `demo/norwegian-geo/scripts/fetch.ts` henter `Postnummerregister-ansi.txt` direkte.

### Felter (hovedtabell)

| Felt | Bredde | Innhold |
|------|--------|---------|
| Postnummer | 4 | Fire sifre |
| Poststed | 32 | Stedsnavn |
| Kommunekode | 4 | Fylke (2) + kommune (2) |
| Kommunenavn | 30 | Offisielt navn |
| Kategori | 1 | G/P/B/S |

**Kategorier:** G = gateadresser, P = postbokser, B = begge, S = servicepostnummer (ikke i bruk til postadresser).

### Oppdateringsfrekvens

- Fast: 15. september og 1. oktober hvert år
- Kan oppdateres oftere ved behov
- Varsling: adressekvalitet@posten.no
- Endringslogger tilgjengelig (nye, endrede, opphørte postnummer fra 1999)

### Flerkommunale postnummer

Ca. 10 % av postnummer finnes i mer enn én kommune. Hovedtabellen inneholder **primærkommune**. Sekundærkommuner finnes i egen fil via Mybring.

### Bring → dagens fylkesstruktur

Bring bruker kommunenummer der de to første sifrene er fylkesnummer. Fylkesreformen 1.1.2024 er dokumentert i veiledningen (Viken → Østfold/Akershus/Buskerud, osv.). Mapping til dagens 15 fylker skjer via kommunenummer — allerede implementert i Norwegian Geo.

### Lisens

- NLOD / åpen lisens på data.norge.no
- Navngi Posten Bring AS som kilde

---

## 4. Postnummerkoordinater — Bring (offisiell)

Bring tilbyr **offisielle postnummerkoordinater** via Mybring — dette er viktig: det finnes en offisiell punktkilde utenom Erik Bolstad.

| Ressurs | Tilgang | Format |
|---------|---------|--------|
| Postnummer med koordinater | https://www.mybring.com/address-files/ (krever konto) | CSV, UTF-8 eller ANSI |
| Dokumentasjon | Bring veiledning §8 | — |

**Felter:**

- Postnummer, Poststedsnavn, Kategori
- Primærkommunenummer, Primærkommunenavn, Primærfylkenummer, Primærfylkesnavn
- X_gateadresser, Y_gateadresser (UTM33)
- X_postbokser, Y_postbokser (UTM33)
- Latitude_gateadresser, Longitude_gateadresser
- Latitude_postbokser, Longitude_postbokser

Koordinater settes i sentralt punkt i veinettet. Servicepostnummer (S) har ingen koordinater.

**Oppdatering:** Ukentlig generering.

**Anbefaling:**

| Scenario | Kilde |
|----------|-------|
| Produksjon / offisiell attribusjon | Bring Mybring |
| Automatisert CI uten konto | Erik Bolstad (sekundær) + tydelig kildemerking |
| Fase 2 polygoner | GeoNorge postnummerområder |

---

## 5. Postnummerområder / postsoner — GeoNorge

### Datasett

| Felt | Verdi |
|------|-------|
| Navn | Postnummerområder |
| UUID | `462a5297-33ef-438a-82a5-07fff5799be3` |
| Eier | Posten / Kartverket (matrikkelbasert) |
| Landingsside | https://kartkatalog.geonorge.no/metadata/uuid/462a5297-33ef-438a-82a5-07fff5799be3 |

### Nedlastingsformater (verifisert)

FGDB, GeoJSON, GML, SOSI — via GeoNorge Nedlastings-API.

**WMS:** `https://wms.geonorge.no/skwms1/wms.postnummeromrader`

**WFS:** `https://wfs.geonorge.no/skwms1/wfs.postnummeromrader`

### Egenskaper

- Offisielle postnummergrenser fra matrikkelen
- Dekker gateadresser; postboksanlegg inkludert
- Årlige endringer samles til 1. oktober; månedlig vedlikehold ellers (unntatt juli og desember)
- Feil kan meldes til postnummer@posten.no

### Vurdering for Aurii (fase 2)

| Kriterium | Vurdering |
|-----------|-----------|
| Nedlastbar uten kartprogram | Ja (GeoNorge web + API) |
| Konverterbar til GeoJSON/TopoJSON | Ja |
| Praktisk for webkart | Ja, men ~5000+ polygoner — krever forenkling og lazy loading |
| Dekker alle gyldige postnummer | Ja (inkl. postboksanlegg) |
| Mer presis enn punkter | Ja for arealvisning |
| Lisens kompatibel | Ja (NLOD / offentlige data) |

**Konklusjon:** Egnet som fase 2. Første versjon bruker punkter; polygoner legges til når kartstacken tåler datamengden.

---

## 6. Historiske kommuner og fylker

### SSB Klass (primær for koder og relasjoner)

Allerede delvis integrert i `demo/norwegian-geo/core/historical/ssb-klass.ts`.

| Klassifikasjon | ID | API |
|----------------|-----|-----|
| Kommuneinndeling | 131 | `https://data.ssb.no/api/klass/v1/classifications/131` |
| Fylkesinndeling | 104 | `https://data.ssb.no/api/klass/v1/classifications/104` |

**Nyttige endepunkter:**

```
GET /classifications/131/codesAt.json?date=YYYY-MM-DD
GET /classifications/131/codes.json?from=YYYY-MM-DD&includeFuture=True
GET /classifications/131/changes.json?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Returnerer `validFrom`, `validTo`, endringshistorikk, sammenslåinger og delinger.

### Historisk geometri

| Kilde | UUID / URL | Dekning |
|-------|-----------|---------|
| Administrative enheter — historiske versjoner | `13ea4d17-4d51-33e3-a950-200dacbdc647` | Årlige offisielle versjoner |
| Historiske kommunegrenser 1986–2019 (SSB) | `268bc92d-53a5-3372-99e6-3d3db4b91298` | Parquet, egen nedlasting https://kart.ssb.no/ |
| Wikipedia-pipeline (eksisterende) | `demo/norwegian-geo/core/historical/` | Relasjoner og narrativ |

**Anbefaling:** Start med **historiske relasjoner** (SSB Klass + eksisterende Wikipedia-data). Legg til historisk geometri når kartbehovet krever det.

---

## 7. Lisens- og attribusjonsmatrise

| Kilde | Lisens | Attribusjon i Aurii |
|-------|--------|---------------------|
| Kartverket grenser | CC BY 4.0 | `© Kartverket` |
| GeoNorge postnummerområder | NLOD | `© Kartverket / Posten` |
| Bring postnummerregister | NLOD | `Posten Bring AS` |
| Bring koordinater (Mybring) | Bring vilkår | `Posten Bring AS` |
| Erik Bolstad koordinater | CC BY 3.0 | Lenke til erikbolstad.no/postnummer |
| SSB Klass | NLOD | `© Statistisk sentralbyrå` |

Attribusjon bør lagres i `GeoSource`-entiteten og eksponeres på kart i `apps/geo`.

---

## 8. Automatisering av nedlasting

| Kilde | Automatiserbar | Metode |
|-------|----------------|--------|
| Kartverket kommuneinfo API | Ja (allerede) | `fetch()` JSON |
| Kartverket grenser GeoJSON | Ja | GeoNorge Nedlastings-API `POST /api/order` |
| Bring postnummer TSV | Ja (allerede) | Direkte URL |
| Bring koordinater | Delvis | Mybring krever autentisering |
| Erik Bolstad CSV | Ja | Direkte URL, ingen auth |
| GeoNorge postnummerområder | Ja | Nedlastings-API |
| SSB Klass | Ja (allerede) | REST JSON |

GeoNorge Nedlastings-API dokumentasjon: https://www.geonorge.no/verktoy/APIer-og-grensesnitt/nedlastingsapiet/
