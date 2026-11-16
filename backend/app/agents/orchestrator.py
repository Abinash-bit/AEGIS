"""Multi-agent orchestration.

Proactive briefing:
  dashboard triggers -> active hazards -> each hazard agent retrieves its own passages and returns structured,
  passage-cited findings (in parallel) -> coordinator merges -> server maps passage IDs to numbered citations and
  drops any item without a valid citation.

Chat:
  question -> route to hazards (retrieval votes + hazard named in the question) -> per-hazard retrieval ->
  optional hazard-agent notes (mode="agents") -> coordinator streams a cited answer.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from .. import config
from ..engine.hazards import HAZARD_NAMES, KB_HAZARD
from ..kb.retriever import get_retriever
from ..memory import store as memory_store
from ..models import Briefing, Chunk, Citation, CitedText, Dashboard, worst
from . import llm, prompts

_briefing_cache: dict[str, Briefing] = {}
QUOTE_CHARS = 700


# ------------------------------------------------------------------ helpers

def _notes(outputs: list[dict], keys: tuple[str, ...]) -> str:
    """Specialist notes for the coordinator, labelled with full agent names (never RAD/ISO/...)."""
    return json.dumps([{**{k: o[k] for k in keys if k != "agent"}, "agent": f"{HAZARD_NAMES[o['agent']]} agent"}
                       for o in outputs], ensure_ascii=False, indent=1)

def snapshot_text(d: Dashboard) -> str:
    env = d.environment
    lines = [
        f"Crew member {d.crew_id} · {env.name} · mission day {env.mission_day}/{env.mission_length_days}",
        f"Gravity {env.gravity_g:g} g · one-way comms delay {env.comms_delay_s:.0f} s · evacuation: {env.evacuation}",
        f"Readiness {d.readiness}/100 · overall status {d.overall_status.upper()}",
        "", "Hazards:",
    ]
    for h in d.hazards:
        lines.append(f"- {h.name}: {h.status.upper()} · {h.key_metric}")
        for t in h.triggers:
            lines.append(f"    · [{t.status}] {t.message}")
    lines += ["", "Vitals today (SIMULATED):"]
    for v in d.vitals:
        base = f" (baseline {v.baseline:g})" if v.baseline is not None else ""
        lines.append(f"- {v.label}: {v.value:g} {v.unit}{base} [{v.status}]")
    lines += ["", "Clinical labs (REAL, NASA OSDR Inspiration4; before launch L-92/L-44/L-3, after return R+1/R+45/R+82/R+194):"]
    for s in d.labs:
        pts = ", ".join(f"{p.timepoint} {p.value:g}" for p in s.points)
        rng = f" normal {s.points[0].range_min}-{s.points[0].range_max}" if s.points and s.points[0].range_min is not None else ""
        chg = f" · R+1 vs L-3 {s.change_r1_vs_l3_pct:+.0f}%" if s.change_r1_vs_l3_pct is not None else ""
        lines.append(f"- {s.label} ({s.unit}{rng}): {pts}{chg}")
    sw = d.space_weather
    lines += ["", f"Space weather (NASA DONKI {sw.window_start}..{sw.window_end}{', STALE' if sw.stale else ''}"
                  f"{', REPLAY' if sw.replay else ''}): max flare {sw.max_flare_class or 'none'}, "
                  f"SEP events {sw.sep_count}, fast CMEs {sw.fast_cme_count}, max Kp {sw.max_kp or 'n/a'}"]
    return "\n".join(lines)


def _passages_block(items: list[tuple[str, Chunk]]) -> str:
    out = []
    for pid, c in items:
        path = " > ".join(c.heading_path)
        out.append(f'<passage id="{pid}" source="{c.title}" path="{path}">\n{c.text}\n</passage>')
    return "\n\n".join(out)


def _citation(n: int, c: Chunk) -> Citation:
    quote = c.text if len(c.text) <= QUOTE_CHARS else c.text[:QUOTE_CHARS].rsplit(" ", 1)[0] + " …"
    return Citation(n=n, chunk_id=c.id, title=c.title, heading_path=c.heading_path, quote=quote,
                    url=c.source_url, hazards=c.hazards)


# ------------------------------------------------------------- hazard agent
async def run_hazard_agent(hid: str, dashboard: Dashboard, focus: str, passages: list[tuple[str, Chunk]]) -> dict:
    user = (f"<dashboard>\n{snapshot_text(dashboard)}\n</dashboard>\n\n"
            f"<passages>\n{_passages_block(passages)}\n</passages>\n\n"
            f"<task>\n{focus}\nGive your findings and recommended actions as {hid}. Cite passage IDs.\n</task>")
    t0 = time.perf_counter()
    out = await llm.structured(model=config.HAZARD_AGENT_MODEL, effort=config.HAZARD_AGENT_EFFORT,
                               system=prompts.hazard_system(hid, HAZARD_NAMES[hid]),
                               messages=[{"role": "user", "content": user}], schema=prompts.HAZARD_SCHEMA)
    out["agent"] = hid
    out["seconds"] = round(time.perf_counter() - t0, 1)
    return out


# --------------------------------------------------------- proactive briefing
def _signature(d: Dashboard) -> str:
    sig = [(h.id, h.status, tuple(t.signal for t in h.triggers if t.status != "nominal")) for h in d.hazards]
    return hashlib.md5(json.dumps([d.crew_id, d.environment.id, d.scenario, sig]).encode()).hexdigest()


def _retrieval_event(hid: str, items: list[tuple[str, Chunk]]) -> dict:
    return {"type": "retrieval", "agent": hid, "count": len(items),
            "passages": [{"n": p, "chunk_id": c.id, "title": c.title, "path": " > ".join(c.heading_path)} for p, c in items]}


def _agent_summary(out: dict) -> str:
    """One line for the live 'thinking trail': the agent's first finding (or first action)."""
    first = (out.get("findings") or out.get("actions") or [{"text": ""}])[0]["text"]
    return first if len(first) <= 220 else first[:220].rsplit(" ", 1)[0] + " …"


