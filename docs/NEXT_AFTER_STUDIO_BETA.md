# Next: After project-oriented Studio beta (#52)

> Planning document for work **after** [PR #52](https://github.com/aprestmo/aurii/pull/52) (and the #51 scaffold it hardens).
>
> Baseline: project packages, DataSources, schedules, published routes, scoped platform APIs, and package-driven Studio are **in tree**.
>
> Parent roadmap: [`Phase4.md`](../Phase4.md). Product vocabulary: [`docs/PRODUCT_MODEL.md`](PRODUCT_MODEL.md). Delivery contract: [`DELIVERY.md`](DELIVERY.md). Post–Phase 4 Editorial + Context (planning only): [`Phase5.md`](../Phase5.md).

---

## Baseline (do not rebuild)

Treat the following as **done foundation**. Next agents extend these surfaces; they do not invent parallel systems.

| Capability | Where | Notes |
|------------|-------|--------|
| Project package (`defineProject`) | `packages/core` + `demo/norwegian-geo/aurii.config.ts` | ADR-0014 |
| Studio config (`defineStudio`) | `packages/studio` + package `studio/`; Studio loads via `AURII_PROJECT_ROOT` | ADR-0017 |
| DataSource + saved imports/sync | Core platform services + Studio Sources/Imports | ADR-0015 |
| Cron scheduling (single-process) | Core scheduler; Studio enable/disable; audited | ADR-0018 |
| Published routes | `defineRoute` + `/public/:slug/v1/...` + Studio enable/disable | ADR-0016 |
| Durable platform store (SQLite file) | `SqlitePlatformStore` when `AURII_DB_PATH` is a file | Secrets stay server-side |
| Package → Core register | `register-via-api.ts` / `bun run register:norwegian-geo-platform` | After `import:norwegian-geo` + `serve` |
| AuthScopes (beta) | Platform routes; global token = `project:admin` | Not full RBAC |
| Geo consumer independence | `apps/geo` never imports Studio; live published routes when `AURII_CORE_URL` set | Snapshots = explicit offline fallback (`AURII_DELIVERY_MODE=snapshot`); live never falls back silently |

**Demo path (already documented):**

```bash
bun run import:norwegian-geo
bun run serve
bun run register:norwegian-geo-platform
AURII_PROJECT_ROOT=demo/norwegian-geo \
AURII_PROJECT_SLUG=norge-data \
AURII_DEFAULT_DATASET=norwegian-geo \
bun run studio
```

---

## Goal of the next slice

Finish Phase 4 **exit criteria** that #52 did not fully close:

1. **Live delivery contract** — `apps/geo` (or equivalent) proven against a running Core with integration tests, not only optional env fallback.
2. **Operable Studio polish** — provenance, clearer run/error UX, config groups actually used in UI.
3. **Honest composition** — clarify `aurii.config.ts` vs `product.yaml` for modules; expand package surface only where Studio/ops need it.
4. **Scale honesty** — measure join/pagination limits; define next bottlenecks without claiming HA or tax-list scale.

Non-goals remain unchanged: CMS, Editorial, LiveCenter, distributed scheduler, marketplace plugins. Editorial + Context is planned after Phase 4 — [`Phase5.md`](../Phase5.md) — and must not be implemented in N1–N5.

---

## Workstreams (ordered)

Dependencies: **N1 → N2** in parallel with **N3**; then **N4**; **N5** continuous.

### N1 — Live delivery proof (Phase 4 workstream C)

**Goal:** Import → Core → published route / SDK → `apps/geo` is the default demonstrated path when Core is up.

**Contract:** [`docs/DELIVERY.md`](DELIVERY.md).

| Step | Deliverable |
|------|-------------|
| N1.1 | Document delivery contract (`docs/DELIVERY.md`): public vs authenticated routes, pagination, snapshot vs live modes |
| N1.2 | Prefer `@aurii/sdk` in `apps/geo` for live reads; keep snapshots explicitly as offline/build mode |
| N1.3 | Integration test: start Core (or use `buildApiApp`), register NG package resources, enable routes, assert `apps/geo` data loaders return live counties/municipalities/postal-codes |
| N1.4 | README / `apps/geo` README: live mode is first-class; snapshot is fallback |

**Exit:** Phase 4 exit criterion “delivery path” and “contract + integration tests” can be checked off for core geo schemas.

**Depends on:** #52 merged (platform register + published routes + sqlite persistence).

Editorial/CMS remains **out of scope** for N1. See [`Phase5.md`](../Phase5.md) (planned only).

---

### N2 — Studio ops polish (Phase 4 workstream B remainder)

**Goal:** Generic Studio + project config fully operate Norwegian Geo without product forks.

| Step | Deliverable |
|------|-------------|
| N2.1 | Use `importGroups` / `routeGroups` / featured columns from loaded `defineStudio` in Imports and Routes pages |
| N2.2 | Source detail: last success/failure, linked definitions, next run, last error (no secrets) |
| N2.3 | Import run detail drawer or expandable row (full `errors[]`, trigger, counts) |
| N2.4 | System page: project slug, dataset, Core URL, scheduler enabled?, platform store mode |
| N2.5 | Optional: token list / create (admin only) + audit tail in Studio — thin UI over existing APIs |

**Exit:** Studio can operate sources → run import → see errors → toggle schedule → enable route without CLI except first register.

**Depends on:** #52 Studio package load + imports schedule UX.

---

### N3 — Package / composition alignment (Phase 4 workstream A remnant)

**Goal:** No second Product Runtime; make the two-file story operable.

| Step | Deliverable |
|------|-------------|
| N3.1 | Document when a schema belongs in `aurii.config.ts` vs only in `product.yaml` modules |
| N3.2 | Decide whether education/health/calendar modules get Studio collections via package config (ops) or stay CLI-only — pick one and implement consistently for NG |
| N3.3 | SDK helper: `loadProjectPackage` + thin `registerProjectPackage({ coreUrl, token })` shared by CLI scripts (replace duplicated register logic) |
| N3.4 | ADR only if Core must learn “product” as a runtime object (default: **no**) |

**Exit:** Contributor can add a module and know which files to touch; register helper is one code path.

**Depends on:** #52 `register-via-api.ts` as reference implementation.

---

### N4 — Scale and query honesty (Phase 4 workstream D)

**Goal:** Measure, don’t pretend.

| Step | Deliverable |
|------|-------------|
| N4.1 | Benchmark Norwegian Geo join/query sizes; record numbers in docs |
| N4.2 | Spike: SQL pushdown for one join or filter path |
| N4.3 | Cursor pagination design for large lists (postal codes / future tax list) |
| N4.4 | Explicit “not ready for N rows” statement updated with measured N |

**Exit:** Phase 4 scale exit criterion satisfied with numbers and named bottlenecks.

**Depends on:** stable delivery path (N1) so benchmarks use real API surfaces.

---

### N5 — Hardening / beta polish (cross-cutting)

Do as follow-ups when touching related code; do not block N1–N3.

| Item | Notes |
|------|--------|
| Postgres-backed `PlatformStore` | Mirror sqlite tables when `DATABASE_URL` is primary ops DB |
| Scheduler tick e2e | Enabled schedule actually fires import once (time-controlled test) |
| Published route hitCount / lastError in Studio | If cheap against existing state |
| Production write policy UX | Surface read-only production dataset restrictions already in Core |
| Secret vault UX | Set secret by id server-side only; never echo values |

---

## Suggested PR / issue split

Small, reviewable PRs branching from **main after #52 merges**:

1. **`docs/DELIVERY.md` + geo live README** (N1.1, N1.4) — docs-first
2. **`apps/geo` SDK/live loaders + integration test** (N1.2, N1.3)
3. **Studio: config groups + source/import detail UX** (N2.1–N2.3)
4. **`registerProjectPackage` helper + script thin wrapper** (N3.3)
5. **Module surface decision for NG Studio** (N3.1–N3.2)
6. **Benchmarks + scale note** (N4.1, N4.4)
7. Optional later: Postgres platform store, scheduler e2e, tokens UI (N5)

Each PR must:

- Reuse Core/SDK/import/query engines (no parallel systems)
- Keep Norwegian Geo as the validation vertical
- Update docs in the same PR
- Keep CMS/Editorial out of scope

---

## Acceptance checklist for “Phase 4 complete enough”

Use this after N1–N4 land (N5 can trail):

- [ ] #52 merged; demo path above works on a clean clone
- [ ] Live delivery contract documented and integration-tested ([`DELIVERY.md`](DELIVERY.md), `live-geo-delivery.test.ts`)
- [ ] `apps/geo` demonstrates Core/published-route consumption without Studio
- [ ] Studio operates NG sources/imports/schedules/routes using package `defineStudio`
- [ ] Composition story (`aurii.config` vs `product.yaml`) documented; register helper shared
- [ ] Scale limits measured and written down
- [ ] Docs still say: CMS is a future separate product; Studio is a data workspace

---

## Agent instructions (next run)

1. Assume branch/`main` includes #52 (or rebase onto it).
2. Start with **N1** unless the user names another workstream.
3. Read this file + `Phase4.md` + `docs/PRODUCT_MODEL.md` before coding.
4. Do not re-scaffold `defineProject` / platform store / ADRs 0014–0018.
5. Prefer extending `register-via-api.ts`, Studio pages, and `apps/geo` live loaders.
6. Stop and document if a step would require a new Core abstraction — ADR first.

---

## Success question

> After the next slice, can a contributor import Norwegian Geo, register the package, enable a published route, run Studio from the package config, and load the same data in `apps/geo` from Core—with tests proving the live path—without any CMS?

If yes, Phase 4’s project-oriented beta is ready to exit into scale/polish and later Editorial planning.
