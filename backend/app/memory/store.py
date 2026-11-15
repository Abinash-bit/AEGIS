"""Persistent conversation memory (SQLite).

Tables
  sessions           one chat thread per astronaut (crew_id + environment + scenario)
  messages           every user / assistant turn, with the agents used and the citations cited
  session_citations  stable citation numbers inside a session: chunk_id -> n (never renumbered)
  briefings          proactive briefings (so chat can discuss the latest one)
  memories           long-term facts the astronaut shared (visible + deletable)
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from .. import config

DB_PATH = config.BACKEND_DIR / "data" / "aegis.db"
DB_PATH.parent.mkdir(exist_ok=True)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, environment TEXT NOT NULL, scenario TEXT NOT NULL,
  title TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
  agents TEXT, cited TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS session_citations (
  session_id TEXT NOT NULL, n INTEGER NOT NULL, chunk_id TEXT NOT NULL, citation TEXT NOT NULL,
  PRIMARY KEY (session_id, chunk_id));
CREATE TABLE IF NOT EXISTS briefings (
  id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, environment TEXT NOT NULL, scenario TEXT NOT NULL,
  data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, text TEXT NOT NULL, category TEXT NOT NULL,
  source_session TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, crew_id TEXT NOT NULL, key TEXT NOT NULL, value REAL NOT NULL,
  value2 REAL, source TEXT NOT NULL DEFAULT 'manual', note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, environment TEXT NOT NULL, data TEXT NOT NULL,
  sent_at TEXT NOT NULL, arrives_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_read_crew ON readings(crew_id, created_at);
CREATE INDEX IF NOT EXISTS ix_msg_session ON messages(session_id, id);
CREATE INDEX IF NOT EXISTS ix_brief_crew ON briefings(crew_id, environment, scenario, created_at);
CREATE INDEX IF NOT EXISTS ix_mem_crew ON memories(crew_id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


_initialised: set[str] = set()


@contextmanager
def _db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    if str(DB_PATH) not in _initialised:   # create tables on first use of this database file
        con.executescript(_SCHEMA)
        _initialised.add(str(DB_PATH))
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init():
    with _db() as con:
        con.executescript(_SCHEMA)


# ------------------------------------------------------------------ sessions
def create_session(crew_id: str, environment: str, scenario: str) -> dict:
    sid, now = uuid.uuid4().hex[:16], _now()
    with _db() as con:
        con.execute("INSERT INTO sessions VALUES (?,?,?,?,?,?,?)", (sid, crew_id, environment, scenario, None, now, now))
    return get_session(sid)


def get_session(sid: str) -> Optional[dict]:
    with _db() as con:
        r = con.execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
    return dict(r) if r else None


def list_sessions(crew_id: Optional[str] = None) -> list[dict]:
    q, args = "SELECT * FROM sessions", ()
    if crew_id:
        q, args = q + " WHERE crew_id=?", (crew_id,)
    with _db() as con:
        return [dict(r) for r in con.execute(q + " ORDER BY updated_at DESC", args)]


def delete_session(sid: str):
    with _db() as con:
        for t in ("messages", "session_citations"):
            con.execute(f"DELETE FROM {t} WHERE session_id=?", (sid,))
        con.execute("DELETE FROM sessions WHERE id=?", (sid,))


def add_message(sid: str, role: str, content: str, agents: list[str] | None = None, cited: list[int] | None = None):
    now = _now()
    with _db() as con:
        con.execute("INSERT INTO messages (session_id, role, content, agents, cited, created_at) VALUES (?,?,?,?,?,?)",
                    (sid, role, content, json.dumps(agents or []), json.dumps(cited or []), now))
        con.execute("UPDATE sessions SET updated_at=?, title=COALESCE(title, ?) WHERE id=?",
                    (now, content[:80] if role == "user" else None, sid))


def get_messages(sid: str, limit: Optional[int] = None) -> list[dict]:
    with _db() as con:
        rows = con.execute("SELECT * FROM messages WHERE session_id=? ORDER BY id", (sid,)).fetchall()
    msgs = [{**dict(r), "agents": json.loads(r["agents"] or "[]"), "cited": json.loads(r["cited"] or "[]")} for r in rows]
    return msgs[-limit:] if limit else msgs


# ---------------------------------------------------------- stable citations
def citation_numbers(sid: str) -> dict[str, int]:
    with _db() as con:
        return {r["chunk_id"]: r["n"] for r in con.execute("SELECT chunk_id, n FROM session_citations WHERE session_id=?", (sid,))}


def register_citation(sid: str, chunk_id: str, citation: dict) -> int:
    """Return the session's number for this chunk, assigning the next number the first time it appears."""
    with _db() as con:
        r = con.execute("SELECT n FROM session_citations WHERE session_id=? AND chunk_id=?", (sid, chunk_id)).fetchone()
        if r:
            return r["n"]
        n = (con.execute("SELECT COALESCE(MAX(n),0) FROM session_citations WHERE session_id=?", (sid,)).fetchone()[0]) + 1
        con.execute("INSERT INTO session_citations VALUES (?,?,?,?)", (sid, n, chunk_id, json.dumps({**citation, "n": n})))
        return n


