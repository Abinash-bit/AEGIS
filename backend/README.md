# AEGIS backend

FastAPI service that powers the crew-health dashboard and the multi-agent RAG assistant.

## Data sources

| Source | What it gives | Label |
|---|---|---|
| NASA DONKI (CCMC) | Live solar flares, solar particle events, CMEs, geomagnetic storms | `LIVE_DONKI` |
| NASA OSDR: Inspiration4 (OSD-569, OSD-575) | Real blood panels for crew C001–C004, before launch and after return | `REAL_OSDR` |
| Simulated telemetry | Sleep, mood, reaction time, HR, BP, temperature, cabin CO₂/temp, radiation dose | `SIMULATED` |
| Knowledge base | 200 chunks from NASA HRP hazard, risk and research pages, podcasts and videos | citations |

## Architecture

```
data/            donki.py (live, cached) · labs.py (real) · telemetry.py (simulated) · environments.py
engine/hazards   fixed rules → status of the 5 hazards + triggers (the LLM never sets status)
kb/retriever     hybrid search: BM25 + embeddings (OpenAI text-embedding-3-small; local fastembed fallback), filtered by hazard
agents/          5 hazard agents (RAD ISO DIST GRAV ENV) + coordinator (Claude)
main.py          REST + server-sent events API
```

- **Proactive briefing:** triggers → active hazards → each agent retrieves its own passages and returns findings that cite passage IDs (agents run in parallel) → the coordinator merges them → the server maps the passage IDs to numbered citations and **drops any item without a valid citation**.
- **Chat:** question → route to hazards → per-hazard retrieval → hazard-agent notes → the coordinator streams a cited answer.

## Conversation memory

Stored in SQLite at `backend/data/aegis.db` (git-ignored).

- **Sessions:** every turn is saved, and the last 8 turns go to Claude, so the conversation survives page reloads.
- **Follow-ups:** short or connective questions ("what about at night?") are routed and searched together with the previous question, and they keep the previous turn's agents.
- **Stable citations:** a source keeps the same number for the whole session. Sources cited in the previous answer stay in context.
- **Latest briefing:** the newest proactive briefing is added to the chat context, with its citations renumbered into the session.
- **Long-term memory:** facts the astronaut states about themselves ("sleeps badly after night shifts") are extracted in parallel with the answer, so there is no extra wait. They are reused in every later session and can be listed and deleted through the API.

## Run

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # Windows (use .venv/bin/... on macOS/Linux)
cp .env.example .env                              # then set ANTHROPIC_API_KEY
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

- Open http://localhost:8000/docs for the interactive API.
- With `OPENAI_API_KEY` set, the 202 chunks are embedded once with OpenAI (about 12 s) and cached.
- Without that key, the local embedding model is downloaded once (~130 MB) and used instead.
- Everything except briefings and chat works without an Anthropic key.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status, whether Claude is configured, retrieval mode |
| GET | `/api/meta` | Crew list, environments, hazards |
| GET | `/api/dashboard/{crew_id}?env=mars_transit&scenario=demo` | Full dashboard (hazards, vitals, labs, space weather, readiness) |
| GET | `/api/space-weather` | DONKI events (add `replay_start=2024-05-08&replay_end=2024-05-15` for a historical storm) |
| GET | `/api/labs/{crew_id}` | Real Inspiration4 lab series |
| POST | `/api/briefing/{crew_id}` | Proactive multi-agent briefing with citations and an agent trace (`force=true` to regenerate) |
| POST | `/api/chat?mode=agents` | Server-sent events: `session`, `routing`, `citations`, `agent_done`, `token`, `memory_saved`, `done`, `error`. Send `session_id` to continue a conversation |
| GET | `/api/briefing/{crew_id}/latest` | Latest saved briefing |
| POST / GET | `/api/sessions` | Create a chat session / list sessions (`?crew_id=`) |
| GET / DELETE | `/api/sessions/{id}` | Full session (messages + stable citations) / delete it |
| GET | `/api/memory/{crew_id}` | Long-term memories about the astronaut |
| DELETE | `/api/memory/{crew_id}/{id}` · `/api/memory/{crew_id}` | Forget one memory / all memories |
| GET | `/api/kb/search?q=...&hazard=GRAV` | Search the knowledge base |
| GET | `/api/kb/chunk/{id}` | One chunk (for the source viewer) |

- `env`: `iss`, `lunar_base`, `mars_transit`, `mars_base`.
- `scenario`: `demo` (injects a realistic pattern) or `nominal`.

## Knowledge base

```bash
.venv/Scripts/python scripts/build_kb.py   # Word files in knowledge-base/sources/docx → knowledge-base/processed/
```

Risk keywords and the risk→hazard mapping live in `scripts/risk_map.json`.

## Tests

```bash
.venv/Scripts/python -m pytest -q tests     # offline: Claude is mocked, DONKI is a fixed window
```

## Notes

- **Thresholds** in `data/telemetry.py` are demo thresholds for color coding, not clinical or NASA flight rules.
- **Career dose limit:** 600 mSv (NASA-STD-3001, 2022).
- **Daily dose rates per environment** come from published in-situ measurements (see `data/environments.py`).
- **DONKI:** `api.nasa.gov/DONKI` now returns 404, so the backend calls CCMC directly (`ccmc.gsfc.nasa.gov/DONKI-API`, no key needed). If DONKI is unreachable, the last cached data is served with `stale=true`.
