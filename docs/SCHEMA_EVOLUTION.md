# Schema Evolution

> **Status: architectural contract (Pre–Phase 5).** This document defines how Aurii treats schema identity, schema versions, and historical interpretation.
>
> ADRs: [ADR-0021 — Schema Evolution and Historical Interpretation](../adr/ADR-0021%20—%20Schema%20Evolution%20and%20Historical%20Interpretation.md).
>
> Related: [HISTORY_MODEL.md](HISTORY_MODEL.md), [TEMPORAL_REFERENCES.md](TEMPORAL_REFERENCES.md), [Schema Language.md](Schema%20Language.md), [COMPETITIVE_GUARDRAILS.md](COMPETITIVE_GUARDRAILS.md), [Phase5.md](../Phase5.md).

---

## Purpose

Norwegian Geo tolerates schema drift during platform validation.

Phase 5 changes the risk profile: authored entities, revisions, and published states may persist for long periods.

This contract answers:

1. What identifies a schema?
2. What is a schema version?
3. Which changes are compatible, potentially breaking, or breaking?
4. How do existing entities remain interpretable after the active schema changes?

---

## Schema identity

A schema has a stable identity independent of its human-readable label.

**Identity = `schema.id` within a `datasetId`.**

- The existing string `id` (for example `"municipality"`, `"article"`) is that identity.
- `name` / `description` / labels are presentation metadata and may change without changing identity.
- Aurii does **not** introduce a second identifier (UUID slug, internal key) unless a future ADR proves it is required.

Storage primary key remains `(id, dataset_id)`.

---

## Schema version

Every stored schema carries an integer **`schemaVersion`** (persisted as `version` on `StoredSchema`).

Minimal model:

```ts
{
  id: "article",
  version: 3,       // schemaVersion
  name: "Article",
  fields: [ /* ... */ ]
}
```

Rules:

| Rule | Meaning |
|------|---------|
| Starts at `1` | Default when omitted on first registration |
| Monotonic for a given identity | A newer registration that changes the definition should bump the version |
| Active schema | The highest registered version currently stored for `(id, datasetId)` |
| Not entityRevision | Do not overload this integer as optimistic concurrency for entity writes |

This task does **not** require a generalized migration DSL or multi-row schema history table. The runtime must still:

1. know which `schemaVersion` an entity/revision was associated with;
2. detect breaking changes rather than silently treating them as compatible.

---

## Change classification

### Compatible

Safe without requiring consumers to rewrite data:

- add an optional field
- change `label` / `description` / UI metadata
- add non-breaking validation metadata that does not reject existing values
- reorder fields in the definition (order is not semantic)

**Behaviour:** may register without forcing a migration. Prefer bumping `schemaVersion` when the definition materially changes, even if compatible, so history is explicit.

### Potentially breaking

May invalidate some existing entities depending on their data:

- make an optional field required
- tighten validation (narrower type constraints, new required format)
- change a reference target (`to`)
- change array element type (`string[]` → `number[]`)
- change `multiple` on a reference field

**Behaviour:** detectable as `potentially_breaking`. Registration should bump `schemaVersion`. Existing entities remain readable; validation against the latest schema may fail until an explicit migration or data fix.

### Breaking

Changes that remove or rewrite meaning:

- remove a field
- rename a field
- change field type (`string` → `number`, etc.)
- change the meaning of an existing field (documented semantic break)
- change natural-key semantics used by imports (`deduplicateBy` / identity fields)

**Behaviour:** detectable as `breaking`. Must not be silently treated as compatible. Existing entity payloads remain stored and readable; interpretation of removed fields is preserved on historical revisions via the revision snapshot / original payload, not by mutating history to match the new schema.

---

## Existing entity semantics

| Question | Answer |
|----------|--------|
| Does an entity retain the schema version it was created/last validated against? | **Yes.** Entities store `schemaVersion` — the schema version associated with the write that produced the current live state (and each durable revision snapshot). |
| Is validation against the latest schema automatic on every read? | **No.** Reads return stored data. Validation against the *active* schema happens on write / import / explicit validate — not as a silent destructive rewrite on read. |
| When does migration happen? | Only as an **explicit** operation (future CLI/API). Ordinary reads never silently migrate. |
| Can old revisions remain valid against old schema versions? | **Yes.** Revision snapshots retain the `schemaVersion` they were written under. |
| What if a field disappears from the current schema but exists in an old revision? | The historical payload **keeps the field**. Consumers that need the current schema shape must migrate or project explicitly. |

**Principle:** Historical data must remain interpretable even when the active schema changes.

---

## Migration boundary

Migration is an explicit operation. It should eventually record:

| Field | Meaning |
|-------|---------|
| `fromSchemaVersion` | Source schema version |
| `toSchemaVersion` | Target schema version |
| `migrationId` | Stable identifier for the migration procedure |
| `timestamp` | When the migration ran |
| `result` | Success / partial / failure summary |

Silent destructive migration during ordinary reads is forbidden.

A full migration framework is **out of scope** for Pre–Phase 5. The runtime only needs enough metadata (`schemaVersion` on entities/revisions) and change classification to prevent Phase 5 from inventing these semantics accidentally.

---

## Runtime support (minimal)

| Surface | Contract |
|---------|----------|
| `StoredSchema.version` | Active schema version for `(id, datasetId)` |
| `Entity.schemaVersion` | Schema version associated with the live entity state |
| `EntityRevisionSnapshot.schemaVersion` | Schema version for a durable revision |
| `classifySchemaChange(previous, next)` | Returns `compatible` \| `potentially_breaking` \| `breaking` |
| `registerSchema` | Persists version; does not rewrite existing entities |

---

## Non-goals

- Generalized migration DSL
- Automatic multi-version schema row history (unless later proven necessary)
- Rewriting Norwegian Geo data to exercise this contract beyond tests
- Treating schema version as the entity concurrency token (see [ADR-0022](../adr/ADR-0022%20—%20Entity%20Revision%20and%20Optimistic%20Concurrency.md))
