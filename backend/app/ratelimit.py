"""Rate limiting for the public deployment.

Every AI request (briefing, chat) costs money on the API key, so:
  * per visitor (client IP): a per-minute and a per-hour limit on AI requests;
  * whole site: a daily cap on AI requests across all visitors (protects the budget);
  * per visitor: a light limit on writes (check-ins, reports) against spam.
Limits come from environment variables. In-memory sliding windows: fine for one server instance
(Render runs one); they reset when the server restarts.
"""
from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


AI_PER_MINUTE = _int("RATE_LIMIT_AI_PER_MINUTE", 6)      # per visitor
AI_PER_HOUR = _int("RATE_LIMIT_AI_PER_HOUR", 40)         # per visitor
AI_PER_DAY_TOTAL = _int("RATE_LIMIT_AI_PER_DAY", 600)    # whole site, all visitors
WRITES_PER_MINUTE = _int("RATE_LIMIT_WRITES_PER_MINUTE", 20)
ENABLED = os.getenv("RATE_LIMIT_ENABLED", "1") == "1"


class SlidingWindow:
    """Allows at most `limit` hits per `window` seconds per key."""

    def __init__(self, limit: int, window: float):
        self.limit, self.window = limit, window
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str, now: float | None = None) -> float:
        """Record a hit and return 0, or return the seconds to wait (no hit recorded)."""
        now = time.monotonic() if now is None else now
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.limit:
                return self.window - (now - q[0]) if q else self.window   # limit 0 = always blocked
            q.append(now)
            return 0.0

    def reset(self):
        with self.lock:
            self.hits.clear()


_ai_minute = SlidingWindow(AI_PER_MINUTE, 60)
_ai_hour = SlidingWindow(AI_PER_HOUR, 3600)
_ai_day = SlidingWindow(AI_PER_DAY_TOTAL, 86400)
_writes = SlidingWindow(WRITES_PER_MINUTE, 60)


def client_ip(request: Request) -> str:
    """Behind Render's proxy the visitor's address is the first entry of X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _too_many(wait: float, what: str):
    secs = max(1, int(round(wait)))
    when = f"{secs} seconds" if secs < 120 else f"{round(secs / 60)} minutes"
    raise HTTPException(429, f"{what} Please try again in {when}.", headers={"Retry-After": str(secs)})


def ai_limit(request: Request):
    """FastAPI dependency for endpoints that call the AI model."""
    if not ENABLED:
        return
    ip = client_ip(request)
    # check the cheapest-to-hit windows first; a refused request is not counted in later windows
    if (w := _ai_minute.check(ip)):
        _too_many(w, "You’re sending requests quickly, so AEGIS is pausing to keep the demo fair for everyone.")
    if (w := _ai_hour.check(ip)):
        _too_many(w, "You’ve reached this hour’s limit of AI requests.")
    if (w := _ai_day.check("site")):
        _too_many(w, "The demo has reached today’s limit of AI requests.")


def write_limit(request: Request):
    """FastAPI dependency for endpoints that save data (check-ins, reports)."""
    if ENABLED and (w := _writes.check(client_ip(request))):
        _too_many(w, "Too many saves in a short time.")


def reset_all():
    for w in (_ai_minute, _ai_hour, _ai_day, _writes):
        w.reset()
