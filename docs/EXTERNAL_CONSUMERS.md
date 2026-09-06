# External consumers

> How an Aurii-based product is expected to live **outside** the Aurii monorepo.
>
> Phase 4 proved Norwegian Geo **inside** the monorepo. Extracting it tests whether the same product can consume Aurii only through supported package and HTTP contracts.

Related: [`PACKAGES.md`](PACKAGES.md), [`PROJECT_PACKAGES.md`](PROJECT_PACKAGES.md), [`DELIVERY.md`](DELIVERY.md), [`PLATFORM_VALIDATION.md`](PLATFORM_VALIDATION.md), [`NORWEGIAN_GEO.md`](NORWEGIAN_GEO.md).

---

## Why this exists

Norwegian Geo currently still lives in this repository (`demo/norwegian-geo`, `apps/geo`). That was correct for Phase 4. It is the wrong long-term shape for a platform:

- Aurii CI was building a product, not only the runtime
- product scripts and datasets sat next to Core
- `workspace:*` hid whether packages were actually installable

The extraction (target: [`aprestmo/norwegian-geo`](https://github.com/aprestmo/norwegian-geo)) is a **platform-boundary validation**, not repository housekeeping.

```text
Phase 4 proved the product inside the monorepo.
The external-repository extraction tests whether the same product can
consume Aurii solely through supported package/API boundaries.
```

Until that repository is the system of record for the product, this monorepo keeps the Geo tree so the product exists somewhere. Aurii CI no longer builds or deploys it as a platform job.

---

## Required architecture

```text
Norwegian Geo (or any later product)
     │
     ├── versioned Aurii packages
     │
     └── Aurii HTTP/API contracts
             │
             ▼
         Aurii Runtime
```

Forbidden in the committed product:

- `workspace:*`
- relative paths into a sibling Aurii checkout
- `bun link` / `npm link`
- copying Aurii source into the product
- importing `@aurii/core` or `@aurii/db` from the browser/product application
- requiring both repositories to be checked out beside each other for normal development or CI

Project-package files (`aurii.config.ts`, `defineRoute`, `defineStudio`) may depend on `@aurii/core` and `@aurii/studio`. That is the supported external project-package model. The **web frontend** must stay on `@aurii/sdk` → HTTP.

---

## In-repo stand-in

`tests/fixtures/external-product/` is a tiny City / Region catalog.

It is **not** a second reference product. It exists so Aurii retains the generic path Geo originally helped prove:

```text
define/register schema
        ↓
write/import entities
        ↓
enable delivery/public route
        ↓
consume via SDK/API
        ↓
receive expected result
```

See `packages/core/src/__tests__/external-product-contract.test.ts`, `apps/api/src/__tests__/external-product-contract.test.ts`, `packages/sdk/src/__tests__/external-product-contract.test.ts`, and `tests/architecture/product-boundary.test.ts`.

Pack/install independence: `tests/pack/pack-public-packages.test.ts` and [`PACKAGES.md`](PACKAGES.md).

---

## Extraction inventory (Phase 0)

Classification used for the move. Do not delete historical ADRs.

| Reference | Classification |
|-----------|----------------|
| `apps/geo/` | Move to `norwegian-geo` |
| `demo/norwegian-geo/` | Move to `norwegian-geo` |
| `@aurii/geo` / `@aurii/norwegian-geo` workspace packages | Move; delete from Aurii workspaces |
| Root Geo scripts (`fetch:norwegian-geo`, `import:norwegian-geo`, …) | Move |
| Root `@turf/*`, `fflate` (Geo-only) | Move with Geo; delete from Aurii if unused |
| `.github/workflows/ci.yml` `geo` job | Delete from Aurii (done) |
| `.github/workflows/deploy-geo.yml` | Move after the new repo deploy is reproducible |
| Core/SDK/API tests that import `demo/norwegian-geo` | Replace with this fixture; keep Geo-specific tests only in the product repo |
| `packages/core/scripts/*norwegian-geo*` | Delete after extraction (deprecated wrappers) |
| `apps/studio` hardcoded `norge-data` fallback | Replace with generic fallback; product config stays in the package |
| `docs/NORWEGIAN_GEO.md`, `REFERENCE_DEMO.md`, live paths in README | Update to the external repository |
| Phase 2 / 2.2 / 4 history, ADRs that mention Geo paths | Retain as historical |
| `packages/core/examples/schemas/{county,municipality,postal-code}.yaml` | Retain as generic examples or replace later; not product data |

---

## What must remain in Aurii after extraction

- Core, SDK, Studio, API, types, validation, db
- Generic contract fixture and pack tests
- Product-boundary architecture tests
- Documentation that Norwegian Geo is the first **external** reference product

Aurii must not keep Norwegian geography data merely so CI has something to import.
