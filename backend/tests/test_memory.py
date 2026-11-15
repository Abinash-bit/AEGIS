"""Conversation memory: sessions persist, citation numbers stay stable, follow-ups keep context,
the latest briefing is renumbered into the session, and long-term memories are saved (Claude mocked)."""
import asyncio
import os

os.environ.setdefault("USE_DENSE", "0")

import pytest

from app.agents import llm, orchestrator
from app.memory import store
from tests.test_backend import _dash


@pytest.fixture
def fake_claude(monkeypatch):
    seen = {"stream_msgs": []}

    async def fake_structured(*, schema, messages, **kw):
        if "memories" in schema["properties"]:
            text = messages[0]["content"]
            return {"memories": [{"text": "Sleeps badly after night shifts.", "category": "habit"}]
                    if "night shift" in text else []}
        return {"findings": [{"text": "f", "passage_ids": []}], "actions": [], "watch_next": "w",
                "escalate": False, "coverage": "covered"}

    async def fake_stream(*, messages, **kw):
        seen["stream_msgs"].append(messages)
        for tok in ["Rest more ", "[1]", "."]:
            yield tok

    monkeypatch.setattr(llm, "structured", fake_structured)
    monkeypatch.setattr(llm, "stream_text", fake_stream)
    return seen


def _run(d, msg, session):
    async def go():
        return [ev async for ev in orchestrator.chat_stream(d, msg, session)]
    return asyncio.run(go())


def test_session_memory_and_stable_citations(fake_claude):
    d = _dash()
    s = store.create_session("C001", "mars_transit", "demo")
    ev1 = _run(d, "I sleep badly after night shift work. What can I do about my sleep?", s)
    nums1 = store.citation_numbers(s["id"])
    ev2 = _run(d, "what about at night?", s)
    nums2 = store.citation_numbers(s["id"])

    # turns are persisted
    msgs = store.get_messages(s["id"])
    assert [m["role"] for m in msgs] == ["user", "assistant", "user", "assistant"]
    # citation numbers never change once assigned
    assert all(nums2[cid] == n for cid, n in nums1.items())
    # follow-up is detected and keeps the previous agents (ISO for sleep)
    routing2 = next(e for e in ev2 if e["type"] == "routing")
    assert routing2["followup"] is True and "ISO" in routing2["agents"]
    # second call to Claude includes the first turn as conversation history
    second = fake_claude["stream_msgs"][1]
    assert second[0]["role"] == "user" and "night shift" in second[0]["content"]
    # long-term memory saved once, then reused in context
    assert any(e["type"] == "memory_saved" for e in ev1)
    assert [m["text"] for m in store.list_memories("C001")] == ["Sleeps badly after night shifts."]
    assert "Sleeps badly after night shifts." in second[-1]["content"]
    assert next(e for e in ev2 if e["type"] == "done")["memories_in_context"] == 1


def test_latest_briefing_is_renumbered_into_session(fake_claude):
    d = _dash()
    b = {"id": "b1", "created_at": "2026-11-15T00:00:00+00:00", "severity": "watch", "agents": ["ISO"],
         "headline": "Sleep is short", "next": "check in",
         "happening": [{"text": "Short sleep", "cites": [1]}], "actions": [{"text": "Sleep more", "cites": [2]}],
         "citations": [{"n": 1, "chunk_id": "risks-001", "title": "t1", "heading_path": [], "quote": "q", "url": "u", "hazards": []},
                       {"n": 2, "chunk_id": "risks-002", "title": "t2", "heading_path": [], "quote": "q", "url": "u", "hazards": []}]}
    store.save_briefing("C001", "mars_transit", "demo", b)
    s = store.create_session("C001", "mars_transit", "demo")
    store.register_citation(s["id"], "some-other-chunk", {"chunk_id": "some-other-chunk"})   # takes number 1
    ev = _run(d, "Explain the action from your briefing", s)
    nums = store.citation_numbers(s["id"])
    assert nums["some-other-chunk"] == 1 and nums["risks-001"] != 1      # briefing [1] was renumbered
    ctx = fake_claude["stream_msgs"][0][-1]["content"]
    assert f"Sleep more [{nums['risks-002']}]" in ctx
    assert next(e for e in ev if e["type"] == "done")["used_briefing"] is True


def test_memory_is_deletable():
    m = store.add_memory("C002", "Prefers short answers.", "preference", None)
    assert store.delete_memory("C002", m["id"]) is True
    assert store.list_memories("C002") == []
