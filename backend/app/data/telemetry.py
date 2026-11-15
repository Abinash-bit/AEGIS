"""Daily telemetry: simulated series (labelled SIMULATED) + the astronaut's own logged readings (labelled LOGGED).

Simulated values are deterministic per crew member (seeded) and anchored to published spaceflight figures:
  * Sleep: astronauts average ~6 h/night in flight (Barger et al. 2014, Lancet Neurology).
  * Radiation dose: daily rates per environment (see environments.DOSE_RATE_MSV_DAY).
Scenarios:
  * "demo"    - 3 short nights, mild fluid-shift BP rise, CO2 drifting up.
  * "nominal" - everything near baseline.
  * "landing" - day 1 after landing (gravity transition): faster heart rate, blood pressure drop when standing,
                worse balance test, slower reactions.
Logged readings (guided check-ins) replace today's value of the matching series.

Thresholds below are DEMO thresholds for colour-coding, not clinical or NASA flight rules.
"""
from __future__ import annotations

import hashlib
import random
from typing import Optional

from ..models import Vital
from .environments import DOSE_RATE_MSV_DAY

DAYS = 14
CAREER_DOSE_LIMIT_MSV = 600  # NASA career effective-dose limit (NASA-STD-3001, 2022 update)


def _rng(crew_id: str, key: str) -> random.Random:
    return random.Random(int(hashlib.md5(f"{crew_id}:{key}".encode()).hexdigest()[:8], 16))


def _series(crew_id, key, base, sd, days=DAYS, lo=None, hi=None, digits=1):
    r = _rng(crew_id, key)
    vals = []
    for _ in range(days):
        v = r.gauss(base, sd)
        if lo is not None: v = max(lo, v)
        if hi is not None: v = min(hi, v)
        vals.append(round(v, digits))
    return vals


def _pct(v, b):
    return round(100 * (v - b) / b, 1) if b else None


def baselines(crew_id: str) -> dict:
    r = _rng(crew_id, "baselines")
    return dict(hr=round(r.uniform(56, 66)), sbp=round(r.uniform(112, 122)), dbp=round(r.uniform(70, 79)),
                sleep=round(r.uniform(7.0, 7.6), 1), mood=4, reaction=round(r.uniform(255, 300)),
                temp=round(r.uniform(36.5, 36.8), 1), balance=round(r.uniform(88, 95)))


# ---- status rules (demo thresholds) -------------------------------------------
def status_for(key: str, v: float, base: dict) -> str:
    if key == "sleep": return "alert" if v < 5 else "watch" if v < 6 else "nominal"
    if key == "mood": return "alert" if v <= 1 else "watch" if v <= 2 else "nominal"
    if key == "reaction":
        d = _pct(v, base["reaction"]); return "alert" if d > 30 else "watch" if d > 15 else "nominal"
    if key == "hr": return "alert" if v > 100 or v < 45 else "watch" if abs(_pct(v, base["hr"])) > 15 else "nominal"
    if key == "sbp": return "alert" if v >= 140 or v < 90 else "watch" if v >= 130 or v < 100 else "nominal"
    if key == "dbp": return "alert" if v >= 90 else "watch" if v >= 85 else "nominal"
    if key == "temp": return "alert" if v >= 38.0 or v < 35.5 else "watch" if v >= 37.5 else "nominal"
    if key == "glucose": return "alert" if v < 54 or v > 250 else "watch" if v < 70 or v > 140 else "nominal"
    if key == "co2": return "alert" if v > 4.0 else "watch" if v > 3.0 else "nominal"
    if key == "cabin_temp": return "watch" if not 18 <= v <= 27 else "nominal"
    if key == "balance": return "alert" if v < 60 else "watch" if v < 75 else "nominal"
    if key == "dose":
        f = v / CAREER_DOSE_LIMIT_MSV; return "alert" if f > 0.8 else "watch" if f > 0.5 else "nominal"
    return "nominal"


