#!/usr/bin/env python3
"""Generate docs/THIRD_PARTY_LICENSES.md from the lockfiles (P7-05).

Sources, all local and offline:
  * uv.lock                 -> Python package names and versions; runtime vs dev is the reachability
                               from lunar-api and lunar-engine (the two shipped packages).
  * installed metadata      -> Python licence strings, read from the uv environment (.venv).
  * package-lock.json       -> npm names, versions, licence field and dev flag.
  * node_modules/*/package.json (when installed) -> repository or homepage URL.

Rules: licences are copied as declared, never guessed. Anything the metadata does not state is
`pending-source`. A small MANUAL table covers packages the local environment cannot show (uvloop is
Linux and macOS only); each entry names where the value came from.

Usage:
  python scripts/gen_licenses.py           write docs/THIRD_PARTY_LICENSES.md
  python scripts/gen_licenses.py --check   exit 1 if the committed file is out of date
The check compares the package set (name, version, scope) and the licence of every package whose
metadata is installed locally, so it also works on a machine without the Windows-only or
Linux-only packages.
"""
from __future__ import annotations

import importlib.metadata as md
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "THIRD_PARTY_LICENSES.md"
PENDING = "pending-source"

# Declared values for packages whose metadata is not installed in every environment.
MANUAL = {
    "uvloop": (
        "MIT OR Apache-2.0",
        "https://github.com/MagicStack/uvloop",
        "PyPI JSON metadata read on 2026-11-15: License field 'MIT License', classifiers "
        "'Apache Software License' and 'MIT License'",
    ),
}

PERMISSIVE = {
    "MIT", "MIT-0", "ISC", "BSD", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "Zlib",
    "OFL-1.1", "BlueOak-1.0.0", "CC0-1.0", "PSF-2.0", "Python-2.0", "Apache 2.0", "BSD License",
    "Apache Software License", "Apache-2.0 WITH LLVM-exception",
}
REVIEW = {  # weak copyleft or attribution data: usable, but needs a stated reason
    "MPL-2.0": "file-level copyleft; unmodified use is compatible with Apache-2.0",
    "CC-BY-4.0": "attribution licence for data; attribution kept in this file",
    "LGPL-3.0-only": "weak copyleft library; allowed only if used unmodified as a dynamic library",
    "LGPL-3.0-or-later": "weak copyleft library; allowed only if used unmodified as a dynamic library",
}
# Trove classifier text to the SPDX name it denotes (only where the mapping is unambiguous).
CLASSIFIERS = {
    "Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0",
    "MIT License": "MIT",
    "Apache Software License": "Apache-2.0",
}
ALIASES = {"Apache 2.0": "Apache-2.0"}
FORBIDDEN = re.compile(r"(?<!L)GPL|AGPL|SSPL|BUSL|Commons-Clause")


