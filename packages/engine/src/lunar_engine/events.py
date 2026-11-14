"""Interpolation, event detection and time remaining (P2-05, docs/04 section 4).

Input is a time series of a quantity (here, visible fraction or elevation). Samples at 10 minute
spacing are interpolated with a cubic Hermite spline whose derivatives come from Catmull-Rom
differences, then crossings of a level are refined by bisection to one second.
"""

from __future__ import annotations

import bisect
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np
import numpy.typing as npt

F64 = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Event:
    time_utc: datetime
    kind: str  # "rise" (crossing upward) or "set" (crossing downward)
    level: float


@dataclass(frozen=True)
class Interval:
    start_utc: datetime
    end_utc: datetime
    open_start: bool  # the interval began before the series did
    open_end: bool  # the interval continues past the end of the series

    @property
    def duration_s(self) -> float:
        return (self.end_utc - self.start_utc).total_seconds()


class HermiteSeries:
    """Cubic Hermite interpolation of (t, y) with Catmull-Rom derivatives. Times are datetimes."""

    def __init__(self, times: Sequence[datetime], values: Sequence[float] | F64) -> None:
        if len(times) != len(values) or len(times) < 2:
            raise ValueError("need at least two samples of equal length")
        self.times = list(times)
        self.t0 = self.times[0]
        self.x: F64 = np.array([(t - self.t0).total_seconds() for t in self.times], dtype=float)
        if np.any(np.diff(self.x) <= 0):
            raise ValueError("times must be strictly increasing")
        self.y: F64 = np.asarray(values, dtype=float)
        self.m: F64 = self._derivatives()

    def _derivatives(self) -> F64:
        x, y = self.x, self.y
        m = np.empty_like(y)
        m[1:-1] = (y[2:] - y[:-2]) / (x[2:] - x[:-2])  # Catmull-Rom (central difference)
        m[0] = (y[1] - y[0]) / (x[1] - x[0])
        m[-1] = (y[-1] - y[-2]) / (x[-1] - x[-2])
        return m

    @property
    def start(self) -> datetime:
        return self.times[0]

    @property
    def end(self) -> datetime:
        return self.times[-1]

    def at_seconds(self, s: float) -> float:
        if s < self.x[0] or s > self.x[-1]:
            raise ValueError("time outside the series")
        i = min(max(int(np.searchsorted(self.x, s, side="right")) - 1, 0), len(self.x) - 2)
        h = self.x[i + 1] - self.x[i]
        u = (s - self.x[i]) / h
        h00 = 2 * u**3 - 3 * u**2 + 1
        h10 = u**3 - 2 * u**2 + u
        h01 = -2 * u**3 + 3 * u**2
        h11 = u**3 - u**2
        return float(
            h00 * self.y[i] + h10 * h * self.m[i] + h01 * self.y[i + 1] + h11 * h * self.m[i + 1]
        )

    def at(self, t: datetime) -> float:
        return self.at_seconds((t - self.t0).total_seconds())


def find_events(
    series: HermiteSeries,
    level: float,
    tolerance_s: float = 1.0,
    scan_step_s: float = 60.0,
) -> list[Event]:
    """All crossings of `level`, refined by bisection to `tolerance_s`.

    The interpolant is scanned every `scan_step_s` seconds (default one minute, finer than the
    10 minute samples) and each sign change is bisected. A tangent touch between scan points is not
    reported; that case has no duration worth planning around.
    """
    out: list[Event] = []
    lo_s, hi_s = float(series.x[0]), float(series.x[-1])
    n = max(int(np.ceil((hi_s - lo_s) / scan_step_s)), 1)
    grid = np.linspace(lo_s, hi_s, n + 1)
    vals = np.array([series.at_seconds(float(s)) - level for s in grid])
    for i in range(n):
        a, b = vals[i], vals[i + 1]
        if a == 0.0 and i > 0:
            continue  # already reported as the end of the previous bracket
        if a < 0.0 <= b or a >= 0.0 > b:
            if a == 0.0 and b >= 0.0:
                continue
            left, right = float(grid[i]), float(grid[i + 1])
            f_left = a
            while right - left > tolerance_s:
                mid = 0.5 * (left + right)
                f_mid = series.at_seconds(mid) - level
                if (f_mid < 0.0) == (f_left < 0.0):
                    left, f_left = mid, f_mid
                else:
                    right = mid
            t = series.t0 + timedelta(seconds=0.5 * (left + right))
            out.append(Event(t, "rise" if b > a else "set", level))
    return out


