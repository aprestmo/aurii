# Aurii Research (planned product hypothesis)

> **Status: planned / exploratory product hypothesis.**
>
> This document defines a future validation/product vertical. It does **not** describe implemented functionality.
>
> Aurii Research is a potential product built on Aurii Core. It is not a new Core concept and not part of Phase 5 implementation scope.

---

## Purpose

Aurii Research is a hypothesis for a broad research and knowledge-work product on top of Aurii Core.

The hypothesis is that one Core can support coherent work across:

- structured records
- external APIs
- imported datasets
- rich text and notes
- files/documents and media
- entities and relations
- sources and provenance
- geographic and temporal information
- derived findings and evidence

without turning Core into a research application.

---

## Audience and product boundary

Aurii Research is **not** scoped only to journalism.

Potential users and domains include:

- analysts
- strategy and product teams
- consultants
- academia/research
- investment and due diligence
- editorial research
- investigations
- internal knowledge teams
- other users who collect, connect, analyse, and document information

Research remains a **separate product/client** over Core public APIs, not a built-in Runtime mode.

---

## Product model (examples, not Core built-ins)

Possible product-level schemas/concepts include:

- `ResearchProject`
- `Source`
- `Entity`
- `Note`
- `Document`
- `Dataset`
- `Query`
- `Claim`
- `Evidence`
- `Excerpt`
- `Question`
- `Hypothesis`
- `Collection`
- `Asset`

These are examples of product schemas and entities, not new built-in Core entity types.

Prefer existing Aurii primitives wherever possible.

Example conceptual flow:

```text
Source
  ↓
Evidence / Excerpt
  ↓
Claim
  ↓
ResearchProject
Entity ←→ Entity
 ↑         ↑
Dataset   Document
```

Key requirement: preserve traceability from claims/findings back to evidence and original sources.

---

## Data and source model pressure

Aurii Research should combine inputs from several origins:

```text
External APIs
Imported datasets
Files / documents
Manual research
Media
Existing Aurii datasets
Automation / AI
        │
        ▼
     Aurii Core
        │
        ▼
   Aurii Research
```

Potential inputs:

- REST / GraphQL APIs
- CSV / JSON / Excel / GeoJSON
- databases via supported source mechanisms
- PDFs and documents
- images, audio, and video
- manually created notes/records

Do not require every external source to be copied into Core when a future source/reference/sync model can safely represent remote or synchronized data.

This document records pressure on the existing DataSource/import/provenance model. It does not define new source architecture.

---

## UX hypotheses (product layer)

Research may need multiple views over the same underlying knowledge:

- rich editor
- source/document reader
- table
- collections
- graph/relationship view
- timeline
- map
- search and filtering
- dataset/query views

These are product UX requirements. They should test product/capability/extension boundaries, not become Core concepts only because Research needs them.

---

## Provenance and evidence

A central Research capability is preserving the path from conclusion to source material:

```text
Source → Evidence/Excerpt → Claim/Finding → ResearchProject
```

AI-derived information must preserve provenance links when applicable.

AI-generated knowledge must not silently become authoritative source data.

---

## Media and files

Research may require significant file/document/media handling.

Aurii should be able to support external/customer-controlled binary storage (for example object storage or DAM), while Aurii manages metadata, relations, provenance, annotations, and permissions.

This document does not select or implement a storage provider.

---

## AI in Research

AI should act as an assistant through the same Core APIs, schemas, validation, and permissions as other clients.

Potential Research product features (hypotheses):

- entity extraction
- relationship suggestions
- classification
- summarisation
- duplicate detection
- quote/date/number extraction
- source comparison
- contradiction detection
- unanswered-question discovery
- hypothesis assistance
- large-collection organisation

All are planned/exploratory and not implemented commitments.

---

## Relationship to Aurii Editorial

Aurii Research and Aurii Editorial are sibling products:

