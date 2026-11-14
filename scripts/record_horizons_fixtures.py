"""Record real Horizons responses used by the convention tests (P1-02).

Usage: uv run python scripts/record_horizons_fixtures.py
Writes only into packages/engine/tests/fixtures/horizons_cache (sha256-named JSON).
Polite: one request per second, user agent set, never run in CI.
"""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages/engine/tests"))
from fixture_requests import REQUESTS  # noqa: E402

from lunar_engine.ephemeris import HorizonsClient  # noqa: E402
from lunar_engine.ephemeris.client import cache_key  # noqa: E402

out = Path(__file__).resolve().parents[1] / "packages/engine/tests/fixtures/horizons_cache"
client = HorizonsClient(cache_dir=out, contact_email="")
index = []
for name, params in REQUESTS.items():
    table, prov = client.observer(params)
    index.append(
        {
            "name": name,
            "sha256": cache_key(params),
            "rows": len(table.rows),
            "api_version": prov["api_version"],
            "retrieved_at_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    )
    print(name, len(table.rows), prov["api_version"])
(out / "INDEX.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf8")
