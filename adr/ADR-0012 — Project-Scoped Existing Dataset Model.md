ADR-0012 — Project-Scoped Existing Dataset Model

Status: Accepted
Date: 2026-07-31
Decision Makers: Aurii Project
Related: ADR-0011 (Project as Top-Level Boundary), ADR-0006 (Unified Data Model)

⸻

Context

ADR-0011 introduced Project as the top-level administrative boundary and stated that all future Core resources must belong to exactly one project. At that time, the existing runtime table `aurii_datasets` was not yet project-scoped.

`aurii_datasets` is the canonical dataset catalog used by Core storage adapters (SQLite and PostgreSQL). It must be extended — not replaced by a parallel `datasets` / `project_datasets` / `dataset_catalog` table.

⸻

Decision

1. **`aurii_datasets` remains the canonical dataset model.** No competing catalog table is introduced. Ownership of the table DDL stays with Core storage adapters; PostgreSQL schema evolution for `project_id` is applied via `@aurii/db` migration `0001_datasets_project_id.sql`.

2. **Every dataset belongs to exactly one project** via required `project_id` (UUID, FK to `projects.id`, `ON DELETE RESTRICT`, indexed).

3. **Existing rows migrate through a Legacy fallback project** (`name: Legacy`, `slug: legacy`, stable UUID `LEGACY_PROJECT_ID` in `@aurii/types`). Migration is multi-step: ensure Legacy → add nullable column → backfill → `SET NOT NULL` → FK + indexes. Re-runs are idempotent.

4. **Dataset identity stays the existing stable `id` (TEXT primary key).** Dataset ids remain globally unique because they are the addressing key for APIs (`?dataset=`), SDK defaults, imports, and schema composite keys `(id, dataset_id)`. Per-project reuse of the same id/slug is intentionally **not** introduced; that would require a separate identity redesign. Human-readable addressing may later use `projectSlug/datasetId` without changing the internal id.

5. **Imports derive project through dataset** (`Import → Dataset → Project`). No `project_id` on import tables in this change — avoid duplicated truth.

6. **Schemas remain dataset-scoped** (composite key with `dataset_id`). Project-scoped schema registration is a follow-up; schemas stay reusable patterns registered per dataset after this migration.

7. **Public dataset administration is project-scoped** at `/api/projects/:projectId/datasets`. Global `/datasets` routes remain temporarily as **deprecated**, Legacy-project-only surfaces so existing SDK/demo callers do not gain cross-project listing.

8. **Moving datasets between projects** is an administrative operation (CLI/script / `DatasetService.reassignDatasetProject`), not a public API update field.

⸻

Consequences

Positive

* Existing data and dataset ids are preserved
* Project write rules (active / inactive / archived) apply to dataset administration
* Single catalog — no parallel models
* Clear migration path from Legacy to named projects (Norge Data, Valgdata, …)

Tradeoffs

* Global uniqueness of dataset `id` means the same slug cannot exist in two projects until a future identity change
* Dual DDL ownership (adapter `CREATE TABLE IF NOT EXISTS` + Drizzle migration) requires keeping column definitions aligned
* Global `/datasets` deprecation must be completed in a later cleanup

Non-goals

* Renaming `aurii_datasets`
* Cross-project dataset membership
* Import or schema project columns
* Public dataset move API
* RBAC / API keys
