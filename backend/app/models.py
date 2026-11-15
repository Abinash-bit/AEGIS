"""API data contracts (mirrors the frontend TypeScript types)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Provenance = Literal["LIVE_DONKI", "REAL_OSDR", "SIMULATED", "LOGGED"]
Status = Literal["nominal", "watch", "alert", "critical"]
HazardId = Literal["RAD", "ISO", "DIST", "GRAV", "ENV"]
Timepoint = Literal["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]

STATUS_ORDER = {"nominal": 0, "watch": 1, "alert": 2, "critical": 3}


def worst(*statuses: str) -> str:
    return max(statuses, key=lambda s: STATUS_ORDER[s]) if statuses else "nominal"


class Environment(BaseModel):
    id: str
    name: str
    comms_delay_s: float            # one-way light time
    gravity_g: float
    evacuation: str
    mission_day: int
    mission_length_days: int
    distance_km: float


class SpaceWeatherEvent(BaseModel):
    id: str
    type: Literal["FLR", "SEP", "CME", "GST"]
    time: str
    class_or_value: str
    earth_directed: Optional[bool] = None
    speed_kms: Optional[float] = None
    kp: Optional[float] = None
    note: str = ""
    link: str = ""


class SpaceWeather(BaseModel):
    provenance: Provenance = "LIVE_DONKI"
    window_start: str
    window_end: str
    fetched_at: str
    stale: bool = False             # True when serving cached data because DONKI was unreachable
    replay: bool = False            # True when showing a historical window on purpose
    events: list[SpaceWeatherEvent]
    max_flare_class: Optional[str] = None
    max_kp: Optional[float] = None
    sep_count: int = 0
    fast_cme_count: int = 0


class LabPoint(BaseModel):
    marker: str
    label: str
    unit: str
    timepoint: Timepoint
    value: float
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    status: Status
    source: Literal["OSD-569", "OSD-575"]


class LabMarkerSeries(BaseModel):
    marker: str
    label: str
    unit: str
    panel: Literal["CBC", "CMP", "CARDIO"]
    hazard: HazardId
    points: list[LabPoint]
    change_r1_vs_l3_pct: Optional[float] = None


class Vital(BaseModel):
    key: str
    label: str
    value: float
    unit: str
    status: Status
    baseline: Optional[float] = None
    delta_vs_baseline_pct: Optional[float] = None
    spark: list[float]
    provenance: Provenance = "SIMULATED"
    hazard: HazardId


class Trigger(BaseModel):
    """A dashboard signal that a hazard agent should react to."""
    hazard: HazardId
    status: Status
    signal: str                      # machine-friendly id, e.g. "flare_M"
    message: str                     # human-readable, e.g. "M3.5 solar flare 2 days ago"
    query: str                       # retrieval query for the knowledge base


class HazardSummary(BaseModel):
    id: HazardId
    name: str
    status: Status
    level: int = Field(ge=0, le=100)  # radar-chart value
    headline: str
    key_metric: str
    triggers: list[Trigger]
    spark: list[float] = []


class Dashboard(BaseModel):
    crew_id: str
    environment: Environment
    generated_at: str
    readiness: int
    overall_status: Status
    hazards: list[HazardSummary]
    vitals: list[Vital]
    labs: list[LabMarkerSeries]
    space_weather: SpaceWeather
    scenario: str


# ---- knowledge base / agents -------------------------------------------------
class Chunk(BaseModel):
    id: str
    doc: str
    hazards: list[str]
    content_type: str
    title: str
    heading_path: list[str]
    source_url: str
    risks: list[str]
    text: str
    score: Optional[float] = None


class Citation(BaseModel):
    n: int
    chunk_id: str
    title: str
    heading_path: list[str]
    quote: str
    url: str
    hazards: list[str]


class CitedText(BaseModel):
    text: str
    cites: list[int]


class Briefing(BaseModel):
    id: str
    crew_id: str
    created_at: str
    severity: Status
    agents: list[HazardId]
    headline: str
    happening: list[CitedText]
    actions: list[CitedText]
    next: str
    escalate_to_flight_surgeon: bool
    citations: list[Citation]
    trace: dict = {}


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    crew_id: str = "C001"
    environment: str = "mars_transit"
    scenario: str = "demo"
    message: str
    session_id: Optional[str] = None   # omit to start a new session; the first SSE event returns its id


class SessionCreate(BaseModel):
    crew_id: str = "C001"
    environment: str = "mars_transit"
    scenario: str = "demo"
