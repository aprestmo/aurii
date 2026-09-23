# ADR-0024 — DuckDB as Analytical Compute for Large Datasets

Status: Accepted (Candidate capability)
Date: 2026-09-22
Decision Makers: Aurii Project
Supersedes: None
Related: ADR-0002, ADR-0004, ADR-0008, ADR-0009, ADR-0012, ADR-0015
Evidence: [`experiments/duckdb-verification/`](../experiments/duckdb-verification/)

⸻

## Context

Aurii stores entities as JSON/JSONB documents in SQLite or PostgreSQL and executes Query Language plans through storage adapters ([ADR-0009](ADR-0009%20—%20Query%20Planner%20and%20Relational%20Execution.md)). That model is correct for Norwegian Geo scale (~18k entities) and for operational product data.

It is not ready for tax-list / multi-ten-million-row workloads ([`docs/SCALE.md`](../docs/SCALE.md)):

* in-memory joins
* no GROUP BY / percentiles / window functions in Query Language
* published-route dumps and offset pagination that assume small schemas
* entity-document storage that duplicates wide tabular rows as JSON

The platform hypothesis still includes large structured datasets (tax lists, company data, SSB, elections). Before locking long-term dataset architecture, we verified whether **DuckDB + Parquet + object storage** should sit beside PostgreSQL as an analytical layer.

Working hypothesis under test:

```
PostgreSQL  = application database and system of record
Object store / Parquet = storage for large structured datasets
DuckDB      = analyse, transform, joins, aggregates, batch ops
Aurii API   = expose controlled results to products
```

DuckDB must not replace PostgreSQL.

⸻

## Problem statement

If Aurii keeps all large tabular datasets exclusively in PostgreSQL entity storage:

* ingest and historical transforms become unnecessarily hard
* analytical queries either fail or force Core toward ad-hoc SQL
* storage cost and JSONB width explode for wide fact tables
* SCALE honesty remains a permanent ceiling instead of a solvable boundary

If Aurii adopts DuckDB without clear boundaries:

* clients might receive raw SQL-over-HTTP (conflicts with ADR-0004)
* Core could grow a second parallel query product
* operational entity semantics (permissions, revisions, provenance) could be diluted

⸻

## Verification

A synthetic Norwegian tax-list benchmark (77 million rows across 2018–2024), plus Heim / Halsa municipality–county history fixtures, was run on a 4-CPU / 15.6 GiB host.

Harness: [`experiments/duckdb-verification/`](../experiments/duckdb-verification/)  
Full results: [`experiments/duckdb-verification/results/RESULTS.md`](../experiments/duckdb-verification/results/RESULTS.md)

### Headline measurements (77M rows)

| Workload | Result |
|----------|--------|
| CSV generate | 3.69 GiB in 30.7s |
| CSV → wash/dedup/validate → Parquet (ZSTD) | **72.9s**, **169.8 MiB** output (~22× smaller) |
| Peak RSS during transform | ~8.1 GiB (memory_limit 8 GiB + spill) |
| History joins (postal + municipality + county, Heim cases) | **44.3s** over 77M; Halsa `1571/15` → Heim `5055/50` at 2020 verified |
| Year filter on Parquet | **14–50 ms** |
| Municipality aggregates / percentiles / window / year-join | **69 ms – 1.1 s** |
| Hive partition by `year=` | year-2024 query **50 ms → 33 ms** |
| S3-compatible read (moto standing in for R2) | **478 ms** for 11M-row object |
| Ephemeral DuckDB job (start→agg→stop) | **~55–62 ms** |
| Persistent connection same query | **~42 ms** |
| Materialized mun stats → Postgres serve | **~5 ms** |
| Allowlisted API query (sequential) | **~55 ms** mean |
| 8 concurrent cold DuckDB API queries | **~2.5 s** each (contention) — needs a shared worker/pool for API |

### Head-to-head vs relational PostgreSQL (2M-row sample)

| Path | Runtime |
|------|---------|
| Postgres `COPY` + `DISTINCT ON` wash | **4.76 s** |
| DuckDB same sample | **0.51 s** (~**9×** faster) |

