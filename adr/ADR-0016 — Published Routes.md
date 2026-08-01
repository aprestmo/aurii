ADR-0016 — Published Routes

Status: Accepted
Date: 2026-08-01
Decision Makers: Aurii Project
Related: ADR-0005 (API-First), ADR-0011, ADR-0014

⸻

Context

The general Query API remains available. Frontends also need **stable, versioned endpoints** that do not require knowing Aurii Query Language. ADR-0011 listed published API routes as future Project children; they were not implemented.

⸻

Decision

1. **Separate definition from state.**
   * **Definition** (`defineRoute` in project code): path, method, declarative query, defaults.
   * **State** (Core): `enabled`, `access`, `cacheTtl`, `datasetId`, `version`, bound to Project.

2. **Declarative query only** for Studio-managed and project-declared routes: `schema`, `filter`, `select`, `orderBy`, `limit`. No arbitrary JavaScript from Studio.

3. **Activation is Core-side.** Disabled routes are not served (404). Enabling requires validation against the target schema/dataset.

4. **Access:** `public` | `authenticated` | `private` (private ≡ authenticated with project token for beta).

5. **URL shape:** `/public/:projectSlug/v1/...` derived from declared paths, project-scoped.

6. **Consumers talk to Core**, never to Studio. `apps/geo` must not import Studio code.

⸻

Consequences

Positive

* Stable delivery contract for frontends
* Studio can enable/disable without redeploying Core code for state changes
* Aligns with “APIs are products”

Tradeoffs

* Advanced queries still use `/query`; published routes are intentionally constrained
* Definition files must be registered/synced into Core before activation

Non-goals

* GraphQL gateway
* Mutating published routes from untrusted Studio input beyond the declarative model
* Leaking hidden fields or secrets
