# Norwegian Geo Website Demo

A public website for the Norwegian Geo **data product**. It proves that Kartverket/Bring (and module) data can power county and municipality pages.

**Not Studio** — this is a separate consumer. Frontends talk to product data / Core; they never go through a CMS UI. See [`docs/PRODUCT_MODEL.md`](../../docs/PRODUCT_MODEL.md).

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

## Run locally

```bash
cd apps/geo
bun install
bun run dev        # http://localhost:4322
```

## Build

```bash
bun run build      # generates static pages
bun run preview
```

## Relationship to Aurii Core

**Today:** this site reads bundled snapshots from `demo/norwegian-geo/core/data/` and `demo/norwegian-geo/modules/*/data/` at build time — the same files imported into Core via `bun run import:norwegian-geo`. Snapshot consumption is an explicit offline/build-time mode.

**Phase 4 delivery contract:** production consumers should prefer `Import → Core → Query/API → @aurii/sdk → frontend`. Live SDK delivery is planned as a first-class path alongside snapshots (`Phase4.md`).

Equivalent Aurii Query Language for each page:

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