```text
               Aurii Core
                   │
      ┌────────────┴────────────┐
      │                         │
      ▼                         ▼
Aurii Research            Aurii Editorial
      │                         │
      └──── optional link ──────┘
```

Neither product should require the other.

- Research should be usable without Editorial.
- Editorial should be usable without Research.
- A newsroom may choose both.

When both exist, Editorial may reference Research material as evidence/foundation:

```text
Source
  ↓
Evidence
  ↓
Claim / Finding
  ↓
Research Project
  ↓
referenced by
  ↓
Article
```

This should not require copying raw research into article records, and raw research must not automatically become publishable.

Permissions remain authoritative.

This document records a product requirement only. It does not introduce cross-project/deployment relation primitives.

---

## Sensitive research, data custody, and deployment

Research raises strong privacy/security constraints. Workspaces may include:

- personal data
- unpublished documents
- confidential sources
- interview material
- internal datasets
- commercially sensitive information
- investigative hypotheses

Therefore, customer-controlled and self-hosted Core deployments are an important scenario.

Aurii should stay cloud-native but not cloud-dependent.

Valid future deployment shapes may include:

- fully self-hosted
- partner-managed
- dedicated managed deployment
- hybrid deployment
- SaaS product UX over customer-hosted Core

Conceptual deployment boundary:

```text
Customer / IT partner environment
┌───────────────────────────────┐
│ Aurii Core                    │
│ Database                      │
│ Search / indexes              │
│ Object storage / media        │
│ Sensitive customer data       │
└───────────────┬───────────────┘
                │
        public/product APIs
                │
        ┌───────┴────────┐
        ▼                ▼
 Aurii Research     Aurii Editorial
   product UX         product UX
```

Product delivery boundary and data-custody boundary do not have to be identical.

This document does not lock commercial packaging or licensing.

---

## Validation value

Research is a planned validation portfolio vertical that complements (not replaces) Norwegian Geo and Editorial.

It should pressure-test Aurii on:

- heterogeneous external data
- imported datasets
- rich/unstructured content
- files/media integration
- provenance and source traceability
- relationships and annotations
- search
- permissions
- sensitive/private data handling
- configurable storage boundaries
- maps/geodata
- timelines
- graph-like relationships
- editor integration
- AI as a client
- collaboration/version history
- product-to-product references
- self-hosted/hybrid deployment

Useful distinction:

- Research produces and organizes knowledge.
- Editorial produces publications from knowledge.

That is a product distinction, not a new Core abstraction.

---

## Explicit non-goals (this issue and current status)

Do **not** read this document as implementation of:

- Aurii Research product runtime features
- Research-specific Core entity types
- cross-project relation primitives
- graph database changes
- media storage provider selection
- AI feature implementation
- auth/privacy runtime changes
- Research UI/editor implementation
- Phase 5 scope expansion
- SaaS pricing/licensing commitments

When future capabilities are referenced here, they are planned/exploratory hypotheses only.

---

## Related documents

- [`PRODUCT_MODEL.md`](./PRODUCT_MODEL.md)
- [`PRODUCT_STRATEGY.md`](./PRODUCT_STRATEGY.md)
- [`PLATFORM_VALIDATION.md`](./PLATFORM_VALIDATION.md)
- [`Studio.md`](./Studio.md)
- [`PROJECT_PACKAGES.md`](./PROJECT_PACKAGES.md)
- [`ARCHITECTURE_FITNESS.md`](./ARCHITECTURE_FITNESS.md)
- [`NORWEGIAN_GEO.md`](./NORWEGIAN_GEO.md)
- [`../Phase5.md`](../Phase5.md)
- [`../adr/ADR-0010 — Optional Authoring Layer.md`](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)
- [`../adr/ADR-0019 — Provenance and Editorial Overrides.md`](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)
- [`../adr/ADR-0020 — Extensible Studio.md`](../adr/ADR-0020%20—%20Extensible%20Studio.md)
