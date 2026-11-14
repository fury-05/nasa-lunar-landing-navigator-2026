"""A fake Horizons that serves a synthetic table for any requested range (no network)."""

import math
import re
from datetime import UTC, datetime, timedelta

import httpx

T0 = datetime(2026, 12, 1, tzinfo=UTC)
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _fmt(t: datetime) -> str:
    return f"{t.year}-{MONTHS[t.month - 1]}-{t.day:02d} {t.hour:02d}:{t.minute:02d}:{t.second:02d}"


def _fake(sun_offset: float):  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        q = request.url.params
        a = datetime.strptime(q["START_TIME"].strip("'"), "%Y-%m-%d %H:%M").replace(tzinfo=UTC)
        b = datetime.strptime(q["STOP_TIME"].strip("'"), "%Y-%m-%d %H:%M").replace(tzinfo=UTC)
        step = int(re.match(r"'(\d+)m'", q["STEP_SIZE"]).group(1))  # type: ignore[union-attr]
        sun = q["COMMAND"] == "'10'"
        rows, t = [], a
        w = 2 * math.pi / 86400.0
        while t <= b:
            s = (t - T0).total_seconds()
            el = (sun_offset + 12 * math.sin(w * s)) if sun else (8 * math.sin(w * s + 1.0) + 3)
            dist = 0.9863 if sun else 384_400.0 / 149_597_870.7
            rows.append(
                f" {_fmt(t)}, , ,{(s / 240) % 360:.6f}, {el:.6f}, 1945.0, {dist:.14f}, 0.1,"
            )
            t += timedelta(minutes=step)
        text = (
            "Center body name: Moon (301)\nCenter pole/equ : MEAN_ME\n"
            "Atmos refraction: NO (AIRLESS)\n"
            " Date__(UT)__HR:MN:SS, , ,Azi_(a-app), Elev_(a-app), Ang-diam, delta, deldot,\n$$SOE\n"
            + "\n".join(rows)
            + "\n$$EOE\n"
        )
        return httpx.Response(200, json={"signature": {"version": "1.2"}, "result": text})

    return handler


fake_horizons = _fake