def intervals_above(
    series: HermiteSeries, level: float, tolerance_s: float = 1.0
) -> list[Interval]:
    """Maximal spans where the series is above `level`, with open ends flagged."""
    events = find_events(series, level, tolerance_s)
    # Decide the starting state just after the first sample, so a series that begins exactly on the
    # level and moves up counts as already above (it has no rise event to open the span).
    probe = min(float(series.x[0]) + max(tolerance_s, 1e-6), float(series.x[-1]))
    starts_above = series.at_seconds(probe) > level
    spans: list[Interval] = []
    current: datetime | None = series.start if starts_above else None
    open_start = starts_above
    for ev in events:
        if ev.kind == "rise":
            current, open_start = ev.time_utc, False
        elif current is not None:
            spans.append(Interval(current, ev.time_utc, open_start, False))
            current = None
    if current is not None:
        spans.append(Interval(current, series.end, open_start, True))
    return spans


def intervals_below(
    series: HermiteSeries, level: float, tolerance_s: float = 1.0
) -> list[Interval]:
    """Maximal spans where the series is at or below `level`."""
    neg = HermiteSeries(series.times, -series.y)
    return intervals_above(neg, -level, tolerance_s)


def combine(a: Sequence[Interval], b: Sequence[Interval]) -> list[Interval]:
    """Intersection of two interval lists (for 'both Sun and Earth up')."""
    out: list[Interval] = []
    i = j = 0
    while i < len(a) and j < len(b):
        lo = max(a[i].start_utc, b[j].start_utc)
        hi = min(a[i].end_utc, b[j].end_utc)
        if lo < hi:
            lo_open = (a[i].open_start and a[i].start_utc == lo) or (
                b[j].open_start and b[j].start_utc == lo
            )
            hi_open = (a[i].open_end and a[i].end_utc == hi) or (
                b[j].open_end and b[j].end_utc == hi
            )
            out.append(Interval(lo, hi, lo_open, hi_open))
        if a[i].end_utc < b[j].end_utc:
            i += 1
        else:
            j += 1
    return out


def complement(spans: Sequence[Interval], start: datetime, end: datetime) -> list[Interval]:
    """Gaps between spans inside [start, end], for 'neither' or 'dark' periods."""
    out: list[Interval] = []
    cursor = start
    cursor_open = True
    for sp in spans:
        if sp.start_utc > cursor:
            out.append(Interval(cursor, sp.start_utc, cursor_open and cursor == start, False))
        cursor = max(cursor, sp.end_utc)
        cursor_open = False
    if cursor < end:
        out.append(Interval(cursor, end, cursor == start, True))
    return out


def time_remaining(
    now: datetime, events: Sequence[Event], kind: str = "set"
) -> timedelta | None:
    """Time from `now` to the next event of `kind`, or None if there is none in the series."""
    times = [e.time_utc for e in events if e.kind == kind]
    k = bisect.bisect_right(times, now)
    return times[k] - now if k < len(times) else None


def sample_function(
    f: Callable[[datetime], float], start: datetime, end: datetime, step: timedelta
) -> tuple[list[datetime], list[float]]:
    """Evaluate `f` on a regular time grid (helper for building a series)."""
    ts: list[datetime] = []
    t = start
    while t <= end:
        ts.append(t)
        t += step
    return ts, [f(t) for t in ts]
