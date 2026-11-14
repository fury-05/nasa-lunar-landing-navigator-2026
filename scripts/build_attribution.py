"""Turn the table in docs/ATTRIBUTION.md into data/attribution.json (P3-05).

The markdown stays the single source of truth for humans. The API serves the JSON. A test fails
if the two differ, so the credits page can never drift from the registry.

Usage: python scripts/build_attribution.py [--check]
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MD = ROOT / "docs" / "ATTRIBUTION.md"
OUT = ROOT / "data" / "attribution.json"
COLUMNS = [
    "id", "name", "publisher", "url", "retrieved_at", "version", "usage_statement",
    "citation", "modules",
]


def parse() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    in_table = False
    for line in MD.read_text(encoding="utf8").splitlines():
        if line.startswith("| id |"):
            in_table = True
            continue
        if not in_table:
            continue
        if not line.startswith("|"):
            break
        if set(line.replace("|", "").strip()) <= {"-", " "}:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != len(COLUMNS):
            raise SystemExit(f"row has {len(cells)} cells, expected {len(COLUMNS)}: {line[:80]}")
        rows.append(dict(zip(COLUMNS, cells, strict=True)))
    if not rows:
        raise SystemExit("no attribution rows found")
    return rows


def document() -> dict[str, object]:
    return {
        "schema": 1,
        "generated_from": "docs/ATTRIBUTION.md",
        "notice": "Planning tool, not for flight operations.",
        "sources": parse(),
    }


def main() -> int:
    text = json.dumps(document(), indent=2, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf8") != text:
            print("data/attribution.json is stale: run python scripts/build_attribution.py")
            return 1
        print("attribution.json is current")
        return 0
    OUT.write_text(text, encoding="utf8", newline="\n")
    print("wrote", OUT.relative_to(ROOT), len(parse()), "sources")
    return 0


if __name__ == "__main__":
    sys.exit(main())
