"""Write packages/contracts/openapi.json from the FastAPI app (P3-06).

Usage: python scripts/export_openapi.py [--check]
--check fails if the committed file differs from what the code generates now.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "packages" / "contracts" / "openapi.json"


def build() -> str:
    from lunar_api.main import app

    return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main() -> int:
    text = build()
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf8") != text:
            print("packages/contracts/openapi.json is stale: run python scripts/export_openapi.py")
            return 1
        print("openapi.json is current")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf8", newline="\n")
    print("wrote", OUT.relative_to(ROOT), len(text), "bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
