# DuckDB verification (tax-list scale)

Technical verification that DuckDB + Parquet + object storage can sit beside PostgreSQL for Aurii’s large datasets.

**Decision:** [ADR-0024](../../adr/ADR-0024%20—%20DuckDB%20as%20Analytical%20Compute%20for%20Large%20Datasets.md) — Option **A (scoped/Candidate)**.

This directory is an **experiment**. It does not modify `@aurii/core` runtime behaviour.

## What was tested

| # | Test | Status |
|---|------|--------|
| 1 | CSV → DuckDB wash/dedup → Parquet (+ Postgres compare) | Done |
| 2 | Postal + municipality history joins (Heim / Halsa) | Done |
| 3 | Analytics directly on Parquet | Done |
| 4 | Hive partitioning (`year=`, `year=`+`county=`) | Done |
| 5 | S3-compatible object storage (moto ≈ R2) | Done |
| 6 | Ephemeral DuckDB jobs vs persistent connection | Done |
| 7 | Aggregate materialization into PostgreSQL | Done |
| 8 | Allowlisted API query PoC | Done |

## Results

- Full ~77M-row run: [`results/RESULTS.md`](results/RESULTS.md)
- Mid ~14M-row run: [`results/RESULTS_14M.md`](results/RESULTS_14M.md)
- Raw JSON: `results/measurements.json`

### Headline (77M rows, 4 CPU / 15.6 GiB)

* CSV 3.69 GiB → Parquet 170 MiB in **73 s**
* DuckDB **~9×** faster than relational Postgres on a 2M wash sample
* Heim/Halsa temporal correction verified (county 15 → 50 at 2020)
* Allowlisted API ~**55 ms** sequential; need a shared worker under concurrency

## Run locally

```bash
# Dependencies (Python 3.12+)
pip install -r requirements.txt

# PostgreSQL required for tests 1c, 7 (relational compare + materialization)
# AURII_QUICK=1 → 500k rows/year (smoke)
# Default → 11M rows/year × 7 years ≈ 77M

cd experiments/duckdb-verification
AURII_QUICK=1 python3 src/run_all.py
```

Environment knobs:

| Variable | Default | Meaning |
|----------|---------|---------|
| `AURII_TAX_ROWS_PER_YEAR` | `11000000` | Rows per year |
| `AURII_TAX_YEARS` | `2018,...,2024` | Years |
| `AURII_PG_COMPARE_ROWS` | `2000000` | Postgres head-to-head sample |
| `AURII_QUICK` | unset | If `1`, 500k rows/year |
| `AURII_SKIP_FULL` | unset | If `1`, only year 2024 |

Working data under `data/` is gitignored and regenerated each run.

## Fixtures

Committed history tables under `fixtures/`:

* `municipality_history.csv` — Hemne/Halsa/Snillfjord → Heim, Orkland mergers
* `postal_history.csv` — postal codes remapped across 2020
* `county_history.csv` — including Halsa’s move into Trøndelag

Tax **rows** are synthetic (deterministic `range()`), shaped like Norwegian tax lists, not the real Skatteetaten dump.

## Out of scope (by design)

* No Core migration off PostgreSQL
* No general SQL editor / SQL-over-HTTP
* No distributed DuckDB
* No production R2 credentials in CI (moto stands in)
