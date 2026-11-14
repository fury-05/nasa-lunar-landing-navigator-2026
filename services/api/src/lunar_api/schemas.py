"""Typed response models for the OpenAPI contract (P3-06).

These describe what the routes already return, so the generated TypeScript client has real types.
`extra="forbid"` is NOT used on purpose: adding a field is not a breaking change for clients.
Times are ISO 8601 UTC strings ending in Z. A number that cannot be computed is null.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Verdict = Literal["viable", "marginal", "not viable"]


class Band(BaseModel):
    low: float
    nominal: float
    high: float


class Source(BaseModel):
    id: str
    url: str
    retrieved_at: str | None
    version: str | None


class Provenance(BaseModel):
    sources: list[Source]
    engine_version: str
    frame_note: str
    assumptions: list[str]
    warnings: list[str]
    uncertainty: dict[str, Any]
    reproduce: dict[str, Any]


class Problem(BaseModel):
    """RFC 7807 problem document returned for every error."""

    type: str
    title: str
    status: int
    detail: str
    instance: str
    request_id: str | None
    errors: list[dict[str, Any]]


class TerrainCoverage(BaseModel):
    covered_fraction: float
    min_reach_m: float
    max_reach_m: float


class SiteSummary(BaseModel):
    id: str
    lat_deg: float
    lon_east_deg: float
    coordinate_status: str
    window: dict[str, Any]
    built_at_utc: str
    terrain_coverage: TerrainCoverage


class SiteList(BaseModel):
    count: int
    sites: list[SiteSummary]
    notice: str


class SiteDetail(BaseModel):
    site_id: str
    lat_deg: float
    lon_east_deg: float
    built_at_utc: str
    engine_version: str
    window: dict[str, Any]
    skyline: dict[str, Any]
    dem: dict[str, Any]
    sources: list[str]
    assumptions: list[str]
    terrain_unavailable: bool = False
    quickmap: str


class SkylineOut(BaseModel):
    site_id: str
    eye_height_m: float
    azimuth_step_deg: float
    azimuth_deg: list[float]
    elevation_deg: list[float]
    reach_m: list[float]
    requested_range_m: float
    covered_fraction: float
    coverage_note: str
    provenance: Provenance


class Metrics(BaseModel):
    verdict: Verdict
    verdict_by_run: dict[str, Verdict]
    robust: bool
    delta_deg: float
    criteria_status: str
    sunlight_hours: Band
    sun_share: Band
    earth_share: Band
    longest_dark_hours: Band
    longest_outage_hours: Band
    elevation_deg: dict[str, float]
    power_index_w_m2: dict[str, float]
    assumptions: list[str]


class AssessOut(Metrics):
    site_id: str
    start_utc: str
    end_utc: str
    provenance: Provenance


class Span(BaseModel):
    start: str
    end: str
    open_start: bool
    open_end: bool


class TimelineOut(BaseModel):
    site_id: str
    start_utc: str
    end_utc: str
    step_min: int
    count: int
    series: list[dict[str, Any]]
    sun_intervals: list[Span]
    dark_intervals: list[Span]
    earth_windows: list[Span]
    earth_outages: list[Span]
    metrics: Metrics
    provenance: Provenance


class SunState(BaseModel):
    visible_fraction: float
    up: bool
    seconds_to_sunset: int | None
    seconds_to_sunrise: int | None
    note_if_null: str


class EarthState(BaseModel):
    margin_deg: float
    link_available: bool
    seconds_to_earthset: int | None
    seconds_to_earthrise: int | None


class StateOut(BaseModel):
    site_id: str
    t: str
    sun: SunState
    earth: EarthState
    definitions: list[str]
    provenance: Provenance


class CompareRow(Metrics):
    site_id: str
    window_index: int
    start_utc: str
    end_utc: str


class Delta(BaseModel):
    metric: str
    a: float
    b: float
    difference: float
    better: Literal["a", "b", "tie"]


class Pairwise(BaseModel):
    window_index: int
    b_minus_a: list[Delta]


class CompareOut(BaseModel):
    rows: list[CompareRow]
    pairwise: list[Pairwise]
    provenance: Provenance


class SlipCellOut(BaseModel):
    offset_days: float
    start_utc: str
    end_utc: str
    verdict: Verdict
    glyph: Literal["check", "tilde", "cross"]
    robust: bool
    sunlight_hours: float
    earth_share: float


class SlipOut(BaseModel):
    sites: list[str]
    offsets_days: list[float]
    cells: list[list[SlipCellOut]]
    provenance: Provenance


class QuickmapOut(BaseModel):
    site_id: str
    url: str
    note: str


class CreditOut(BaseModel):
    id: str
    name: str
    publisher: str
    url: str
    credit: str
    usage_statement: str
    retrieved_at: str
    terms_confirmed: bool


class AttributionOut(BaseModel):
    notice: str
    count: int
    unconfirmed_terms: list[str]
    sources: list[CreditOut]
    software: str


class JobAccepted(BaseModel):
    site_id: str
    job_id: str | None
    status: str
    cached: bool
    status_url: str | None = None
    events_url: str | None = None
    site_url: str | None = None


class JobOut(BaseModel):
    job_id: str
    site_id: str
    status: Literal["queued", "running", "done", "failed"]
    progress: float = Field(ge=0, le=1)
    message: str
    reason: str | None
    created_at_utc: str
    updated_at_utc: str
    result: dict[str, Any]
    site_url: str | None = None
    retry: str | None = None


class RegistryRow(BaseModel):
    id: str
    name: str
    publisher: str
    url: str
    retrieved_at: str
    version: str
    usage_statement: str
    citation: str
    modules: str


class HealthOut(BaseModel):
    status: Literal["ok"]


class CheckResult(BaseModel):
    ok: bool
    detail: str


class ReadyOut(BaseModel):
    status: Literal["ready", "not-ready"]
    checks: dict[str, CheckResult]


class VersionOut(BaseModel):
    api: str
    engine: str
    disclaimer: str
