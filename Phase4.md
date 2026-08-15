# Phase 4 — Data Products and Delivery

> Planning document for the next implementation phase.
>
> Phase 3 completed the relational Core. Phase 4 completes the **data-product path** before the repository attempts a full newsroom, LiveCenter, or authoring CMS.
>
> Product vocabulary: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md).  
> Product strategy: [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md).  
> Optional authoring decision: [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).  
> Architecture fitness tests: [`docs/ARCHITECTURE_FITNESS.md`](docs/ARCHITECTURE_FITNESS.md).  
> Provenance: [`adr/ADR-0019 — Provenance and Editorial Overrides.md`](adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md).  
> Extensible Studio: [`adr/ADR-0020 — Extensible Studio.md`](adr/ADR-0020%20—%20Extensible%20Studio.md).

---

## Objective

Prove that Aurii can ship coherent **data products**: composed schemas and modules, operable imports, and a documented production delivery path from Core through the SDK to an independent frontend—without requiring any CMS or authoring client.

```text
Import → Core storage → Query / API → @aurii/sdk → real frontend
```

Norwegian Geo remains the canonical vertical for this proof. Scale stress uses a tax-list-sized (or similarly large) dataset as a future benchmark target—not as a claim that such scale already works.

---

## Project-oriented Studio beta (Phase 4 delivery)

Phase 4 includes a **project-oriented Studio beta** as part of the data-product delivery path—not as a CMS.

| Capability | Role in Phase 4 | Status |
|------------|-----------------|--------|
| Project package (`aurii.config.ts` / `defineProject`) | Installable schemas, sources, imports, sync, routes, Studio config | Beta — [ADR-0014](adr/ADR-0014%20—%20Project%20Configuration%20Package.md) |
| DataSource model | First-class provenance registry for file/HTTP/DB/manual/… | Beta — [ADR-0015](adr/ADR-0015%20—%20DataSource%20Model.md) |
| Scheduling (cron on saved sync/import) | Minimal single-process scheduler for recurring refresh | Beta — [ADR-0018](adr/ADR-0018%20—%20Minimal%20Scheduling.md) |
| Published routes (`defineRoute`) | Stable `/public/:projectSlug/v1/...` delivery endpoints | Beta — [ADR-0016](adr/ADR-0016%20—%20Published%20Routes.md) |
| Studio extension (`defineStudio`) | Generic `@aurii/studio-app` + project config + simple view registry | Beta — [ADR-0017](adr/ADR-0017%20—%20Studio%20Extension%20Model.md); planned surface [ADR-0020](adr/ADR-0020%20—%20Extensible%20Studio.md) |
| Provenance / overrides | Source value vs editorial override as Core metadata | Designed — [ADR-0019](adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md) (not implemented) |

Docs: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md), [`docs/Studio.md`](docs/Studio.md), [`docs/PROJECT_PACKAGES.md`](docs/PROJECT_PACKAGES.md).

Studio remains an **extensible data workspace**, not a publication CMS. Generated forms are in-scope as **default record UI** (not as a CMS). A CMS / authoring product stays a non-goal for Phase 4. Domain editors (Kampbart match desk, playground Map view) are **not** Phase 4 implementation work; their **extension contract** is an architectural commitment ([ADR-0020](adr/ADR-0020%20—%20Extensible%20Studio.md)).

---

## Why Phase 4 comes before authoring

| Already true after Phase 3 | Still missing for a product platform |
|----------------------------|--------------------------------------|
| Import → validate → persist → query | Formal product composition beyond Norwegian Geo convention |
| References, joins, Studio query playground | Import as an operable first-class product surface (history, retry, provenance UX) |
| SDK + HTTP API | End-to-end **live** delivery to a real frontend (not only snapshots / admin UI) |
| Norwegian Geo as reference data product | Honest scale limits and next bottlenecks measured |

Building CMS, drafts, LiveCenter, or NewsML delivery on top of an incomplete delivery contract would invert the dependency order. Phase 4 finishes the data foundation; later phases add publication authoring and newsroom compositions.

