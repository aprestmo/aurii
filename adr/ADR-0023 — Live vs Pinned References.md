# ADR-0023 — Live vs Pinned References

## Status

Accepted (Pre–Phase 5 architecture readiness)

## Context

Products will reference structured entities (for example Article → Municipality). When entity data changes, it is ambiguous whether the reference means “current state” or “state at publish/cite time.” Accidental one-size-fits-all semantics would break either live dashboards or reproducible publications.

## Decision

1. Aurii supports two reference modes:
   - **Live** — resolve current entity state by schema + id
   - **Pinned** — resolve immutable historical state by schema + id + `entityRevision`
2. Pinned resolution uses durable revision snapshots; updating the live entity must not change a pinned result.
3. Temporal metadata distinguishes:
   - **`recordedAt`** — when Aurii stored the fact (system)
   - **`effectiveAt`** (or schema-declared `validFrom`/`validTo`) — when the fact applies in the world (domain)
4. Aurii does not implement a full bitemporal query engine in this ADR.
5. Exact wire syntax for references is not locked; the semantic contract is.

Canonical documentation: [`docs/TEMPORAL_REFERENCES.md`](../docs/TEMPORAL_REFERENCES.md).

## Consequences

- Entity revision snapshots are required for real pinned addressing (not fake stubs)
- Publication history may later point at pinned revisions without mutating them
- Products choose live vs pinned explicitly; Core does not silently rewrite one into the other
- Domain temporal fields remain schema-declared where needed (Norwegian Geo validity windows)

## Related

- [ADR-0022 — Entity Revision and Optimistic Concurrency](ADR-0022%20—%20Entity%20Revision%20and%20Optimistic%20Concurrency.md)
- [HISTORY_MODEL.md](../docs/HISTORY_MODEL.md)
- [ADR-0019 — Provenance and Editorial Overrides](ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md)
