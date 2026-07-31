ADR-0013 — Project Write Policy for Dataset-Bound Resources

Status: Accepted
Date: 2026-07-31
Decision Makers: Aurii Project
Related: ADR-0011 (Project as Top-Level Boundary), ADR-0012 (Project-Scoped Existing Dataset Model)

⸻

Context

ADR-0011 established project statuses (`active` / `inactive` / `archived`) and write rules for project administration. ADR-0012 scoped datasets to projects and noted that import runs which mutate data must still enforce those rules.

Imports and schemas are dataset-bound. Duplicating `project_id` onto import or schema tables would create a second source of truth. Write checks must still apply consistently whether the caller uses HTTP, CLI, SDK, or Core directly.

⸻

Decision

1. **Imports and schemas derive project through dataset** (`Import|Schema → Dataset → Project`). No `project_id` column is added to import-run or schema tables for this purpose.

2. **Mutations require a writable project** (`status === "active"`). This includes:
   - import runs (including dry-run starts that record runs / would persist)
   - schema register (upsert) and schema delete
   - dataset create / update / reassign (existing `DatasetService` path)

3. **Reads remain allowed** for `inactive` and `archived` projects: schemas, entities, import history, dataset metadata, queries.

4. **Core enforces the policy**, not only HTTP adapters. Shared helper: `assertProjectWritable(project, operation?)` throwing `ProjectNotWritableError` (HTTP 409).

5. **Import jobs re-check status at actual run/persist time.** Accepting or scheduling work while a project is active is not enough; a deactivation before entity writes must fail the run in a controlled way (status `failed`) without writing entities.

6. **Wrong project context returns 404** on project-scoped routes (`/api/projects/:id/datasets/:datasetId/...`), without revealing that the dataset exists elsewhere.

⸻

Consequences

Positive

* One write-policy implementation shared by datasets, imports, and schemas
* Inactive/archived projects stay inspectable
* Background/long import paths cannot bypass deactivation
* Ownership stays on the dataset row

Tradeoffs

* ProjectService must be available to Core runtime paths (`configureProjectService` / `getProjectService`)
* Static product YAML schema files are not runtime mutations; policy applies when `registerSchema` / import actually runs
* Cross-table transactions between `projects` and entity writes are not required for this decision; re-check near persist is the consistency strategy

Non-goals

* Duplicating project columns on imports/schemas
* Public dataset move API
* Full redesign of import scheduling/queue infrastructure
* RBAC
