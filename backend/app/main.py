"""AEGIS backend API.

Run (from backend/):  .venv/Scripts/uvicorn app.main:app --reload --port 8000
Docs:                 http://localhost:8000/docs
"""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import config
from .agents import llm
from .agents.orchestrator import briefing_events, build_briefing, chat_stream
from .data.environments import list_environments
from .data.labs import CREW, get_labs
from .data.donki import get_space_weather
from .engine.hazards import HAZARD_NAMES, KB_HAZARD
from .kb.retriever import get_retriever
from .memory import store as memory_store
from .models import Briefing, ChatRequest, Dashboard, SessionCreate
from .services import build_dashboard

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
@asynccontextmanager
async def lifespan(_app):
    memory_store.init()   # create SQLite tables if needed
    get_retriever()       # load chunks + embeddings once
    yield


app = FastAPI(title="AEGIS crew-health API", version="0.2.0", lifespan=lifespan,
              description="Dashboard data (NASA DONKI live, NASA OSDR real labs, simulated telemetry) and a "
                          "multi-agent RAG assistant grounded in NASA Human Research Program sources.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

EnvId = Literal["iss", "lunar_base", "mars_transit", "mars_base"]
Scenario = Literal["demo", "nominal", "landing"]


@app.get("/api/health")
def health():
    r = get_retriever()
    return {"ok": True, "llm_provider": config.LLM_PROVIDER, "ai_configured": config.llm_configured(),
            "kb_chunks": len(r.chunks), "retrieval_mode": r.mode,
            "models": {"coordinator": config.COORDINATOR_MODEL, "hazard": config.HAZARD_AGENT_MODEL, "memory": config.MEMORY_MODEL}}


@app.get("/api/meta")
def meta():
    return {"crew": CREW, "environments": [e.model_dump() for e in list_environments()],
            "hazards": [{"id": k, "name": v, "kb_key": KB_HAZARD[k]} for k, v in HAZARD_NAMES.items()],
            "scenarios": ["demo", "nominal"]}


async def _dash(crew_id, env, scenario, replay_start, replay_end) -> Dashboard:
    try:
        return await build_dashboard(crew_id, env, scenario, replay_start, replay_end)
    except KeyError as e:
        raise HTTPException(404, str(e))


@app.get("/api/dashboard/{crew_id}", response_model=Dashboard)
async def dashboard(crew_id: str, env: EnvId = "mars_transit", scenario: Scenario = "demo",
                    replay_start: Optional[str] = Query(None, description="YYYY-MM-DD: replay a historical DONKI window"),
                    replay_end: Optional[str] = None):
    return await _dash(crew_id, env, scenario, replay_start, replay_end)


@app.get("/api/space-weather")
async def space_weather(replay_start: Optional[str] = None, replay_end: Optional[str] = None):
    return await get_space_weather(replay_start, replay_end)


@app.get("/api/labs/{crew_id}")
def labs(crew_id: str):
    try:
        return get_labs(crew_id)
    except KeyError as e:
        raise HTTPException(404, str(e))


@app.post("/api/briefing/{crew_id}", response_model=Briefing)
async def briefing(crew_id: str, env: EnvId = "mars_transit", scenario: Scenario = "demo", force: bool = False,
                   replay_start: Optional[str] = None, replay_end: Optional[str] = None):
    d = await _dash(crew_id, env, scenario, replay_start, replay_end)
    try:
        return await build_briefing(d, force=force)
    except llm.AgentError as e:
        raise HTTPException(503, str(e))


@app.post("/api/briefing/{crew_id}/stream")
async def briefing_stream(crew_id: str, env: EnvId = "mars_transit", scenario: Scenario = "demo", force: bool = False,
                          replay_start: Optional[str] = None, replay_end: Optional[str] = None):
    """Server-sent events: dashboard_read, routing, retrieval, agent_done, writing, briefing, error."""
    d = await _dash(crew_id, env, scenario, replay_start, replay_end)

    async def events():
        try:
            async for ev in briefing_events(d, force=force):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except llm.AgentError as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.post("/api/chat")
async def chat(req: ChatRequest, mode: Literal["agents", "direct"] = "agents",
               replay_start: Optional[str] = None, replay_end: Optional[str] = None):
    """Server-sent events: session, routing, citations, agent_done, token, memory_saved, done, error.

    Send `session_id` to continue a conversation (memory is kept server-side); omit it to start a new one.
    """
    if req.session_id:
        session = memory_store.get_session(req.session_id)
        if not session:
            raise HTTPException(404, "session not found")
        crew, env, scenario = session["crew_id"], session["environment"], session["scenario"]
    else:
        crew, env, scenario = req.crew_id, req.environment, req.scenario
    d = await _dash(crew, env, scenario, replay_start, replay_end)
    session = session if req.session_id else memory_store.create_session(crew, env, scenario)

    async def events():
        try:
            async for ev in chat_stream(d, req.message, session, mode=mode):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except llm.AgentError as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


# ---- conversation sessions ---------------------------------------------------
@app.post("/api/sessions")
def create_session(body: SessionCreate):
    if body.crew_id not in CREW:
        raise HTTPException(404, f"unknown crew member '{body.crew_id}'")
    return memory_store.create_session(body.crew_id, body.environment, body.scenario)


@app.get("/api/sessions")
def list_sessions(crew_id: Optional[str] = None):
    return memory_store.list_sessions(crew_id)


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    s = memory_store.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    return {**s, "messages": memory_store.get_messages(session_id),
            "citations": memory_store.session_citations(session_id)}


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    memory_store.delete_session(session_id)
    return {"deleted": session_id}


# ---- long-term astronaut memory (visible and deletable) ------------------------
@app.get("/api/memory/{crew_id}")
def get_memory(crew_id: str):
    return memory_store.list_memories(crew_id)


@app.delete("/api/memory/{crew_id}/{memory_id}")
def delete_memory(crew_id: str, memory_id: str):
    if not memory_store.delete_memory(crew_id, memory_id):
        raise HTTPException(404, "memory not found")
    return {"deleted": memory_id}


@app.delete("/api/memory/{crew_id}")
def clear_memory(crew_id: str):
    return {"deleted": memory_store.clear_memories(crew_id)}


@app.get("/api/briefing/{crew_id}/latest")
def latest_briefing(crew_id: str, env: EnvId = "mars_transit", scenario: Scenario = "demo"):
    b = memory_store.latest_briefing(crew_id, env, scenario)
    if not b:
        raise HTTPException(404, "no briefing yet")
    return b


@app.get("/api/kb/search")
def kb_search(q: str, hazard: Optional[str] = Query(None, description="RAD|ISO|DIST|GRAV|ENV"), k: int = 8):
    hz = [KB_HAZARD[hazard]] if hazard in KB_HAZARD else None
    return [c.model_dump() for c in get_retriever().search(q, k=k, hazards=hz)]


@app.get("/api/kb/chunk/{chunk_id}")
def kb_chunk(chunk_id: str):
    c = get_retriever().by_id.get(chunk_id)
    if not c:
        raise HTTPException(404, "chunk not found")
    return c


# ---- guided check-ins: the astronaut's own readings ----------------------------
from pydantic import BaseModel, Field  # noqa: E402

from .data.environments import get_environment  # noqa: E402
from .services import crew_overview as _crew_overview, routine as _routine  # noqa: E402

READING_LIMITS = {  # key -> (min, max) accepted values; anything outside is almost certainly a typo
    "bp": (60, 250), "hr": (30, 220), "temp": (33, 43), "glucose": (20, 600), "sleep": (0, 24), "mood": (1, 5),
    "reaction": (100, 2000),
}


class ReadingIn(BaseModel):
    key: str
    value: float
    value2: Optional[float] = Field(None, description="diastolic for key='bp'")
    source: Literal["manual", "camera"] = "manual"
    note: Optional[str] = None


@app.post("/api/readings/{crew_id}")
def add_reading(crew_id: str, r: ReadingIn):
    if crew_id not in CREW:
        raise HTTPException(404, f"unknown crew member '{crew_id}'")
    if r.key not in READING_LIMITS:
        raise HTTPException(422, f"unknown reading '{r.key}'. Options: {', '.join(READING_LIMITS)}")
    lo, hi = READING_LIMITS[r.key]
    if not lo <= r.value <= hi:
        raise HTTPException(422, f"{r.key} value {r.value} looks wrong (expected {lo}-{hi})")
    if r.key == "bp" and (r.value2 is None or not 30 <= r.value2 <= 160 or r.value2 >= r.value):
        raise HTTPException(422, "blood pressure needs a diastolic value lower than the systolic value")
    return memory_store.add_reading(crew_id, r.key, r.value, r.value2, r.source, r.note)


@app.get("/api/readings/{crew_id}")
def list_readings(crew_id: str, limit: int = 100):
    return memory_store.list_readings(crew_id, limit)


@app.get("/api/routine/{crew_id}")
def routine(crew_id: str):
    return _routine(crew_id)


@app.get("/api/crew-overview")
async def crew_overview(env: EnvId = "mars_transit", scenario: Scenario = "demo",
                        replay_start: Optional[str] = None, replay_end: Optional[str] = None):
    return await _crew_overview(env, scenario, replay_start, replay_end)


# ---- reports to Earth ------------------------------------------------------------
class ReportIn(BaseModel):
    environment: EnvId = "mars_transit"
    data: dict


@app.post("/api/reports/{crew_id}")
def send_report(crew_id: str, body: ReportIn):
    env = get_environment(body.environment)
    return memory_store.save_report(crew_id, env.id, body.data, env.comms_delay_s)


@app.get("/api/reports/{crew_id}")
def list_reports(crew_id: str):
    return memory_store.list_reports(crew_id)
