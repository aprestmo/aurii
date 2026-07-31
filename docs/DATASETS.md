# Aurii Datasets

> A **dataset** is the storage and query boundary for schemas and entities. Every dataset belongs to exactly one **project**.

Canonical table: **`aurii_datasets`** (Core storage adapters). See [ADR-0012](../adr/ADR-0012%20—%20Project-Scoped%20Existing%20Dataset%20Model.md).

---

## Model

| Field | Role |
|-------|------|
| `id` | Stable internal identity (global primary key). Used in `?dataset=`, imports, schema keys. |
| `projectId` | Owning project UUID (required). |
| `name` / `description` | Human-facing metadata |
| `createdAt` | Created timestamp |

### Uniqueness

Dataset `id` remains **globally unique**. The same id cannot exist in two projects.

Rationale: existing APIs, SDK `defaultDataset`, import YAML `dataset:`, and `aurii_schemas (id, dataset_id)` all address datasets by this id. Changing uniqueness to `(project_id, slug)` would be a separate identity redesign.

Human-readable compound addressing can still be expressed as `projectSlug/datasetId` (e.g. `norge-data/norwegian-geo`) without replacing the internal id.

---

## Project write rules

| Project status | List / get / read data | Create / update dataset | Import / schema mutations |
|----------------|------------------------|-------------------------|---------------------------|
| `active` | Yes | Yes | Yes |
| `inactive` | Yes | No (`PROJECT_NOT_WRITABLE`) | No |
| `archived` | Yes | No (`PROJECT_NOT_WRITABLE`) | No |

Shared Core helper: `assertProjectWritable` ([ADR-0013](../adr/ADR-0013%20—%20Project%20Write%20Policy%20for%20Dataset-Bound%20Resources.md)).

---

## API

```
GET    /api/projects/:id/datasets
POST   /api/projects/:id/datasets
GET    /api/projects/:id/datasets/:datasetId
PATCH  /api/projects/:id/datasets/:datasetId
```

Project-scoped import/schema helpers:

```
GET    /api/projects/:id/datasets/:datasetId/schemas
POST   /api/projects/:id/datasets/:datasetId/schemas
GET    /api/projects/:id/datasets/:datasetId/imports
POST   /api/projects/:id/datasets/:datasetId/imports/run
```

Response includes `projectId`:

```json
{
  "data": {
    "id": "norwegian-geo",
    "name": "Norwegian Geography",
    "projectId": "…",
    "createdAt": "…"
  }
}
```

Opening a dataset through the wrong project returns **404** (`DATASET_NOT_FOUND`).

### Breaking change — global `/datasets` removed

Removed:

```
GET  /datasets
POST /datasets
```

Use the project-scoped routes above. There is no Legacy fallback on the removed paths.

---

## SDK

```ts
const project = await client.projects.getBySlug("norge-data");
const datasets = await client.projects.byId(project.id).datasets.list();
const one = await client.projects.byId(project.id).datasets.get("norwegian-geo");
await client.projects.byId(project.id).datasets.create({
  id: "municipalities",
  name: "Municipalities",
});
```

Deprecated global `client.datasets.*` methods have been **removed**.

---

## Migration of existing data

Migration `0001_datasets_project_id.sql`:

1. Ensure **Legacy** project (`slug: legacy`, stable `LEGACY_PROJECT_ID`)
2. Add nullable `project_id`
3. Backfill all existing rows to Legacy
4. Verify no nulls
5. `SET NOT NULL` + FK `ON DELETE RESTRICT` + indexes

Existing dataset ids are preserved.

```bash
export DATABASE_URL=postgres://aurii:aurii@localhost:5432/aurii
bun run --filter='@aurii/db' migrate
```

---

## Classifying Legacy datasets

After migration, move datasets out of Legacy with admin tooling (not the public API):

```bash
# Single dataset
bun run --filter='@aurii/db' reassign-dataset -- \
  --dataset norwegian-geo --to-project norge-data

# Norwegian Geo product (idempotent summary)
bun run migrate:norwegian-geo-project
```

Example target layout:

```
Legacy          ← only unclassified leftovers
Norge Data      ← norwegian-geo (and future NO reference datasets)
Valgdata        ← elections, election-results
News CMS        ← articles (future)
```

---

## Imports and schemas

### Imports

Imports reference a **dataset id**. Project is derived:

```
Import → Dataset → Project
```

Core `runImport` enforces writable project status at job start and again immediately before entity writes. Inactive/archived projects reject the run (`PROJECT_NOT_WRITABLE`, HTTP 409) and write no entities. Import history remains readable.

### Schemas

Schemas are stored per dataset (`PRIMARY KEY (id, dataset_id)`). Project is derived through the dataset. `registerSchema` / `deleteSchema` enforce writable project status in Core.

**Static product YAML** under `demo/` is not a runtime mutation until `registerSchema` (CLI, import script, or API) runs.

---

## Core service

`DatasetService` (`@aurii/core`) requires `projectId` on all operations, checks project existence and writability via `assertProjectWritable`, and never trusts `projectId` from a request body when the URL already supplies it.
