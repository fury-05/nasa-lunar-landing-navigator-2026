"""Record the Horizons responses for the Apollo landing check, then print the comparison.

Usage: uv run python scripts/validate_apollo.py [--record] [--out FILE.json]
Without --record only the cached (recorded) responses are used and nothing touches the network.
With --record missing responses are fetched politely (one per second, cached by sha256 in
packages/engine/tests/fixtures/horizons_cache). Six requests in total. Never run in CI.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages/engine/tests"))
import httpx  # noqa: E402
from apollo_requests import (  # noqa: E402
    APOLLO_NASA,
    SP4029_LOCATION,
    SP4029_URL,
    apollo16_diagnostic_request,
    apollo_request,
    parse_minute_table,
)
from lunar_engine.ephemeris import HorizonsClient  # noqa: E402
from lunar_engine.ephemeris.client import cache_key  # noqa: E402

CACHE = ROOT / "packages/engine/tests/fixtures/horizons_cache"


def _offline(request: httpx.Request) -> httpx.Response:
    raise RuntimeError(f"not recorded (run with --record): {request.url}")


def sun_elevation_at(rows: list[tuple[datetime, float]], t: datetime) -> float:
    """Linear interpolation between the two 1 minute rows around t (error ~1e-5 degrees)."""
    for (t0, e0), (t1, e1) in zip(rows, rows[1:], strict=False):
        if t0 <= t <= t1:
            return e0 + (e1 - e0) * (t - t0).total_seconds() / (t1 - t0).total_seconds()
    raise ValueError("time outside the recorded window")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--record", action="store_true")
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    sites = {s["id"]: s for s in json.loads((ROOT / "data/sites.json").read_text("utf8"))["sites"]}
    client = HorizonsClient(
        cache_dir=CACHE, transport=None if args.record else httpx.MockTransport(_offline)
    )
    results = []
    for sid, (nasa, landing) in APOLLO_NASA.items():
        s = sites[sid]
        params = apollo_request(s["lon_east_deg"], s["lat_deg"], landing)
        payload = client.raw(params)
        table = parse_minute_table(payload)
        prov = {"api_version": payload.get("signature", {}).get("version")}
        rows = [(r.time_utc, r.elevation_deg) for r in table.rows if r.elevation_deg is not None]
        ours = sun_elevation_at(rows, landing)
        results.append(
            {
                "id": sid, "lat_deg": s["lat_deg"], "lon_east_deg": s["lon_east_deg"],
                "landing_gmt": landing.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "nasa_sun_angle_deg": nasa, "ours_deg": round(ours, 3),
                "diff_deg": round(ours - nasa, 3), "request_sha256": cache_key(params),
                "api_version": prov["api_version"], "rows": len(table.rows),
            }
        )
    # Diagnostic for the one mismatch, kept apart from the comparison (docs/validation/REPORT.md)
    a16 = sites["apollo-16"]
    dpay = client.raw(apollo16_diagnostic_request(a16["lon_east_deg"], a16["lat_deg"]))
    drows = [(r.time_utc, r.elevation_deg) for r in parse_minute_table(dpay).rows]
    nasa16 = APOLLO_NASA["apollo-16"][0]
    diag = {"nasa_value_deg": nasa16, "crossings": []}
    for (t0, e0), (t1, e1) in zip(drows, drows[1:], strict=False):
        if e0 is not None and e1 is not None and (e0 - nasa16) * (e1 - nasa16) <= 0 and e0 != e1:
            tc = t0 + (t1 - t0) * ((nasa16 - e0) / (e1 - e0))
            diag["crossings"].append(tc.strftime("%Y-%m-%dT%H:%M:%SZ"))
    # Apollo 16 press kit events table: planned touchdown 97:42 GET, 20/2:36 pm EST
    planned = datetime(1972, 4, 20, 19, 36, 0, tzinfo=UTC)
    pe = sun_elevation_at([(t, e) for t, e in drows if e is not None], planned)
    diag["planned_touchdown_utc"] = planned.strftime("%Y-%m-%dT%H:%M:%SZ")
    diag["ours_at_planned_deg"] = round(pe, 3)
    diag["diff_at_planned_deg"] = round(pe - nasa16, 3)
    print("apollo-16 diagnostic: Sun at the NASA value", nasa16, "at", diag["crossings"],
          "| ours at planned touchdown", diag["planned_touchdown_utc"], round(pe, 3),
          "diff", round(pe - nasa16, 3))
    doc = {
        "source": {"url": SP4029_URL, "location": SP4029_LOCATION},
        "generated_at_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "results": results,
        "apollo16_diagnostic": diag,
    }
    for r in results:
        print(r["id"], r["landing_gmt"], "NASA", r["nasa_sun_angle_deg"], "ours", r["ours_deg"],
              "diff", r["diff_deg"])
    if args.out:
        args.out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf8")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
