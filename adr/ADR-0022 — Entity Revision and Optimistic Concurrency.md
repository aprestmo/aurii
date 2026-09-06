# ADR-0022 — Entity Revision and Optimistic Concurrency

## Status

Accepted (Pre–Phase 5 architecture readiness)

## Context

Aurii has multiple conceptual writers (Studio, imports, automation, future Editorial, external clients). There was no entity update API and no concurrency token. Silent last-write-wins must not become the default mutation contract before Phase 5.

## Decision

1. Every mutable entity exposes a monotonically increasing integer **`entityRevision`** (starts at `1` on create).
2. Canonical write precondition is **`expectedRevision`** on update. Successful updates atomically increment `entityRevision`.
3. Stale preconditions fail with a **concurrency conflict** (HTTP **409**), never silent overwrite.
4. Compare-and-write is **atomic at the storage layer** (`UPDATE … WHERE id = ? AND entity_revision = ?`), not an application-level read-check-write race.
5. HTTP uses the same contract: request body `expectedRevision` (and response `ETag` reflecting `entityRevision` for convenience). Do not introduce a second competing concurrency mechanism.
6. Imports that upsert through Core must go through the same revision increment semantics — they must not write around Core.
7. Durable **revision snapshots** are stored on create/update to support pinned reference addressing ([ADR-0023](ADR-0023%20—%20Live%20vs%20Pinned%20References.md)) without collapsing into provenance or publication history ([HISTORY_MODEL.md](../docs/HISTORY_MODEL.md)).

Canonical docs: [`docs/HISTORY_MODEL.md`](../docs/HISTORY_MODEL.md), [`docs/API.md`](../docs/API.md).

### Idempotency (documented, not a platform-wide layer)

| Case | Expectation |
|------|-------------|
| Import runs with natural-key upsert | Idempotent at the natural key; each successful update still increments `entityRevision` |
| Retryable mutations with `expectedRevision` | Safe to retry: stale expected revision conflicts instead of double-applying |
| Scheduled syncs | Should use Core import/upsert paths; must not bypass concurrency |

Do not add a platform-wide idempotency key framework without product evidence.

## Consequences

- Core, HTTP, and SDK expose update + conflict
- Studio and products must use the public mutation contract
- `entityRevision` ≠ `schemaVersion` ≠ import run ID ≠ published revision
- Full audit log and publication history remain separate future work

## Related

- [ADR-0006 — Unified Data Model](ADR-0006%20—%20Unified%20Data%20Model.md)
- [ADR-0021 — Schema Evolution](ADR-0021%20—%20Schema%20Evolution%20and%20Historical%20Interpretation.md)
- [ADR-0023 — Live vs Pinned References](ADR-0023%20—%20Live%20vs%20Pinned%20References.md)