def norm(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def _eval(expr: str) -> tuple[str, list[str]]:
    """Evaluate an SPDX-like expression: AND needs every part, OR takes the best alternative."""
    rank = {"ok": 0, "review": 1, "unknown": 2}
    toks = re.findall(r"\(|\)|AND|OR|[^\s()]+(?:\s+WITH\s+[^\s()]+)?", expr)
    pos = 0

    def parse_or() -> tuple[str, list[str]]:
        nonlocal pos
        alts = [parse_and()]
        while pos < len(toks) and toks[pos] == "OR":
            pos += 1
            alts.append(parse_and())
        return min(alts, key=lambda a: rank[a[0]])

    def parse_and() -> tuple[str, list[str]]:
        nonlocal pos
        parts = [parse_atom()]
        while pos < len(toks) and toks[pos] == "AND":
            pos += 1
            parts.append(parse_atom())
        st = max((p[0] for p in parts), key=lambda x: rank[x])
        return st, [n for p in parts for n in p[1]]

    def parse_atom() -> tuple[str, list[str]]:
        nonlocal pos
        if pos >= len(toks):
            return "unknown", ["incomplete expression"]
        t = toks[pos]
        pos += 1
        if t == "(":
            r = parse_or()
            if pos < len(toks) and toks[pos] == ")":
                pos += 1
            return r
        if t in PERMISSIVE:
            return "ok", []
        if t in REVIEW:
            return "review", [f"{t}: {REVIEW[t]}"]
        return "unknown", [f"{t}: not in the reviewed list"]

    return parse_or()


def classify(lic: str) -> tuple[str, str]:
    """Return (status, note). status is ok, review, incompatible or unknown."""
    if not lic or lic == PENDING:
        return "unknown", "licence not stated in metadata"
    if FORBIDDEN.search(lic):
        return "incompatible", "GPL family licence"
    for raw, spdx in ALIASES.items():  # free-text spellings, mapped for classification only
        lic = lic.replace(raw, spdx)
    st, notes = _eval(lic)
    return st, "; ".join(notes)


def py_licence(meta: md.PackageMetadata) -> str:
    expr = meta.get("License-Expression")
    if expr:
        return expr.strip()
    lic = (meta.get("License") or "").strip()
    if lic and "\n" not in lic and len(lic) < 80:
        return lic
    cls = [CLASSIFIERS.get(c.split("::")[-1].strip(), c.split("::")[-1].strip())
           for c in meta.get_all("Classifier") or []
           if c.startswith("License ::") and c.split("::")[-1].strip() != "OSI Approved"]
    return " OR ".join(dict.fromkeys(cls)) if cls else PENDING


def py_url(meta: md.PackageMetadata) -> str:
    for entry in meta.get_all("Project-URL") or []:
        label, _, url = entry.partition(",")
        if label.strip().lower() in {"homepage", "source", "source code", "repository", "home", "github"}:
            return url.strip()
    for entry in meta.get_all("Project-URL") or []:
        return entry.partition(",")[2].strip()
    return (meta.get("Home-page") or "").strip() or PENDING


def python_rows() -> list[dict]:
    lock = tomllib.loads((ROOT / "uv.lock").read_text(encoding="utf-8"))
    pkgs = {norm(p["name"]): p for p in lock["package"]}
    # Runtime scope: everything reachable from the two shipped packages (extras included).
    runtime: set[str] = set()
    todo = ["lunar-api", "lunar-engine"]
    while todo:
        n = norm(todo.pop())
        if n in runtime or n not in pkgs:
            continue
        runtime.add(n)
        p = pkgs[n]
        deps = list(p.get("dependencies", []))
        for group in p.get("optional-dependencies", {}).values():
            deps += group
        todo += [d["name"] for d in deps]
    installed: dict[str, md.Distribution] = {}
    for sp in (ROOT / ".venv" / "Lib" / "site-packages", *(ROOT / ".venv" / "lib").glob("python*/site-packages")):
        if sp.is_dir():
            for d in md.distributions(path=[str(sp)]):
                installed[norm(d.metadata["Name"])] = d
    rows = []
    for n, p in sorted(pkgs.items()):
        if "editable" in p["source"] or "virtual" in p["source"]:
            continue  # first-party packages (lunar-api, lunar-engine, lunar-navigator)
        lic, url, note = PENDING, PENDING, ""
        local = n in installed
        if local:
            meta = installed[n].metadata
            lic, url = py_licence(meta), py_url(meta)
        elif n in MANUAL:
            lic, url, note = MANUAL[n]
        rows.append({
            "eco": "python", "name": p["name"], "version": p["version"],
            "scope": "runtime" if n in runtime else "dev", "license": lic, "url": url,
            "note": note, "local": local,
        })
    return rows


def npm_rows() -> list[dict]:
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    rows = []
    for path, v in sorted(lock["packages"].items()):
        if not path or path in ("apps/web", "node_modules/@lunar/web") or v.get("link"):
            continue
        name = path.split("node_modules/")[-1]
        lic = v.get("license")
        if isinstance(lic, dict):
            lic = lic.get("type")
        url, local = f"https://www.npmjs.com/package/{name}", False  # registry page, from the lockfile name
        pj = ROOT / path / "package.json"
        if pj.is_file():
            local = True
            m = json.loads(pj.read_text(encoding="utf-8"))
            repo = m.get("repository")
            repo = repo.get("url") if isinstance(repo, dict) else repo
            url = m.get("homepage") or repo or url
            url = re.sub(r"^git\+", "", url) if isinstance(url, str) else f"https://www.npmjs.com/package/{name}"
            if lic is None:
                lic = m.get("license") if isinstance(m.get("license"), str) else None
        rows.append({
            "eco": "npm", "name": name, "version": v.get("version", PENDING),
            "scope": "dev" if v.get("dev") else "runtime", "license": lic or PENDING,
            "url": url, "note": "", "local": local,
        })
    # Collapse platform binaries that share a name prefix and licence into one row each only if
    # they are identical in every column; otherwise keep them. (Keeps the file readable.)
    return rows


def render(rows: list[dict]) -> str:
    for r in rows:
        r["status"], r["why"] = classify(r["license"])
    flagged = [r for r in rows if r["status"] != "ok"]
    py = [r for r in rows if r["eco"] == "python"]
    js = [r for r in rows if r["eco"] == "npm"]
    L: list[str] = []
    a = L.append
    a("# Third-party licences")
    a("")
    a("Generated by `scripts/gen_licenses.py` from `uv.lock`, the uv environment metadata and "
      "`package-lock.json`. Do not edit by hand; run `python scripts/gen_licenses.py` and commit "
      "the result. Licences are copied as declared by each package; `pending-source` means the "
      "metadata did not state a value. npm sources are the package homepage or repository when the "
      "package is installed locally, otherwise its npm registry page. This file is an inventory, not legal advice. The "
      "project itself is Apache-2.0 (see `LICENSE`).")
    a("")
    a(f"Counts: {len(py)} Python packages ({sum(r['scope']=='runtime' for r in py)} runtime), "
      f"{len(js)} npm packages ({sum(r['scope']=='runtime' for r in js)} runtime). "
      "Runtime means shipped to the VM or the browser; dev means tests, linting and build tools.")
    a("")
    a("## Flagged for review")
    a("")
    a("No package is under a GPL or AGPL licence unless listed here as `incompatible`. "
      "Rows below are not `ok` under the reviewed permissive list.")
    a("")
    a("| Package | Version | Scope | Licence as declared | Status | Why |")
    a("|---|---|---|---|---|---|")
    groups: dict[tuple, list[dict]] = {}
    for r in flagged:
        groups.setdefault((r["eco"], r["scope"], r["license"], r["status"], r["why"]), []).append(r)
    for (eco, scope, lic, st, why), g in sorted(groups.items(), key=lambda kv: (kv[0][1] != "runtime", kv[0][0], kv[0][2])):
        if len(g) > 4:
            names = f"{g[0]['name']} and {len(g) - 1} sibling packages ({eco})"
            ver = g[0]["version"]
        else:
            names = ", ".join(f"{x['name']} ({eco})" for x in g)
            ver = ", ".join(x["version"] for x in g)
        a(f"| {names} | {ver} | {scope} | {lic} | {st} | {why} |")
    a("")
    a("Reading the flags:")
    a("")
    a("* `psycopg` and `psycopg-binary` are LGPL-3.0-only and run on the VM. We use them unmodified "
      "as installed libraries and do not distribute a modified copy; this is the usual reading "
      "of LGPL for a dependency. Confirm with the team before any redistribution as a bundled "
      "binary. Decision recorded here, not yet an ADR.")
    a("* MPL-2.0 packages (certifi, orjson, hypothesis, pathspec, lightningcss): used unmodified; "
      "MPL obligations apply only to modified MPL files.")
    a("* Fonts `@fontsource/sora` and `@fontsource/ibm-plex-mono` are OFL-1.1 and are shipped in "
      "the web bundle, self-hosted as required by docs/02. OFL permits embedding and requires "
      "the font licence text to travel with the fonts.")
    a("* `caniuse-lite` (CC-BY-4.0) is a dev-only browser-support data file and is not shipped.")
    a("")
    for title, sub in (("Python packages", py), ("npm packages", js)):
        a(f"## {title}")
        a("")
        a("| Name | Version | Scope | Licence as declared | Source |")
        a("|---|---|---|---|---|")
        for r in sorted(sub, key=lambda x: (x["scope"] != "runtime", x["name"].lower())):
            src = r["url"] if r["url"] == PENDING else f"<{r['url']}>"
            extra = f" ({r['note']})" if r["note"] else ""
            a(f"| {r['name']} | {r['version']} | {r['scope']} | {r['license']}{extra} | {src} |")
        a("")
    a("## Data and services")
    a("")
    a("Data sources are not software dependencies. They are listed in `NOTICE`, "
      "`docs/ATTRIBUTION.md` and `data/attribution.json`.")
    a("")
    return "\n".join(L)


def parse_committed(text: str) -> dict[tuple, str]:
    out = {}
    eco = None
    for line in text.splitlines():
        if line.startswith("## Python"):
            eco = "python"
        elif line.startswith("## npm"):
            eco = "npm"
        elif line.startswith("## Data"):
            eco = None
        elif eco and line.startswith("| ") and not line.startswith("| Name") and not line.startswith("|---"):
            cells = [c.strip() for c in line.strip().strip("|").split(" | ")]
            if len(cells) >= 5:
                lic = re.sub(r" \(PyPI.*\)$", "", cells[3])
                out[(eco, cells[0], cells[1], cells[2])] = lic
    return out


def main() -> int:
    rows = python_rows() + npm_rows()
    text = render(rows)
    if "--check" in sys.argv:
        if not OUT.is_file():
            print(f"missing {OUT.relative_to(ROOT)}; run scripts/gen_licenses.py")
            return 1
        have = parse_committed(OUT.read_text(encoding="utf-8"))
        want = {(r["eco"], r["name"], r["version"], r["scope"]): r for r in rows}
        problems = []
        for k, r in want.items():
            if k not in have:
                problems.append(f"missing or changed row: {k}")
            elif r["local"] and have[k] != re.sub(r" \(.*\)$", "", f"{r['license']}") and have[k] != r["license"]:
                problems.append(f"licence changed for {k}: {have[k]} -> {r['license']}")
        for k in have:
            if k not in want:
                problems.append(f"stale row: {k}")
        if problems:
            print("\n".join(problems[:30]))
            print("docs/THIRD_PARTY_LICENSES.md is out of date; run python scripts/gen_licenses.py")
            return 1
        print(f"licence report ok ({len(rows)} packages)")
        return 0
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(rows)} packages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
