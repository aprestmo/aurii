# DuckDB verification results
Generated: 2026-09-22 20:49:06 UTC
Years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] | Rows/year config: 2000000 | PG compare: 1000000

## Benchmark table

| Test | Rows | Input | Output | Runtime | Peak RAM | CPU% | Query latency | Disk R/W | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1a_generate_csv | 14,000,000 | — | 687.7 MiB | 5.790s | 98 MiB | 0 | — | 0/688 MiB | Low — DuckDB range() COPY | years=[2018, 2019, 2020, 2021, 2022, 2023, 2024] rows/year=2000000 |
| 1b_csv_transform_parquet | 14,000,000 | 687.7 MiB | 31.3 MiB | 5.214s | 3408 MiB | 0 | — | 0/31 MiB | Low — ~40 lines SQL | people=2,000,000 heim_rows=800,000 null_income=0 compression=zstd |
| 1c_postgres_copy_transform | 1,000,000 | 49.1 MiB | — | 2.189s | 3408 MiB | 0 | — | 0/0 MiB | Medium — SQL + COPY + DISTINCT ON | relational Postgres (not Aurii JSON entities); sample=1,000,000 rows |
| 1d_duckdb_same_sample | 1,000,000 | 49.1 MiB | — | 0.279s | 3408 MiB | 0 | — | 0/0 MiB | Low | same sample as 1c for head-to-head |
| 2_history_joins | 14,000,000 | 31.3 MiB | 34.1 MiB | 5.057s | 5061 MiB | 0 | — | 0/34 MiB | Medium — temporal joins + successor map | Heim yearly=[(2018, 160000, 3, 2), (2019, 160000, 3, 2), (2020, 160000, 1, 1), (2021, 160000, 1, 1), (2022, 160000, 1, 1), (2023, 160000, 1, 1), (2024, 160000, 1, 1)]; Halsa postal county/mun transitions=[(2018, '1571', '15', '5055'), (2019, '1571', '15', '5055'), (2020, '5055', '50', '5055'), (2021, '5055', '50', '5055'), (2022, '5055', '50', '5055'), (2023, '5055', '50', '5055'), (2024, '5055', '50', '5055')] |
| 3_filter_year | 2,000,000 | 34.1 MiB | — | 0.006s | 5061 MiB | 0 | 5.4 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=1 |
| 3_filter_municipality | 1,120,000 | 34.1 MiB | — | 0.028s | 5061 MiB | 0 | 27.6 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=1 |
| 3_agg_by_mun | 6 | 34.1 MiB | — | 0.016s | 5061 MiB | 0 | 15.6 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=6 |
| 3_top_income | 50 | 34.1 MiB | — | 0.015s | 5061 MiB | 0 | 14.6 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=50 |
| 3_percentiles | 6 | 34.1 MiB | — | 0.038s | 5061 MiB | 0 | 37.4 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=6 |
| 3_window_rank | 24 | 34.1 MiB | — | 0.121s | 5061 MiB | 0 | 120.6 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=24 |
| 3_join_years | 6 | 34.1 MiB | — | 0.140s | 5061 MiB | 0 | 139.8 ms | 0/0 MiB | Low — SQL on Parquet | result_rows=6 |
| 4a_write_partition_year | 14,000,000 | 34.1 MiB | 34.2 MiB | 2.498s | 5061 MiB | 0 | — | 0/34 MiB | Low | files=7 |
| 4b_write_partition_year_county | 14,000,000 | — | 31.0 MiB | 3.057s | 5061 MiB | 0 | — | 0/31 MiB | Low | files=30 |
| 4c_query_year2024_flat | 2,000,000 | — | — | 0.014s | 5061 MiB | 0 | 13.6 ms | 0/0 MiB | Low | avg_income=694999.5 |
| 4c_query_year2024_part_year | 2,000,000 | — | — | 0.007s | 5061 MiB | 0 | 7.2 ms | 0/0 MiB | Low | avg_income=694999.5 |
| 4c_query_year2024_part_year_county | 2,000,000 | — | — | 0.007s | 5061 MiB | 0 | 7.0 ms | 0/0 MiB | Low | avg_income=694999.5 |
| 4d_parquet_metadata | 7 | — | — | 0.000s | 5061 MiB | 0 | — | 0/0 MiB | Low | avg_rows/file=2000000 avg_file_bytes=5129532 avg_row_groups=19.1 avg_rg_rows=104478 avg_rg_compressed=19004 |
| 5a_upload_parquet_s3 | 1 | — | 4.7 MiB | 0.030s | 5061 MiB | 0 | — | 0/0 MiB | Low — boto3 + metadata pointer | uploaded 1 files to s3://aurii-datasets/tax/ (moto) |
| 5b_duckdb_query_s3_parquet | 2,000,000 | — | — | 0.057s | 5061 MiB | 0 | 56.6 ms | 0/0 MiB | Low | avg_income=694999.5; S3-compatible (moto stands in for R2) |
| 6a_ephemeral_jobs_x3 | — | — | — | 0.055s | 5061 MiB | 0 | 18.3 ms | 0/0 MiB | Low — embed library, no daemon | per_job_s=[0.02, 0.018, 0.017] |
| 6b_persistent_connection_x3 | — | — | — | 0.038s | 5061 MiB | 0 | 8.8 ms | 0/0 MiB | Low | per_query_s=[0.009, 0.009, 0.009] |
| 7a_duckdb_aggregate | 42 | — | 1.8 KiB | 0.156s | 5061 MiB | 0 | — | 0/0 MiB | Low | — |
| 7b_load_aggregates_postgres | 42 | — | — | 0.015s | 5061 MiB | 0 | — | 0/0 MiB | Low | API can serve common stats from Postgres without scanning Parquet |
| 7c_postgres_serve_aggregate | — | — | — | 0.001s | 5061 MiB | 0 | 0.9 ms | 0/0 MiB | Low | operational read path |
| 8a_api_sequential_x10 | — | — | — | 0.208s | 5061 MiB | 0 | 17.2 ms | 0/0 MiB | Low — allowlisted queries only | min=16.2 max=20.3 p50=16.9 |
| 8b_api_concurrency_8 | — | — | — | 0.505s | 5061 MiB | 0 | 445.7 ms | 0/0 MiB | Low | 8 parallel allowlisted queries; latencies=[390.4, 391.8, 435.2, 465.6, 458.5, 479.6, 462.9, 481.3] |

## Environment

- CPUs: 4
- DuckDB: 1.5.5
- RAM: 15.6 GiB
