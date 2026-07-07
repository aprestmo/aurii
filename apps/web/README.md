# Norwegian Geo Website Demo

A minimal public website proving that Kartverket and Bring data imported into Aurii can power a complete county and municipality site with static routes.

**Not Studio** — this is a separate API consumer, built the same way any headless frontend would consume Aurii.

## Routes

| Route | Pages | Data |
|-------|-------|------|
| `/` | 1 | Lists all 15 counties |
| `/fylker/[id]` | 15 | County detail + municipalities (e.g. `/fylker/03` → Oslo) |
| `/kommuner/[id]` | 357 | Municipality detail + postal codes (e.g. `/kommuner/0301` → Oslo) |

**Total: 373 static pages** generated at build time.

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
bun run build      # generates all 373 pages
bun run preview
```

## Relationship to Aurii Core

This demo reads bundled snapshots from `demo/norwegian-geo/core/data/` and `demo/norwegian-geo/modules/*/data/` at build time — the same files imported into Core via `bun run import:norwegian-geo`.

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

A production site would call these via `@aurii/sdk` at build time or request time instead of reading JSON directly.

## Validation

Automated proof that every route is queryable via Core:

```bash
cd packages/core && bun test src/__tests__/geo-website-routes.test.ts
```
