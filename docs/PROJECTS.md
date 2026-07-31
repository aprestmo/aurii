# Aurii Projects

> An Aurii **project** is the administrative, security, and functional boundary for datasets, imports, relations, and APIs. All Core resources belong to exactly one project, with explicit mechanisms for controlled cross-project relations.

---

## Why projects are top-level

Until now Aurii organized data primarily by **dataset**. Datasets remain the storage/query boundary for entities, but they are not a sufficient tenancy or product boundary:

- One deployment may host several products (Norwegian Geo, election data, a CMS).
- A future CMS may keep editorial entities in one project while referencing municipalities or election results in another—without copying data.
- Access control, API keys, import configurations, and published API routes all need a stable parent.

**Project** is that parent. Stable identity is a UUID; human-readable addressing uses a unique **slug**.

This supersedes the earlier guidance in `PRODUCT_MODEL.md` that deferred a Core `Project` type. See [ADR-0011](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md) and [ADR-0012](../adr/ADR-0012%20—%20Project-Scoped%20Existing%20Dataset%20Model.md).

---

## Status

| Status | Meaning |
|--------|---------|
| `active` | Available for normal use (create/update datasets, imports that write, schema changes) |
| `inactive` | Temporarily disabled — read/list allowed; writes rejected |
| `archived` | Read-only intent; `archivedAt` is set. Reactivation clears `archivedAt` |

Projects are not permanently deleted through the public API in this version. Hard-deleting a project that still owns datasets is blocked by `ON DELETE RESTRICT` on `aurii_datasets.project_id`.

### Allowed transitions

```
active   → inactive | archived
inactive → active | archived
archived → active
```

---

## Data model

### `projects` (PostgreSQL via Drizzle in `@aurii/db`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Generated (or stable for Legacy) |
| `name` | text | Required |
| `slug` | text | Required, unique, indexed |
| `description` | text \| null | Optional |
| `status` | text | `active` \| `inactive` \| `archived`, indexed |
| `created_at` | timestamptz | Automatic |
| `updated_at` | timestamptz | Automatic on change |
| `archived_at` | timestamptz \| null | Set on archive |

### `aurii_datasets` (canonical dataset table — Core storage)

`aurii_datasets` is the **canonical** dataset catalog. It is **not** replaced by a parallel `datasets` / `project_datasets` table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text | Stable dataset identity (global PK) |
| `name` | text | Display name |
| `description` | text \| null | Optional |
| `project_id` | uuid | **Required**, FK → `projects.id` `ON DELETE RESTRICT`, indexed |
| `created_at` | timestamptz | Automatic |

See [DATASETS.md](./DATASETS.md) for identity, API, migration, and Legacy classification.

### Relationship model

```
Project 1──* Dataset 1──* Schema / Entity / ImportRun
                │
                └── imports derive project via dataset (Import → Dataset → Project)
```

---

## Packages

| Package | Role |
|---------|------|
| `@aurii/types` | Shared `Project` types + `LEGACY_PROJECT_ID` |
| `@aurii/validation` | Name/slug/description/status rules |
| `@aurii/db` | Drizzle schema, migrations, seed, reassign script |
| `@aurii/core` | `ProjectService`, `DatasetService`, repositories, storage adapters |
| `@aurii/api` | Thin Elysia routes under `/api/projects` |
| `@aurii/sdk` | `client.projects.byId(id).datasets.*` |

---

## API

### Projects

Base path: `/api/projects`

Response envelope:

```json
{ "data": { "id": "…", "name": "…", "slug": "…", "description": null, "status": "active", "createdAt": "…", "updatedAt": "…", "archivedAt": null } }
```

Error envelope:

```json
{ "error": { "code": "PROJECT_SLUG_CONFLICT", "message": "…" } }
```

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/projects` | Create |
| `GET` | `/api/projects` | List (optional `?status=`) |
| `GET` | `/api/projects/:id` | Get by UUID |
| `GET` | `/api/projects/by-slug/:slug` | Get by slug |
| `PATCH` | `/api/projects/:id` | Update name/slug/description |
| `PATCH` | `/api/projects/:id/status` | Change status |
| `POST` | `/api/projects/:id/archive` | Explicit archive |

### Project-scoped datasets

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/projects/:projectId/datasets` | List datasets in project |
| `POST` | `/api/projects/:projectId/datasets` | Create (active projects only) |
| `GET` | `/api/projects/:projectId/datasets/:datasetId` | Get (404 if wrong project) |
| `PATCH` | `/api/projects/:projectId/datasets/:datasetId` | Update name/description |

`projectId` always comes from the URL. Body `projectId` is ignored.

### Deprecated global dataset routes

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/datasets` | Lists **Legacy** project datasets only |
| `POST` | `/datasets` | Creates in the **Legacy** project |

Prefer the project-scoped routes. See [DATASETS.md](./DATASETS.md).

---

## Migration

Requires PostgreSQL (for example `docker compose up postgres`).

```bash
export DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii
bun run --filter='@aurii/db' migrate
```

Migration files:

- `packages/db/migrations/0000_projects.sql` — `projects` table
- `packages/db/migrations/0001_datasets_project_id.sql` — Legacy project + `aurii_datasets.project_id`

---

## Seed

Idempotent seed — upserts by slug:

1. **Legacy** (stable UUID) — only for unclassified pre-migration data
2. **Norge Data**, **Valgdata**, **News CMS** — example projects for new data

```bash
export DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii
bun run --filter='@aurii/db' seed
```

Do not place new example datasets in Legacy. Reclassify Legacy datasets with:

```bash
bun run --filter='@aurii/db' reassign-dataset -- --dataset norwegian-geo --to-project norge-data
```

---

## Tests

```bash
# Validation
bun run --filter='@aurii/validation' test

# Core project + dataset services
bun test packages/core/src/__tests__/project-service.test.ts
bun test packages/core/src/__tests__/dataset-service.test.ts

# HTTP routes
bun run --filter='@aurii/api' test

# Migration (requires DATABASE_URL)
bun run --filter='@aurii/db' test
```

When `DATABASE_URL` is unset, `@aurii/api` uses an in-memory project repository so local/runtime tests do not require Postgres. Production and Docker should set `DATABASE_URL` and run migrations.

---

## Run the API

```bash
bun run --filter='@aurii/api' serve
```

This serves Core runtime routes and `/api/projects` on the same port.
