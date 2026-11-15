"""Read access to precomputed site bundles (P3-03). Loads lazily and caches in memory."""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any

from lunar_engine.compare import SiteSky
from lunar_engine.events import Event, HermiteSeries, find_events
from lunar_engine.metrics import sun_fraction_series
from lunar_engine.precompute import load_site

# Lowercase letters, digits, dash and underscore only. A fixed alphabet keeps ids out of the
# file system's own rules (case folding, dots, separators, reserved names) and gives one cache key.
SITE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def valid_site_id(site_id: str) -> bool:
    return bool(SITE_ID.fullmatch(site_id))


class Derived:
    """Series computed once per bundle: Sun fraction, Earth margin and their events.

    Everything here depends only on the stored bundle, so it is built on first use and kept.
    A request for a moment or a window then only reads from it.
    """

    def __init__(self, site: SiteSky) -> None:
        self.sun_fraction = HermiteSeries(
            site.sun.times, sun_fraction_series(site.sun, site.skyline)
        )
        self.earth_margin = HermiteSeries(
            site.earth.times,
            site.earth.elevation_deg - site.skyline.at_array(site.earth.azimuth_deg),
        )
        self._sun_events: list[Event] | None = None
        self._earth_events: list[Event] | None = None
        self._lock = threading.Lock()

    @property
    def sun_events(self) -> list[Event]:
        with self._lock:
            if self._sun_events is None:
                self._sun_events = find_events(self.sun_fraction, 0.5)
            return self._sun_events

    @property
    def earth_events(self) -> list[Event]:
        with self._lock:
            if self._earth_events is None:
                self._earth_events = find_events(self.earth_margin, 0.0)
            return self._earth_events


class SiteStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._cache: dict[str, tuple[SiteSky, dict[str, Any]]] = {}
        self._derived: dict[str, tuple[float, Derived]] = {}
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
        if hit is not None and (self.root / site_id / "meta.json").exists():
            return hit  # a deleted (expired or evicted) bundle must stop being served
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

    def derived(self, site_id: str) -> Derived:
        """Cached derived series for a site. Rebuilt if the bundle's meta file changed on disk."""
        site, _ = self.get(site_id)
        stamp = (self.root / site_id / "meta.json").stat().st_mtime
        with self._lock:
            hit = self._derived.get(site_id)
            if hit is not None and hit[0] == stamp:
                return hit[1]
        built = Derived(site)
        with self._lock:
            self._derived[site_id] = (stamp, built)
        return built

    def warm(self) -> dict[str, float]:
        """Load every bundle and build its derived series and events. Returns seconds per site.

        Run at startup in a background thread so the first visitor never waits for it.
        """
        import time

        out: dict[str, float] = {}
        for sid in self.ids():
            t = time.perf_counter()
            try:
                d = self.derived(sid)
                _ = d.sun_events, d.earth_events
            except Exception:  # noqa: BLE001 - one bad bundle must not stop the others
                out[sid] = -1.0
                continue
            out[sid] = round(time.perf_counter() - t, 3)
        return out
