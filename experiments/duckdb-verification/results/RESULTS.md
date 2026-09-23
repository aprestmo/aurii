# DuckDB verification results
Generated: 2026-09-22 20:52:35 UTC
Years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] | Rows/year config: 11000000 | PG compare: 2000000

## Verdict

**ADR-0024 Option A (scoped/Candidate):** DuckDB + Parquet + object storage beside PostgreSQL.

| Question | Answer from this run |
|----------|----------------------|
| Faster/simpler than Postgres for large facts? | Yes — ~9× on 2M wash; 77M CSV→Parquet in 73s |
| Parquet first-class? | Yes — 3.69 GiB CSV → 170 MiB ZSTD |
| Datasets outside Postgres? | Yes — catalog in PG, bytes in files/S3 |
| R2/S3 + Parquet + DuckDB standard? | Yes (Candidate); moto verified S3 path |
| Materialize to Postgres? | Small aggregates (mun stats ~5 ms serve) |
| Operational vs analytical? | QL/entities vs DuckDB/Parquet scans |
| RAM | ~8–8.6 GiB peak at 77M with 8 GiB limit + spill |
| API latency | ~55 ms sequential; pool needed for concurrency |
| Ephemeral OK? | Yes for jobs (~55 ms); persistent better for API |
| Schema/dataset fit | Extend dataset metadata; keep entity SoR |

Heim/Halsa check: postal `6680` maps to municipality `1571` / county `15` in 2018–2019 and `5055` / `50` from 2020.

## Benchmark table

