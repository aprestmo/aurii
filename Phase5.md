# Phase 5 — Editorial & Context

> **Status: planned / post–Phase 4.** This is a roadmap only.
>
> Do **not** implement Phase 5 capabilities until Phase 4 exit criteria are met or consciously waived with documented rationale.
>
> Parent: [`Phase4.md`](Phase4.md). Product vocabulary: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md). Authoring boundary: [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md). Delivery contract: [`docs/DELIVERY.md`](docs/DELIVERY.md).

---

## Objective

Phase 5 should validate Aurii on two dimensions.

### Platform validation

Prove that a sophisticated authored/hybrid product can be built entirely on the generic Aurii Runtime **without turning Core into a newsroom CMS**.

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

- **Core** remains the system of record.
- **Editorial** is a **client** / separate product — not Studio renamed, and not a required layer between Core and frontends.
- **Frontends consume Core/delivery APIs directly** and must never depend on Editorial as a read proxy.
- **Studio** remains the **data workspace** (sources, imports, schedules, entities, query, published routes). It must not evolve into the CMS.

This is [ADR-0010](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md) applied to a concrete product hypothesis: **Editorial + Context**.

---

## Proposed workstreams

### A. Authored-content foundation

Define the smallest **generic** capabilities needed for authored entities.

Investigate and design (prefer ADRs before new Core abstractions):

- authored documents/entities
- durable revisions / version history
- generic draft/published lifecycle capability
- authors/ownership references
- schema-declared references from authored content to existing Aurii entities
- preview/delivery of unpublished content

Do **not** hardcode journalism concepts into Core. `Article` may exist as a product schema later; it must not become a special built-in Core type.

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

Design Context so it could eventually be exposed independently of Aurii Editorial:

```text
                   Aurii Context
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
 Aurii Editorial    external CMS    research tool
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                     Aurii Core
```

This matters for later market validation: Context may be valuable even when the customer does not use our editor.

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

Context must arrive **early enough** that Phase 5 does not turn into simply “build another CMS”.

---

## Entry criteria

Do not begin Phase 5 implementation until Phase 4 exit criteria are met or consciously waived with documented rationale.

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

- turning Studio into the CMS
- hardcoded `Article`, `Desk`, `PrintReady` or similar newsroom concepts in generic Core
- making Editorial a required proxy between Core and frontends
- representing all realtime collaboration state as ordinary durable Core entities
- AI-only Context architecture
- full InDesign/InCopy/NewsML production integration in the first slice
- full enterprise RBAC as a prerequisite for proving Editorial
- premature pricing/tier/licensing architecture inside Core
- a large new Product Runtime abstraction merely to support Editorial

---

## Success question

> Can we build and operate a genuinely useful authored/hybrid product—where writers can create content and immediately use relevant structured data already available in Aurii—without adding newsroom-specific business logic to Core?

If yes, Aurii has validated both:

1. the generic Runtime model; and
2. the foundation for a differentiated commercial Editorial + Context service.

---

## Related documents

- [`Phase4.md`](Phase4.md) — data products and delivery (must complete first)
- [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md) — Core / Studio / CMS / consumer vocabulary
- [`docs/DELIVERY.md`](docs/DELIVERY.md) — live frontend delivery contract
- [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [`AGENTS.md`](AGENTS.md) — dual reference verticals (Norwegian Geo now; Editorial later)
