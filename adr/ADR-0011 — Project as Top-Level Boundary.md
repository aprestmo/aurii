ADR-0011 — Project as Top-Level Boundary

Status: Accepted
Date: 2026-07-31
Decision Makers: Aurii Project
Supersedes: Deferred Project guidance in PRODUCT_MODEL.md (section “Product vs Dataset…”)
Related: ADR-0005 (API-First), ADR-0006 (Unified Data Model), ADR-0010 (Optional Authoring Layer)

⸻

Context

Aurii must support multiple products in one Runtime deployment—for example Norwegian reference data, election data, and a future editorial CMS. A CMS article may reference municipalities or election results without copying those entities into the CMS datastore.

Earlier product documentation deferred a Core `Project` type in favor of dataset + product-manifest conventions (Norwegian Geo). That convention is still valuable for **product composition**, but it does not provide:

* a stable administrative boundary for API keys, members, and route configuration
* a security boundary independent of dataset ids
* a place for cross-product references to hang without inventing ad-hoc namespaces

⸻

Decision

Introduce **Project** as the top-level administrative, security, and functional boundary in Aurii Core.

* Each project has a stable UUID and a unique human-readable slug.
* Status is `active` | `inactive` | `archived` (no hard delete in the public API for v1).
* All future Core resources (datasets, schemas, imports, relations, API routes, keys, saved queries, views) **must** belong to exactly one project.
* Cross-project relations are allowed only through explicit future mechanisms (stable references or declarative queries)—not by copying entity payloads.

Project is implemented as a first-class platform table (`projects`), not as a Schema-backed Entity. It is infrastructure for tenancy and administration; content remains Entities under Schemas within a project's datasets.

⸻

Consequences

Positive

* Clear parent for access control and API surface configuration
* Slug/name can change without breaking UUID-based relations
* CMS and data products can coexist with controlled references
* Aligns Domain Model documentation (“Projects organize work”) with an implementable Core model

Tradeoffs

* Dataset project-scoping of existing `aurii_datasets` is specified in [ADR-0012](./ADR-0012%20—%20Project-Scoped%20Existing%20Dataset%20Model.md) (completed follow-up)
* Product manifests (`product.yaml`) remain complementary composition docs—not a substitute for Project rows
* Must avoid conflating Project (tenancy) with Product (shipping solution) or Dataset (storage/query boundary)

⸻

Non-goals (this decision)

* Visual control panel
* Users, orgs, RBAC
* Cross-project reference engine
* Permanent deletion
* Empty speculative tables for future resources
