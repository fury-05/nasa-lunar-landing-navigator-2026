"""Small load test for the deployed API (P3-08). Standard library only.

Usage: python scripts/loadtest.py BASE_URL --clients 8 --seconds 20 [--path PATH ...]

Each client loops over the chosen paths as fast as it can, with a unique X-Forwarded-For style
spread NOT used (it would be ignored). Reports requests, errors, status counts and latency
percentiles per path. This measures the server AS SEEN FROM THIS MACHINE: network and TLS
included. It is a smoke level load test, not a capacity benchmark. Rate limiting (429) is counted
separately because it is the server defending itself, not failing.
"""

import argparse
import statistics
import threading
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict

DEFAULT_PATHS = [
    "/api/v1/version",
    "/api/v1/sites",
    "/api/v1/sites/pgda-site04/skyline?step_deg=5",
    "/api/v1/sites/pgda-site04/state?t=2026-12-12T12:00:00Z",
    "/api/v1/sites/pgda-site04/assess?start=2026-12-11T00:00:00Z&end=2026-12-19T00:00:00Z",
]


def worker(base: str, paths: list[str], stop: float, out: dict, lock: threading.Lock) -> None:
    i = 0
    while time.time() < stop:
        path = paths[i % len(paths)]
        i += 1
        t = time.perf_counter()
        try:
            req = urllib.request.Request(base + path, headers={"User-Agent": "lunar-loadtest/0.1"})
            with urllib.request.urlopen(req, timeout=30) as r:
                r.read()
                code = r.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:  # noqa: BLE001
            code = type(e).__name__
        dt = time.perf_counter() - t
        with lock:
            out[path].append((code, dt))


def pct(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("--clients", type=int, default=8)
    ap.add_argument("--seconds", type=float, default=20)
    ap.add_argument("--path", action="append")
    a = ap.parse_args()
    paths = a.path or DEFAULT_PATHS
    out: dict = defaultdict(list)
    lock = threading.Lock()
    stop = time.time() + a.seconds
    ts = [threading.Thread(target=worker, args=(a.base.rstrip("/"), paths, stop, out, lock)) for _ in range(a.clients)]
    t0 = time.time()
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    wall = time.time() - t0
    total = sum(len(v) for v in out.values())
    codes = Counter(c for v in out.values() for c, _ in v)
    print(f"clients={a.clients} wall={wall:.1f}s requests={total} rate={total / wall:.1f}/s status={dict(codes)}")
    for p in paths:
        ok = [d for c, d in out[p] if c == 200]
        n = len(out[p])
        if ok:
            print(f"  n={n:5d} ok={len(ok):5d} p50={statistics.median(ok)*1000:7.0f}ms p95={pct(ok, .95)*1000:7.0f}ms max={max(ok)*1000:7.0f}ms  {p[:70]}")
        else:
            print(f"  n={n:5d} ok=    0  {p[:70]}  codes={Counter(c for c, _ in out[p])}")


if __name__ == "__main__":
    main()