async def _gather_agents(jobs: dict) -> AsyncIterator[tuple[str, object]]:
    """Run hazard agents in parallel and yield (agent, result-or-exception) as each one finishes."""
    async def wrap(hid, coro):
        try:
            return hid, await coro
        except Exception as e:  # noqa: BLE001 - reported per agent
            return hid, e
    for fut in asyncio.as_completed([wrap(h, c) for h, c in jobs.items()]):
        yield await fut


def dashboard_read_event(d: Dashboard) -> dict:
    sigs = [t for h in d.hazards for t in h.triggers if t.status != "nominal"]
    order = {"critical": 0, "alert": 1, "watch": 2, "nominal": 3}
    return {"type": "dashboard_read", "hazards": len(d.hazards), "signals": len(sigs),
            "highlights": [t.message for t in sorted(sigs, key=lambda t: order[t.status])[:3]]}


async def briefing_events(d: Dashboard, force: bool = False) -> AsyncIterator[dict]:
    """Proactive briefing as a stream of steps:
    dashboard_read -> routing -> retrieval (per agent) -> agent_done / agent_error (as each finishes)
    -> writing -> briefing (final)."""
    sig = _signature(d)
    if not force and sig in _briefing_cache:
        yield {"type": "briefing", "briefing": _briefing_cache[sig].model_dump(), "cached": True}
        return
    t_start = time.perf_counter()
    yield dashboard_read_event(d)

    active = [h for h in d.hazards if h.status != "nominal"] or sorted(d.hazards, key=lambda h: -h.level)[:2]
    yield {"type": "routing", "agents": [h.id for h in active],
           "reasons": {h.id: f"{h.status}: {h.headline}" for h in active}}

    retriever = get_retriever()
    registry: dict[str, Chunk] = {}
    per_agent: dict[str, list[tuple[str, Chunk]]] = {}
    for h in active:
        query = " ".join(t.query for t in h.triggers if t.status != "nominal") or " ".join(t.query for t in h.triggers)
        items = []
        for c in retriever.search(query, k=config.TOP_K, hazards=[KB_HAZARD[h.id]]):
            pid = next((p for p, x in registry.items() if x.id == c.id), None) or f"P{len(registry) + 1}"
            registry[pid] = c
            items.append((pid, c))
        per_agent[h.id] = items
        yield _retrieval_event(h.id, items)

    jobs = {}
    for h in active:
        concerns = "\n".join(f"- [{t.status}] {t.message}" for t in h.triggers) or "- no active triggers"
        focus = f"Your hazard is currently {h.status.upper()}. Signals:\n{concerns}"
        jobs[h.id] = run_hazard_agent(h.id, d, focus, per_agent[h.id])
    agent_outputs, errors = [], []
    async for hid, r in _gather_agents(jobs):
        if isinstance(r, Exception):
            errors.append(f"{hid}: {r}")
            yield {"type": "agent_error", "agent": hid, "error": str(r)}
        else:
            agent_outputs.append(r)
            yield {"type": "agent_done", "agent": hid, "seconds": r["seconds"], "coverage": r["coverage"],
                   "summary": _agent_summary(r)}
    if not agent_outputs:
        raise llm.AgentError("All hazard agents failed: " + "; ".join(map(str, errors)))
    order = [h.id for h in active]
    agent_outputs.sort(key=lambda o: order.index(o["agent"]))

    yield {"type": "writing", "agents": [o["agent"] for o in agent_outputs]}
    titles = "\n".join(f"{pid}: {c.title} ({' > '.join(c.heading_path)})" for pid, c in registry.items())
    notes = _notes(agent_outputs, ("agent", "findings", "actions", "watch_next", "escalate", "coverage"))
    user = (f"<dashboard>\n{snapshot_text(d)}\n</dashboard>\n\n<specialist_notes>\n{notes}\n</specialist_notes>\n\n"
            f"<passage_index>\n{titles}\n</passage_index>\n\n"
            "Write the briefing for the astronaut. Use only passage IDs that appear in the specialist notes.")
    t0 = time.perf_counter()
    merged = await llm.structured(model=config.COORDINATOR_MODEL, effort=config.COORDINATOR_EFFORT,
                                  system=prompts.COORDINATOR_SYSTEM,
                                  messages=[{"role": "user", "content": user}], schema=prompts.COORDINATOR_SCHEMA)
    coord_s = round(time.perf_counter() - t0, 1)

    # passage IDs -> numbered citations (order of first use); drop items with no valid citation
    numbers: dict[str, int] = {}
    dropped = 0

    def convert(items: list[dict]) -> list[CitedText]:
        nonlocal dropped
        out = []
        for it in items:
            cites = []
            for pid in it.get("passage_ids", []):
                if pid in registry:
                    numbers.setdefault(pid, len(numbers) + 1)
                    cites.append(numbers[pid])
            if cites:
                out.append(CitedText(text=it["text"], cites=sorted(set(cites))))
            else:
                dropped += 1
        return out

    happening, actions = convert(merged["happening"]), convert(merged["actions"])
    citations = [_citation(n, registry[pid]) for pid, n in sorted(numbers.items(), key=lambda kv: kv[1])]
    severity = worst(*[h.status for h in active])
    b = Briefing(
        id=uuid.uuid4().hex[:12], crew_id=d.crew_id, created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        severity=severity, agents=[o["agent"] for o in agent_outputs], headline=merged["headline"],
        happening=happening, actions=actions, next=merged["next"],
        escalate_to_flight_surgeon=bool(merged["escalate"] or any(o["escalate"] for o in agent_outputs)),
        citations=citations,
        trace={
            "triggers": [t.model_dump() for h in active for t in h.triggers],
            "routing": {h.id: f"status {h.status}" for h in active},
            "retrieval": {hid: [{"pid": p, "chunk_id": c.id, "title": c.title, "score": c.score} for p, c in items]
                          for hid, items in per_agent.items()},
            "agents": agent_outputs, "agent_errors": errors,
            "coordinator_seconds": coord_s, "uncited_items_dropped": dropped,
            "total_seconds": round(time.perf_counter() - t_start, 1),
            "retrieval_mode": retriever.mode,
            "models": {"hazard": config.HAZARD_AGENT_MODEL, "coordinator": config.COORDINATOR_MODEL},
        },
    )
    _briefing_cache[sig] = b
    memory_store.save_briefing(d.crew_id, d.environment.id, d.scenario, b.model_dump())
    yield {"type": "briefing", "briefing": b.model_dump(), "cached": False}


