ADR-0015 — DataSource Model

Status: Accepted
Date: 2026-08-01
Decision Makers: Aurii Project
Related: ADR-0011, ADR-0014, ADR-0002 (Core as Content Lake)

⸻

Context

Studio must show where data comes from. Today “sources” in Norwegian Geo `module.yaml` are documentation only; Core `ImportDefinition.source` is a file path descriptor (`csv`/`json`). Neither is a first-class operable registry for HTTP, databases, manual ops, automation, or future CMS products.

⸻

Decision

1. **Introduce `DataSource` as a Core-managed resource** scoped to Project + Dataset.

2. **Kinds:** `file` | `http` | `database` | `manual` | `product` | `automation` | `other`.

3. **Status:** `active` | `paused` | `error` | `disabled`.

4. **Secrets:** stored server-side only (`SecretRef`). API/SDK responses never include secret values.

5. **Reuse import engine.** A DataSource links to saved import/sync definitions; it does not replace the pipeline engine.

6. **Not Schema-backed Entities (v1).** Like Project, DataSource is platform infrastructure for operations. Revisit Entity modeling later if products need to query sources as data.

⸻

Consequences

Positive

* Studio can list provenance, last success/failure, next run, linked definitions
* Equal footing for file import, cron sync, manual entry, and future products

Tradeoffs

* Parallel to file `Source` on ImportDefinition until saved definitions fully supersede path-only imports
* Minimal secret vault (in-process / env) — not a cloud KMS

Non-goals

* Distributed connector marketplace
* Live database CDC
* Returning credentials to the browser
