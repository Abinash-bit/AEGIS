"""Deterministic rules: dashboard data -> per-hazard status + triggers.

Status is decided HERE (traceable rules), never by the LLM. Agents only explain and advise.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..data.donki import flare_score
from ..data.telemetry import CAREER_DOSE_LIMIT_MSV
from ..models import (Environment, HazardSummary, LabMarkerSeries, SpaceWeather, Trigger, Vital, worst)

HAZARD_NAMES = {
    "RAD": "Space Radiation",
    "ISO": "Isolation & Confinement",
    "DIST": "Distance from Earth",
    "GRAV": "Gravity Fields",
    "ENV": "Hostile & Closed Environments",
}
# knowledge-base hazard keys
KB_HAZARD = {
    "RAD": "space_radiation",
    "ISO": "isolation_confinement",
    "DIST": "distance_from_earth",
    "GRAV": "gravity_fields",
    "ENV": "hostile_closed_environments",
}
_LEVEL = {"nominal": 15, "watch": 45, "alert": 72, "critical": 92}


def _hours_ago(ts: str) -> float:
    try:
        t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - t).total_seconds() / 3600
    except (ValueError, AttributeError):
        return 1e9


def _ago(h: float) -> str:
    return f"{h:.0f} h ago" if h < 48 else f"{h / 24:.0f} days ago"


def _rad(sw: SpaceWeather, vit: dict[str, Vital]) -> list[Trigger]:
    t: list[Trigger] = []
    flares = [e for e in sw.events if e.type == "FLR"]
    if flares:
        top = max(flares, key=lambda e: flare_score(e.class_or_value))
        h = _hours_ago(top.time)
        cls = top.class_or_value
        recent = h <= 24 or sw.replay
        st = ("critical" if cls.startswith("X") and recent else "alert" if cls.startswith("X") or (cls.startswith("M") and recent)
              else "watch" if cls.startswith("M") else None)
        if st:
            t.append(Trigger(hazard="RAD", status=st, signal=f"flare_{cls[0]}",
                             message=f"Class {cls} solar flare ({'replayed window' if sw.replay else _ago(h)})",
                             query="solar flare solar storm radiation exposure in flight acute risk protect crew"))
    if sw.sep_count:
        t.append(Trigger(hazard="RAD", status="alert", signal="sep",
                         message=f"{sw.sep_count} solar energetic particle event(s) in the window",
                         query="solar particle event acute radiation sickness shielding storm shelter habitat design"))
    if sw.fast_cme_count:
        t.append(Trigger(hazard="RAD", status="watch", signal="fast_cme",
                         message=f"{sw.fast_cme_count} fast coronal mass ejection(s) (≥1000 km/s)",
                         query="coronal mass ejection solar storm space weather radiation"))
    d = vit.get("dose")
    if d:
        frac = d.value / CAREER_DOSE_LIMIT_MSV
        st = d.status
        t.append(Trigger(hazard="RAD", status=st, signal="dose",
                         message=f"Cumulative dose {d.value:.0f} mSv ({frac:.0%} of the {CAREER_DOSE_LIMIT_MSV} mSv career limit)",
                         query="long-term radiation exposure galactic cosmic rays cancer risk dose limits"))
    if sw.stale:
        t.append(Trigger(hazard="RAD", status="watch", signal="donki_stale",
                         message="Live space-weather feed unreachable; showing last known data",
                         query="space radiation monitoring dosimeters"))
    return t


def _iso(vit: dict[str, Vital]) -> list[Trigger]:
    t = []
    s = vit["sleep"]
    short = sum(v < 6 for v in s.spark[-3:])
    if s.status != "nominal" or short >= 2:
        t.append(Trigger(hazard="ISO", status=worst(s.status, "watch" if short >= 2 else "nominal"), signal="sleep",
                         message=f"Sleep {s.value} h last night; {short} of the last 3 nights under 6 h (baseline {s.baseline} h)",
                         query="inadequate sleep irregular schedules fatigue circadian countermeasures light"))
    r = vit["reaction"]
    if r.status != "nominal":
        t.append(Trigger(hazard="ISO", status=r.status, signal="reaction",
                         message=f"Reaction time {r.value:.0f} ms, {r.delta_vs_baseline_pct:+.0f}% vs baseline",
                         query="cognitive performance fatigue behavioral health monitoring"))
    m = vit["mood"]
    if m.status != "nominal" or m.value <= 3:
        t.append(Trigger(hazard="ISO", status=m.status, signal="mood",
                         message=f"Self-reported mood {m.value:.0f}/5 (baseline {m.baseline:.0f}/5)",
                         query="behavioral health mood isolation confinement coping psychological support crew"))
    return t


def _dist(env: Environment) -> list[Trigger]:
    d = env.comms_delay_s
    if d >= 60:
        st, txt = "watch", f"One-way comms delay {d / 60:.1f} min: crew must act autonomously; {env.evacuation.lower()}"
    elif d >= 1:
        st, txt = "nominal", f"One-way comms delay {d:.1f} s; {env.evacuation.lower()}"
    else:
        st, txt = "nominal", f"Near real-time contact with Earth; {env.evacuation.lower()}"
    return [Trigger(hazard="DIST", status=st, signal="comms_delay", message=txt,
                    query="distance from Earth communication delay autonomy medical care limited resources evacuation")]


def _grav(vit: dict[str, Vital], labs: dict[str, LabMarkerSeries], env: Environment, scenario: str = "demo") -> list[Trigger]:
    t = []
    if scenario == "landing":
        t.append(Trigger(hazard="GRAV", status="alert", signal="gravity_transition",
                         message=f"Day 1 at {env.gravity_g:g} g after months of weightlessness: balance, orientation and "
                                 f"blood pressure on standing are adapting",
                         query="gravity transition landing sensorimotor vestibular disorientation orthostatic fainting readiness"))
    bal = vit.get("balance")
    if bal and bal.status != "nominal":
        t.append(Trigger(hazard="GRAV", status=bal.status, signal="balance",
                         message=f"Balance test {bal.value:.0f}/100 (baseline {bal.baseline:.0f})",
                         query="balance sensorimotor vestibular function after landing mission readiness tests"))
    sbp = vit["sbp"]
    d = sbp.delta_vs_baseline_pct or 0
    if sbp.status != "nominal" or abs(d) > 8:
        trend = "rising" if d > 0 else "falling"
        logged = " (logged by you)" if sbp.provenance == "LOGGED" else ""
        t.append(Trigger(hazard="GRAV", status=worst(sbp.status, "watch"), signal="bp",
                         message=f"Systolic BP {sbp.value:.0f} mmHg{logged}, {d:+.0f}% vs baseline ({trend})",
                         query="cardiovascular adaptations fluid shift blood pressure microgravity"
                               + (" orthostatic intolerance fainting standing" if d < 0 else "")))
    hr = vit["hr"]
    if hr.status != "nominal":
        t.append(Trigger(hazard="GRAV", status=hr.status, signal="hr",
                         message=f"Resting heart rate {hr.value:.0f} bpm, {hr.delta_vs_baseline_pct:+.0f}% vs baseline",
                         query="cardiovascular adaptations heart rate deconditioning"))
    g = vit.get("glucose")
    if g and g.status != "nominal":
        t.append(Trigger(hazard="GRAV", status=g.status, signal="glucose_logged",
                         message=f"Blood sugar {g.value:.0f} mg/dL (logged by you)",
                         query="metabolism nutrition diet blood sugar spaceflight"))
    for key, q in (("calcium", "bone loss bone density calcium microgravity exercise"),
                   ("hemoglobin", "red blood cells blood changes spaceflight"),
                   ("glucose", "metabolism nutrition diet spaceflight")):
        s = labs.get(key)
        if not s:
            continue
        bad = [p for p in s.points if p.status != "nominal"]
        if bad:
            p = bad[-1]
            t.append(Trigger(hazard="GRAV", status=p.status, signal=f"lab_{key}",
                             message=f"{s.label} {p.value:g} {s.unit} at {p.timepoint} (normal {p.range_min}-{p.range_max})",
                             query=q))
    if env.gravity_g < 0.2:
        t.append(Trigger(hazard="GRAV", status="nominal", signal="microgravity",
                         message=f"Gravity {env.gravity_g:g} g: bone, muscle, fluid-shift and eye (SANS) risks accumulate",
                         query="spaceflight associated neuro-ocular syndrome SANS fluid shift bone muscle loss countermeasures"))
    return t


def _env(vit: dict[str, Vital], labs: dict[str, LabMarkerSeries]) -> list[Trigger]:
    t = []
    c = vit["co2"]
    if c.status != "nominal" or c.spark[-1] - c.spark[-4] > 0.4:
        t.append(Trigger(hazard="ENV", status=worst(c.status, "watch"), signal="co2",
                         message=f"Cabin CO₂ {c.value} mmHg, rising over 4 days",
                         query="closed environment cabin air carbon dioxide gases habitat monitoring"))
    tmp = vit["temp"]
    if tmp.status != "nominal":
        t.append(Trigger(hazard="ENV", status=tmp.status, signal="fever", message=f"Body temperature {tmp.value} °C",
                         query="infection immune system microbes illness in flight"))
    ly = labs.get("absolute_lymphocytes")
    if ly and ly.change_r1_vs_l3_pct is not None and ly.change_r1_vs_l3_pct <= -25:
        t.append(Trigger(hazard="ENV", status="watch", signal="lymphocytes_drop",
                         message=f"Lymphocytes {ly.change_r1_vs_l3_pct:+.0f}% one day after return vs 3 days before launch (real OSDR data)",
                         query="altered immune system responses latent virus reactivation stress microbes"))
    return t


def _headline(trigs: list[Trigger], default: str) -> str:
    ranked = sorted(trigs, key=lambda x: {"nominal": 0, "watch": 1, "alert": 2, "critical": 3}[x.status], reverse=True)
    return ranked[0].message if ranked and ranked[0].status != "nominal" else default


def evaluate(env: Environment, sw: SpaceWeather, vitals: list[Vital], labs: list[LabMarkerSeries],
             scenario: str = "demo") -> list[HazardSummary]:
    vit = {v.key: v for v in vitals}
    lab = {s.marker: s for s in labs}
    out = []
    spec = {
        "RAD": (_rad(sw, vit), f"Dose {vit['dose'].value:.0f} mSv · max flare {sw.max_flare_class or 'none'}", vit["dose"].spark),
        "ISO": (_iso(vit), f"Sleep {vit['sleep'].value} h · mood {vit['mood'].value:.0f}/5", vit["sleep"].spark),
        "DIST": (_dist(env), f"Delay {env.comms_delay_s / 60:.1f} min" if env.comms_delay_s >= 60 else f"Delay {env.comms_delay_s:.1f} s", []),
        "GRAV": (_grav(vit, lab, env, scenario), f"BP {vit['sbp'].value:.0f}/{vit['dbp'].value:.0f} · {env.gravity_g:g} g", vit["sbp"].spark),
        "ENV": (_env(vit, lab), f"CO₂ {vit['co2'].value} mmHg · cabin {vit['cabin_temp'].value} °C", vit["co2"].spark),
    }
    for hid, (trigs, metric, spark) in spec.items():
        status = worst(*[x.status for x in trigs]) if trigs else "nominal"
        level = min(100, _LEVEL[status] + 4 * sum(x.status != "nominal" for x in trigs))
        out.append(HazardSummary(id=hid, name=HAZARD_NAMES[hid], status=status, level=level,
                                 headline=_headline(trigs, "No active concerns"), key_metric=metric,
                                 triggers=trigs, spark=spark))
    return out


def readiness(hazards: list[HazardSummary]) -> tuple[int, str]:
    penalty = {"nominal": 0, "watch": 6, "alert": 15, "critical": 30}
    score = max(0, 100 - sum(penalty[h.status] for h in hazards) - sum(
        2 for h in hazards for t in h.triggers if t.status != "nominal"))
    return score, worst(*[h.status for h in hazards])