Relations, sources, provenance, and Studio extensibility are **not** deferred “nice to haves.” They are already in the architecture (Phase 3 relations; Phase 4 DataSource + simple Studio views). Remaining work is staged implementation on that foundation—see **Foundations roadmap** below.

---

## Foundations roadmap (how this phase sits)

Guideline sequence for the platform (not a claim that Phase 4 implements all of it):

```text
Schema
  ↓
Records
  ↓
Relations
  ↓
Generated Studio
  ↓
Rich content / blocks
  ↓
Studio extension API
  ↓
Sources / ingestion / provenance
  ↓
Publishing / versioning / workflows
  ↓
Domain-specific Studio experiences
```

**Where we already are, and why the order differs slightly:**

| Foundation | Status | Notes |
|------------|--------|--------|
| Schema | Implemented | Phase 1–2 |
| Records / entities | Implemented | Same primitive for data, content, hybrids |
| Relations | Implemented (typed refs, 1:1, 1:n, joins, import integrity); reverse refs, n:n, richer traversal **planned** | Landed in **Phase 3**, before generated Studio—on purpose (Geo/Gaselle graphs) |
| Generated Studio | Partial (browse, query, generic entity UI); schema-generated forms **not required to exit Phase 4** | Default workspace UX, not a CMS. May start in Phase 4 polish; must not wait for Phase 5 |
| Rich content / blocks | Planned field types on the same entity | After generated default UI; **not** a second store. Phase 5 can consume them; schema may grow earlier |
| Studio extension API | Beta simple view registry; full surface **planned** | Started in Phase 4 **before** rich content because Geo needed custom pages. Widen per ADR-0020 without locking APIs |
| Sources / ingestion / provenance | DataSource + import/sync **beta**; provenance/overrides **designed** (ADR-0019); `packages/sources` / `apps/worker` **intended placement only** | Pulled **earlier** than the guideline because Geo cannot be honest without sources. Not a late integration |
| Publishing / versioning / workflows | Planned generic capabilities | **Phase 5+** — unchanged |
| Domain-specific Studio | After a stable extension contract | Kampbart match desk, Map views: **products**, not Core. Need not wait for Editorial |

**Deviation from the guideline, explained:** Sources and a thin Studio extension point moved earlier than “rich content” because the implemented vertical is a data product (Norwegian Geo). That is compatible with the guideline’s intent: those concerns are foundations, not afterthoughts. Publishing still follows. Domain studios still follow a real extension API.

Do **not** implement Kampbart, playground Map, Gaselle, `packages/sources`, workers, or a provenance store as Phase 4 exit work unless a later issue assigns them.

---

## Current baseline (implemented / beta)

Do not re-implement these; build on them.

| Area | What exists | Maturity |
|------|-------------|----------|
| Core | Schemas, entities, datasets, projects, import engine, pipelines, Query Language v1 (joins, count), planner, HTTP API, OpenAPI/Swagger | Implemented |
| Storage | SQLite + PostgreSQL adapters; in-memory joins (correct at Norwegian Geo scale) | Implemented |
| SDK | Typed client for datasets, schemas, entities, query, import, stats | Implemented |
| Project package | `defineProject` / `aurii.config.ts`; validate/load without Studio | Beta |
| DataSource + saved imports/sync | Core registry; secrets server-side; cron schedule (single-process) | Beta |
| Published routes | `defineRoute`; `/public/:projectSlug/v1/...`; Core activation state | Beta |
| Studio | `@aurii/studio-app`: sources, imports, history, schedules, routes, entities, query, system; `defineStudio` + simple view registry | Beta |
| Norwegian Geo | `product.yaml`, `aurii.config.ts`, core + modules, import scripts, tests, `apps/geo` consumer | Reference vertical |
| ADRs | 0009–0010, 0011–0013 (projects), 0014–0018 (project Studio platform), 0019–0020 (provenance, extensible Studio) | Accepted |

### Known gaps Phase 4 must treat honestly

