"""Horizons rise/transit/set (RTS) helper, used as an independent cross-check (P1-03).

Horizons request: STEP_SIZE='1m RAD' returns only the rows where the target rises, reaches
maximum elevation, transits or sets. Accuracy is at most twice the step (docs/04 section 8).
Observed in real data (ADR-0004): for the Sun the flagged elevation is about minus one solar
angular radius, so Horizons RTS refers to the upper limb touching the horizon, not the centre.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from lunar_engine.ephemeris.client import HorizonsClient, observer_params
from lunar_engine.ephemeris.parse import ObserverTable

_KINDS = {"r": "rise", "s": "set", "t": "transit", "e": "elevation-max"}


@dataclass(frozen=True)
class RtsEvent:
    time_utc: datetime
    kind: str
    azimuth_deg: float | None
    elevation_deg: float | None


def events_from_table(table: ObserverTable) -> list[RtsEvent]:
    out: list[RtsEvent] = []
    for row in table.rows:
        flag = row.rts_flag.strip()
        if flag in _KINDS:
            out.append(RtsEvent(row.time_utc, _KINDS[flag], row.azimuth_deg, row.elevation_deg))
    return out


def rts_events(
    client: HorizonsClient,
    body: str,
    lon_east_deg: float,
    lat_deg: float,
    start_utc: str,
    stop_utc: str,
    alt_km: float = 0.0,
) -> list[RtsEvent]:
    """Rise, set, transit events for `body` at a lunar site, from Horizons."""
    params = observer_params(
        body, lon_east_deg, lat_deg, alt_km, start_utc, stop_utc, "1m RAD", "4"
    )
    table, _ = client.observer(params)
    return events_from_table(table)


def crossing_times(
    times: list[datetime], values: list[float], level: float
) -> list[tuple[datetime, str]]:
    """Linear interpolation of where `values` crosses `level`. Returns (time, 'up' | 'down')."""
    out: list[tuple[datetime, str]] = []
    for i in range(len(values) - 1):
        a, b = values[i] - level, values[i + 1] - level
        if a == 0 or (a < 0 < b) or (a > 0 > b):
            frac = 0.0 if a == b else a / (a - b)
            t = times[i] + (times[i + 1] - times[i]) * frac
            out.append((t, "up" if b > a else "down"))
    return out
