# Delivery contract

> How independent frontends consume Aurii Core.
>
> **Status:** beta (Phase 4 N1). This document describes the **implemented** contract, not planned capabilities.
>
> Related: [ADR-0016](../adr/ADR-0016%20—%20Published%20Routes.md), [`API.md`](API.md), [`PROJECT_PACKAGES.md`](PROJECT_PACKAGES.md), [`Phase4.md`](../Phase4.md).

---

## Supported production path

```text
Import
  ↓
Aurii Core
  ↓
published route / Query API / @aurii/sdk
  ↓
independent frontend
```

`apps/geo` is the reference consumer. **Studio is not required** for frontend delivery and must not sit on this path.

---

## Two consumer modes

| Mode | When | What it does |
|------|------|----------------|
| **Live** | `AURII_CORE_URL` (or `PUBLIC_AURII_CORE_URL`) is set, unless mode is forced to snapshot | Reads Core published routes via `@aurii/sdk`. **Does not** fall back to snapshot files. |
| **Snapshot** | No Core URL, or `AURII_DELIVERY_MODE=snapshot` | Reads committed JSON under `demo/norwegian-geo/**/data/`. Offline / GitHub Pages / build-time fallback. |

Live is the **normal production integration contract**. Snapshot is an **explicit** fallback for environments that cannot reach Core.

Force live (fails if Core URL is missing):

```bash
AURII_DELIVERY_MODE=live
AURII_CORE_URL=http://localhost:3000
```

Force snapshot even if a Core URL is present (useful for static builds):

```bash
AURII_DELIVERY_MODE=snapshot
```

---

## Authenticated Core reads vs public published routes

### Authenticated Query / entity / SDK reads

These Core HTTP surfaces are the general platform API. When `AURII_API_TOKEN` is set on the API process, they require a bearer token (global token or a project token with sufficient scopes).

| Surface | Typical use |
|---------|-------------|
| `GET /query?q=…&dataset=…` | Ad-hoc Query Language (`client.query.run`) |
| `GET /entities?schema=…` | Paginated entity lists (`client.entities.list`) |
| `GET /schemas`, `/stats`, `/imports`, `/api/projects/…` | Studio, ops, and authenticated clients |

This is the right path when the consumer can hold a credential (Studio, CLI, private apps). It is **not** the public website contract.

### Public published routes

Stable, versioned, declarative endpoints. No Query Language required of the frontend.

```text
GET /public/:projectSlug/v1/:path
```

Example (Norwegian Geo):

```text
GET /public/norge-data/v1/counties
GET /public/norge-data/v1/municipalities
GET /public/norge-data/v1/postal-codes
GET /public/norge-data/v1/municipalities/:id
```

- **No Studio.** The API process serves these routes.
- **Access** is stored in Core: `public` | `authenticated` | `private`.
- Public routes do not require a token. Authenticated/private routes require a bearer token and otherwise return `401`.
- Disabled or unknown routes return `404`.
- Response shape: `{ "data": [ … ], "meta": { "routeId": "…" } }`.

SDK:

```ts
import { createClient } from "@aurii/sdk";

const client = createClient({ baseUrl: "http://localhost:3000" });
const counties = await client.published.get("norge-data", "/counties");
// counties.data — array of selected fields
```

`apps/geo` uses this SDK method in live mode. It does not duplicate ad-hoc query parsing.

---

## How published routes are versioned and enabled

1. **Definition** lives in the project package (`defineRoute` files listed from `aurii.config.ts`): path, method (`GET` only), declarative query (`schema`, `select`, `filter`, `orderBy`, `limit`), defaults.
2. **Register** the definition into Core (`POST /api/projects/:id/routes` or `bun run register:norwegian-geo-platform`).
3. **State** lives in Core: `enabled`, `access`, `cacheTtl`, `version`, bound to the Project + dataset.
4. **Enable** (`PATCH …/routes/:routeId` with `{ "enabled": true }`, or upsert with `enabled: true`). Enabling validates that the target schema exists in the dataset.
5. **URL prefix** is currently always `/public/:projectSlug/v1/…` (ADR-0016). The definition’s `version` field (typically `"1"`) is stored on the route state; it is not a second URL namespace in this beta.

