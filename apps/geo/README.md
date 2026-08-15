# Norwegian Geo Website Demo

A public website for the Norwegian Geo **data product**. It proves that Kartverket/Bring (and module) data can power county and municipality pages.

**Not Studio** — this is a separate consumer. Frontends talk to Core published routes or committed snapshots; they never go through Studio or a CMS UI. See [`docs/PRODUCT_MODEL.md`](../../docs/PRODUCT_MODEL.md) and [`docs/DELIVERY.md`](../../docs/DELIVERY.md).

## Routes

| Route | Pages | Data |
|-------|-------|------|
| `/` | 1 | Lists all 15 counties |
| `/fylker/[id]` | 15 | County detail + municipalities (e.g. `/fylker/03` → Oslo) |
| `/kommuner/[id]` | 357 | Municipality detail + postal codes (e.g. `/kommuner/0301` → Oslo) |

**Total: 373 static pages** generated at build time (plus module routes).

County and municipality IDs are numeric (`03`, `0301`) and URL-safe — no slug encoding required.

## Live demo

Hosted on GitHub Pages (see `docs/DEPLOYMENT.md`):

**https://aprestmo.github.io/aurii/**

That deployment uses **snapshot / build-time** mode (no running Core).

## Delivery modes

Live Core-backed mode is the **normal production integration contract**. Snapshot mode is an **explicit** offline / build-time fallback. Live mode never silently reads snapshot files.

| Mode | How to select | Data source |
|------|----------------|-------------|
| **Live** | Set `AURII_CORE_URL` (or `AURII_DELIVERY_MODE=live` + Core URL) | Published routes via `@aurii/sdk` |
| **Snapshot** | Unset Core URL, or `AURII_DELIVERY_MODE=snapshot` | Bundled JSON under `demo/norwegian-geo/**/data/` |

Core schemas on the live path today: **counties**, **municipalities**, **postal codes**. Module datasets (schools, kindergartens, hospitals, holidays) still use snapshots in this beta.

This app has **no dependency on Studio**.

### Live Core-backed mode

```bash
# From repo root — import, serve, register, then enable routes
bun run import:norwegian-geo
bun run serve
AURII_CORE_URL=http://localhost:3000 bun run register:norwegian-geo-platform
# Enable counties / municipalities / postal-codes in Studio, or:
#   PATCH /api/projects/:id/routes/:routeId  { "enabled": true }

cd apps/geo
AURII_CORE_URL=http://localhost:3000 \
AURII_PROJECT_SLUG=norge-data \
bun run dev        # http://localhost:4322
```

`PUBLIC_AURII_CORE_URL` / `PUBLIC_AURII_PROJECT_SLUG` are accepted as aliases for static hosts that only expose `PUBLIC_*` env.

### Snapshot / offline / build-time mode

```bash
cd apps/geo
bun install
bun run dev        # http://localhost:4322 — reads committed snapshots
# or:
AURII_DELIVERY_MODE=snapshot bun run build
```

## Build

```bash
bun run build      # generates static pages
bun run preview
```

Without `AURII_CORE_URL`, the build is snapshot mode. With Core URL set, the build reads live published routes (and **fails** if Core is unreachable).

## Relationship to Aurii Core

```text
Import → Aurii Core → published route / @aurii/sdk → apps/geo
```

Equivalent Aurii Query Language for each page (authenticated Query API; the public site uses published routes instead):

```
# County list
from county order by name asc

# County page (/fylker/03)
from county where id == "03"
from municipality where countyId == "03" order by name asc

# Municipality page (/kommuner/0301)
from municipality where id == "0301"
from postal-code where municipalityId == "0301" order by code asc limit 15
```

## Validation

Automated proof that every route is queryable via Core:

```bash
cd packages/core && bun test src/__tests__/geo-website-routes.test.ts
```

Live published-route path used by this app:

```bash
cd apps/geo && bun test src/__tests__/live-geo-delivery.integration.test.ts
```
