"""Thin async wrapper around the Anthropic SDK (client.beta.messages for server-side refusal fallbacks)."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import AsyncIterator, Optional

import anthropic

from .. import config


class AgentError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def client() -> anthropic.AsyncAnthropic:
    if not config.claude_configured():
        raise AgentError("Claude is not configured: set ANTHROPIC_API_KEY in backend/.env")
    return anthropic.AsyncAnthropic()


def _common(model: str, effort: str, system: str) -> dict:
    kw = dict(model=model, system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
              output_config={"effort": effort})
    if config.USE_FALLBACKS:
        kw.update(betas=[config.FALLBACK_BETA], fallbacks="default")
    return kw


def _text(resp) -> str:
    return "".join(b.text for b in resp.content if b.type == "text")


async def structured(*, model: str, effort: str, system: str, messages: list[dict], schema: dict,
                     max_tokens: int = 16000) -> dict:
    """One call that must return JSON matching `schema` (structured outputs)."""
    kw = _common(model, effort, system)
    kw["output_config"] = {**kw["output_config"], "format": {"type": "json_schema", "schema": schema}}
    try:
        resp = await client().beta.messages.create(max_tokens=max_tokens, messages=messages, **kw)
    except anthropic.APIConnectionError as e:
        raise AgentError(f"Cannot reach the Claude API: {e}") from e
    except anthropic.AuthenticationError as e:
        raise AgentError("Claude API key rejected (check ANTHROPIC_API_KEY)") from e
    except anthropic.RateLimitError as e:
        raise AgentError("Claude API rate limit reached; try again shortly") from e
    except anthropic.APIStatusError as e:
        raise AgentError(f"Claude API error {e.status_code}: {e.message}") from e
    if resp.stop_reason == "refusal":
        raise AgentError("The model declined this request")
    if resp.stop_reason == "max_tokens":
        raise AgentError("Agent output was truncated (max_tokens)")
    return json.loads(_text(resp))


async def stream_text(*, model: str, effort: str, system: str, messages: list[dict],
                      max_tokens: int = 16000) -> AsyncIterator[str]:
    """Stream plain-text tokens."""
    kw = _common(model, effort, system)
    try:
        async with client().beta.messages.stream(max_tokens=max_tokens, messages=messages, **kw) as stream:
            async for text in stream.text_stream:
                yield text
            final = await stream.get_final_message()
            if final.stop_reason == "refusal":
                raise AgentError("The model declined this request")
    except anthropic.APIConnectionError as e:
        raise AgentError(f"Cannot reach the Claude API: {e}") from e
    except anthropic.AuthenticationError as e:
        raise AgentError("Claude API key rejected (check ANTHROPIC_API_KEY)") from e
    except anthropic.RateLimitError as e:
        raise AgentError("Claude API rate limit reached; try again shortly") from e
    except anthropic.APIStatusError as e:
        raise AgentError(f"Claude API error {e.status_code}: {e.message}") from e
