"""Assemble the dashboard for one astronaut from the data sources (+ their own logged readings)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from .data.donki import get_space_weather
from .data.environments import get_environment
from .data.labs import CREW, get_labs
from .data.telemetry import get_vitals
from .engine.hazards import evaluate, readiness
from .memory import store
from .models import Dashboard


async def build_dashboard(crew_id: str = "C001", env_id: str = "mars_transit", scenario: str = "demo",
                          replay_start: Optional[str] = None, replay_end: Optional[str] = None) -> Dashboard:
    env = get_environment(env_id)
    if scenario == "landing":   # first day on the surface after the long weightless transit
        env = env.model_copy(update={"mission_day": 1})
    sw = await get_space_weather(replay_start, replay_end)
    labs = get_labs(crew_id)
    vitals = get_vitals(crew_id, env_id, max(env.mission_day, 14), scenario, logged=store.latest_readings(crew_id))
    hazards = evaluate(env, sw, vitals, labs, scenario)
    score, overall = readiness(hazards)
    return Dashboard(crew_id=crew_id, environment=env, generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                     readiness=score, overall_status=overall, hazards=hazards, vitals=vitals, labs=labs,
                     space_weather=sw, scenario=scenario)


async def crew_overview(env_id: str, scenario: str, replay_start: Optional[str] = None, replay_end: Optional[str] = None) -> list[dict]:
    dashes = await asyncio.gather(*(build_dashboard(c, env_id, scenario, replay_start, replay_end) for c in CREW))
    out = []
    for d in dashes:
        top = sorted(d.hazards, key=lambda h: -h.level)[0]
        out.append({"crew_id": d.crew_id, "readiness": d.readiness, "overall_status": d.overall_status,
                    "hazards": [{"id": h.id, "name": h.name, "status": h.status} for h in d.hazards],
                    "top": {"id": top.id, "name": top.name, "headline": top.headline}})
    return out


# ---- daily routine + gamification -----------------------------------------------
ROUTINE = [
    {"key": "sleep", "label": "Log last night's sleep", "when": "07:00", "hazard": "ISO"},
    {"key": "bp", "label": "Blood pressure", "when": "07:30", "hazard": "GRAV"},
    {"key": "hr", "label": "Resting heart rate", "when": "07:30", "hazard": "GRAV"},
    {"key": "glucose", "label": "Fasting blood sugar", "when": "07:45", "hazard": "GRAV"},
    {"key": "mood", "label": "Mood check", "when": "13:00", "hazard": "ISO"},
    {"key": "temp", "label": "Body temperature", "when": "19:00", "hazard": "ENV"},
]
POINTS_PER_READING = 10
CREW_WEEKLY_GOAL = 400
BADGES = [(3, "First steps · 3-day streak"), (7, "Steady orbit · 7-day streak"), (14, "Long haul · 14-day streak")]


def routine(crew_id: str) -> dict:
    today = datetime.now(timezone.utc).date()
    days = store.reading_days(crew_id)
    done_today = days.get(today.isoformat(), set())
    # streak: consecutive days (ending today, or yesterday if nothing logged yet today) with at least 3 check-ins
    streak, d = 0, today if len(done_today) >= 3 else today - timedelta(days=1)
    while len(days.get(d.isoformat(), set())) >= 3:
        streak += 1
        d -= timedelta(days=1)
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(timespec="seconds")
    counts = store.count_readings_since(CREW, week_start)
    crew_points = {c: counts.get(c, 0) * POINTS_PER_READING for c in CREW}
    return {
        "date": today.isoformat(),
        "items": [{**it, "done": it["key"] in done_today} for it in ROUTINE],
        "done": sum(it["key"] in done_today for it in ROUTINE), "total": len(ROUTINE),
        "streak_days": streak,
        "badges": [{"days": n, "name": name, "earned": streak >= n} for n, name in BADGES],
        "points": crew_points.get(crew_id, 0),
        "crew_points": crew_points, "crew_total": sum(crew_points.values()), "crew_goal": CREW_WEEKLY_GOAL,
    }
