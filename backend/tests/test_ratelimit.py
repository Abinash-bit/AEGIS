"""Rate limiting: sliding windows, 429 responses with Retry-After, and the visitor IP behind a proxy."""
import os

os.environ.setdefault("USE_DENSE", "0")

from fastapi.testclient import TestClient

from app import ratelimit
from app.main import app


def test_sliding_window_blocks_then_recovers():
    w = ratelimit.SlidingWindow(limit=2, window=60)
    assert w.check("a", now=0) == 0 and w.check("a", now=1) == 0
    assert w.check("a", now=2) == 58                 # third hit inside the window → wait until the first expires
    assert w.check("b", now=2) == 0                  # other visitors are unaffected
    assert w.check("a", now=61) == 0                 # first hit expired → allowed again


def test_write_limit_returns_429_with_retry_after(monkeypatch):
    monkeypatch.setattr(ratelimit, "_writes", ratelimit.SlidingWindow(2, 60))
    c = TestClient(app)
    body = {"key": "hr", "value": 64}
    assert c.post("/api/readings/C001", json=body).status_code == 200
    assert c.post("/api/readings/C001", json=body).status_code == 200
    r = c.post("/api/readings/C001", json=body)
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) > 0
    assert "try again" in r.json()["detail"]


def test_ai_limit_applies_before_any_model_call(monkeypatch):
    monkeypatch.setattr(ratelimit, "_ai_minute", ratelimit.SlidingWindow(0, 60))   # everything over the limit
    r = TestClient(app).post("/api/chat", json={"message": "hello"})
    assert r.status_code == 429


def test_daily_site_cap_counts_all_visitors(monkeypatch):
    monkeypatch.setattr(ratelimit, "_ai_day", ratelimit.SlidingWindow(1, 86400))
    c = TestClient(app)
    first = c.post("/api/briefing/C001", headers={"x-forwarded-for": "1.1.1.1"}, params={"env": "mars_transit"})
    assert first.status_code != 429                                 # counted (may fail later without a model key)
    second = c.post("/api/briefing/C001", headers={"x-forwarded-for": "2.2.2.2"}, params={"env": "mars_transit"})
    assert second.status_code == 429 and "today" in second.json()["detail"]


def test_client_ip_uses_first_forwarded_address():
    class Req:
        headers = {"x-forwarded-for": "203.0.113.7, 10.0.0.1"}
        client = None
    assert ratelimit.client_ip(Req()) == "203.0.113.7"
