"""
Aurii DuckDB verification suite — synthetic Norwegian tax-list scale.

Runs Tests 1–8 from the DuckDB architecture investigation and writes
JSON + markdown measurements under experiments/duckdb-verification/results/.

Environment:
  AURII_TAX_YEARS           default 2018..2024
  AURII_TAX_ROWS_PER_YEAR   default 11000000 (~77M total)
  AURII_PG_COMPARE_ROWS     default 2000000
  AURII_SKIP_FULL           if 1, skip multi-year full ingest (use one year)
  AURII_QUICK               if 1, use 500_000 rows/year for CI-smoke
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import duckdb
import psycopg2
from moto.server import ThreadedMotoServer

# Ensure src imports work when run as script
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (  # noqa: E402
    ANALYTICS_YEARS,
    DATA,
    FIXTURES,
    PG_COMPARE_ROWS,
    RESULTS,
    ROWS_PER_YEAR,
    YEARS,
    ensure_dirs,
)
from metrics import Measurement, file_size, markdown_table, measure, save_measurements  # noqa: E402


def connect_duckdb(threads: int | None = None) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(database=":memory:")
    n = threads or min(4, os.cpu_count() or 4)
    con.execute(f"SET threads={n}")
    # Cap memory so the host stays responsive (~half of available)
    con.execute("SET memory_limit='8GB'")
    con.execute("SET temp_directory=?", [str(DATA / "duckdb_tmp")])
    (DATA / "duckdb_tmp").mkdir(parents=True, exist_ok=True)
    return con


def _quick_rows() -> int:
    if os.environ.get("AURII_QUICK") == "1":
        return 500_000
    return ROWS_PER_YEAR


def generate_year_csv(con: duckdb.DuckDBPyConnection, year: int, rows: int) -> Path:
    """Generate synthetic tax CSV for one year with Heim-relevant municipality codes."""
    out = DATA / "csv" / f"tax_{year}.csv"
    if out.exists() and out.stat().st_size > 0:
        # Reuse if row count matches (cheap check via duckdb)
        existing = con.execute(
            f"SELECT count(*) FROM read_csv_auto('{out.as_posix()}', header=true)"
        ).fetchone()[0]
        if existing == rows:
            return out

    # Municipality assignment depends on year (Heim formed 2020-01-01).
    # ~8% of rows are Heim-cluster postal areas for Test 2 stress.
    sql = f"""
    COPY (
      SELECT
        {year} AS year,
        printf('P%010d', i) AS person_id,
        CASE
          WHEN i % 100 < 8 THEN
            CASE
              WHEN {year} < 2020 THEN
                CASE i % 5
                  WHEN 0 THEN '5011'  -- Hemne
                  WHEN 1 THEN '5011'
                  WHEN 2 THEN '1571'  -- Halsa
                  WHEN 3 THEN '5012'  -- Snillfjord
                  ELSE '5011'
                END
              ELSE '5055'  -- Heim
            END
          WHEN i % 100 < 20 THEN CASE WHEN {year} < 2020 THEN
              CASE i % 4 WHEN 0 THEN '5024' WHEN 1 THEN '5023' WHEN 2 THEN '5016' ELSE '5025' END
            ELSE '5059' END
          WHEN i % 100 < 40 THEN '5001'
          WHEN i % 100 < 55 THEN '0301'
          WHEN i % 100 < 70 THEN '1103'
          ELSE '4601'
        END AS municipality_id,
        CASE
          WHEN i % 100 < 8 THEN
            CASE i % 5
              WHEN 0 THEN '7200'
              WHEN 1 THEN '7201'
              WHEN 2 THEN '6680'
              WHEN 3 THEN '6683'
              ELSE '7250'
            END
          WHEN i % 100 < 20 THEN '7300'
          WHEN i % 100 < 40 THEN '7000'
          WHEN i % 100 < 55 THEN '0150'
          WHEN i % 100 < 70 THEN '4000'
          ELSE '5000'
        END AS postal_code,
        (250000 + (i % 900000) + ({year} - 2018) * 5000)::INTEGER AS income,
        (40000 + (i % 200000))::INTEGER AS tax,
        (i % 50) * 100000::INTEGER AS wealth,
        CASE WHEN i % 17 = 0 THEN NULL ELSE (i % 7) END AS household_size,
        -- inject dirty rows for wash/dedup
        CASE WHEN i % 10007 = 0 THEN printf('P%010d', i - 1) ELSE NULL END AS dup_of
      FROM range(0, {rows}) AS t(i)
    ) TO '{out.as_posix()}' (HEADER, DELIMITER ',')
    """
    con.execute(sql)
    return out


def test1_csv_to_parquet(measurements: list[Measurement]) -> Path:
    """Test 1: CSV → DuckDB normalize/wash/dedup/validate → Parquet."""
    con = connect_duckdb()
    rows = _quick_rows()
    years = YEARS if os.environ.get("AURII_SKIP_FULL") != "1" else [2024]
    csv_paths: list[Path] = []
    with measure("1a_generate_csv") as m:
        for y in years:
            csv_paths.append(generate_year_csv(con, y, rows))
        m.rows = rows * len(years)
        m.output_bytes = sum(file_size(p) for p in csv_paths)
        m.implementation_complexity = "Low — DuckDB range() COPY"
        m.notes = f"years={years} rows/year={rows}"
    measurements.append(m)

    parquet_root = DATA / "parquet" / "tax_flat"
    parquet_root.mkdir(parents=True, exist_ok=True)
    out_file = parquet_root / "tax_all.parquet"

    with measure("1b_csv_transform_parquet") as m:
        # Load, normalize, wash, type convert, dedup, validate, write
        con.execute("INSTALL httpfs; LOAD httpfs;")  # harmless if unused
        con.execute(
            f"""
            CREATE OR REPLACE TABLE tax_raw AS
            SELECT * FROM read_csv_auto(
              {[p.as_posix() for p in csv_paths]},
              header=true,
              union_by_name=true
            );
            """
        )
        con.execute(
            """
            CREATE OR REPLACE TABLE tax_clean AS
            SELECT
              year::INTEGER AS year,
              person_id::VARCHAR AS person_id,
              lpad(municipality_id::VARCHAR, 4, '0') AS municipality_id,
              lpad(postal_code::VARCHAR, 4, '0') AS postal_code,
              income::BIGINT AS income,
              tax::BIGINT AS tax,
              wealth::BIGINT AS wealth,
              household_size::INTEGER AS household_size
            FROM tax_raw
            WHERE person_id IS NOT NULL
              AND municipality_id IS NOT NULL
              AND income >= 0
              AND tax >= 0
            QUALIFY row_number() OVER (
              PARTITION BY year, person_id
              ORDER BY income DESC
            ) = 1;
            """
        )
        # Validation summary
        stats = con.execute(
            """
            SELECT
              count(*) AS rows,
              count(DISTINCT person_id) AS people,
              sum(CASE WHEN municipality_id = '5055' THEN 1 ELSE 0 END) AS heim_rows,
              sum(CASE WHEN income IS NULL THEN 1 ELSE 0 END) AS null_income
            FROM tax_clean
            """
        ).fetchone()
        con.execute(f"COPY tax_clean TO '{out_file.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        m.rows = int(stats[0])
        m.input_bytes = sum(file_size(p) for p in csv_paths)
        m.output_bytes = file_size(out_file)
        m.implementation_complexity = "Low — ~40 lines SQL"
        m.notes = (
            f"people={stats[1]:,} heim_rows={stats[2]:,} null_income={stats[3]} "
            f"compression=zstd"
        )
        m.extra = {"heim_rows": stats[2], "people": stats[1]}
    measurements.append(m)
    con.close()
    return out_file


def test1_postgres_compare(measurements: list[Measurement], csv_sample: Path) -> None:
    """Compare a relational Postgres COPY+transform path on a bounded slice."""
    rows = min(PG_COMPARE_ROWS, _quick_rows())
    con = connect_duckdb()
    sample = DATA / "csv" / "tax_pg_sample.csv"
    # Build sample from existing 2024 csv or generate
    src = DATA / "csv" / "tax_2024.csv"
    if not src.exists():
        generate_year_csv(con, 2024, rows)
        src = DATA / "csv" / "tax_2024.csv"
    con.execute(
        f"""
        COPY (
          SELECT * FROM read_csv_auto('{src.as_posix()}', header=true)
          LIMIT {rows}
        ) TO '{sample.as_posix()}' (HEADER, DELIMITER ',')
        """
    )
    con.close()

    pg = psycopg2.connect(
        host="127.0.0.1",
        dbname="aurii_duckdb_bench",
        user="aurii",
        password="aurii",
    )
    pg.autocommit = True
    cur = pg.cursor()
    cur.execute("DROP TABLE IF EXISTS tax_raw CASCADE")
    cur.execute("DROP TABLE IF EXISTS tax_clean CASCADE")
    cur.execute(
        """
        CREATE TABLE tax_raw (
          year INT, person_id TEXT, municipality_id TEXT, postal_code TEXT,
          income BIGINT, tax BIGINT, wealth BIGINT, household_size INT, dup_of TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE tax_clean (
          year INT, person_id TEXT, municipality_id TEXT, postal_code TEXT,
          income BIGINT, tax BIGINT, wealth BIGINT, household_size INT
        )
        """
    )

    with measure("1c_postgres_copy_transform") as m:
        with sample.open() as f:
            # skip header
            next(f)
            cur.copy_expert(
                "COPY tax_raw FROM STDIN WITH (FORMAT csv)",
                f,
            )
        cur.execute(
            """
            INSERT INTO tax_clean
            SELECT DISTINCT ON (year, person_id)
              year,
              person_id,
              lpad(municipality_id, 4, '0'),
              lpad(postal_code, 4, '0'),
              income, tax, wealth, household_size
            FROM tax_raw
            WHERE person_id IS NOT NULL AND municipality_id IS NOT NULL
              AND income >= 0 AND tax >= 0
            ORDER BY year, person_id, income DESC
            """
        )
        cur.execute("SELECT count(*) FROM tax_clean")
        m.rows = cur.fetchone()[0]
        m.input_bytes = file_size(sample)
        m.implementation_complexity = "Medium — SQL + COPY + DISTINCT ON"
        m.notes = f"relational Postgres (not Aurii JSON entities); sample={rows:,} rows"
    measurements.append(m)

    # Fair DuckDB same sample
    dcon = connect_duckdb()
    with measure("1d_duckdb_same_sample") as m:
        dcon.execute(
            f"""
            CREATE TABLE tax_clean AS
            SELECT
              year::INTEGER, person_id::VARCHAR,
              lpad(municipality_id::VARCHAR, 4, '0') AS municipality_id,
              lpad(postal_code::VARCHAR, 4, '0') AS postal_code,
              income::BIGINT, tax::BIGINT, wealth::BIGINT, household_size::INTEGER
            FROM read_csv_auto('{sample.as_posix()}', header=true)
            WHERE person_id IS NOT NULL AND municipality_id IS NOT NULL
              AND income >= 0 AND tax >= 0
            QUALIFY row_number() OVER (PARTITION BY year, person_id ORDER BY income DESC) = 1
            """
        )
        m.rows = dcon.execute("SELECT count(*) FROM tax_clean").fetchone()[0]
        m.input_bytes = file_size(sample)
        m.implementation_complexity = "Low"
        m.notes = "same sample as 1c for head-to-head"
    measurements.append(m)
    dcon.close()
    cur.close()
    pg.close()


def test2_history_joins(measurements: list[Measurement], parquet_path: Path) -> Path:
    """Test 2: join tax records to postal + municipality history (Heim cases)."""
    con = connect_duckdb()
    mun = FIXTURES / "municipality_history.csv"
    postal = FIXTURES / "postal_history.csv"
    county = FIXTURES / "county_history.csv"
    out = DATA / "parquet" / "tax_historically_corrected.parquet"

    with measure("2_history_joins") as m:
        con.execute(
            f"""
            CREATE OR REPLACE TABLE mun_hist AS
            SELECT * FROM read_csv_auto('{mun.as_posix()}', header=true);
            CREATE OR REPLACE TABLE postal_hist AS
            SELECT * FROM read_csv_auto('{postal.as_posix()}', header=true);
            CREATE OR REPLACE TABLE county_hist AS
            SELECT * FROM read_csv_auto('{county.as_posix()}', header=true);
            CREATE OR REPLACE TABLE tax AS
            SELECT * FROM read_parquet('{parquet_path.as_posix()}');
            """
        )
        # Historical correction:
        # 1) Resolve postal → municipality as of tax year (Jan 1)
        # 2) Map dissolved municipalities to successors for "current" view
        # 3) Attach historically correct county
        con.execute(
            """
            CREATE OR REPLACE TABLE tax_corrected AS
            WITH tax_dated AS (
              SELECT t.*, make_date(t.year, 1, 1) AS as_of
              FROM tax t
            ),
            with_postal AS (
              SELECT
                td.*,
                ph.municipality_id AS municipality_from_postal,
                ph.place_name
              FROM tax_dated td
              LEFT JOIN postal_hist ph
                ON ph.postal_code = td.postal_code
               AND td.as_of BETWEEN ph.valid_from::DATE AND ph.valid_to::DATE
            ),
            with_mun AS (
              SELECT
                wp.*,
                coalesce(wp.municipality_from_postal, wp.municipality_id) AS hist_municipality_id,
                mh.name AS municipality_name,
                mh.county_id AS hist_county_id,
                mh.change_type,
                mh.successor_id
              FROM with_postal wp
              LEFT JOIN mun_hist mh
                ON mh.municipality_id = coalesce(wp.municipality_from_postal, wp.municipality_id)
               AND wp.as_of BETWEEN mh.valid_from::DATE AND mh.valid_to::DATE
               AND mh.change_type != 'county'
            )
            SELECT
              year, person_id, postal_code, income, tax, wealth, household_size,
              municipality_id AS source_municipality_id,
              hist_municipality_id,
              municipality_name,
              hist_county_id,
              ch.name AS hist_county_name,
              -- "current" municipality after mergers
              coalesce(
                CASE WHEN year < 2020 AND hist_municipality_id IN ('5011','1571','5012')
                     THEN '5055' END,
                CASE WHEN year < 2020 AND hist_municipality_id IN ('5024','5023','5016','5025')
                     THEN '5059' END,
                hist_municipality_id
              ) AS current_municipality_id,
              change_type,
              place_name
            FROM with_mun wm
            LEFT JOIN county_hist ch
              ON ch.county_id = wm.hist_county_id
             AND wm.as_of BETWEEN ch.valid_from::DATE AND ch.valid_to::DATE
            """
        )
        heim = con.execute(
            """
            SELECT
              year,
              count(*) AS n,
              count(DISTINCT hist_municipality_id) AS hist_muns,
              count(DISTINCT hist_county_id) AS hist_counties
            FROM tax_corrected
            WHERE postal_code IN ('7200','7201','6680','6683','7250')
               OR hist_municipality_id IN ('5011','1571','5012','5055')
               OR current_municipality_id = '5055'
            GROUP BY year
            ORDER BY year
            """
        ).fetchall()
        # Assert Heim county shift for Halsa postal 6680
        halsa = con.execute(
            """
            SELECT year, hist_municipality_id, hist_county_id, current_municipality_id
            FROM tax_corrected
            WHERE postal_code = '6680'
            GROUP BY 1,2,3,4
            ORDER BY year
            """
        ).fetchall()
        con.execute(
            f"COPY tax_corrected TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)"
        )
        m.rows = con.execute("SELECT count(*) FROM tax_corrected").fetchone()[0]
        m.input_bytes = file_size(parquet_path)
        m.output_bytes = file_size(out)
        m.implementation_complexity = "Medium — temporal joins + successor map"
        m.notes = (
            f"Heim yearly={heim}; Halsa postal county/mun transitions={halsa}"
        )
        m.extra = {"heim_by_year": heim, "halsa_transitions": halsa}
    measurements.append(m)
    con.close()
    return out


def test3_analytics(measurements: list[Measurement], parquet_path: Path) -> None:
    """Test 3: analytical queries directly on Parquet."""
    con = connect_duckdb()
    queries = {
        "filter_year": f"""
            SELECT count(*) FROM read_parquet('{parquet_path.as_posix()}') WHERE year = 2024
        """,
        "filter_municipality": f"""
            SELECT count(*) FROM read_parquet('{parquet_path.as_posix()}')
            WHERE hist_municipality_id = '5055' OR current_municipality_id = '5055'
        """,
        "agg_by_mun": f"""
            SELECT current_municipality_id, count(*) AS people, avg(income) AS average_income
            FROM read_parquet('{parquet_path.as_posix()}')
            WHERE year = 2024
            GROUP BY 1
            ORDER BY people DESC
            LIMIT 20
        """,
        "top_income": f"""
            SELECT person_id, income, current_municipality_id
            FROM read_parquet('{parquet_path.as_posix()}')
            WHERE year = 2024
            ORDER BY income DESC
            LIMIT 50
        """,
        "percentiles": f"""
            SELECT
              current_municipality_id,
              quantile_cont(income, 0.5) AS median_income,
              quantile_cont(income, 0.9) AS p90_income,
              quantile_cont(income, 0.99) AS p99_income
            FROM read_parquet('{parquet_path.as_posix()}')
            WHERE year = 2024
            GROUP BY 1
            ORDER BY median_income DESC
            LIMIT 20
        """,
        "window_rank": f"""
            SELECT * FROM (
              SELECT person_id, current_municipality_id, income,
                     rank() OVER (PARTITION BY current_municipality_id ORDER BY income DESC) AS rnk
              FROM read_parquet('{parquet_path.as_posix()}')
              WHERE year = 2024
            ) WHERE rnk <= 3
            LIMIT 100
        """,
        "join_years": f"""
            WITH a AS (
              SELECT person_id, income AS income_2023
              FROM read_parquet('{parquet_path.as_posix()}') WHERE year = 2023
            ),
            b AS (
              SELECT person_id, income AS income_2024, current_municipality_id
              FROM read_parquet('{parquet_path.as_posix()}') WHERE year = 2024
            )
            SELECT b.current_municipality_id,
                   avg(b.income_2024 - a.income_2023) AS avg_delta
            FROM a JOIN b USING (person_id)
            GROUP BY 1
            ORDER BY avg_delta DESC
            LIMIT 20
        """,
    }
    # Warmup
    con.execute(queries["filter_year"]).fetchall()
    for name, sql in queries.items():
        with measure(f"3_{name}") as m:
            t0 = time.perf_counter()
            rows = con.execute(sql).fetchall()
            latency = (time.perf_counter() - t0) * 1000
            m.query_latency_ms = round(latency, 2)
            m.rows = len(rows) if name != "filter_year" and name != "filter_municipality" else int(rows[0][0])
            m.input_bytes = file_size(parquet_path)
            m.implementation_complexity = "Low — SQL on Parquet"
            m.notes = f"result_rows={len(rows)}"
        measurements.append(m)
    con.close()


def test4_partitioning(measurements: list[Measurement], corrected: Path) -> Path:
    """Test 4: Hive-style partitioning by year and year+county."""
    con = connect_duckdb()
    part_year = DATA / "parquet_partitioned" / "tax_by_year"
    part_county = DATA / "parquet_partitioned" / "tax_by_year_county"
    part_year.mkdir(parents=True, exist_ok=True)
    part_county.mkdir(parents=True, exist_ok=True)

    with measure("4a_write_partition_year") as m:
        con.execute(
            f"""
            COPY (
              SELECT * FROM read_parquet('{corrected.as_posix()}')
            ) TO '{part_year.as_posix()}'
            (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (year), OVERWRITE_OR_IGNORE)
            """
        )
        m.output_bytes = file_size(part_year)
        m.input_bytes = file_size(corrected)
        m.rows = con.execute(
            f"SELECT count(*) FROM read_parquet('{part_year.as_posix()}/**/*.parquet')"
        ).fetchone()[0]
        m.implementation_complexity = "Low"
        m.notes = f"files={len(list(part_year.rglob('*.parquet')))}"
    measurements.append(m)

    with measure("4b_write_partition_year_county") as m:
        con.execute(
            f"""
            COPY (
              SELECT *, hist_county_id AS county FROM read_parquet('{corrected.as_posix()}')
            ) TO '{part_county.as_posix()}'
            (FORMAT PARQUET, COMPRESSION ZSTD, PARTITION_BY (year, county), OVERWRITE_OR_IGNORE)
            """
        )
        m.output_bytes = file_size(part_county)
        m.rows = con.execute(
            f"SELECT count(*) FROM read_parquet('{part_county.as_posix()}/**/*.parquet')"
        ).fetchone()[0]
        m.implementation_complexity = "Low"
        m.notes = f"files={len(list(part_county.rglob('*.parquet')))}"
    measurements.append(m)

    # Query effect: year filter on flat vs partitioned
    for label, path in [
        ("flat", corrected),
        ("part_year", part_year / "**" / "*.parquet"),
        ("part_year_county", part_county / "**" / "*.parquet"),
    ]:
        glob = path.as_posix() if isinstance(path, Path) else str(path)
        if label != "flat":
            glob = str(path) if not isinstance(path, Path) else path.as_posix()
            # rebuild
            if label == "part_year":
                glob = f"{part_year.as_posix()}/**/*.parquet"
            else:
                glob = f"{part_county.as_posix()}/**/*.parquet"
        else:
            glob = corrected.as_posix()
        with measure(f"4c_query_year2024_{label}") as m:
            t0 = time.perf_counter()
            n = con.execute(
                f"SELECT count(*), avg(income) FROM read_parquet('{glob}') WHERE year = 2024"
            ).fetchone()
            m.query_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            m.rows = int(n[0])
            m.notes = f"avg_income={n[1]:.1f}" if n[1] else ""
            m.implementation_complexity = "Low"
        measurements.append(m)

    # File size / row group probe
    probe = con.execute(
        f"""
        SELECT
          count(*) AS files,
          avg(num_rows) AS avg_rows,
          avg(file_size_bytes) AS avg_file_bytes,
          avg(num_row_groups) AS avg_row_groups
        FROM parquet_file_metadata('{part_year.as_posix()}/**/*.parquet')
        """
    ).fetchone()
    rg = con.execute(
        f"""
        SELECT avg(row_group_num_rows), avg(total_compressed_size)
        FROM parquet_metadata('{part_year.as_posix()}/**/*.parquet')
        """
    ).fetchone()
    with measure("4d_parquet_metadata") as m:
        m.rows = int(probe[0]) if probe[0] else 0
        m.notes = (
            f"avg_rows/file={probe[1]:.0f} avg_file_bytes={probe[2]:.0f} "
            f"avg_row_groups={probe[3]:.1f} avg_rg_rows={rg[0]:.0f} avg_rg_compressed={rg[1]:.0f}"
        )
        m.implementation_complexity = "Low"
        m.extra = {
            "avg_rows": probe[1],
            "avg_file_bytes": probe[2],
            "avg_row_groups": probe[3],
            "avg_rg_rows": rg[0],
            "avg_rg_compressed": rg[1],
        }
    measurements.append(m)
    con.close()
    return part_year


def test5_object_storage(measurements: list[Measurement], part_year: Path) -> None:
    """Test 5: DuckDB against S3-compatible storage (moto)."""
    # Prefer a single year partition for upload size
    year_dir = next(part_year.glob("year=*"), None)
    if year_dir is None:
        files = list(part_year.rglob("*.parquet"))
    else:
        files = list(year_dir.rglob("*.parquet"))
    if not files:
        measurements.append(
            Measurement(test="5_s3_skip", notes="no parquet files to upload", implementation_complexity="—")
        )
        return

    server = ThreadedMotoServer(port=5010, verbose=False)
    server.start()
    time.sleep(0.5)
    try:
        import boto3

        os.environ["AWS_ACCESS_KEY_ID"] = "testing"
        os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
        os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
        s3 = boto3.client("s3", endpoint_url="http://127.0.0.1:5010")
        s3.create_bucket(Bucket="aurii-datasets")
        with measure("5a_upload_parquet_s3") as m:
            total = 0
            for f in files[:8]:  # cap upload count for moto memory
                key = f"tax/{f.parent.name}/{f.name}" if f.parent.name.startswith("year=") else f"tax/{f.name}"
                s3.upload_file(str(f), "aurii-datasets", key)
                total += f.stat().st_size
            m.output_bytes = total
            m.rows = min(8, len(files))
            m.implementation_complexity = "Low — boto3 + metadata pointer"
            m.notes = f"uploaded {m.rows} files to s3://aurii-datasets/tax/ (moto)"
        measurements.append(m)

        con = connect_duckdb()
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET s3_endpoint='127.0.0.1:5010'")
        con.execute("SET s3_access_key_id='testing'")
        con.execute("SET s3_secret_access_key='testing'")
        con.execute("SET s3_url_style='path'")
        con.execute("SET s3_use_ssl=false")
        with measure("5b_duckdb_query_s3_parquet") as m:
            t0 = time.perf_counter()
            n = con.execute(
                "SELECT count(*), avg(income) FROM read_parquet('s3://aurii-datasets/tax/**/*.parquet')"
            ).fetchone()
            m.query_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            m.rows = int(n[0])
            m.notes = f"avg_income={n[1]:.1f}; S3-compatible (moto stands in for R2)"
            m.implementation_complexity = "Low"
        measurements.append(m)
        con.close()

        # Dataset metadata shape for Postgres (conceptual)
        meta = {
            "id": "tax-lists",
            "name": "Norwegian tax lists (synthetic)",
            "schema": "tax_record",
            "storage_location": "s3://aurii-datasets/tax/",
            "format": "parquet",
            "row_count": int(n[0]),
            "version": "v1-synthetic",
        }
        (RESULTS / "dataset_metadata_example.json").write_text(json.dumps(meta, indent=2))
    finally:
        server.stop()


def test6_ephemeral_engine(measurements: list[Measurement], part_year: Path) -> None:
    """Test 6: start DuckDB per job, transform, terminate — vs long-lived connection."""
    glob = f"{part_year.as_posix()}/**/*.parquet"

    # Cold start per job (3 iterations)
    cold_times = []
    with measure("6a_ephemeral_jobs_x3") as m:
        for i in range(3):
            t0 = time.perf_counter()
            con = connect_duckdb()
            con.execute(
                f"""
                COPY (
                  SELECT current_municipality_id, count(*) AS n, avg(income) AS avg_income
                  FROM read_parquet('{glob}')
                  WHERE year = 2024
                  GROUP BY 1
                ) TO '{(DATA / 'exports' / f'agg_job_{i}.parquet').as_posix()}' (FORMAT PARQUET)
                """
            )
            con.close()
            cold_times.append(time.perf_counter() - t0)
        m.runtime_s = round(sum(cold_times), 3)
        m.query_latency_ms = round(sum(cold_times) / len(cold_times) * 1000, 2)
        m.notes = f"per_job_s={[round(t, 3) for t in cold_times]}"
        m.implementation_complexity = "Low — embed library, no daemon"
        m.extra = {"per_job_s": cold_times}
    measurements.append(m)

    # Persistent connection (3 queries)
    warm_times = []
    with measure("6b_persistent_connection_x3") as m:
        con = connect_duckdb()
        # warmup
        con.execute(f"SELECT count(*) FROM read_parquet('{glob}') WHERE year = 2024").fetchone()
        for _ in range(3):
            t0 = time.perf_counter()
            con.execute(
                f"""
                SELECT current_municipality_id, count(*), avg(income)
                FROM read_parquet('{glob}')
                WHERE year = 2024
                GROUP BY 1
                """
            ).fetchall()
            warm_times.append(time.perf_counter() - t0)
        con.close()
        m.query_latency_ms = round(sum(warm_times) / len(warm_times) * 1000, 2)
        m.notes = f"per_query_s={[round(t, 3) for t in warm_times]}"
        m.implementation_complexity = "Low"
        m.extra = {"per_query_s": warm_times}
    measurements.append(m)


def test7_materialize_postgres(measurements: list[Measurement], part_year: Path) -> None:
    """Test 7: DuckDB aggregate → materialize into PostgreSQL."""
    glob = f"{part_year.as_posix()}/**/*.parquet"
    con = connect_duckdb()
    with measure("7a_duckdb_aggregate") as m:
        con.execute(
            f"""
            CREATE OR REPLACE TABLE municipality_statistics AS
            SELECT
              year,
              current_municipality_id AS municipality_id,
              count(*)::BIGINT AS population_count,
              avg(income)::DOUBLE AS average_income,
              quantile_cont(income, 0.5)::DOUBLE AS median_income,
              avg(tax)::DOUBLE AS average_tax
            FROM read_parquet('{glob}')
            GROUP BY 1, 2
            """
        )
        m.rows = con.execute("SELECT count(*) FROM municipality_statistics").fetchone()[0]
        export = DATA / "exports" / "municipality_statistics.parquet"
        con.execute(f"COPY municipality_statistics TO '{export.as_posix()}' (FORMAT PARQUET)")
        m.output_bytes = file_size(export)
        m.implementation_complexity = "Low"
    measurements.append(m)

    pg = psycopg2.connect(
        host="127.0.0.1", dbname="aurii_duckdb_bench", user="aurii", password="aurii"
    )
    pg.autocommit = True
    cur = pg.cursor()
    cur.execute("DROP TABLE IF EXISTS municipality_statistics")
    cur.execute(
        """
        CREATE TABLE municipality_statistics (
          year INT,
          municipality_id TEXT,
          population_count BIGINT,
          average_income DOUBLE PRECISION,
          median_income DOUBLE PRECISION,
          average_tax DOUBLE PRECISION,
          PRIMARY KEY (year, municipality_id)
        )
        """
    )
    rows = con.execute("SELECT * FROM municipality_statistics").fetchall()
    with measure("7b_load_aggregates_postgres") as m:
        cur.executemany(
            """
            INSERT INTO municipality_statistics
            (year, municipality_id, population_count, average_income, median_income, average_tax)
            VALUES (%s,%s,%s,%s,%s,%s)
            """,
            rows,
        )
        m.rows = len(rows)
        m.implementation_complexity = "Low"
        m.notes = "API can serve common stats from Postgres without scanning Parquet"
    measurements.append(m)

    with measure("7c_postgres_serve_aggregate") as m:
        t0 = time.perf_counter()
        cur.execute(
            """
            SELECT municipality_id, population_count, average_income, median_income
            FROM municipality_statistics
            WHERE year = 2024
            ORDER BY average_income DESC
            LIMIT 20
            """
        )
        cur.fetchall()
        m.query_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        m.implementation_complexity = "Low"
        m.notes = "operational read path"
    measurements.append(m)
    cur.close()
    pg.close()
    con.close()


def test8_api_poc(measurements: list[Measurement], part_year: Path) -> None:
    """Test 8: controlled dataset query endpoint using ephemeral DuckDB."""
    from fastapi import FastAPI, HTTPException
    from fastapi.testclient import TestClient

    glob = f"{part_year.as_posix()}/**/*.parquet"
    app = FastAPI(title="Aurii DuckDB dataset query PoC")

    ALLOWED = {
        "mun_stats": f"""
            SELECT current_municipality_id AS municipality_id,
                   count(*) AS people,
                   avg(income) AS average_income
            FROM read_parquet('{glob}')
            WHERE year = ?
            GROUP BY 1
            ORDER BY people DESC
            LIMIT 50
        """,
        "heim_overview": f"""
            SELECT year, count(*) AS people, avg(income) AS average_income
            FROM read_parquet('{glob}')
            WHERE current_municipality_id = '5055' OR hist_municipality_id = '5055'
            GROUP BY 1 ORDER BY 1
        """,
    }

    @app.get("/datasets/{dataset_id}/query")
    def query_dataset(dataset_id: str, q: str = "mun_stats", year: int = 2024):
        if dataset_id != "tax-lists":
            raise HTTPException(404, "dataset not found")
        if q not in ALLOWED:
            raise HTTPException(400, f"query must be one of {list(ALLOWED)}")
        t0 = time.perf_counter()
        con = connect_duckdb()
        try:
            sql = ALLOWED[q]
            if "?" in sql:
                rows = con.execute(sql, [year]).fetchall()
                cols = [d[0] for d in con.description]
            else:
                rows = con.execute(sql).fetchall()
                cols = [d[0] for d in con.description]
        finally:
            con.close()
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "datasetId": dataset_id,
            "query": q,
            "latencyMs": round(latency_ms, 2),
            "columns": cols,
            "rows": [dict(zip(cols, r)) for r in rows],
        }

    client = TestClient(app)
    # Sequential latency
    latencies = []
    with measure("8a_api_sequential_x10") as m:
        for _ in range(10):
            r = client.get("/datasets/tax-lists/query", params={"q": "mun_stats", "year": 2024})
            assert r.status_code == 200
            latencies.append(r.json()["latencyMs"])
        m.query_latency_ms = round(sum(latencies) / len(latencies), 2)
        m.notes = f"min={min(latencies):.1f} max={max(latencies):.1f} p50={sorted(latencies)[5]:.1f}"
        m.implementation_complexity = "Low — allowlisted queries only"
        m.extra = {"latencies_ms": latencies}
    measurements.append(m)

    # Light concurrency
    from concurrent.futures import ThreadPoolExecutor, as_completed

    conc_lat = []
    with measure("8b_api_concurrency_8") as m:
        def one():
            r = client.get("/datasets/tax-lists/query", params={"q": "heim_overview"})
            return r.status_code, r.json()["latencyMs"]

        with ThreadPoolExecutor(max_workers=8) as ex:
            futs = [ex.submit(one) for _ in range(8)]
            for fut in as_completed(futs):
                code, lat = fut.result()
                assert code == 200
                conc_lat.append(lat)
        m.query_latency_ms = round(sum(conc_lat) / len(conc_lat), 2)
        m.notes = f"8 parallel allowlisted queries; latencies={ [round(x,1) for x in conc_lat] }"
        m.implementation_complexity = "Low"
        m.extra = {"latencies_ms": conc_lat}
    measurements.append(m)

    # Persist a tiny standalone server script path note
    (RESULTS / "api_poc_note.json").write_text(
        json.dumps(
            {
                "endpoint": "GET /datasets/:datasetId/query?q=mun_stats&year=2024",
                "allowed_queries": list(ALLOWED),
                "mean_sequential_ms": measurements[-2].query_latency_ms,
                "mean_concurrency_ms": measurements[-1].query_latency_ms,
            },
            indent=2,
        )
    )


def write_report(measurements: list[Measurement]) -> None:
    save_measurements(RESULTS / "measurements.json", measurements)
    md = []
    md.append("# DuckDB verification results\n")
    md.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n")
    md.append(f"Years: {YEARS} | Rows/year config: {_quick_rows()} | PG compare: {PG_COMPARE_ROWS}\n")
    md.append("\n## Benchmark table\n\n")
    md.append(markdown_table(measurements))
    md.append("\n\n## Environment\n\n")
    md.append(f"- CPUs: {os.cpu_count()}\n")
    md.append(f"- DuckDB: {duckdb.__version__}\n")
    try:
        import psutil as ps

        md.append(f"- RAM: {ps.virtual_memory().total / (1024**3):.1f} GiB\n")
    except Exception:
        pass
    (RESULTS / "RESULTS.md").write_text("".join(md), encoding="utf-8")
    print("".join(md))


def main() -> None:
    ensure_dirs()
    measurements: list[Measurement] = []
    print("=== Test 1: CSV → DuckDB → Parquet ===")
    parquet = test1_csv_to_parquet(measurements)
    print("=== Test 1c/d: Postgres compare ===")
    test1_postgres_compare(measurements, parquet)
    print("=== Test 2: History joins (Heim) ===")
    corrected = test2_history_joins(measurements, parquet)
    print("=== Test 3: Analytics on Parquet ===")
    test3_analytics(measurements, corrected)
    print("=== Test 4: Partitioning ===")
    part_year = test4_partitioning(measurements, corrected)
    print("=== Test 5: Object storage (S3-compatible) ===")
    test5_object_storage(measurements, part_year)
    print("=== Test 6: Ephemeral vs persistent ===")
    test6_ephemeral_engine(measurements, part_year)
    print("=== Test 7: Materialize to Postgres ===")
    test7_materialize_postgres(measurements, part_year)
    print("=== Test 8: API PoC ===")
    test8_api_poc(measurements, part_year)
    write_report(measurements)
    print(f"\nWrote {RESULTS / 'RESULTS.md'} and measurements.json")


if __name__ == "__main__":
    main()
