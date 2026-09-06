# History Model

> **Status: architectural contract (Pre–Phase 5).** Provenance, audit, revision, and publication history are four distinct concepts.
>
> Related: [ADR-0019 — Provenance and Editorial Overrides](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md), [SCHEMA_EVOLUTION.md](SCHEMA_EVOLUTION.md), [TEMPORAL_REFERENCES.md](TEMPORAL_REFERENCES.md), [ADR-0022 — Entity Revision and Optimistic Concurrency](../adr/ADR-0022%20—%20Entity%20Revision%20and%20Optimistic%20Concurrency.md), [Phase5.md](../Phase5.md).

---

## Purpose

Phase 5 introduces authored revisions and publication.

Aurii already has import history and provenance requirements.

These concepts must **not** collapse into one generic “history” mechanism.

---

## The four kinds of history

```text
                         Entity
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
 Provenance            Revisions             Audit
 origin/ownership      durable state         operations
                           │
                           ▼
                     Publication
                 externally visible state
```

### 1. Provenance

Answers: **Where did this value/data originate?**

Examples:

- DataSource
- upstream ID
- import run
- source timestamp
- transform
- editorial override

Authoritative design: [ADR-0019](../adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md).

Provenance is about **origin and ownership of values**, not about which operation happened or which state was published.

### 2. Audit history

Answers: **Who/what performed an operation?**

Examples:

- `entity.created`
- `entity.updated`
- `entity.deleted`
- `entity.restored`
- `entity.migrated`
- `publication.created`
- `token.created` / platform ops already recorded today

Audit history describes **operations**. It is not a snapshot/revision store.

Platform audit events already exist for some project operations. Full entity audit coverage is not required for Pre–Phase 5, but the type vocabulary must stay distinct.

### 3. Revision history

Answers: **What did the authored/entity state look like at a particular revision?**

A revision is **durable state**.

Examples:

- revision 17
- revision 18
- revision 19

Revision history may eventually support diff/rollback.

Do **not** equate revisions with audit events.

Do **not** equate `entityRevision` with an import run ID or a published version number.

### 4. Publication history

Answers: **What exact state was exposed/published to consumers?**

Publication state may point to an immutable revision (or equivalent snapshot).

It must **not** silently mutate when the current entity changes.

Full publication workflow is Phase 5 / product scope. The architectural rule is reserved now so Editorial cannot invent a conflicting model.

---

## Architectural rule

Never implement a generic history abstraction that hides which of these four semantics is intended.

Prefer precise vocabulary in APIs and types:

| Prefer | Avoid when meaning is specific |
|--------|--------------------------------|
| `ProvenanceRecord` | `HistoryEntry` |
| `AuditEvent` | `HistoryEntry` |
| `EntityRevision` / `EntityRevisionSnapshot` | `Version` / `HistoryEntry` |
| `PublicationRecord` | `HistoryEntry` |

Avoid one integer called `version` for unrelated concepts. Use:

- `schemaVersion`
- `entityRevision`
- `publishedRevision` (reserved)
- `sourceVersion` (reserved for upstream/source payloads)

---

## Implementation status (Pre–Phase 5)

| Concept | Status |
|---------|--------|
| Provenance (field-level) | Designed (ADR-0019); not fully implemented |
| DataSource / import run origin | Partially implemented (sources, import runs) |
| Audit events (platform ops) | Implemented for some platform actions |
| Entity revision + snapshots | Minimal runtime support for concurrency + pinned addressing |
| Publication history | Architecturally reserved — not implemented |

---

## Separation invariants (tests)

1. `entityRevision` is not an import run ID.
2. Source/provenance metadata can change without implying a new published version.
3. Revision metadata can exist independently of provenance metadata.
4. Types used for revisions must not be aliased as provenance or publication records.

---

## Non-goals

- Full publication workflow
- Complete entity audit log for every mutation
- A single polymorphic `HistoryEntry` store
- Collapsing import history into revision history
