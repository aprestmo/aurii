# ADR-0021 — Schema Evolution and Historical Interpretation

## Status

Accepted (Pre–Phase 5 architecture readiness)

## Context

Aurii schemas currently upsert by `(id, datasetId)` with an integer `version` field that is overwritten in place. Entities do not record which schema version they were written under.

Phase 5 will persist authored content for long periods. Without an explicit contract, Editorial could invent migration semantics accidentally.

## Decision

1. **Schema identity** is the existing string `schema.id` scoped by `datasetId`. No second identifier.
2. **Schema version** is the integer `StoredSchema.version` (`schemaVersion` in prose). Prefer the smallest viable model — no migration DSL in this ADR.
3. Entities and durable revision snapshots store **`schemaVersion`** for historical interpretation.
4. Schema changes are classified as **compatible**, **potentially breaking**, or **breaking** via `classifySchemaChange`. Breaking changes must be detectable.
5. Ordinary reads never silently migrate. Migration is an explicit future operation that should record from/to versions, migration id, timestamp, and result.
6. Historical payloads remain stored even if fields disappear from the active schema.

Canonical documentation: [`docs/SCHEMA_EVOLUTION.md`](../docs/SCHEMA_EVOLUTION.md).

## Consequences

- Phase 5 agents have a clear answer for “what happens when a schema changes?”
- Import/register paths must set and preserve `schemaVersion` on writes
- A full schema history table / migration framework remains deferred until proven necessary
- `schemaVersion` must not be confused with `entityRevision`

## Related

- [ADR-0003 — Schema-First Architecture](ADR-0003%20—%20Schema-First%20Architecture.md)
- [ADR-0006 — Unified Data Model](ADR-0006%20—%20Unified%20Data%20Model.md)
- [ADR-0022 — Entity Revision and Optimistic Concurrency](ADR-0022%20—%20Entity%20Revision%20and%20Optimistic%20Concurrency.md)