- Live delivery for Norwegian Geo core schemas is documented in [`docs/DELIVERY.md`](docs/DELIVERY.md) and integration-tested (`apps/geo` live loaders via published routes). Snapshots remain an **explicit** offline/build-time mode (`AURII_DELIVERY_MODE=snapshot`). Module datasets in `apps/geo` still use snapshots in this beta.
- In-memory joins are **not** suitable for millions of rows.
- Platform ops (DataSource / schedule / published routes) persist in SQLite when `AURII_DB_PATH` is a file; HA multi-node scheduling remains out of beta.
- Resumability for huge imports and distributed job queues remain out of beta guarantees.
- Product composition via `product.yaml` remains a **convention** alongside `aurii.config.ts`; no large “Product Runtime.”
- Project tokens + AuthScopes are enforced on platform routes when `AURII_API_TOKEN` is set (global token = `project:admin`); finer multi-org RBAC is later.
- No Editorial reference vertical (by design for this phase).

---

## Non-goals

Phase 4 does **not** deliver:

- a complete news CMS (Studio is not a CMS synonym)
- turning Studio into an editorial authoring editor
- LiveCenter
- realtime collaborative editing
- full asset / media management
- complex editorial workflow or approvals
- NewsML-G2 or InDesign/InCopy delivery
- AI automation as a production feature
- RBAC beyond the existing bearer token model (may document needs; not a Phase 4 exit requirement)
- schema-generated **publication** authoring as a CMS (generated **data** forms are allowed as Studio default UI)
- a full Plugin Runtime / marketplace (beta uses a simple Studio view registry; ADR-0020 is the planned contract)
- implementing Kampbart, playground Map, Gaselle, `packages/sources`, or `apps/worker`
- locking `defineSource` or Studio plugin component APIs
- a large new “product runtime” abstraction without an approved ADR **and** concrete use in Norwegian Geo
- distributed HA job queues / exactly-once schedulers

These belong to later phases built on a proven data-product foundation.

---

## Workstreams (ordered)

Workstreams may overlap in engineering time, but dependencies run roughly A → B/C in parallel, then D, with E as boundary definition throughout.

### A. Product composition and manifest

**Goal:** Formalize the useful generic parts of Norwegian Geo’s `product.yaml` convention.

**Plan:**

1. Document the composition model (already started in `docs/PRODUCT_MODEL.md`): schemas, imports, modules, dependencies, import ordering, consumers.
2. Inventory what `product.yaml` / `module.yaml` / `lib/manifest.ts` already enforce vs document-only fields.
3. Decide, with an ADR if Core/SDK code changes are proposed:
   - what remains documentation/convention;
   - what becomes SDK helpers (load manifest, ordered import);
   - what, if anything, becomes a Core API.
4. Exercise every change against Norwegian Geo—no abstract product engine without a consumer.
5. Project Core type is now established ([ADR-0011](adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md), [`docs/PROJECTS.md`](docs/PROJECTS.md)). Phase 4 should attach product/dataset composition to projects rather than inventing a parallel tenancy model.

**Exit contribution:** One data product (Norwegian Geo) is described through the agreed composition model with unambiguous module dependency order.

---

### B. Import as a first-class product surface

**Goal:** Evolve Studio’s project workspace and Core import APIs so operating a data product does not require product-specific UI forks.

#### Already exists / beta

- Declarative import YAML (CLI + API)
- Analyze upload, mapping, transforms, dry run, persist
- Import history listing (`GET /imports`)
- Reference validation modes (`strict` / `warning` / `skip`)
- Studio Import Wizard
- **Beta:** DataSource registry, saved import/sync definitions, minimal cron scheduling, project package wiring ([ADR-0014](adr/ADR-0014%20—%20Project%20Configuration%20Package.md)–[ADR-0018](adr/ADR-0018%20—%20Minimal%20Scheduling.md))

#### Phase 4 proposes (prioritized)

