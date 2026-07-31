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

| Project status | List / get dataset | Create / update dataset |
|----------------|--------------------|-------------------------|
| `active` | Yes | Yes |
| `inactive` | Yes | No (`PROJECT_NOT_WRITABLE`) |
| `archived` | Yes | No (`PROJECT_NOT_WRITABLE`) |

---

## API

Preferred:

```
GET    /api/projects/:id/datasets
POST   /api/projects/:id/datasets
GET    /api/projects/:id/datasets/:datasetId
PATCH  /api/projects/:id/datasets/:datasetId
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

### Deprecated global routes

`GET/POST /datasets` remain for compatibility. They are scoped to the **Legacy** fallback project only and do not list or create datasets across projects.

---

## SDK

```ts
const datasets = await client.projects.byId(projectId).datasets.list();
const one = await client.projects.byId(projectId).datasets.get("norwegian-geo");
await client.projects.byId(projectId).datasets.create({
  id: "municipalities",
  name: "Municipalities",
});
```

Deprecated: `client.datasets.list()` / `client.datasets.create()` (Legacy project only).

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

After migration, move datasets out of Legacy with the admin script (not the public API):

```bash
bun run --filter='@aurii/db' reassign-dataset -- \
  --dataset norwegian-geo --to-project norge-data
```

Example target layout:

```
Legacy          ← only unclassified leftovers
Norge Data      ← municipalities, counties, postal-codes, norwegian-geo
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

Do not add `project_id` on import tables while that would duplicate ownership. Next task: enforce project write rules on import runs that mutate data (inactive/archived → reject).

### Schemas

Schemas are stored per dataset (`PRIMARY KEY (id, dataset_id)`). They are not project-scoped in this change. After project migration, a dataset still resolves its schemas the same way.

**Next step:** decide whether schema *registration* becomes project-scoped (admin UX) while keeping schema definitions reusable across datasets, or keep registration dataset-scoped only. Recommendation: keep schemas dataset-scoped and reusable; project context comes from the dataset.

---

## Core service

`DatasetService` (`@aurii/core`) requires `projectId` on all operations, checks project existence and writability, and never trusts `projectId` from a request body when the URL already supplies it.
