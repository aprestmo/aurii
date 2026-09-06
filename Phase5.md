# Phase 5 — Editorial & Context

> **Status: planned / post–Phase 4.** This is a roadmap only.
>
> Phase 4 exit criteria are **met** ([`Phase4.md`](Phase4.md)). Do **not** implement Phase 5 capabilities unless that is the assigned task.
>
> Parent: [`Phase4.md`](Phase4.md). Product vocabulary: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md). Strategy: [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md). Platform validation: [`docs/PLATFORM_VALIDATION.md`](docs/PLATFORM_VALIDATION.md). Competitive guardrails: [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md). Authoring boundary: [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md). Delivery contract: [`docs/DELIVERY.md`](docs/DELIVERY.md).

---

## Objective

Phase 5 should validate Aurii on two dimensions.

### Platform validation

Prove that a sophisticated authored/hybrid product can be built entirely on the generic Aurii Runtime **without turning Core into a newsroom CMS** and **without making Aurii Core a CMS backend**.

Editorial is a **validation client**. It must not redefine Aurii.

This is one entry in the broader real-product validation portfolio — [`docs/PLATFORM_VALIDATION.md`](docs/PLATFORM_VALIDATION.md). It does not replace the need for other diverse projects, and editorial capabilities introduced for it should start as Experimental / product-local until reuse is proven.

Apply the Kyro test and promotion ladder in [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md) before promoting Editorial needs into Core. Aurii must not become “a better headless CMS”.

### Market validation

Prove that contextual access to an organisation’s own structured data creates enough value inside the writing/research workflow to support a standalone product/service.

---

## Architectural boundary

Preserve this separation:

```text
Aurii Core
  │
  ├─ schemas
  ├─ entities
  ├─ relations
  ├─ query
  ├─ generic revisions/capabilities
  └─ APIs
        │
        ▼
Aurii Editorial
  │
  ├─ authoring/editor UX
  ├─ Context
  ├─ collaboration
  └─ production/workflow UX
        │
        ▼
Consumers
  ├─ web
  ├─ print/export
  └─ other clients
```

