# Architecture fitness tests

> Four representative products used to stress Aurii’s architecture.
>
> They are **design tests**, not a requirement to implement those products in this phase.
>
> If any case needs special-case logic inside Core, the architecture should be reconsidered.
>
> Product vocabulary: [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md).  
> Product strategy: [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).  
> Platform validation (portfolio, success/failure): [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md).  
> Studio extension: [ADR-0017](../adr/ADR-0017%20—%20Studio%20Extension%20Model.md), [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md).  
> Provenance: [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md).

---

## Why these cases exist

Aurii is a platform for **modeling, ingesting, editing, enriching, relating, and publishing structured data and editorial content**. It is not only a headless CMS alternative.

The same Core must eventually support, among others:

- publication CMS
- Kampbart
- playground directories
- DN Gaselle
- Geo datasets
- LiveCenter
- documentation
- other structured-data applications — including products not listed here

without each project inventing its own backend architecture.

These cases are **architecture tests and possible products**, not a closed catalog of what Aurii is allowed to become. Customer needs may evolve the platform beyond them. **Products discover requirements. Core absorbs durable generalizations.** See [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md).

They are design pressure, not automatic validation proof. Whether Aurii should remain a platform is judged by real products, convergence evidence, and decision gates in [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md).

Norwegian Geo remains the **implemented** canonical vertical for import, schema, query, storage, SDK, and delivery. Editorial + Context remains the **planned** vertical for authoring, revision, publishing, preview, workflow, and media ([`Phase5.md`](../Phase5.md)).

These four cases sit **across** that split. They test whether the unified record model, relations, sources, provenance, and Studio extensibility are strong enough that domain products stay outside Core.

---

## Capability matrix

| Capability | Kampbart | Playgrounds | Gaselle | Geo |
|------------|----------|-------------|---------|-----|
| Structured records | High | High | High | High |
| Rich / free-form content | High | High | High | Low / moderate |
| Relations | High | Moderate | High | Moderate |
| Custom Studio / editor | Very high | Moderate | Moderate | Low / moderate |
| Geodata / map | Low | High | Moderate | High |
| External ingestion | Possible | Possible | High | Very high |
| Provenance | Low | Low / moderate | High | Very high |
| Editorial overrides | Moderate | Moderate | High | Very high |

Map views, match timelines, and company rankings are **product UX**. Core/Studio provide the extension mechanism; they must not grow football, playground, or newspaper builtins.

---

## 1. Kampbart

Kampbart.com is today WordPress plus extensive ACF. The domain is structured sports data with operational reporting:

- sports
- teams
- players
- matches
- lineups
- results
- match events
- goals
- cards
- match reports

Example:

```text
Match
├── sport
├── tournament
├── homeTeam
├── awayTeam
├── lineup
├── events[]
├── score
└── matchReport
```

Studio for this product should be able to feel like a **match reporting tool**, not a generic database admin: score, lineup, timeline, events, report.

That UX is a **Studio extension** (custom record editor, maybe custom tools). Core must not know football.

### Architecture question

> Can Studio feel like a specialized match-reporting tool instead of a database admin?

### What must remain generic

- `Match`, `Player`, `Event` are schemas, not Core types.
- Typed references connect match → teams → players → events.
- Rich match-report content lives on the same Match record (or a related record) as structured score/lineup fields.
- Generated forms are the fallback; Kampbart replaces the Match editor via the Studio extension API.

---

## 2. Playground directory (Lekeplassoversikt)

A playground is primarily structured data:

- name
- coordinates
- municipality
- facilities
- age
- accessibility
- equipment
- parking
- toilets
- images

It also needs editorial / free-form content on the **same** record:

- description
- tips
- reviews
- text blocks

The collection should be viewable as **List | Table | Map** without Map becoming a Core concept.

### Architecture question

> Can structured facts and flexible editorial content exist naturally on the same record?

### What must remain generic

- One Entity / one Schema. Not a “content row” plus a “data row.”
- Coordinates are fields (or a reusable geo field type/plugin), not a Playground engine.
- Map is a **collection view** registered by the project (or a reusable Studio view module).
- Municipality is a typed reference to existing geo data—not copied into the playground as article body.

---

## 3. DN Gaselle

Gaselle combines classic editorial content with structured company and financial data.

```text
Company
├── AnnualFinancials
├── GaselleQualification
├── GaselleRanking
├── Region
└── related Articles
```

Articles may **reference** companies. Company data must not have to exist as “content,” and must not be owned by articles.

The same Company record should feed:

- rankings
- company profiles
- search
- maps
- graphics
- articles
- APIs

### Architecture question

> Can large structured datasets and editorial content be linked without modeling the data as articles?

### What must remain generic

- Company, financials, rankings, and articles are all schema-typed entities.
- Content may reference data without owning it ([ADR-0006](../adr/ADR-0006%20—%20Unified%20Data%20Model.md)).
- Ingestion from Brønnøysund / accounting sources is a Source, not an article import.
- Editorial commentary and overrides must not destroy source-owned figures ([ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)).

---

## 4. Geo

Geo combines hard facts from several open APIs and datasets.

Not only:

```text
External APIs → Frontend
```

The intended path:

```text
External APIs
    ↓
Aurii ingestion
    ↓
Normalized Aurii data
    ↓
Editorial enrichment / overrides
    ↓
Aurii API
    ↓
Frontends
```

That makes the following first-class: import/sync, normalization, caching/snapshots, provenance, data source, last updated, error status, editorial enrichment, editorial overrides.

Norwegian Geo is the **implemented** instance of this case.

### Architecture question

> Can Aurii own and expose a normalized model even when the authoritative information comes from external sources?

### What must remain generic

- Kartverket, Bring, SSB, and similar providers are Sources—not Core connectors named after those agencies.
- Normalized `county` / `municipality` / `postal-code` entities are the product schema, not a geo engine inside Core.
- Provenance and sync status are Core metadata concerns; municipality names are not.
- Overrides (for example a locally corrected name) must not erase the last source value.

---

## Guardrail

If a design requires Core to know about matches, playgrounds, Gaselle rankings, or Norwegian administrative geography, stop.

Express the domain in:

- schemas
- relations
- sources / pipelines
- Studio config and extensions
- product modules

Keep Core generic.

---

## How to use this document

When changing Core, Schema Language, Query Language, Studio, or the roadmap:

1. Ask whether the change still answers the four architecture questions above.
2. Prefer Norwegian Geo for **implementation** proof of import, query, delivery, and sources.
3. Use Kampbart, playgrounds, and Gaselle as **design** tests even before those products exist in-repo.
4. Do not add demo datasets for Kampbart/Gaselle/playgrounds unless that is the assigned task.

---

## Related documents

- [`PRODUCT_MODEL.md`](PRODUCT_MODEL.md) — product composition and modes
- [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) — open Core, product boundaries, Studio audience
- [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md) — real-product portfolio, maturity model, and decision gates
- [`Architecture.md`](Architecture.md) — engines, sources, provenance
- [`Studio.md`](Studio.md) — generated UI and extension surface
- [`Phase4.md`](../Phase4.md) — data products and delivery
- [`Phase5.md`](../Phase5.md) — Editorial & Context (planned)
- [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)
- [ADR-0020](../adr/ADR-0020%20—%20Extensible%20Studio.md)
