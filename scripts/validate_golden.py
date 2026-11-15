"""Record or refresh the golden regression file (docs/04 section 8, item 8).

Usage:
  uv run python scripts/validate_golden.py --record-horizons          # 2 requests, if not cached
  uv run python scripts/validate_golden.py --update --adr initial      # first recording
  uv run python scripts/validate_golden.py --update --adr ADR-0009     # after an approved change

Drift is never silent: --update refuses unless --adr is 'initial' (first recording only) or names an
existing file docs/DECISIONS/ADR-NNNN-*.md that explains why the numbers changed. The name is
appended to adr_history inside the golden file. Nothing here runs in CI.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages/engine/tests"))
import golden_support as g  # noqa: E402
from lunar_engine.ephemeris import HorizonsClient  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--record-horizons", action="store_true")
    ap.add_argument("--update", action="store_true")
    ap.add_argument("--adr", default="")
    args = ap.parse_args()
    if args.record_horizons:
        live = HorizonsClient(cache_dir=g.CACHE, contact_email="")
        for name, params in g.requests().items():
            table, prov = live.observer(params)
            print(name, len(table.rows), prov["api_version"], prov["request_sha256"])
        live.close()
    if args.update:
        history: list[str] = []
        if g.GOLDEN_PATH.exists():
            history = list(g.load_golden().get("adr_history", []))
        if args.adr == "initial":
            if history:
                print("REFUSED: a golden file exists; name the ADR that approves the change")
                return 2
        elif not args.adr or not list((ROOT / "docs/DECISIONS").glob(f"{args.adr}-*.md")):
            print("REFUSED: --adr must name an existing docs/DECISIONS/ADR-NNNN-*.md")
            return 2
        history.append(args.adr)
        doc = g.golden_document(g.make_client(), args.adr, history)
        g.GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        g.GOLDEN_PATH.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf8")
        print("wrote", g.GOLDEN_PATH.relative_to(ROOT), "history", history)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
