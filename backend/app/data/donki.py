"""Live space weather from NASA DONKI (CCMC), with in-memory + on-disk caching.

If DONKI is unreachable we serve the last cached window and mark it `stale=True`.
`replay_start`/`replay_end` fetch a historical window on purpose (marked `replay=True`), e.g. the May 2024 storms.
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from .. import config
from ..models import SpaceWeather, SpaceWeatherEvent

_mem: dict[str, tuple[float, SpaceWeather]] = {}
_FLARE_RANK = {"A": 0, "B": 1, "C": 2, "M": 3, "X": 4}


def flare_score(cls: Optional[str]) -> float:
    """'M3.5' -> 3.35 so classes sort correctly (X1 > M9.9)."""
    if not cls or cls[0] not in _FLARE_RANK:
        return -1
    try:
        mag = float(cls[1:] or 1)
    except ValueError:
        mag = 1
    return _FLARE_RANK[cls[0]] + min(mag, 9.99) / 10


def _iso(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


async def _get(client: httpx.AsyncClient, kind: str, start: str, end: str) -> list[dict]:
    r = await client.get(f"{config.DONKI_BASE}/{kind}", params={"startDate": start, "endDate": end})
    r.raise_for_status()
    return r.json() if r.text.strip() else []


def _parse(raw: dict[str, list[dict]]) -> list[SpaceWeatherEvent]:
    ev: list[SpaceWeatherEvent] = []
    for f in raw.get("FLR", []):
        ev.append(SpaceWeatherEvent(id=f["flrID"], type="FLR", time=f.get("peakTime") or f.get("beginTime"),
                                    class_or_value=f.get("classType") or "?", note=f.get("sourceLocation") or "",
                                    link=f.get("link", "")))
    for s in raw.get("SEP", []):
        ev.append(SpaceWeatherEvent(id=s["sepID"], type="SEP", time=s.get("eventTime"),
                                    class_or_value="Solar energetic particles",
                                    note=", ".join(i.get("displayName", "") for i in s.get("instruments", [])),
                                    link=s.get("link", "")))
    for c in raw.get("CME", []):
        analyses = c.get("cmeAnalyses") or []
        best = next((a for a in analyses if a.get("isMostAccurate")), analyses[0] if analyses else None)
        speed = best.get("speed") if best else None
        earth = None
        if best and best.get("enlilList"):
            earth = any(e.get("isEarthGB") or e.get("estimatedShockArrivalTime") for e in best["enlilList"])
        ev.append(SpaceWeatherEvent(id=c["activityID"], type="CME", time=c.get("startTime"),
                                    class_or_value=f"{int(speed)} km/s" if speed else "speed n/a",
                                    speed_kms=speed, earth_directed=earth, link=c.get("link", ""),
                                    note=(c.get("note") or "")[:240]))
    for g in raw.get("GST", []):
        kps = [k.get("kpIndex") for k in g.get("allKpIndex", []) if k.get("kpIndex") is not None]
        kp = max(kps) if kps else None
        ev.append(SpaceWeatherEvent(id=g["gstID"], type="GST", time=g.get("startTime"),
                                    class_or_value=f"Kp {kp:g}" if kp is not None else "Kp n/a", kp=kp,
                                    link=g.get("link", "")))
    ev.sort(key=lambda e: e.time or "", reverse=True)
    return ev


def _summarise(events, start, end, *, stale=False, replay=False) -> SpaceWeather:
    flares = [e.class_or_value for e in events if e.type == "FLR"]
    kps = [e.kp for e in events if e.type == "GST" and e.kp is not None]
    return SpaceWeather(
        window_start=start, window_end=end, fetched_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        stale=stale, replay=replay, events=events,
        max_flare_class=max(flares, key=flare_score) if flares else None,
        max_kp=max(kps) if kps else None,
        sep_count=sum(e.type == "SEP" for e in events),
        fast_cme_count=sum(e.type == "CME" and (e.speed_kms or 0) >= 1000 for e in events),
    )


async def get_space_weather(replay_start: Optional[str] = None, replay_end: Optional[str] = None) -> SpaceWeather:
    replay = bool(replay_start)
    if replay:
        start, end = replay_start, replay_end or replay_start
    else:
        now = datetime.now(timezone.utc)
        start, end = _iso(now - timedelta(days=config.DONKI_LOOKBACK_DAYS)), _iso(now)
    key = f"{start}_{end}"
    hit = _mem.get(key)
    if hit and (replay or time.time() - hit[0] < config.DONKI_CACHE_TTL_S):
        return hit[1]

    disk = config.CACHE_DIR / f"donki_{key}.json"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            kinds = ["FLR", "SEP", "CME", "GST"]
            results = await asyncio.gather(*(_get(client, k, start, end) for k in kinds))
        raw = dict(zip(kinds, results))
        disk.write_text(json.dumps(raw), encoding="utf-8")
        sw = _summarise(_parse(raw), start, end, replay=replay)
    except (httpx.HTTPError, ValueError):
        # DONKI unreachable: fall back to the newest cached window on disk
        cached = sorted(config.CACHE_DIR.glob("donki_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        src = disk if disk.exists() else (cached[0] if cached else None)
        if not src:
            raise
        raw = json.loads(src.read_text(encoding="utf-8"))
        s, e = src.stem.removeprefix("donki_").split("_")
        sw = _summarise(_parse(raw), s, e, stale=True, replay=replay)
    _mem[key] = (time.time(), sw)
    return sw