Fairness note: comparison is against a **relational** Postgres table, not Aurii’s JSON entity store. Loading 77M wide fact rows as Aurii entities was out of scope and would be worse on both storage and query axes.

### Implementation complexity

All eight verification tests were expressible in low-to-medium complexity SQL (~40 lines for the ingest path; temporal history joins were the heaviest). No distributed DuckDB, no custom query language, no Core invasions were required for the experiment.

⸻

## Decision

**Option A (scoped): DuckDB becomes part of Aurii’s dataset architecture as an embedded analytical compute layer — Candidate maturity — not a replacement for PostgreSQL or for Aurii Query Language on entities.**

Adopted architecture:

```
                    Aurii
                      │
       ┌──────────────┴──────────────┐
       │                             │
  Application / entity data     Large dataset layer
       │                             │
  PostgreSQL                    Object storage (R2/S3/…)
  (SoR)                         Parquet (Hive partitions)
       │                             │
       │                             ▼
       │                           DuckDB (embedded compute)
       │                             │
       └──────────────┬──────────────┘
                      │
                      ▼
                 Aurii API
```

### What this means

1. **PostgreSQL remains the system of record** for projects, schemas, entities, users, permissions, workflows, dataset *metadata*, relations between Aurii objects, and small/medium datasets where document storage is sufficient.
2. **Parquet is a first-class storage format** for large structured datasets that do not require per-row entity semantics (revisions, editorial overrides, Studio form editing).
3. **Object storage holds the bytes**; Postgres holds pointers and catalog fields (`storage_location`, `format`, `row_count`, `version`, schema id, project id).
4. **DuckDB is a compute engine Aurii uses**, not a database Aurii must permanently operate. Default lifecycle: start per job / per allowlisted query batch, spill to disk, terminate. A persistent worker pool is optional for concurrent API analytics.
5. **Clients do not get arbitrary SQL.** Dataset queries remain allowlisted or expressed through future Aurii abstractions that *compile* to DuckDB plans — preserving ADR-0004.
6. **Common aggregates may be materialized into PostgreSQL** for operational API latency; heavy analytics stay on Parquet + DuckDB.

### Explicit non-decisions (this ADR does not authorize)

* Migrating Core entity storage off PostgreSQL/SQLite
* Replacing Query Language with SQL-over-HTTP
* Distributed / multi-node DuckDB
* Wiring DuckDB into every Core module immediately
* Treating tax-list product schemas as Core concepts

### Maturity

**Candidate** reusable capability ([`docs/PLATFORM_VALIDATION.md`](../docs/PLATFORM_VALIDATION.md) ladder):

* Proven on a tax-list-shaped synthetic workload
* Next challenge: a multi-source product (external API + periodic updates + geo joins + history) before promoting to unconditional Core default
* Until then, implementation may live as an experimental package / pipeline adapter, with Core owning only the durable contracts (dataset metadata, storage location, allowlisted query surface)

⸻

## Answers to the verification questions

1. **Faster / simpler than Postgres for large datasets?** Yes for columnar ingest, wash, history joins, and analytics. ~9× on a 2M relational sample; 77M CSV→Parquet in ~73s with ~22× compression. Simpler SQL than equivalent imperative pipelines.
2. **Parquet first-class?** Yes, for large analytical datasets.
3. **Large datasets outside Postgres?** Yes — bytes in object storage; catalog in Postgres.
4. **R2/S3 + Parquet + DuckDB as standard?** Yes as the default for *large dataset storage + compute*, with self-hosted S3-compatible endpoints equally valid ([ADR-0008](ADR-0008%20—%20Self-Hosted%20First%20Architecture.md)).
5. **What to materialize to Postgres?** Small aggregates and API-hot summaries (e.g. `municipality_statistics`), dataset metadata, and any slice that needs entity/permission semantics.
6. **Operational vs analytical boundary?** Operational: point lookups, Studio pages, permissions, revisions, small joins via Aurii QL on entities. Analytical: scans, group-bys, percentiles, window functions, multi-year joins, historical corrections over millions of rows → DuckDB/Parquet.
7. **RAM?** Realistic 77M wash/join peaked ~8–8.6 GiB with an 8 GiB DuckDB limit and disk spill. Plan **≥8–16 GiB** for tax-list-class jobs on 4 cores; ephemeral jobs for partitioned year queries used tens of milliseconds and modest incremental RAM.
8. **API latency?** ~55 ms sequential allowlisted query on year-partitioned 11M rows. Concurrent cold starts contend (~2.5 s at concurrency 8) → use a shared DuckDB worker/pool for interactive API, not one process per request under load.
9. **Per-job vs persistent?** Prefer **ephemeral for batch jobs**; prefer **persistent worker/pool for interactive API**. No requirement to run DuckDB as a always-on cluster.
10. **Fit with schema/dataset model?** Dataset remains the storage/query boundary ([ADR-0012](ADR-0012%20—%20Project-Scoped%20Existing%20Dataset%20Model.md)). Extend dataset metadata with external storage descriptors; keep entity schemas for operational records; large fact tables may be schema-described without being row-stored as entities.