def get_vitals(crew_id: str, env_id: str, mission_day: int, scenario: str = "demo",
               logged: Optional[dict[str, dict]] = None) -> list[Vital]:
    """`logged`: latest logged reading per key (from the readings table) - replaces today's value."""
    base = baselines(crew_id)
    logged = logged or {}

    s = {
        "sleep": _series(crew_id, "sleep", 6.2, 0.6, lo=4.5, hi=8.0),
        "hr": _series(crew_id, "hr", base["hr"] + 2, 2.5, digits=0),
        "sbp": _series(crew_id, "sbp", base["sbp"] + 3, 4, digits=0),
        "dbp": _series(crew_id, "dbp", base["dbp"] + 2, 3, digits=0),
        "mood": _series(crew_id, "mood", 3.8, 0.4, lo=1, hi=5, digits=0),
        "reaction": _series(crew_id, "reaction", base["reaction"] * 1.04, 10, digits=0),
        "temp": _series(crew_id, "temp", base["temp"], 0.15, digits=1),
        "co2": _series(crew_id, "co2", 2.4, 0.2, lo=1.5, digits=2),
        "cabin_temp": _series(crew_id, "cabin_t", 22.5, 0.6, digits=1),
    }
    if scenario == "demo":
        s["sleep"][-3:] = [5.6, 5.3, 5.4]
        s["mood"][-2:] = [3, 3]
        s["reaction"][-3:] = [round(base["reaction"] * f) for f in (1.12, 1.16, 1.18)]
        s["sbp"][-4:] = [base["sbp"] + d for d in (8, 10, 12, 13)]
        s["co2"][-4:] = [2.8, 3.0, 3.2, 3.3]
    if scenario == "landing":
        s["hr"][-2:] = [round(base["hr"] * 1.18), round(base["hr"] * 1.27)]
        s["sbp"][-2:] = [base["sbp"] - 10, base["sbp"] - 18]          # drop on standing (orthostatic)
        s["reaction"][-2:] = [round(base["reaction"] * 1.14), round(base["reaction"] * 1.2)]
        s["balance"] = _series(crew_id, "balance", base["balance"], 3, digits=0)
        s["balance"][-2:] = [66, 58]

    provenance: dict[str, str] = {}
    for key, rd in logged.items():
        if key == "bp":
            for k, v in (("sbp", rd["value"]), ("dbp", rd.get("value2"))):
                if v is not None:
                    s[k][-1] = round(v); provenance[k] = "LOGGED"
        elif key == "glucose":
            s["glucose"] = [round(rd["value"])]; provenance["glucose"] = "LOGGED"
        elif key in s:
            s[key][-1] = rd["value"]; provenance[key] = "LOGGED"

    rate = DOSE_RATE_MSV_DAY[env_id]
    s["dose"] = [round(rate * (mission_day - DAYS + i + 1), 1) for i in range(DAYS)]

    def vital(key, label, unit, hazard, baseline=None):
        series = s[key]
        v = series[-1]
        return Vital(key=key, label=label, value=v, unit=unit, status=status_for(key, v, base), baseline=baseline,
                     delta_vs_baseline_pct=_pct(v, baseline) if baseline else None, spark=series, hazard=hazard,
                     provenance=provenance.get(key, "SIMULATED"))

    out = [
        vital("sleep", "Sleep (last night)", "h", "ISO", base["sleep"]),
        vital("mood", "Mood (self-report 1-5)", "/5", "ISO", base["mood"]),
        vital("reaction", "Reaction time", "ms", "ISO", base["reaction"]),
        vital("hr", "Resting heart rate", "bpm", "GRAV", base["hr"]),
        vital("sbp", "Blood pressure (systolic)", "mmHg", "GRAV", base["sbp"]),
        vital("dbp", "Blood pressure (diastolic)", "mmHg", "GRAV", base["dbp"]),
        vital("temp", "Body temperature", "°C", "ENV", base["temp"]),
        vital("co2", "Cabin CO₂ (partial pressure)", "mmHg", "ENV"),
        vital("cabin_temp", "Cabin temperature", "°C", "ENV"),
        vital("dose", "Cumulative radiation dose", "mSv", "RAD"),
    ]
    if "glucose" in s:
        out.append(vital("glucose", "Blood sugar (fingerstick)", "mg/dL", "GRAV"))
    if "balance" in s:
        out.append(vital("balance", "Balance test score", "/100", "GRAV", base["balance"]))
    return out