async def build_briefing(d: Dashboard, force: bool = False) -> Briefing:
    """Non-streaming convenience wrapper around briefing_events()."""
    async for ev in briefing_events(d, force):
        if ev["type"] == "briefing":
            return Briefing(**ev["briefing"])
    raise llm.AgentError("briefing produced no result")


# ------------------------------------------------------------------- chat
def route(question: str, d: Dashboard, max_agents: int = 3) -> list[str]:
    votes = get_retriever().hazard_votes(question)
    inv = {v: k for k, v in KB_HAZARD.items()}
    ranked = sorted(((inv[h], n) for h, n in votes.items() if h in inv), key=lambda x: -x[1])
    chosen = [hid for hid, n in ranked if n >= 2][:max_agents] or [ranked[0][0]] if ranked else []
    q = question.lower()
    for hid, words in {"RAD": ["radiation", "flare", "solar", "dose", "cosmic"], "ISO": ["sleep", "mood", "lonely", "stress", "tired"],
                       "DIST": ["delay", "earth", "communicat", "evacuat", "food"], "GRAV": ["bone", "blood pressure", "heart", "muscle", "eye", "gravity"],
                       "ENV": ["co2", "air", "microbe", "immune", "infection", "lymphocyte"]}.items():
        if any(w in q for w in words) and hid not in chosen:
            chosen.append(hid)
    return chosen[:max_agents] or ["ISO"]


