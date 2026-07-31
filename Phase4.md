# Phase 4 — Data Products and Delivery

> Planning document for the next implementation phase.
>
> Phase 3 completed the relational Core. Phase 4 completes the **data-product path** before the repository attempts a full newsroom, LiveCenter, or authoring CMS.
>
> Product vocabulary: [`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md).  
> Optional authoring decision: [`adr/ADR-0010 — Optional Authoring Layer.md`](adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md).

---

## Objective

Prove that Aurii can ship coherent **data products**: composed schemas and modules, operable imports, and a documented production delivery path from Core through the SDK to an independent frontend—without requiring any CMS or authoring client.

```text
Import → Core storage → Query / API → @aurii/sdk → real frontend
```

Norwegian Geo remains the canonical vertical for this proof. Scale stress uses a tax-list-sized (or similarly large) dataset as a future benchmark target—not as a claim that such scale already works.

---

## Why Phase 4 comes before authoring

| Already true after Phase 3 | Still missing for a product platform |
|----------------------------|--------------------------------------|
| Import → validate → persist → query | Formal product composition beyond Norwegian Geo convention |
| References, joins, Studio query playground | Import as an operable first-class product surface (history, retry, provenance UX) |
| SDK + HTTP API | End-to-end **live** delivery to a real frontend (not only snapshots / admin UI) |
| Norwegian Geo as reference data product | Honest scale limits and next bottlenecks measured |

Building CMS, drafts, LiveCenter, or NewsML delivery on top of an incomplete delivery contract would invert the dependency order. Phase 4 finishes the data foundation; later phases add authoring and newsroom compositions.

---

## Current baseline (implemented)

Do not re-implement these; build on them.

| Area | What exists |
|------|-------------|
| Core | Schemas, entities, datasets, import engine, pipelines, Query Language v1 (joins, count), planner, HTTP API, OpenAPI/Swagger |
| Storage | SQLite + PostgreSQL adapters; in-memory joins (correct at Norwegian Geo scale) |
| SDK | Typed client for datasets, schemas, entities, query, import, stats |
| Studio | Dashboard, import wizard, entity browser, schemas, query playground, dataset switcher |
| Norwegian Geo | `product.yaml`, core + modules, import scripts, tests, `apps/geo` consumer |
| ADR-0009 / ADR-0010 | Relational planner; optional authoring clients |

### Known gaps Phase 4 must treat honestly

- `apps/geo` primarily reads **committed snapshots**, not live Core via SDK.
- In-memory joins are **not** suitable for millions of rows.
- Import UX lacks first-class source registry, resumability, rich provenance, scheduled HTTP connectors.
- Product composition is a **Norwegian Geo convention**, not a generic Core/SDK capability yet.
- No Editorial reference vertical (by design for this phase).

---

## Non-goals

Phase 4 does **not** deliver:

- a complete news CMS
- LiveCenter
- realtime collaborative editing
- full asset / media management
- complex editorial workflow or approvals
- NewsML-G2 or InDesign/InCopy delivery
- AI automation as a production feature
- RBAC beyond the existing bearer token model (may document needs; not a Phase 4 exit requirement)
- schema-generated rich authoring forms as a CMS
- a large new “product runtime” abstraction without an approved ADR **and** concrete use in Norwegian Geo

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

**Goal:** Evolve Studio’s data workspace and Core import APIs so operating a data product does not require product-specific UI.

#### Already exists

- Declarative import YAML (CLI + API)
- Analyze upload, mapping, transforms, dry run, persist
- Import history listing (`GET /imports`)
- Reference validation modes (`strict` / `warning` / `skip`)
- Studio Import Wizard

#### Phase 4 proposes (prioritized)

| Priority | Item | Notes |
|----------|------|-------|
| P0 | Clear Studio surfacing of sources, saved definitions, dry-run vs commit, and run results (inserted/updated/skipped/errors) | Build on existing wizard + history |
| P0 | Documented dependency ordering for multi-schema imports | Norwegian Geo already requires order |
| P1 | Provenance / source metadata conventions on entities | Align with Norwegian Geo `standardFields` in `product.yaml` |
| P1 | Retry and clearer failure reporting for partial runs | Measure before inventing job queues |
| P2 | Resumability for large imports | Design with tax-list scale in mind |
| P2 | HTTP/API connectors and scheduled imports | Explicitly deferred from “must ship in Phase 4” if P0/P1 incomplete; may land as stretch |

**Exit contribution:** Studio can operate the Norwegian Geo data product (inspect schemas, run/re-run imports, browse, query) without product-specific Studio code.

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
| **Editorial** | Canonical authoring / publishing vertical (later) | Define boundary and prerequisites only |

**Prerequisites before an Editorial phase should start:**

- Phase 4 exit criteria met (or consciously waived with rationale)
- ADR-0010 still in force
- Editorial concepts expressed as schemas/capabilities proposals—not Core newsroom builtins
- No requirement that Norwegian Geo grow draft/publish fields “just to have somewhere to test”

**Exit contribution:** Written boundary in `AGENTS.md` / this document; no Editorial implementation in Phase 4.

---

## Exit criteria

Phase 4 is complete when all of the following are true:

1. **Composition:** One data product is described through the agreed product composition model.
2. **Delivery path:** Import → Core → Query/API → SDK → frontend is exercised end to end (live Core, not only snapshots).
3. **Studio:** The data product can be operated without product-specific Studio UI logic.
4. **Modules:** Product modules and dependency/import order are unambiguous and documented.
5. **Contract:** Delivery contract is documented and covered by integration tests.
6. **Scale:** Limitations are measured honestly; next bottlenecks are explicit.
7. **No CMS required:** The data product functions with zero authoring/CMS client.

---

## Suggested follow-up issue split

Derive implementation issues from this plan rather than one mega-PR:

1. Product manifest convention + docs/SDK helpers (A)
2. Studio import operations polish + provenance fields (B)
3. Live SDK delivery mode for Norwegian Geo / `apps/geo` (C)
4. Delivery contract doc + integration tests (C)
5. SQL join/aggregate pushdown spike + benchmarks (D)
6. Reference index / lookup performance for imports (D)
7. Pagination strategy for large result sets (D)

Authoring, newsroom, and LiveCenter issues wait until Phase 4 exits.

---

## Relationship to Phase 3 recommendations

Phase 3’s “Recommended Phase 4 scope” listed SQL pushdown, reference indexes, dot-notation, GROUP BY, schema-generated forms, and enum types. Phase 4 **absorbs** the data/delivery and scale items. Schema-generated **authoring** forms are **out of scope** here (ADR-0010 / non-goals); read-only relation display and query playground already shipped. Enum may land if it unblocks data products; it is not a CMS feature.

---

## Documentation updates expected during Phase 4 implementation

- Keep `docs/PRODUCT_MODEL.md` and this file’s “baseline / non-goals / exit criteria” in sync with reality.
- Update README status when Phase 4 completes.
- Do not rewrite Phase 1–3 historical reports; add status notes if needed.

---

## Success question

> Can a new contributor ship a data product on Aurii—import it, operate it in Studio, and consume it from an independent frontend via the SDK—without building or deploying a CMS?

If yes, Phase 4 succeeded.