| Priority | Item | Notes |
|----------|------|-------|
| P0 | Clear Studio surfacing of sources, saved definitions, dry-run vs commit, and run results (inserted/updated/skipped/errors) | Build on wizard + history + DataSource beta |
| P0 | Documented dependency ordering for multi-schema imports | Norwegian Geo already requires order |
| P0 | Project-oriented Studio operable via `aurii.config.ts` + env (local / `studio:build`) | Beta hardening, not a CMS |
| P0 | Architecture: provenance/override concepts and Studio extension trajectory documented | ADR-0019, ADR-0020, fitness tests — **design**, not feature build |
| P1 | Provenance / source metadata on entities (start small; prefer Core metadata over product JSON) | [ADR-0019](adr/ADR-0019%20—%20Provenance%20and%20Editorial%20Overrides.md); NG `standardFields` only as a temporary convention |
| P1 | Retry and clearer failure reporting for partial runs | Measure before inventing job queues |
| P1 | Published routes operable from Studio (enable/disable, inspect) | Complements workstream C |
| P1 | Generated record forms as default entity editor (schema-driven, not CMS) | Optional in Phase 4; must not be classified as Editorial |
| P2 | Resumability for large imports | Design with tax-list scale in mind |
| P2 | Richer HTTP connectors / `packages/sources` adapters | Design only unless assigned; HA scheduler remains non-goal |
| P2 | Reverse references / query-through-relation improvements | Evolution of Phase 3; not a new engine |

**Exit contribution:** Studio can operate the Norwegian Geo data product (sources, imports, schedules, schemas, browse, query, published routes) via generic UI + project config—without a product-specific Studio fork and without a CMS.

---

### C. Delivery contract

**Goal:** Define and validate the production path:

```text
Import → Core storage → Query/API → @aurii/sdk → real frontend
```

**Plan:**

1. Document the delivery contract: stable API/SDK boundaries, pagination, public vs authenticated delivery, OpenAPI and query examples, frontend independence from Studio.
2. Prove the path with Norwegian Geo:
   - Prefer a consumer path that uses `@aurii/sdk` (or equivalent HTTP) against a running Core.
   - Keep direct snapshot consumption as an **explicit** offline or build-time mode—not the only integration pattern.
3. Add integration tests that fail if the live delivery path regresses.
4. Optional: cache/revalidation hooks or domain events that frontends can use (`entity.*`, `import.*` exist internally; expose or document what consumers may rely on).
5. Ensure `apps/geo` (or a thin sibling route/mode) demonstrates live delivery without depending on Studio.

**Exit contribution:** Complete import-to-Core-to-SDK-to-frontend path exercised end to end; delivery contract documented and integration-tested.

---

### D. Query and scale improvements

**Goal:** Treat large datasets honestly. Use a tax-list or similarly large dataset as the future stress case.

**Candidates to improve (informed by Phase 3 limitations):**

- SQL pushdown for joins and aggregates where storage allows
- Indexed natural-key / reference lookup (especially import validation)
- Cursor-based pagination where offset pagination fails at scale
- Grouping and additional aggregates
- Filtering and sorting pushed to storage
- Exports and visualization-oriented queries
- Benchmarks and acceptance criteria with published numbers

**Honesty rule:** Do not claim the current in-memory join strategy is suitable for millions of rows. Phase 4 may ship incremental pushdown and still exit with explicit remaining bottlenecks.

**Exit contribution:** Scale limitations measured; next bottlenecks explicit in docs/tests. Norwegian Geo remains correct; large-dataset criteria defined even if full tax-list product is only partially imported.

---

### E. Reference verticals (boundary, not build)

**Goal:** Establish a two-track validation strategy without faking Editorial.

| Track | Role | Phase 4 action |
|-------|------|----------------|
| **Norwegian Geo** | Canonical import / data / delivery vertical | Extend and prove delivery |
| **Editorial** | Canonical authoring / publishing vertical (later) | Define boundary and prerequisites only — roadmap: [`Phase5.md`](Phase5.md) (**planned / post–Phase 4**, not implemented here) |
| **Architecture fitness tests** | Kampbart, playgrounds, Gaselle, Geo as design tests | Keep the plan honest — [`docs/ARCHITECTURE_FITNESS.md`](docs/ARCHITECTURE_FITNESS.md). Do not implement those products in Phase 4 |

**Prerequisites before an Editorial phase should start:**