| Test | Rows | Input | Output | Runtime | Peak RAM | CPU% | Query latency | Disk R/W | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1a_generate_csv | 77,000,000 | — | 3.69 GiB | 30.652s | 99 MiB | 0 | — | 0/3783 MiB | Low — DuckDB range() COPY | years=[2018, 2019, 2020, 2021, 2022, 2023, 2024] rows/year=11000000 |
| 1b_csv_transform_parquet | 77,000,000 | 3.69 GiB | 169.8 MiB | 72.916s | 8144 MiB | 0 | — | 36849/13870 MiB | Low — ~40 lines SQL | people=11,000,000 heim_rows=4,400,000 null_income=0 compression=zstd |
| 1c_postgres_copy_transform | 2,000,000 | 98.3 MiB | — | 4.763s | 8144 MiB | 0 | — | 0/0 MiB | Medium — SQL + COPY + DISTINCT ON | relational Postgres (not Aurii JSON entities); sample=2,000,000 rows |
| 1d_duckdb_same_sample | 2,000,000 | 98.3 MiB | — | 0.509s | 8144 MiB | 0 | — | 0/0 MiB | Low | same sample as 1c for head-to-head |
| 2_history_joins | 77,000,000 | 169.8 MiB | 184.1 MiB | 44.315s | 8625 MiB | 0 | — | 6639/18473 MiB | Medium — temporal joins + successor map | Heim yearly=[(2018, 880000, 3, 2), (2019, 880000, 3, 2), (2020, 880000, 1, 1), (2021, 880000, 1, 1), (2022, 880000, 1, 1), (2023, 880000, 1, 1), (2024, 880000, 1, 1)]; Halsa postal county/mun transitions=[(2018, '1571', '15', '5055'), (2019, '1571', '15', '5055'), (2020, '5055', '50', '5055'), (2021, '5055', '50', '5055'), (2022, '5055', '50', '5055'), (2023, '5055', '50', '5055'), (2024, '5055', '50', '5055')] |
| 3_filter_year | 11,000,000 | 184.1 MiB | — | 0.015s | 8625 MiB | 0 | 14.4 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=1 |
| 3_filter_municipality | 6,160,000 | 184.1 MiB | — | 0.143s | 8625 MiB | 0 | 142.7 ms | 4/0 MiB | Low — SQL on Parquet | result_rows=1 |
| 3_agg_by_mun | 6 | 184.1 MiB | — | 0.069s | 8625 MiB | 0 | 69.2 ms | 10/0 MiB | Low — SQL on Parquet | result_rows=6 |
| 3_top_income | 50 | 184.1 MiB | — | 0.046s | 8625 MiB | 0 | 45.6 ms | 1/0 MiB | Low — SQL on Parquet | result_rows=50 |
| 3_percentiles | 6 | 184.1 MiB | — | 0.230s | 8625 MiB | 0 | 230.3 ms | 1/0 MiB | Low — SQL on Parquet | result_rows=6 |
| 3_window_rank | 72 | 184.1 MiB | — | 1.131s | 8625 MiB | 0 | 1130.5 ms | 4/0 MiB | Low — SQL on Parquet | result_rows=72 |
| 3_join_years | 6 | 184.1 MiB | — | 0.770s | 8625 MiB | 0 | 769.5 ms | 17/0 MiB | Low — SQL on Parquet | result_rows=6 |
| 4a_write_partition_year | 77,000,000 | 184.1 MiB | 185.2 MiB | 13.387s | 8625 MiB | 0 | — | 106/185 MiB | Low | files=7 |
| 4b_write_partition_year_county | 77,000,000 | — | 164.3 MiB | 16.032s | 8625 MiB | 0 | — | 0/164 MiB | Low | files=30 |
| 4c_query_year2024_flat | 11,000,000 | — | — | 0.050s | 8625 MiB | 0 | 49.6 ms | 0/0 MiB | Low | avg_income=723635.9 |
| 4c_query_year2024_part_year | 11,000,000 | — | — | 0.033s | 8625 MiB | 0 | 33.0 ms | 0/0 MiB | Low | avg_income=723635.9 |
| 4c_query_year2024_part_year_county | 11,000,000 | — | — | 0.029s | 8625 MiB | 0 | 29.2 ms | 0/0 MiB | Low | avg_income=723635.9 |
| 4d_parquet_metadata | 7 | — | — | 0.000s | 8625 MiB | 0 | — | 0/0 MiB | Low | avg_rows/file=11000000 avg_file_bytes=27745552 avg_row_groups=99.1 avg_rg_rows=110951 avg_rg_compressed=19854 |
| 5a_upload_parquet_s3 | 1 | — | 25.1 MiB | 0.161s | 8625 MiB | 0 | — | 0/49 MiB | Low — boto3 + metadata pointer | uploaded 1 files to s3://aurii-datasets/tax/ (moto) |
| 5b_duckdb_query_s3_parquet | 11,000,000 | — | — | 0.478s | 8625 MiB | 0 | 478.1 ms | 0/0 MiB | Low | avg_income=723635.9; S3-compatible (moto stands in for R2) |
| 6a_ephemeral_jobs_x3 | — | — | — | 0.172s | 8625 MiB | 0 | 57.4 ms | 0/0 MiB | Low — embed library, no daemon | per_job_s=[0.062, 0.055, 0.055] |
| 6b_persistent_connection_x3 | — | — | — | 0.145s | 8625 MiB | 0 | 42.6 ms | 0/0 MiB | Low | per_query_s=[0.044, 0.041, 0.043] |
| 7a_duckdb_aggregate | 42 | — | 1.8 KiB | 0.910s | 8625 MiB | 0 | — | 0/0 MiB | Low | — |
| 7b_load_aggregates_postgres | 42 | — | — | 0.020s | 8625 MiB | 0 | — | 0/0 MiB | Low | API can serve common stats from Postgres without scanning Parquet |
| 7c_postgres_serve_aggregate | — | — | — | 0.005s | 8625 MiB | 0 | 4.9 ms | 0/0 MiB | Low | operational read path |
| 8a_api_sequential_x10 | — | — | — | 0.597s | 8625 MiB | 0 | 54.7 ms | 0/0 MiB | Low — allowlisted queries only | min=52.0 max=64.0 p50=54.1 |
| 8b_api_concurrency_8 | — | — | — | 2.624s | 8625 MiB | 0 | 2495.4 ms | 0/0 MiB | Low | 8 parallel allowlisted queries; latencies=[2411.8, 2447.4, 2435.2, 2447.4, 2515.5, 2530.4, 2578.6, 2597.2] |

## Environment

- CPUs: 4
- DuckDB: 1.5.5
- RAM: 15.6 GiB