- **Core** remains the system of record. It is not a media backend. Publishing/news/magazine is an important validation domain, not a limit on what Core can support.
- **Editorial** is a **client** / separate product — not Studio renamed, and not a required layer between Core and frontends. Other publishing cases (magazine, newsroom, small publisher) may justify separate products that share capabilities rather than one universal CMS.
- **Aurii Research** is a separate planned sibling product hypothesis ([`docs/RESEARCH.md`](docs/RESEARCH.md)). It is not part of Phase 5 implementation scope, but it may later consume Context/Core capabilities independently of Editorial.
- **Frontends consume Core/delivery APIs directly** and must never depend on Editorial as a read proxy.
- **Studio** remains the **extensible developer/operator project workspace** (sources, imports, schedules, entities, query, published routes, generated default UI, custom editors/views via extensions). It must not evolve into the publication CMS or the journalist’s default tool. Domain-specific Studio experiences (match desk, map) are operator-facing extensions and may be designed before Phase 5; they are not Editorial.
- **Context** may appear under Editorial in the Phase 5 composition above while it is experimentally validated. That does not make Editorial its permanent host — see [Reusable Context boundary](#reusable-context-boundary).

This is [ADR-0010](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md) applied to a concrete product hypothesis: **Editorial + Context**. Direction: [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md). Fitness tests: [`docs/ARCHITECTURE_FITNESS.md`](docs/ARCHITECTURE_FITNESS.md). Guardrails: [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md).

Editorial concepts should begin **product-local**. Examples that must **not** become Core concepts merely because Editorial needs them:

`Article` · `Story` · `Headline` · `Byline` · `Desk` · `Publication` · `PrintReady` · `Breaking` · `Embargo`

---

## Prioritization: Context before CMS completeness

Aurii Editorial must demonstrate **Context** before attempting to become a feature-complete CMS.

The first Editorial milestone should **not** be judged primarily on:

- number of field types
- media features
- editor toolbar completeness
- admin customization
- dashboard polish
- GraphQL support
- plugin count

Those are commodity CMS capabilities. After **minimal authoring** works, Phase 5 should prioritize proving:

```text
authored content
      ↓
explicit entity references
      ↓
Aurii entities
      ↓
relations
      ↓
datasets
      ↓
provenance-aware contextual information
```

Example (project data, not Core builtins):

```text
An Editorial document references Trondheim.

Aurii should be able to expose available relevant information such as:

Trondheim
├─ municipality
├─ county
├─ population
├─ elections
├─ companies
├─ geography
├─ statistics
└─ other connected datasets
```

without requiring the Editorial application to own or duplicate those facts.

This is more important strategically than matching conventional CMS feature matrices.

---

## Proposed workstreams

### A. Authored-content foundation

Define the smallest **generic** capabilities needed for authored entities.

Investigate and design (prefer ADRs before new Core abstractions):

- authored documents/entities
- durable revisions / version history
- generic draft/published lifecycle capability
- authors/ownership references
- schema-declared references from authored content to existing Aurii entities (content references data without owning it)
- structured fields and rich/free-form content on the **same** entity when the product needs a hybrid record
- preview/delivery of unpublished content

Do **not** hardcode journalism concepts into Core. `Article` may exist as a product schema later; it must not become a special built-in Core type. `Company`, `Match`, and `Playground` remain ordinary schemas too.

### B. Minimal Editorial authoring product

Build a **separate** Editorial/authoring client that proves authored content against the same Core used by data products.

First useful vertical:

- modern text editor
- article metadata
- save / revision history
- draft / publish
- explicit entity/data references
- preview

Article schemas belong to the Editorial **product**, not to generic Core.

### C. Context — primary differentiating hypothesis

Treat **Context** as a first-class product capability, not merely an editor sidebar.

The first version should work **deterministically without requiring AI**.

```text
authored text / explicit references
        ↓
entity/schema matching
        ↓
Aurii query + relations
        ↓
relevant entities + available datasets
        ↓
editor / research experience
```

Potential examples (project data, not Core builtins): election data, companies, people, municipalities, statistics, geographic data, previous structured datasets, other sources connected to the Aurii project.

**Start with**

1. explicit references
2. entity lookup/search
3. source- and provenance-aware results
4. relation traversal
5. relevant-data queries

Example:

```yaml
Article
  references:
    - schema: municipality
      id: "5001"
    - schema: election
      id: "storting-2025"
```

The Editorial UI can then ask Core:

> What data related to these entities is available in this project?

and surface useful material while the user writes or researches.

**Later:** entity extraction from text, semantic matching, ranking, AI-assisted suggestions.

AI must be an **enhancement** to Context, not the architecture Context depends on.

#### Reusable Context boundary

Context must **not** belong exclusively to Editorial.

Architect Context so it can eventually be consumed by:

- Aurii Editorial
- Aurii Research
- an external CMS
- custom applications
- AI clients
- future products

Do **not** couple Context implementation to one rich-text editor.

Prefer an eventual boundary resembling:

```text
                 Context capability
                        │
        ┌───────────────┼────────────────┐
        │               │                │
    Editorial       Research       external client
        │               │                │
        └───────────────┼────────────────┘
                        │
                    Aurii Core
```

Context may start inside Editorial while experimentally validating it, but its **data/query model must not assume Editorial is its permanent host**.

This matters for later market validation: Context may be valuable even when the customer does not use our editor. Aurii Research is one possible sibling consumer, but it is documented separately and is not implemented by this phase roadmap.

### D. Realtime collaboration

After basic authored content works, validate simultaneous editing.

Treat realtime collaboration as a **separate architectural concern**.

- Core should own **durable** entity/revision state.
- Ephemeral collaboration state should **not** automatically become normal durable Core domain state.

Evaluate an architecture such as:

```text
Editor clients
     ↕
Yjs / CRDT
     ↕
Collaboration service
     ↓
durable revisions
     ↓
Aurii Core
```

Presence, cursors, and transient CRDT state can belong to the collaboration layer. Durable revisions belong to Aurii.

Do **not** introduce realtime collaboration into Core merely because Editorial needs it.

### E. Production workflow and publication targets

Once authoring is proven, validate a full production lifecycle.

Avoid hardcoded newsroom statuses in Core. Prefer generic primitives such as:

- `WorkflowDefinition`
- `WorkflowState`
- `Transition`
- `Assignment`
- `Publication`
- `PublicationTarget`

A newsroom product may then **configure**:

```text
Idea
  ↓
Research
  ↓
Draft
  ↓
Editing
  ↓
Ready
  ├──→ Web
  └──→ Print
```

`Idea`, `Editing`, `PrintReady`, `Desk`, and similar labels should be **product configuration / domain data** — not generic Core concepts.

Web and print should be publication/delivery **targets** around the same authored resource, not separate article types.

### F. Productisation / service validation

Phase 5 should explicitly test whether Editorial + Context can become a commercial service built on Aurii.

Keep these concepts separate:

| Concept | Role |
|---------|------|
| **Aurii Core** | Generic technology/runtime. Potential future distribution: `@aurii/core`, `@aurii/sdk`, `@aurii/types`, … Self-hosted/npm distribution remains compatible. |
| **Aurii Cloud** | Potential future managed/runtime hosting (storage, auth, backups, scaling, realtime infrastructure, observability). **Not required in Phase 5.** |
| **Aurii Editorial + Context** | A product/service that can be market-tested independently of how Core is commercially distributed. **Primary commercial validation target for Phase 5.** |
| **Context integrations** | Longer term: other CMSes, newsroom editors, research tools, AI clients, custom internal applications. |

npm packaging and potential Community/Pro/Enterprise or hosted tiers may be investigated **separately** after the product boundary has been validated. Do not encode pricing/tier/licensing architecture inside Core in this phase.

---

## Ordering

Suggested order:

```text
A. Authored-content foundation
        ↓
B. Minimal Editorial client
        ↓
C. Context MVP
        ↓
D. Realtime collaboration
        ↓
E. Production workflow + publication targets
        ↓
F. Productisation + external Context integrations
```

Context must arrive **early enough** that Phase 5 does not turn into simply “build another CMS”. See [Prioritization: Context before CMS completeness](#prioritization-context-before-cms-completeness).

---

## Entry criteria

Phase 4 exit criteria are **met** ([`Phase4.md`](Phase4.md)). Do not begin Phase 5 implementation unless that is the assigned task.

At minimum:

- live delivery contract is proven and integration-tested ([`docs/DELIVERY.md`](docs/DELIVERY.md))
- independent consumers can use Core without Studio
- Studio can operate the reference data product without becoming a CMS
- product/package composition is understandable
- scale limitations have been measured and documented
- [ADR-0010](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md) remains the architectural boundary for authoring

---

## Guardrails / non-goals

Initially reject:

- turning Studio into the publication CMS (custom Studio editors for matches/maps are ADR-0020 extensions, not this product)
- turning Phase 5 into implementation of Aurii Research
- hardcoded `Article`, `Desk`, `PrintReady` or similar newsroom concepts in generic Core
- making Editorial a required proxy between Core and frontends
- representing all realtime collaboration state as ordinary durable Core entities
- AI-only Context architecture
- full InDesign/InCopy/NewsML production integration in the first slice
- full enterprise RBAC as a prerequisite for proving Editorial
- premature pricing/tier/licensing architecture inside Core
- a large new Product Runtime abstraction merely to support Editorial
- promoting commodity CMS capabilities (generated forms, media library, GraphQL, protocol checklists, extra database adapters) into Core for competitor parity — [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md)
- judging Phase 5 successful merely because Aurii can edit an article, upload images, save drafts, publish content, or provide an admin UI

---

## Success question

> Can we build and operate a genuinely useful authored/hybrid product—where writers can create content and immediately use relevant structured data already available in Aurii—without adding newsroom-specific business logic to Core?

If yes, Aurii has validated both:

1. the generic Runtime model; and
2. the foundation for a differentiated commercial Editorial + Context service.

That question is **necessary but not sufficient**. Phase 5 must also meet the differentiated criteria below.

---

## Differentiated success criteria

Phase 5 must **not** be considered strategically successful merely because Aurii can:

- edit an article
- upload images
- save drafts
- publish content
- provide an admin UI

Those outcomes would also describe a conventional headless CMS. They are useful enabling work, not platform proof.

At least one Phase 5 success criterion must prove Aurii’s differentiated platform value:

> An Editorial document can reference an entity originating from an independently managed structured dataset, and Context can deterministically surface relevant related entities/data with source/provenance information, without duplicating that data into the Editorial product model.

Additional required criterion:

> The same Context/Core capability can be exercised through a non-Editorial test client or API-level contract, demonstrating that the capability is not editor-specific.

Until those criteria can be demonstrated, Phase 5 has not validated Aurii’s hypothesis — regardless of how complete a conventional CMS feature matrix looks.

These criteria are **planned validation targets**. They do not claim Context or Editorial exist today.

---

## Related documents

- [`Phase4.md`](Phase4.md) — data products and delivery (must complete first)
- [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md) — Core / Studio / CMS / consumer vocabulary
- [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md) — open Core, product boundaries, Studio audience
- [`docs/COMPETITIVE_GUARDRAILS.md`](docs/COMPETITIVE_GUARDRAILS.md) — Kyro test, commodity vs strategic capabilities, promotion ladder
- [`docs/DELIVERY.md`](docs/DELIVERY.md) — live frontend delivery contract
- [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [`docs/ARCHITECTURE_FITNESS.md`](docs/ARCHITECTURE_FITNESS.md) — Kampbart, playgrounds, Gaselle, Geo
- [`adr/ADR-0019 — Provenance and Editorial Overrides.md`](adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)
- [`adr/ADR-0020 — Extensible Studio.md`](adr/ADR-0020%20—%20Extensible%20Studio.md)
- [`AGENTS.md`](AGENTS.md) — dual reference verticals (Norwegian Geo now; Editorial later) plus fitness tests
