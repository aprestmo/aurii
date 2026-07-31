# Breaking changes

## 2026-07-31 — Global `/datasets` routes removed

Global dataset administration routes are removed. Datasets are project-scoped only.

### Removed

```
GET  /datasets
POST /datasets
```

Deprecated SDK methods removed:

```ts
client.datasets.list()
client.datasets.create(input)
```

### Use instead

```
GET    /api/projects/:projectId/datasets
POST   /api/projects/:projectId/datasets
GET    /api/projects/:projectId/datasets/:datasetId
PATCH  /api/projects/:projectId/datasets/:datasetId
```

```ts
const project = await client.projects.getBySlug("norge-data");
const datasets = await client.projects.byId(project.id).datasets.list();
await client.projects.byId(project.id).datasets.create({
  id: "norwegian-geo",
  name: "Norwegian Public Reference Data",
});
```

### Not removed

* Legacy project (`slug: legacy`, `LEGACY_PROJECT_ID`) — still used for unclassified migrated datasets
* Admin reassignment (`DatasetService.reassignDatasetProject`, `reassign-dataset` script)
* Storage default of new unclassified rows to Legacy when `projectId` is omitted at the adapter layer

See [ADR-0012](../adr/ADR-0012%20—%20Project-Scoped%20Existing%20Dataset%20Model.md) and [DATASETS.md](./DATASETS.md).
