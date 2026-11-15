"""Central configuration. Values come from environment variables (or backend/.env)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")

# --- paths ---------------------------------------------------------------
KB_CHUNKS = PROJECT_DIR / "knowledge-base" / "processed" / "chunks.jsonl"
LABS_DIR = PROJECT_DIR / "data" / "inspiration4"
CACHE_DIR = BACKEND_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

# --- Claude ----------------------------------------------------------------
# Opus 5.5 for every agent by default; override per role via env if you want to trade cost/latency.
COORDINATOR_MODEL = os.getenv("COORDINATOR_MODEL", "claude-opus-5-5")
HAZARD_AGENT_MODEL = os.getenv("HAZARD_AGENT_MODEL", "claude-opus-5-5")
COORDINATOR_EFFORT = os.getenv("COORDINATOR_EFFORT", "medium")
HAZARD_AGENT_EFFORT = os.getenv("HAZARD_AGENT_EFFORT", "low")
MEMORY_MODEL = os.getenv("MEMORY_MODEL", "claude-opus-5-5")      # long-term memory extraction
MEMORY_EFFORT = os.getenv("MEMORY_EFFORT", "low")
# Server-side refusal fallback (beta). Set USE_FALLBACKS=0 to disable.
USE_FALLBACKS = os.getenv("USE_FALLBACKS", "1") == "1"
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# --- NASA DONKI ------------------------------------------------------------
# api.nasa.gov/DONKI now returns 404; CCMC serves DONKI directly without an API key.
DONKI_BASE = os.getenv("DONKI_BASE", "https://ccmc.gsfc.nasa.gov/DONKI-API/get")
DONKI_CACHE_TTL_S = int(os.getenv("DONKI_CACHE_TTL_S", "300"))
DONKI_LOOKBACK_DAYS = int(os.getenv("DONKI_LOOKBACK_DAYS", "7"))

# --- retrieval -------------------------------------------------------------
# Dense embeddings: OpenAI when OPENAI_API_KEY is set (reads the whole chunk, up to 8191 tokens),
# otherwise the local fastembed model (truncates at 512 tokens). Either way, BM25 runs alongside.
OPENAI_EMBED_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
LOCAL_EMBED_MODEL = os.getenv("LOCAL_EMBED_MODEL", "BAAI/bge-small-en-v1.5")
EMBED_PROVIDER = os.getenv("EMBED_PROVIDER", "openai" if os.getenv("OPENAI_API_KEY") else "local")
USE_DENSE = os.getenv("USE_DENSE", "1") == "1"   # 0 = BM25 only
TOP_K = int(os.getenv("TOP_K", "6"))

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")


def claude_configured() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_PROFILE"))
