# Norwegian Geo

Norwegian Geo is a **standalone data product and reference application built on Aurii**.

It is Aurii’s first external downstream product. Phase 4 proved the product inside the Aurii monorepo. This repository is the system of record for Norwegian geography, data sources, import rules, project schemas, product routes, and the public website.

It is **not** part of the Aurii monorepo. It has its own CI, release, and GitHub Pages lifecycle.

## What is this?

```text
Norwegian datasets
       ↓
Aurii project package
       ↓
Aurii Runtime
       ↓
SDK / published HTTP routes
       ↓
Astro web product
```

| Layer | Location | Role |
|-------|----------|------|
| Project package | `project/` | Schemas, sources, imports, routes, Studio config, datasets |
| Web product | `apps/web/` | Public Astro site (counties, municipalities, modules, history) |
| Aurii | dependency | Runtime + public packages (`@aurii/sdk`, `@aurii/core`, `@aurii/studio`, …) |

## Responsibilities

| Belongs to Norwegian Geo | Belongs to Aurii Runtime |
|--------------------------|--------------------------|
| Norwegian schemas, snapshots, and source adapters | Generic schema, import, query, and storage engines |
| Kartverket / Bring / UDIR / Brreg / Nager.Date integration | Published-route and SDK contracts |
| Project package (`aurii.config.ts`, `defineStudio`) | `defineProject` / `loadProjectPackage` / `registerProjectPackage` |
| Public website and GitHub Pages deploy | Core HTTP API and Studio operator workspace |
| Historical admin pipeline and heraldry | Domain-agnostic entity / relation model |

Do not move Norwegian geography into Aurii Core. Do not copy Aurii source into this repository.

## Architecture

```text
Norwegian Geo
     │
     ├── versioned Aurii packages
     │
     └── Aurii HTTP/API contracts
             │
             ▼
         Aurii Runtime
```

- The **web frontend** talks to Aurii through `@aurii/sdk` and published HTTP routes. It does **not** import `@aurii/core`, `@aurii/db`, or Studio.
- The **project package** (`aurii.config.ts`, `defineRoute`, `defineStudio`) may use `@aurii/core`, `@aurii/studio`, and `@aurii/db`. That is the supported external project-package model.
- Transitive platform packages: `@aurii/types`, `@aurii/validation`.
- **Studio** is an optional operator tool pointed at this project. It is not on the public delivery path.

Platform source: [aprestmo/aurii](https://github.com/aprestmo/aurii).

## Tooling

Requires [Bun](https://bun.sh) **1.4.2** or compatible (`packageManager` in root `package.json`).

```bash
git clone https://github.com/aprestmo/norwegian-geo.git
cd norwegian-geo
bun install
```

No Aurii source checkout is required.

### Test

```bash
bun test
# or the same via
bun run test
```

### Typecheck / Astro check

```bash
bun run typecheck    # astro check
```

### Build

```bash
bun run build        # snapshot / offline static site
# GitHub Pages:
ASTRO_SITE=https://aprestmo.github.io ASTRO_BASE=/norwegian-geo/ bun run build
```

### Local development

```bash
bun run dev          # http://localhost:4322 — snapshot mode by default
```

### Live Aurii Runtime

1. Run an Aurii Runtime (from a published/packed `@aurii` install, or an Aurii checkout used **only** as the server).
2. Import and register this project:

```bash
bun run import
AURII_CORE_URL=http://localhost:3000 bun run register
# Enable published routes (Studio or PATCH /api/projects/:id/routes/:routeId)
```

3. Point the web app at that Runtime:

```bash
AURII_CORE_URL=http://localhost:3000 \
AURII_PROJECT_SLUG=norge-data \
bun run dev
```

Live mode never silently falls back to snapshots. `AURII_DELIVERY_MODE=snapshot` forces the offline path.

## Aurii package dependency (temporary)

`@aurii/*` is not yet published to a package registry. This repository vendors packed tarballs under `vendor/aurii/` and pins them with root `overrides`.

That is a **versioned artifact pin**, not a sibling source checkout. See [`vendor/aurii/README.md`](vendor/aurii/README.md).

When the packages are on a registry, replace `overrides` with semver and delete `vendor/aurii/`.

### Refresh / upgrade vendored Aurii packages

```bash
# in a checkout of aprestmo/aurii
bun run pack:packages

# in this repository
AURII_PACK_DIR=/path/to/aurii/.tmp/packs bun run refresh:aurii
bun install
```

Commit `vendor/aurii/`, `package.json`, and `bun.lock`.

## Data / ops scripts

| Script | Purpose |
|--------|---------|
| `bun run fetch` | Fetch current Geo snapshots from open sources |
| `bun run fetch:historical` | Fetch historical administrative units |
| `bun run fetch:ssb-identifiers` | Fetch SSB identifier periods |
| `bun run build:enrichment` | Build municipality enrichment |
| `bun run validate:historical` | Validate historical dataset |
| `bun run import` | Register schemas and import entities into a Runtime |
| `bun run register` | Register the project package via HTTP |
| `bun run migrate` | Classify datasets under the Norge Data project |
| `bun run build:geodata` | Build simplified boundary GeoJSON |
| `bun run refresh:aurii` | Copy packed `@aurii/*` tarballs into `vendor/aurii/` |

## GitHub Pages

Expected URL: `https://aprestmo.github.io/norwegian-geo/` (`ASTRO_BASE=/norwegian-geo/`).

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The static build uses snapshot mode unless `AURII_CORE_URL` is set.

**Manual repository setting:** Settings → Pages → Source = **GitHub Actions**. The workflow cannot enable that setting by itself.

## Layout

```text
norwegian-geo/
├── project/          # Aurii project package
│   ├── aurii.config.ts
│   ├── schemas, sources, imports, routes
│   ├── core/         # counties, municipalities, postal codes, history
│   ├── modules/      # schools, kindergartens, hospitals, holidays
│   └── studio/
├── apps/web          # Astro consumer (@aurii/sdk only)
└── vendor/aurii      # temporary packed @aurii/* tarballs
```

Provenance of the extract from Aurii: [`BOOTSTRAP.md`](BOOTSTRAP.md).
