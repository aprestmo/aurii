# ADR-0019 — Provenance and Editorial Overrides

Status: Accepted  
Date: 2026-08-15  
Decision Makers: Aurii Project  
Related: [ADR-0002](./ADR-0002%20—%20Core%20as%20the%20Content%20Lake.md), [ADR-0006](./ADR-0006%20—%20Unified%20Data%20Model.md), [ADR-0015](./ADR-0015%20—%20DataSource%20Model.md), [`docs/ARCHITECTURE_FITNESS.md`](../docs/ARCHITECTURE_FITNESS.md)

⸻

## Context

Aurii data arrives from many places: files, HTTP APIs, databases, manual Studio edits, automation, AI, and future product clients. [ADR-0015](./ADR-0015%20—%20DataSource%20Model.md) already introduced `DataSource` as a Core-managed registry (where data comes from). That is necessary but not sufficient.

Geo, Gaselle, and similar products need to know **which values** came from which source, whether a human overrode them, and whether a later sync may overwrite those overrides. Treating every field as undifferentiated JSON makes that hard to add later.

Phase 4 currently lists “provenance / source metadata conventions on entities” as a P1 polish item. Architecture must treat provenance as a **design requirement now**, even though the storage shape and APIs remain unimplemented.

⸻

## Decision

1. **Provenance is a Core concern**, not a Studio-only display field and not a product-specific JSON convention.

2. **Source value and editorial override are separate concepts.** A later sync may refresh the source value without silently destroying an explicit override. Core must be able to represent both.

3. **Provenance may live as internal Core metadata**, not necessarily inside the ordinary record JSON that APIs return as business fields. Do not force products to model `population.source` / `population.override` as schema fields unless they want that in the public model.

4. **The current entity JSON must not make this difficult later.** Avoid designs that flatten away origin, assume every write is equivalent, or treat imported entities as uneditable CMS documents.

5. **Minimum questions the model must eventually answer** (per record and, where needed, per field):

   - which DataSource / source definition a value came from
   - upstream identifier
   - when Aurii fetched it
   - when upstream last changed (if known)
   - sync status (success, error, stale, paused)
   - which transform / pipeline produced the stored value
   - whether the field is source-owned, editorially owned, or overlayed

6. **Do not lock the API or JSON layout in this ADR.** A sketch for thinking:

   ```text
   population
     sourceValue: 21438
     provider: SSB
     fetchedAt: …
     override: null
   ```

   That sketch is illustrative. Implementation may use sidecar metadata, field-level annotations, or a provenance store—as long as the concepts remain distinct.

7. **Editorial enrichment is not the same as override.** Adding a description or tips field beside imported coordinates is enrichment. Replacing an imported population figure is an override. Both must be possible on the same entity.

⸻

## Source-owned vs editorially owned

| | Source-owned | Editorial overlay | Editorially owned |
|--|--------------|-------------------|-------------------|
| Typical origin | Import / sync | Human or CMS write on a sourced field | Schema fields never filled by a source |
| Sync behavior (intent) | Refresh from upstream | Keep override; keep source value | Untouched by sync |
| Example | SSB population | Corrected municipality name | Playground tips; match report body |

Exact conflict policies (source wins, override wins, review queue) are **product/capability configuration**, not hardcoded Core newsroom rules.

⸻

## Compatibility with existing decisions

- [ADR-0015](./ADR-0015%20—%20DataSource%20Model.md) remains the registry of sources. This ADR is about **values and ownership**, not replacing DataSource.
- [ADR-0006](./ADR-0006%20—%20Unified%20Data%20Model.md) still holds: there is one entity model. Provenance is platform metadata, not a second “data” storage engine.
- Imports continue to submit entities to Core; they must not write around Core ([`docs/Core.md`](../docs/Core.md)).

⸻

## Non-goals (this ADR)

- Implementing a provenance store, field-level overlay API, or worker
- Locking `defineSource()` syntax
- Requiring every entity to carry visible provenance in public JSON
- Building Gaselle or Geo override UIs

⸻

## Consequences

### Positive

- Geo can own a normalized model while remaining honest about Kartverket/SSB/Bring.
- Gaselle can ingest financials and still allow editorial commentary without turning companies into articles.
- Studio can later show “from SSB, fetched …, overridden by …” without Core learning those product names.
- Future sync will have a place to hang conflict policy.

### Costs

- Entity persistence and mutation APIs will need a metadata channel; that is extra work versus “just JSON.”
- Contributors must not stuff provenance into random schema fields as the long-term model.
- Until implemented, docs must distinguish **designed** vs **shipped**.

⸻

## Implementation notes (non-binding)

- Prefer Core metadata over duplicating provenance in every product schema.
- Align entity-level “last imported / source id” conventions with Norwegian Geo `standardFields` only as a **temporary** product convention if needed before Core metadata exists.
- A future `packages/sources` adapter layer and optional `apps/worker` process should emit provenance; they should not own it.

⸻

## Decision summary

Aurii must be able to preserve where values came from and to keep editorial overrides distinct from source data. Provenance is planned Core metadata. The public record model stays a unified entity. APIs are not locked by this ADR.