def _is_followup(message: str) -> bool:
    m = message.lower().strip()
    return len(m.split()) <= 12 or bool(re.match(r"^(and|but|what about|how about|why|so|then|also|is that|does that|can i)\b", m))


def _session_number(sid: str, c: Chunk) -> int:
    return memory_store.register_citation(sid, c.id, _citation(0, c).model_dump())


def _briefing_block(sid: str, b: dict) -> str:
    """The latest briefing, with its citation numbers translated into this session's stable numbers."""
    remap = {c["n"]: memory_store.register_citation(sid, c["chunk_id"], c) for c in b.get("citations", [])}

    def fmt(items):
        return "\n".join(f"- {it['text']} " + "".join(f"[{remap[n]}]" for n in it["cites"] if n in remap) for it in items)

    return (f"Given at {b['created_at']} · severity {b['severity'].upper()} · agents {', '.join(b['agents'])}\n"
            f"Headline: {b['headline']}\nWhat is happening:\n{fmt(b['happening'])}\n"
            f"What to do:\n{fmt(b['actions'])}\nWhat comes next: {b['next']}")


async def extract_memories(crew_id: str, sid: str, message: str) -> list[dict]:
    existing = memory_store.list_memories(crew_id)
    user = (f"<existing_memory>\n" + ("\n".join(f"- {m['text']}" for m in existing) or "(none)") +
            f"\n</existing_memory>\n\n<astronaut_message>\n{message}\n</astronaut_message>")
    out = await llm.structured(model=config.MEMORY_MODEL, effort=config.MEMORY_EFFORT, system=prompts.MEMORY_SYSTEM,
                               messages=[{"role": "user", "content": user}], schema=prompts.MEMORY_SCHEMA, max_tokens=4000)
    known = {m["text"].strip().lower() for m in existing}
    saved = []
    for m in out["memories"][:5]:
        if m["text"].strip().lower() not in known:
            saved.append(memory_store.add_memory(crew_id, m["text"].strip(), m["category"], sid))
    return saved


