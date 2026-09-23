#!/usr/bin/env python3
"""Standalone allowlisted dataset-query PoC (Test 8).

  DATASET_PARQUET_GLOB='.../year=*/**/*.parquet' \
    uvicorn api.server:app --port 8090

  curl 'http://127.0.0.1:8090/datasets/tax-lists/query?q=mun_stats&year=2024'
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import duckdb
from fastapi import FastAPI, HTTPException

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GLOB = str(ROOT / "data" / "parquet_partitioned" / "tax_by_year" / "**" / "*.parquet")
GLOB = os.environ.get("DATASET_PARQUET_GLOB", DEFAULT_GLOB)

app = FastAPI(title="Aurii DuckDB dataset query PoC", version="0.1.0")

QUERIES = {
    "mun_stats": """
        SELECT current_municipality_id AS municipality_id,
               count(*) AS people,
               avg(income) AS average_income
        FROM read_parquet(?)
        WHERE year = ?
        GROUP BY 1
        ORDER BY people DESC
        LIMIT 50
    """,
    "heim_overview": """
        SELECT year, count(*) AS people, avg(income) AS average_income
        FROM read_parquet(?)
        WHERE current_municipality_id = '5055' OR hist_municipality_id = '5055'
        GROUP BY 1 ORDER BY 1
    """,
}


def _connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(database=":memory:")
    con.execute(f"SET threads={min(4, os.cpu_count() or 4)}")
    con.execute("SET memory_limit='4GB'")
    return con


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/datasets/{dataset_id}/query")
def query_dataset(dataset_id: str, q: str = "mun_stats", year: int = 2024):
    if dataset_id != "tax-lists":
        raise HTTPException(404, detail="DATASET_NOT_FOUND")
    if q not in QUERIES:
        raise HTTPException(400, detail=f"query must be one of {list(QUERIES)}")
    t0 = time.perf_counter()
    con = _connect()
    try:
        sql = QUERIES[q]
        if q == "mun_stats":
            rows = con.execute(sql, [GLOB, year]).fetchall()
        else:
            rows = con.execute(sql, [GLOB]).fetchall()
        cols = [d[0] for d in con.description]
    finally:
        con.close()
    return {
        "datasetId": dataset_id,
        "query": q,
        "latencyMs": round((time.perf_counter() - t0) * 1000, 2),
        "columns": cols,
        "rows": [dict(zip(cols, r)) for r in rows],
    }
