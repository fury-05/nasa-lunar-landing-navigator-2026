"""Read access to precomputed site bundles (P3-03). Loads lazily and caches in memory."""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any

from lunar_engine.compare import SiteSky
from lunar_engine.precompute import load_site

# Lowercase letters, digits, dash and underscore only. A fixed alphabet keeps ids out of the
# file system's own rules (case folding, dots, separators, reserved names) and gives one cache key.
SITE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def valid_site_id(site_id: str) -> bool:
    return bool(SITE_ID.fullmatch(site_id))


class SiteStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._cache: dict[str, tuple[SiteSky, dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def ids(self) -> list[str]:
        if not self.root.exists():
            return []
        return sorted(p.parent.name for p in self.root.glob("*/meta.json"))

    def meta(self, site_id: str) -> dict[str, Any]:
        return self.get(site_id)[1]

    def get(self, site_id: str) -> tuple[SiteSky, dict[str, Any]]:
        if not valid_site_id(site_id):
            raise KeyError(site_id)
        with self._lock:
            hit = self._cache.get(site_id)
            if hit is not None:
                return hit
        if not (self.root / site_id / "meta.json").exists():
            raise KeyError(site_id)
        loaded = load_site(self.root, site_id)
        with self._lock:
            self._cache[site_id] = loaded
        return loaded

    def raw_meta(self, site_id: str) -> dict[str, Any]:
        text = (self.root / site_id / "meta.json").read_text(encoding="utf8")
        data: dict[str, Any] = json.loads(text)
        return data
