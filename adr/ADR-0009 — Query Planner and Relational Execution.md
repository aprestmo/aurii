ADR-0009 — Query Planner and Relational Execution

Status: Accepted
Date: 2026-07-06
Decision Makers: Aurii Project
Supersedes: Partial aspects of ADR-0004 non-goals

⸻

Context

Phase 2 delivered Query Language v0: single-entity filter, sort, and pagination over JSON document storage. Phase 3 requires relationships, joins, aggregates, and import-time reference validation — without exposing SQL to clients.

ADR-0004 stated that joins and execution plans were implementation details clients should not see. Phase 3 introduces an internal planner while keeping that boundary: clients send query strings; Core produces and executes plans.

⸻

Decision

1. **Separate parsing from execution** via an explicit planner that converts `QueryAST` → `ExecutionPlan`.
2. **Storage adapters execute plans**, not query strings or client-supplied SQL.
3. **Joins and complex predicates** may use in-memory execution over scan results when SQL translation is impractical for JSON storage.
4. **Reference fields** use `type: reference` with `to: <schema>`; values remain string IDs in entity JSON.

⸻

Consequences

Positive:
- SQLite and PostgreSQL stay aligned through a shared plan contract
- New query features extend the AST and planner without API changes
- Explain API can describe plans for Studio and debugging

Negative:
- In-memory joins do not scale to large datasets yet
- EXISTS in queries checks population, not full referential integrity (import validation handles that)

⸻

Phase 4 recommendations

Detailed plan: `Phase4.md` (Data Products and Delivery). Technical carry-overs:

- Push join and aggregate predicates into SQL where possible
- Reference integrity indexes on hot reference fields
- Schema-aware EXISTS (verify target entity exists)
- Dot-notation traversal as sugar over joins

Authoring/CMS forms are out of Phase 4 scope (ADR-0010).
