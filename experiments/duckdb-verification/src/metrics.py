"""Process metrics helpers for benchmark tables."""

from __future__ import annotations

import json
import os
import resource
import time
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterator

import psutil


@dataclass
class Measurement:
    test: str
    rows: int | None = None
    input_bytes: int | None = None
    output_bytes: int | None = None
    runtime_s: float | None = None
    peak_rss_mb: float | None = None
    cpu_percent: float | None = None
    query_latency_ms: float | None = None
    disk_read_mb: float | None = None
    disk_write_mb: float | None = None
    implementation_complexity: str | None = None
    notes: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d


def file_size(path: Path | str) -> int:
    p = Path(path)
    if p.is_file():
        return p.stat().st_size
    if p.is_dir():
        return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
    return 0


def dir_size_glob(root: Path, pattern: str) -> int:
    return sum(f.stat().st_size for f in root.glob(pattern) if f.is_file())


@contextmanager
def measure(test: str) -> Iterator[Measurement]:
    proc = psutil.Process(os.getpid())
    # Prime cpu_percent
    proc.cpu_percent(interval=None)
    io_before = proc.io_counters() if hasattr(proc, "io_counters") else None
    rss_before = proc.memory_info().rss
    peak = rss_before
    t0 = time.perf_counter()
    m = Measurement(test=test)
    try:
        yield m
    finally:
        elapsed = time.perf_counter() - t0
        rss_after = proc.memory_info().rss
        # ru_maxrss is KB on Linux
        ru = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        peak_rss = max(rss_before, rss_after, ru * 1024)
        # Sample children too (DuckDB may spawn threads in-process; include self peak)
        try:
            for child in proc.children(recursive=True):
                try:
                    peak_rss = max(peak_rss, child.memory_info().rss)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception:
            pass
        m.runtime_s = round(elapsed, 3)
        m.peak_rss_mb = round(peak_rss / (1024 * 1024), 1)
        m.cpu_percent = proc.cpu_percent(interval=0.1)
        if io_before is not None:
            try:
                io_after = proc.io_counters()
                m.disk_read_mb = round((io_after.read_bytes - io_before.read_bytes) / (1024 * 1024), 1)
                m.disk_write_mb = round((io_after.write_bytes - io_before.write_bytes) / (1024 * 1024), 1)
            except Exception:
                pass


def save_measurements(path: Path, items: list[Measurement]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([m.to_dict() for m in items], indent=2), encoding="utf-8")


def markdown_table(items: list[Measurement]) -> str:
    headers = [
        "Test",
        "Rows",
        "Input",
        "Output",
        "Runtime",
        "Peak RAM",
        "CPU%",
        "Query latency",
        "Disk R/W",
        "Complexity",
        "Notes",
    ]
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for m in items:
        def fmt_bytes(n: int | None) -> str:
            if n is None:
                return "—"
            if n < 1024:
                return f"{n} B"
            if n < 1024**2:
                return f"{n / 1024:.1f} KiB"
            if n < 1024**3:
                return f"{n / (1024**2):.1f} MiB"
            return f"{n / (1024**3):.2f} GiB"

        row = [
            m.test,
            f"{m.rows:,}" if m.rows is not None else "—",
            fmt_bytes(m.input_bytes),
            fmt_bytes(m.output_bytes),
            f"{m.runtime_s:.3f}s" if m.runtime_s is not None else "—",
            f"{m.peak_rss_mb:.0f} MiB" if m.peak_rss_mb is not None else "—",
            f"{m.cpu_percent:.0f}" if m.cpu_percent is not None else "—",
            f"{m.query_latency_ms:.1f} ms" if m.query_latency_ms is not None else "—",
            (
                f"{m.disk_read_mb or 0:.0f}/{m.disk_write_mb or 0:.0f} MiB"
                if m.disk_read_mb is not None or m.disk_write_mb is not None
                else "—"
            ),
            m.implementation_complexity or "—",
            (m.notes or "—").replace("|", "/"),
        ]
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)
