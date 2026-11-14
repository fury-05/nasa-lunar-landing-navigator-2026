"""Parser for Horizons OBSERVER tables (CSV format). Pure functions, no network.

Only text between $$SOE and $$EOE is data. Column positions are taken from the header
line, never assumed, so a changed quantity list cannot silently shift values.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

_MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}

# Header lines worth keeping as provenance (frame and site assumptions, ADR-0004).
_FRAME_KEYS = (
    "Target body name", "Center body name", "Center geodetic", "Center cylindric",
    "Center pole/equ", "Center radii", "Target pole/equ", "Target radii",
    "Atmos refraction", "Time format", "EOP file",
)


class HorizonsParseError(ValueError):
    """The payload does not look like an observer table."""


@dataclass(frozen=True)
class ObserverRow:
    time_utc: datetime
    azimuth_deg: float | None
    elevation_deg: float | None
    ang_diam_arcsec: float | None
    delta_au: float | None
    deldot_km_s: float | None
    solar_flag: str
    rts_flag: str


@dataclass(frozen=True)
class ObserverTable:
    rows: list[ObserverRow]
    frame_header: dict[str, str] = field(default_factory=dict)
    columns: list[str] = field(default_factory=list)


def _parse_time(text: str) -> datetime:
    # Example: "2026-Dec-01 00:00:00" (TIME_DIGITS=SECONDS). Locale independent.
    date, _, clock = text.strip().partition(" ")
    year, mon, day = date.split("-")
    hh, mm, ss = clock.split(":")
    return datetime(int(year), _MONTHS[mon], int(day), int(hh), int(mm), int(float(ss)), tzinfo=UTC)


def _num(text: str) -> float | None:
    t = text.strip()
    if not t or t.lower() in {"n.a.", "n.a"}:
        return None
    return float(t)


def _frame_header(lines: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in lines:
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        if key in _FRAME_KEYS:
            out[key] = value.strip()
    return out


def parse_observer_result(result: str) -> ObserverTable:
    """Parse the `result` text of a Horizons observer response."""
    lines = result.splitlines()
    try:
        soe = next(i for i, ln in enumerate(lines) if ln.strip() == "$$SOE")
        eoe = next(i for i, ln in enumerate(lines) if ln.strip() == "$$EOE")
    except StopIteration as exc:
        raise HorizonsParseError("no $$SOE/$$EOE block in result") from exc
    if eoe < soe:
        raise HorizonsParseError("$$EOE before $$SOE")
    header_idx = next(
        (i for i in range(soe - 1, -1, -1) if lines[i].lstrip().startswith("Date__(UT)")), None
    )
    if header_idx is None:
        raise HorizonsParseError("column header line not found")
    columns = [c.strip() for c in lines[header_idx].split(",")]

    def col(name: str) -> int | None:
        return columns.index(name) if name in columns else None

    i_az, i_el = col("Azi_(a-app)"), col("Elev_(a-app)")
    i_ad, i_de, i_dd = col("Ang-diam"), col("delta"), col("deldot")
    rows: list[ObserverRow] = []
    for ln in lines[soe + 1 : eoe]:
        if not ln.strip():
            continue
        f = ln.split(",")

        def get(i: int | None, f: list[str] = f) -> float | None:
            return _num(f[i]) if i is not None and i < len(f) else None

        rows.append(
            ObserverRow(
                time_utc=_parse_time(f[0]),
                azimuth_deg=get(i_az),
                elevation_deg=get(i_el),
                ang_diam_arcsec=get(i_ad),
                delta_au=get(i_de),
                deldot_km_s=get(i_dd),
                solar_flag=f[1] if len(f) > 1 else "",
                rts_flag=f[2] if len(f) > 2 else "",
            )
        )
    return ObserverTable(rows=rows, frame_header=_frame_header(lines[:soe]), columns=columns)
