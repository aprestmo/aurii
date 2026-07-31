# Aurii Projects

> An Aurii **project** is the administrative, security, and functional boundary for datasets, imports, relations, and APIs. All future Core resources belong to exactly one project, with explicit mechanisms for controlled cross-project relations.

---

## Why projects are top-level

Until now Aurii organized data primarily by **dataset**. Datasets remain the storage/query boundary for entities, but they are not a sufficient tenancy or product boundary:

- One deployment may host several products (Norwegian Geo, election data, a CMS).
- A future CMS may keep editorial entities in one project while referencing municipalities or election results in another—without copying data.
- Access control, API keys, import configurations, and published API routes all need a stable parent.

**Project** is that parent. Stable identity is a UUID; human-readable addressing uses a unique **slug**.

This supersedes the earlier guidance in `PRODUCT_MODEL.md` that deferred a Core `Project` type. See [ADR-0011](../adr/ADR-0011%20—%20Project%20as%20Top-Level%20Boundary.md).

---

## Status

| Status | Meaning |
|--------|---------|
| `active` | Available for normal use |
| `inactive` | Temporarily disabled |
| `archived` | Read-only intent; `archivedAt` is set. Reactivation clears `archivedAt` |

Projects are not permanently deleted through the public API in this version.

### Allowed transitions

```
active   → inactive | archived
inactive → active | archived
archived → active
```

---

## Data model

Table `projects` (PostgreSQL via Drizzle in `@aurii/db`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Generated |
| `name` | text | Required |
| `slug` | text | Required, unique, indexed |
| `description` | text \| null | Optional |
| `status` | text | `active` \| `inactive` \| `archived`, indexed |
| `created_at` | timestamptz | Automatic |
| `updated_at` | timestamptz | Automatic on change |
| `archived_at` | timestamptz \| null | Set on archive |

Future tables (`datasets`, `imports`, `relationships`, `api_routes`, `project_members`, `project_api_keys`, `saved_queries`, `data_views`) should reference `project_id`. They are **not** created in this foundation step.

---

## Packages

| Package | Role |
|---------|------|
| `@aurii/types` | Shared `Project` types (no Drizzle types in the API) |
| `@aurii/validation` | Name/slug/description/status rules |
| `@aurii/db` | Drizzle schema, migrations, seed |
| `@aurii/core` | `ProjectService` + repositories (memory / Drizzle) |
| `@aurii/api` | Thin Elysia routes under `/api/projects` |

---

## API

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

**List default:** returns **all** projects (active, inactive, and archived). Pass `?status=active` (or `inactive` / `archived`) to filter. Inactive projects are not hidden unless you filter.

Create example:

```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"Valgdata","slug":"valgdata","description":"Offisielle og bearbeidede norske valgdata."}'
```

---

## Migration

Requires PostgreSQL (for example `docker compose up postgres`).

```bash
export DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii
bun run --filter='@aurii/db' migrate
```

Migration file: `packages/db/migrations/0000_projects.sql`.

---

## Seed

Idempotent seed (Norge Data, Valgdata, News CMS) — upserts by slug:

```bash
export DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii
bun run --filter='@aurii/db' seed
```

---

## Tests

```bash
# Validation
bun run --filter='@aurii/validation' test

# Core project service (in-memory)
bun test packages/core/src/__tests__/project-service.test.ts

# HTTP routes (in-memory)
bun run --filter='@aurii/api' test
```

When `DATABASE_URL` is unset, `@aurii/api` uses an in-memory project repository so local/runtime tests do not require Postgres. Production and Docker should set `DATABASE_URL` and run migrations.

---

## Run the API

```bash
bun run --filter='@aurii/api' serve
```

This serves Core runtime routes and `/api/projects` on the same port.