⸻

## Guardrail checks

| Test | Result |
|------|--------|
| Product-local first? | Tax lists could stay product-local, but the *storage/compute split* is cross-product (Geo history, SSB, company data). Candidate in Core contracts; first adapters may be experimental. |
| Kyro test | Conventional headless CMS does not solve 77M-row historical joins + Parquet lake analytics as Aurii’s dataset thesis. Not a CMS-parity feature. |
| Multi-product reuse | Architecture targets ≥2 products; next verification case must not be tax-only. |
| Core-fundamentality | Touches ingest, datasets, query, and cross-product information — fundamental when scoped to large columnar datasets. |

⸻

## Consequences

### Positive

* Unlocks tax-list-class datasets without pretending JSON entity storage will scale
* Keeps PostgreSQL focused on what it does well
* Preserves ADR-0004 (no client SQL) while allowing powerful compute internally
* Aligns with self-hosted object storage ([ADR-0008](ADR-0008%20—%20Self-Hosted%20First%20Architecture.md))
* Natural fit for pipeline/batch work and optional materialization

### Negative / risks

* Two storage shapes (entities vs Parquet datasets) must stay clearly documented
* Risk of accidental SQL surface if API allowlists are sloppy
* Concurrent interactive analytics needs an explicit worker strategy
* Operators must provision RAM/disk for spill files on large jobs
* Catalog/metadata schema for external datasets is still to be designed in code

### Follow-ups (not this ADR)

1. Dataset metadata fields for `storage_location` / `format` / `row_count` / `version`
2. Experimental DuckDB pipeline source/sink (CSV/Parquet/S3) without changing entity adapters
3. Allowlisted `GET /datasets/:id/query` (or QL subset that compiles to DuckDB) behind a feature flag
4. Second verification product (API + periodic updates + geo + history) before declaring Core-default
5. Update [`docs/SCALE.md`](../docs/SCALE.md) with measured DuckDB path (done alongside this ADR)

⸻

## Rejected alternatives

### B — DuckDB only in ingest pipelines

Rejected as the *final* architecture because Tests 3–8 showed durable value for analytics-on-Parquet, materialization, and controlled API queries — not only ingest. Ingest-only may still be the **first implementation slice**.

### C — Insufficient value / Postgres only

Rejected by benchmarks: compression, transform speed, history joins, and analytical latency are not achievable with the current entity-document path at this scale.

⸻

## Partitioning standard (initial)

Default layout for Aurii large datasets:

```
datasets/<dataset-id>/
  year=YYYY/
    part-*.parquet
```

Optional second level when query patterns filter by county/region:

```
datasets/<dataset-id>/
  year=YYYY/
    county=CC/
      part-*.parquet
```

Guidance from this run: ~100k rows/row group worked well; year partitions of ~11M rows (~25 MiB ZSTD) were efficient. Prefer fewer medium files over thousands of tiny ones.

⸻

## Summary

DuckDB + Parquet + object storage should become Aurii’s **Candidate** standard for large analytical datasets, beside PostgreSQL as system of record. Implement incrementally; do not replace entity Query Language; do not ship general SQL-over-HTTP.