def session_citations(sid: str) -> list[dict]:
    with _db() as con:
        return [json.loads(r["citation"]) for r in
                con.execute("SELECT citation FROM session_citations WHERE session_id=? ORDER BY n", (sid,))]


# ----------------------------------------------------------------- briefings
def save_briefing(crew_id: str, environment: str, scenario: str, briefing: dict):
    with _db() as con:
        con.execute("INSERT OR REPLACE INTO briefings VALUES (?,?,?,?,?,?)",
                    (briefing["id"], crew_id, environment, scenario, json.dumps(briefing), briefing["created_at"]))


def latest_briefing(crew_id: str, environment: str, scenario: str) -> Optional[dict]:
    with _db() as con:
        r = con.execute("SELECT data FROM briefings WHERE crew_id=? AND environment=? AND scenario=? "
                        "ORDER BY created_at DESC LIMIT 1", (crew_id, environment, scenario)).fetchone()
    return json.loads(r["data"]) if r else None


# ------------------------------------------------------------------ memories
def list_memories(crew_id: str) -> list[dict]:
    with _db() as con:
        return [dict(r) for r in con.execute("SELECT * FROM memories WHERE crew_id=? ORDER BY created_at", (crew_id,))]


def add_memory(crew_id: str, text: str, category: str, source_session: Optional[str]) -> dict:
    m = {"id": uuid.uuid4().hex[:12], "crew_id": crew_id, "text": text, "category": category,
         "source_session": source_session, "created_at": _now()}
    with _db() as con:
        con.execute("INSERT INTO memories VALUES (:id,:crew_id,:text,:category,:source_session,:created_at)", m)
    return m


def delete_memory(crew_id: str, memory_id: str) -> bool:
    with _db() as con:
        return con.execute("DELETE FROM memories WHERE crew_id=? AND id=?", (crew_id, memory_id)).rowcount > 0


def clear_memories(crew_id: str) -> int:
    with _db() as con:
        return con.execute("DELETE FROM memories WHERE crew_id=?", (crew_id,)).rowcount


# ------------------------------------------------------------------ readings (guided check-ins)
def add_reading(crew_id: str, key: str, value: float, value2: Optional[float] = None,
                source: str = "manual", note: Optional[str] = None) -> dict:
    now = _now()
    with _db() as con:
        cur = con.execute("INSERT INTO readings (crew_id, key, value, value2, source, note, created_at) VALUES (?,?,?,?,?,?,?)",
                          (crew_id, key, value, value2, source, note, now))
        rid = cur.lastrowid
    return {"id": rid, "crew_id": crew_id, "key": key, "value": value, "value2": value2, "source": source,
            "note": note, "created_at": now}


def list_readings(crew_id: str, limit: int = 200) -> list[dict]:
    with _db() as con:
        return [dict(r) for r in con.execute(
            "SELECT * FROM readings WHERE crew_id=? ORDER BY created_at DESC, id DESC LIMIT ?", (crew_id, limit))]


def latest_readings(crew_id: str, within_hours: int = 36) -> dict[str, dict]:
    """Most recent reading per key from the last `within_hours` hours."""
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(hours=within_hours)).isoformat(timespec="seconds")
    out: dict[str, dict] = {}
    with _db() as con:
        for r in con.execute("SELECT * FROM readings WHERE crew_id=? AND created_at>=? ORDER BY created_at, id",
                             (crew_id, since)):
            out[r["key"]] = dict(r)
    return out


def reading_days(crew_id: str) -> dict[str, set[str]]:
    """UTC date -> set of reading keys logged that day."""
    days: dict[str, set[str]] = {}
    with _db() as con:
        for r in con.execute("SELECT key, created_at FROM readings WHERE crew_id=?", (crew_id,)):
            days.setdefault(r["created_at"][:10], set()).add(r["key"])
    return days


def count_readings_since(crew_ids: list[str], since_iso: str) -> dict[str, int]:
    with _db() as con:
        q = f"SELECT crew_id, COUNT(*) n FROM readings WHERE created_at>=? AND crew_id IN ({','.join('?' * len(crew_ids))}) GROUP BY crew_id"
        return {r["crew_id"]: r["n"] for r in con.execute(q, (since_iso, *crew_ids))}


# ------------------------------------------------------------------ reports to Earth
def save_report(crew_id: str, environment: str, data: dict, delay_s: float) -> dict:
    from datetime import timedelta
    sent = datetime.now(timezone.utc)
    rep = {"id": uuid.uuid4().hex[:12], "crew_id": crew_id, "environment": environment, "data": data,
           "sent_at": sent.isoformat(timespec="seconds"),
           "arrives_at": (sent + timedelta(seconds=delay_s)).isoformat(timespec="seconds")}
    with _db() as con:
        con.execute("INSERT INTO reports VALUES (?,?,?,?,?,?)", (rep["id"], crew_id, environment, json.dumps(data),
                                                                rep["sent_at"], rep["arrives_at"]))
    return rep


def list_reports(crew_id: str) -> list[dict]:
    with _db() as con:
        return [{**dict(r), "data": json.loads(r["data"])} for r in
                con.execute("SELECT * FROM reports WHERE crew_id=? ORDER BY sent_at DESC", (crew_id,))]
