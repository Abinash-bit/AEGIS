"""Offline tests: no network for agents (Claude is mocked), DONKI replaced by a fixed window."""
import asyncio
import os

os.environ.setdefault("USE_DENSE", "0")  # BM25-only keeps tests fast and offline

import pytest

from app.agents import llm, orchestrator
from app.data.donki import flare_score
from app.data.environments import get_environment
from app.data.labs import get_labs
from app.data.telemetry import get_vitals
from app.engine.hazards import evaluate, readiness
from app.models import Dashboard, SpaceWeather, SpaceWeatherEvent


def _sw(events=()):
    return SpaceWeather(window_start="2024-05-08", window_end="2024-05-15", fetched_at="now", replay=True,
                        events=list(events),
                        max_flare_class=max((e.class_or_value for e in events if e.type == "FLR"), key=flare_score, default=None),
                        sep_count=sum(e.type == "SEP" for e in events))


def _dash(sw=None, scenario="demo", env="mars_transit", crew="C001") -> Dashboard:
    e = get_environment(env)
    sw = sw or _sw()
    v = get_vitals(crew, env, e.mission_day, scenario)
    labs = get_labs(crew)
    hz = evaluate(e, sw, v, labs)
    score, overall = readiness(hz)
    return Dashboard(crew_id=crew, environment=e, generated_at="now", readiness=score, overall_status=overall,
                     hazards=hz, vitals=v, labs=labs, space_weather=sw, scenario=scenario)


def test_flare_ordering():
    assert flare_score("X1.0") > flare_score("M9.9") > flare_score("C5") > flare_score("B1")


def test_comms_delay_from_distance():
    assert 1.2 < get_environment("lunar_base").comms_delay_s < 1.4
    assert get_environment("mars_transit").comms_delay_s > 600


def test_real_labs_c001():
    labs = {s.marker: s for s in get_labs("C001")}
    glucose = [p.value for p in labs["glucose"].points]
    assert glucose == [83, 80, 69, 90, 84, 91, 87]          # real OSDR values, L-92 .. R+194
    assert labs["absolute_lymphocytes"].change_r1_vs_l3_pct == pytest.approx(-38.5, abs=0.1)
    assert labs["glucose"].points[0].range_min == 65 and labs["glucose"].points[0].range_max == 99


def test_sep_event_raises_radiation_alert():
    sw = _sw([SpaceWeatherEvent(id="s1", type="SEP", time="2024-05-11T02:00Z", class_or_value="SEP"),
              SpaceWeatherEvent(id="f1", type="FLR", time="2024-05-11T01:00Z", class_or_value="X5.8")])
    rad = next(h for h in _dash(sw).hazards if h.id == "RAD")
    assert rad.status == "critical"
    assert {t.signal for t in rad.triggers} >= {"sep", "flare_X"}


def test_demo_scenario_flags_sleep_and_nominal_does_not_inject():
    iso_demo = next(h for h in _dash(scenario="demo").hazards if h.id == "ISO")
    assert any(t.signal == "sleep" for t in iso_demo.triggers)
    sleep_nominal = next(v for v in get_vitals("C001", "mars_transit", 142, "nominal") if v.key == "sleep")
    assert sleep_nominal.spark[-3:] != [5.6, 5.3, 5.4]


def test_briefing_maps_citations_and_drops_uncited(monkeypatch):
    """Agents and coordinator are mocked; checks passage-ID -> citation numbering and the 'no citation, no claim' rule."""
    calls = []

    async def fake_structured(*, schema, messages, **kw):
        calls.append(schema)
        if "findings" in schema["properties"]:
            return {"findings": [{"text": "f", "passage_ids": ["P1"]}], "actions": [], "watch_next": "w",
                    "escalate": False, "coverage": "covered"}
        return {"headline": "h",
                "happening": [{"text": "cited", "passage_ids": ["P2", "P1"]}, {"text": "uncited", "passage_ids": []}],
                "actions": [{"text": "bogus id", "passage_ids": ["P999"]}, {"text": "ok", "passage_ids": ["P1"]}],
                "next": "n", "escalate": True}

    monkeypatch.setattr(llm, "structured", fake_structured)
    orchestrator._briefing_cache.clear()
    b = asyncio.run(orchestrator.build_briefing(_dash()))
    assert [h.text for h in b.happening] == ["cited"]
    assert [a.text for a in b.actions] == ["ok"]
    assert b.happening[0].cites == [1, 2] and b.actions[0].cites == [2]   # P2 used first -> [1], P1 -> [2]
    assert [c.n for c in b.citations] == [1, 2]
    assert b.trace["uncited_items_dropped"] == 2
    assert b.escalate_to_flight_surgeon is True
    assert len(calls) == len(b.agents) + 1


def test_route_picks_hazard_named_in_question():
    assert "RAD" in orchestrator.route("Is the solar flare dangerous for me?", _dash())
    assert "GRAV" in orchestrator.route("How do I protect my bones?", _dash())


def test_briefing_stream_emits_steps_in_order(monkeypatch):
    async def fake_structured(*, schema, **kw):
        if "findings" in schema["properties"]:
            return {"findings": [{"text": "a finding", "passage_ids": ["P1"]}], "actions": [], "watch_next": "w",
                    "escalate": False, "coverage": "covered"}
        return {"headline": "h", "happening": [{"text": "x", "passage_ids": ["P1"]}], "actions": [],
                "next": "n", "escalate": False}

    monkeypatch.setattr(llm, "structured", fake_structured)
    orchestrator._briefing_cache.clear()

    async def collect():
        return [e async for e in orchestrator.briefing_events(_dash(), force=True)]
    evs = asyncio.run(collect())
    types = [e["type"] for e in evs]
    assert types[0] == "dashboard_read" and types[1] == "routing" and types[-2:] == ["writing", "briefing"]
    n_agents = len(evs[1]["agents"])
    assert types.count("retrieval") == n_agents and types.count("agent_done") == n_agents
    assert all(e["summary"] == "a finding" for e in evs if e["type"] == "agent_done")
    assert all(e["passages"] for e in evs if e["type"] == "retrieval")
