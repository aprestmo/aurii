# Norwegian Geo website

Public website for the Norwegian Geo data product. It proves that Kartverket/Bring (and module) data can power county and municipality pages.

This app depends on **`@aurii/sdk` only** among Aurii packages. It never imports `@aurii/core`, `@aurii/db`, or Studio.

## Routes

| Route | Pages | Data |
|-------|-------|------|
| `/` | 1 | Lists all 15 counties |
| `/fylker/[id]` | 15 | County detail + municipalities |
| `/kommuner/[id]` | 357 | Municipality detail + postal codes |

Plus module and historical routes. County and municipality IDs are numeric (`03`, `0301`).

## Delivery modes

Live Core-backed mode is the **normal production integration contract**. Snapshot mode is an **explicit** offline / build-time fallback. Live mode never silently reads snapshot files.

| Mode | How to select | Data source |
|------|----------------|-------------|
| **Live** | Set `AURII_CORE_URL` (or `AURII_DELIVERY_MODE=live` + Core URL) | Published routes via `@aurii/sdk` |
| **Snapshot** | Unset Core URL, or `AURII_DELIVERY_MODE=snapshot` | Bundled JSON under `project/**/data/` |

From the repository root:

```bash
bun run import
AURII_CORE_URL=http://localhost:3000 bun run register

AURII_CORE_URL=http://localhost:3000 \
AURII_PROJECT_SLUG=norge-data \
bun run dev
```

Snapshot / offline:

```bash
bun run dev
# or
AURII_DELIVERY_MODE=snapshot bun run build
```

## GitHub Pages

`https://aprestmo.github.io/norwegian-geo/` with `ASTRO_BASE=/norwegian-geo/`.
