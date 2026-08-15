# @aurii/studio-app

> Aurii Studio is a **client** of the Aurii Runtime. It consumes the public HTTP API (via `@aurii/sdk`) and nothing else.
>
> Studio is a **project-oriented workspace** — sources, imports, schedules, entities, queries, published routes, plus generated default UI and optional custom views. It is **not** a publication CMS.
>
> Config helpers live in `@aurii/studio` (`defineStudio`). This package is the Astro UI app.
>
> **Status:** project-oriented Studio **beta** (Phase 4). Full extension API planned ([ADR-0020](../../adr/ADR-0020%20—%20Extensible%20Studio.md)). See [`docs/Studio.md`](../../docs/Studio.md), [`docs/PRODUCT_MODEL.md`](../../docs/PRODUCT_MODEL.md), [ADR-0017](../../adr/ADR-0017%20—%20Studio%20Extension%20Model.md).

## Surfaces

- **Overview** — project dashboard, dataset context
- **Sources** — DataSource registry
- **Imports** — wizard + saved definitions, history, schedules
- **Published routes** — inspect / enable delivery endpoints (served by Core)
- **Entities** — browse and filter
- **Query** — Query Language playground
- **Schemas** — inspect registered schemas
- **System** — connection and status
- **Custom views** — optional, via project `defineStudio` registry

## Quick start

From the repo root (Core must be running):

```bash
bun run serve

AURII_CORE_URL=http://localhost:3000 \
AURII_PROJECT_SLUG=norge-data \
AURII_DEFAULT_DATASET=norwegian-geo \
AURII_PROJECT_ROOT=demo/norwegian-geo \
bun run studio
```

Or from this package:

```bash
bun install
bun run dev        # http://localhost:4321
```

Hosted / static build (from repo root):

```bash
AURII_CORE_URL=https://api.example.com \
AURII_PROJECT_SLUG=norge-data \
AURII_DEFAULT_DATASET=norwegian-geo \
bun run studio:build
```

**Do not** embed API tokens in public builds.

## Environment variables

| Variable | Meaning |
|----------|---------|
| `AURII_CORE_URL` / `PUBLIC_AURII_CORE_URL` | Core API base URL (default `http://localhost:3000`) |
| `AURII_PROJECT_SLUG` / `PUBLIC_AURII_PROJECT_SLUG` | Core Project slug |
| `AURII_DEFAULT_DATASET` / `PUBLIC_AURII_DEFAULT_DATASET` | Default dataset id |
| `AURII_PROJECT_ROOT` | Optional path to project package for config loading |

Browser login still stores `aurii.apiUrl`, `aurii.token`, and `aurii.dataset` in localStorage.

## Project config

Projects customize navigation and views with `defineStudio` from `@aurii/studio`, referenced from `aurii.config.ts`. Without config, Studio uses the default workspace. See [`docs/PROJECT_PACKAGES.md`](../../docs/PROJECT_PACKAGES.md).

## Import Wizard

1. **Upload** — CSV or JSON  
2. **Preview** — format, columns, inferred types  
3. **Schema** — generated or existing  
4. **Mapping** — columns → fields, transforms  
5. **Dry run** — validate only  
6. **Import** — persist + summary  

Nothing is written before step 6.
