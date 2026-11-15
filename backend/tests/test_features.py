"""Check-ins, landing scenario, routine/streaks, reports, validation."""
import os

os.environ.setdefault("USE_DENSE", "0")

from fastapi.testclient import TestClient

from app.data.environments import get_environment
from app.data.labs import get_labs
from app.data.telemetry import get_vitals
from app.engine.hazards import evaluate
from app.main import app
from app.memory import store
from app.services import routine
from tests.test_backend import _sw


def test_logged_reading_replaces_todays_value_and_is_labelled():
    store.add_reading("C001", "bp", 142, 92)
    store.add_reading("C001", "glucose", 61)
    v = {x.key: x for x in get_vitals("C001", "mars_transit", 142, "nominal", logged=store.latest_readings("C001"))}
    assert v["sbp"].value == 142 and v["sbp"].provenance == "LOGGED" and v["sbp"].status == "alert"
    assert v["dbp"].value == 92 and v["dbp"].provenance == "LOGGED"
    assert v["glucose"].value == 61 and v["glucose"].status == "watch"
    assert v["sleep"].provenance == "SIMULATED"
    grav = next(h for h in evaluate(get_environment("mars_transit"), _sw(), list(v.values()), get_labs("C001"))
                if h.id == "GRAV")
    signals = {t.signal for t in grav.triggers}
    assert {"bp", "glucose_logged"} <= signals
    assert "logged by you" in next(t for t in grav.triggers if t.signal == "bp").message


def test_landing_scenario_flags_gravity_transition():
    env = get_environment("mars_base")
    v = get_vitals("C002", "mars_base", 14, "landing")
    keys = {x.key for x in v}
    assert "balance" in keys
    grav = next(h for h in evaluate(env, _sw(), v, get_labs("C002"), "landing") if h.id == "GRAV")
    assert grav.status in ("alert", "critical")
    assert {"gravity_transition", "balance"} <= {t.signal for t in grav.triggers}


def test_routine_tracks_done_items_and_points():
    for key in ("sleep", "bp", "mood"):
        store.add_reading("C003", key, 120 if key == "bp" else 4, 80 if key == "bp" else None)
    r = routine("C003")
    assert r["done"] == 3 and r["total"] == 6
    assert r["streak_days"] == 1
    assert r["points"] == 30 and r["crew_total"] >= 30


def test_reading_validation_and_report_arrival_time():
    c = TestClient(app)
    assert c.post("/api/readings/C001", json={"key": "bp", "value": 120}).status_code == 422          # no diastolic
    assert c.post("/api/readings/C001", json={"key": "hr", "value": 900}).status_code == 422           # impossible
    assert c.post("/api/readings/C001", json={"key": "hr", "value": 64, "source": "camera"}).status_code == 200
    rep = c.post("/api/reports/C001", json={"environment": "mars_transit", "data": {"summary": "x"}}).json()
    from datetime import datetime
    delay = (datetime.fromisoformat(rep["arrives_at"]) - datetime.fromisoformat(rep["sent_at"])).total_seconds()
    assert abs(delay - get_environment("mars_transit").comms_delay_s) <= 1