Norwegian Geo routes default to `enabled: false`. Registering the package does not by itself publish data; an operator (Studio or API) must enable the route.

---

## Pagination — current behavior and limits

| Surface | Pagination today | Limit |
|---------|------------------|--------|
| `GET /entities` | Offset (`limit`, `offset`) | Client-chosen; SDK default `limit=50` |
| Query Language | `limit` / `offset` in the query | As written |
| Published routes | **Single `limit` on the declarative query** | Default **1000** if omitted; Norwegian Geo postal-codes route sets `10000` to cover ~5,122 rows |

**Not implemented on published routes:** cursor/keyset pagination, `?page=` / `?cursor=` query parameters, or automatic continuation.

Offset pagination and in-memory joins are **not** a scale contract for millions of rows. That is Phase 4 N4, not this delivery slice.

---

## Frontend independence from Studio

- Consumers talk to Core (published routes, Query API, or SDK).
- `apps/geo` must not depend on `@aurii/studio` or `@aurii/studio-app`.
- Studio may **operate** published routes (enable/disable, inspect). It is never a read proxy.
- A future Editorial/CMS client is also not a read proxy ([ADR-0010](../adr/ADR-0010%20—%20Optional%20Authoring%20Layer.md)).

---

## Live vs snapshot vs build-time

| | Live | Snapshot / offline / build-time |
|--|------|----------------------------------|
| Source of truth | Entities in Core | Committed JSON snapshots (the same files the import engine reads) |
| Requires running API | Yes | No |
| Requires Studio | No | No |
| Failure behavior | **Fail closed** (error). No silent snapshot fallback | Read files |
| Typical use | Production / local Core-backed site | GitHub Pages, air-gapped builds, tests of static pages |

Module datasets in `apps/geo` (schools, kindergartens, hospitals, holidays) still use snapshots in this beta; only the Norwegian Geo **core** schemas (counties, municipalities, postal codes) are on published routes.

---

## Stable contract vs current beta behavior

**Treat as the contract (keep compatible):**

- URL shape `/public/:projectSlug/v1/…`
- `{ data, meta? }` envelope
- Disabled → 404; private/authenticated without token → 401
- `defineRoute` declarative query (no arbitrary JavaScript)
- SDK `createClient().published.get(slug, path)`
- Frontends never depend on Studio

**Beta / may change (do not freeze blindly):**

- Default published-route `limit` of 1000
- No cursor pagination on published routes
- Cache is `Cache-Control: public, max-age=<cacheTtl>` only (no purge API)
- Hit counters / lastError are operational, not a client contract
- `v1` is the only public URL version
- Select lists are per-route; consumers must not assume every schema field is published
- Platform route state persistence (SQLite file vs memory) is an ops concern

**Out of this contract (do not document as available):**

- GraphQL gateway
- Realtime invalidation for frontends
- Preview of unpublished/draft entities
- Editorial/CMS delivery
- Mutating published routes from the public URL

---

## Reference: run the Norwegian Geo consumer

See [`apps/geo/README.md`](../apps/geo/README.md) for commands.

```bash
# 1. Import entities into Core
bun run import:norwegian-geo

# 2. Serve Core
bun run serve

# 3. Register package resources (sources, saved imports, routes)
AURII_CORE_URL=http://localhost:3000 bun run register:norwegian-geo-platform

# 4. Enable routes in Studio, or PATCH /api/projects/:id/routes/:routeId
#    { "enabled": true }

# 5. Live geo site
cd apps/geo
AURII_CORE_URL=http://localhost:3000 \
AURII_PROJECT_SLUG=norge-data \
bun run dev
```

Snapshot / offline (default when Core URL is unset):

```bash
cd apps/geo
bun run dev
# or: AURII_DELIVERY_MODE=snapshot bun run build
```