async def chat_stream(d: Dashboard, message: str, session: dict, mode: str = "agents") -> AsyncIterator[dict]:
    """Yields events: session, routing, citations, agent_done/agent_error, token, memory_saved, done, error.

    Memory: the session's turns are stored in SQLite; the last turns go to the model; citation numbers are stable for
    the whole session; the latest proactive briefing and the astronaut's long-term memories are added to the context.
    """
    t0 = time.perf_counter()
    sid, crew = session["id"], d.crew_id
    yield {"type": "session", "session_id": sid}
    yield dashboard_read_event(d)

    history = memory_store.get_messages(sid, limit=10)
    prev_user = next((m for m in reversed(history) if m["role"] == "user"), None)
    prev_asst = next((m for m in reversed(history) if m["role"] == "assistant"), None)
    followup = bool(prev_user) and _is_followup(message)
    memory_store.add_message(sid, "user", message)

    # long-term memory extraction runs in parallel with the answer
    mem_task = asyncio.create_task(extract_memories(crew, sid, message))

    # routing + retrieval use the conversation for short follow-ups
    context_query = f"{prev_user['content']} {message}" if followup else message
    agents = route(context_query, d)
    if followup and prev_asst and prev_asst["agents"]:
        agents = list(dict.fromkeys(prev_asst["agents"] + agents))[:3]
    yield {"type": "routing", "agents": agents, "followup": followup}

    retriever = get_retriever()
    passages: list[tuple[str, Chunk]] = []
    per_agent: dict[str, list[tuple[str, Chunk]]] = {}
    seen: set[str] = set()
    for hid in agents:
        items = []
        for c in retriever.search(context_query, k=4, hazards=[KB_HAZARD[hid]], exclude=seen):
            seen.add(c.id)
            items.append((str(_session_number(sid, c)), c))
        per_agent[hid] = items
        passages += items
        yield _retrieval_event(hid, items)
    # keep the passages cited in the previous answer available, so "that" / "the second point" still resolve
    if prev_asst:
        cmap = {n: cid for cid, n in memory_store.citation_numbers(sid).items()}
        for n in prev_asst["cited"][:4]:
            cid = cmap.get(n)
            if cid and cid not in seen and cid in retriever.by_id:
                seen.add(cid)
                passages.append((str(n), retriever.by_id[cid]))

    briefing = memory_store.latest_briefing(crew, d.environment.id, d.scenario)
    briefing_txt = _briefing_block(sid, briefing) if briefing else ""
    memories = memory_store.list_memories(crew)
    yield {"type": "citations", "citations": memory_store.session_citations(sid)}

    notes = ""
    if mode == "agents":
        focus = (f"The astronaut asks: \"{message}\"" + (f" (follow-up to: \"{prev_user['content']}\")" if followup else "")
                 + ". Answer only the part that falls in your specialty.")
        ok = []
        async for hid, r in _gather_agents({h: run_hazard_agent(h, d, focus, per_agent[h]) for h in agents}):
            if isinstance(r, Exception):
                yield {"type": "agent_error", "agent": hid, "error": str(r)}
            else:
                ok.append(r)
                yield {"type": "agent_done", "agent": hid, "seconds": r["seconds"], "coverage": r["coverage"],
                       "summary": _agent_summary(r)}
        notes = _notes(ok, ("agent", "findings", "actions", "escalate", "coverage"))

    user = (f"<dashboard>\n{snapshot_text(d)}\n</dashboard>\n\n"
            + (f"<latest_briefing>\n{briefing_txt}\n</latest_briefing>\n\n" if briefing_txt else "")
            + (f"<astronaut_memory>\n" + "\n".join(f"- {m['text']}" for m in memories) + "\n</astronaut_memory>\n\n" if memories else "")
            + f"<passages>\n{_passages_block(passages)}\n</passages>\n\n"
            + (f"<specialist_notes>\n{notes}\n</specialist_notes>\n\n" if notes else "")
            + f"<question>\n{message}\n</question>")
    past = [{"role": m["role"], "content": m["content"]} for m in history[-8:]]
    while past and past[0]["role"] != "user":  # the API requires the first message to be from the user
        past.pop(0)
    msgs = past + [{"role": "user", "content": user}]

    yield {"type": "writing", "agents": agents}
    full = []
    async for tok in llm.stream_text(model=config.COORDINATOR_MODEL, effort=config.COORDINATOR_EFFORT,
                                     system=prompts.CHAT_SYSTEM, messages=msgs):
        full.append(tok)
        yield {"type": "token", "text": tok}
    text = "".join(full)
    valid = set(memory_store.citation_numbers(sid).values())
    cited = sorted({int(n) for n in re.findall(r"\[(\d+)\]", text) if int(n) in valid})
    memory_store.add_message(sid, "assistant", text, agents=agents, cited=cited)

    try:
        saved = await asyncio.wait_for(mem_task, timeout=30)
        if saved:
            yield {"type": "memory_saved", "memories": saved}
    except Exception as e:  # noqa: BLE001 - memory is best-effort; never fail the answer because of it
        yield {"type": "memory_error", "error": str(e)}

    yield {"type": "done", "session_id": sid, "cited": cited, "agents": agents, "followup": followup,
           "used_briefing": bool(briefing_txt), "memories_in_context": len(memories),
           "seconds": round(time.perf_counter() - t0, 1), "retrieval_mode": retriever.mode}