- Phase 4 exit criteria met (or consciously waived with rationale)
- ADR-0010 still in force
- Editorial concepts expressed as schemas/capabilities proposals—not Core newsroom builtins
- No requirement that Norwegian Geo grow draft/publish fields “just to have somewhere to test”
- Architecture still answers the four fitness questions in [`docs/ARCHITECTURE_FITNESS.md`](docs/ARCHITECTURE_FITNESS.md)

**Exit contribution:** Written boundary in `AGENTS.md` / this document; no Editorial implementation in Phase 4. Domain-specific **Studio extensions** (match desk, Map) remain non-goals to *build* here; their contract is documented.

---

## Exit criteria

Phase 4 is complete when all of the following are true:

1. **Composition:** One data product is described through the agreed product composition model.
2. **Delivery path:** Import → Core → Query/API → SDK → frontend is exercised end to end (live Core, not only snapshots).
3. **Studio:** The data product can be operated via generic Studio + project config (`defineStudio` / `aurii.config.ts`) without forking the Studio app and without a CMS.
4. **Modules:** Product modules and dependency/import order are unambiguous and documented.
5. **Contract:** Delivery contract is documented and covered by integration tests.
6. **Scale:** Limitations are measured honestly; next bottlenecks are explicit.
7. **No CMS required:** The data product functions with zero authoring/CMS client.
8. **Architecture honesty:** Docs/ADRs state that relations, sources, provenance/overrides, and Studio extensibility are foundations; fitness tests exist; no competing parallel plan.

---

## Suggested follow-up issue split

**Current next-step plan (post–project Studio beta):** [`docs/NEXT_AFTER_STUDIO_BETA.md`](docs/NEXT_AFTER_STUDIO_BETA.md).

That document assumes [PR #52](https://github.com/aprestmo/aurii/pull/52) (persistence, package-driven Studio, register-via-api, AuthScopes) as baseline and sequences:

1. Live delivery contract + `apps/geo` integration proof (N1)
2. Studio ops polish — groups, provenance, run errors (N2)
3. Package/composition alignment + shared register helper (N3)
4. Scale measurements / pushdown spike (N4)
5. Optional hardening — Postgres platform store, scheduler e2e (N5)

Older split (still valid themes, superseded in order by the doc above):

1. Product manifest convention + docs/SDK helpers (A)
2. Studio import operations polish + provenance fields (B)
3. Live SDK delivery mode for Norwegian Geo / `apps/geo` (C)
4. Delivery contract doc + integration tests (C)
5. SQL join/aggregate pushdown spike + benchmarks (D)
6. Reference index / lookup performance for imports (D)
7. Pagination strategy for large result sets (D)

Authoring, newsroom, and LiveCenter issues wait until Phase 4 exits. The post–Phase 4 Editorial + Context hypothesis is captured in [`Phase5.md`](Phase5.md) (planning only).

---

## Relationship to Phase 3 recommendations

Phase 3’s “Recommended Phase 4 scope” listed SQL pushdown, reference indexes, dot-notation, GROUP BY, schema-generated forms, and enum types. Phase 4 **absorbs** the data/delivery and scale items. Schema-generated **publication** forms remain out of scope as a CMS (ADR-0010). Schema-generated **default record UI** is allowed as Studio evolution (ADR-0020) and is not a Phase 4 exit gate. Read-only relation display and query playground already shipped. Enum may land if it unblocks data products.

---

## Documentation updates expected during Phase 4 implementation

- Keep `docs/PRODUCT_MODEL.md`, `docs/Studio.md`, `docs/PROJECT_PACKAGES.md`, `docs/ARCHITECTURE_FITNESS.md`, and this file’s “baseline / non-goals / exit criteria” in sync with reality.
- Delivery contract: [`docs/DELIVERY.md`](docs/DELIVERY.md) (N1).
- Post–Phase 4 Editorial + Context: [`Phase5.md`](Phase5.md) (planned only — do not implement in Phase 4).
- Update README status when Phase 4 completes.
- Do not rewrite Phase 1–3 historical reports; add status notes if needed.

---

## Success question

> Can a new contributor ship a data product on Aurii—declare a project package, import it, operate it in project-oriented Studio, and consume it from an independent frontend via the SDK or published routes—without building or deploying a CMS?

If yes, Phase 4 succeeded.
