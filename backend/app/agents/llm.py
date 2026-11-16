"""Thin async wrapper around the reasoning model.

Two providers behind the same two functions, chosen with LLM_PROVIDER:
  * "openai"    (default): Chat Completions, strict JSON-schema structured outputs, streaming, reasoning_effort.
  * "anthropic": Messages API via client.beta.messages (server-side refusal fallbacks), output_config effort/format.
`structured()` returns a dict that matches the schema; `stream_text()` yields plain-text tokens.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import AsyncIterator

from .. import config


class AgentError(RuntimeError):
    pass


def _check():
    if not config.llm_configured():
        key = "OPENAI_API_KEY" if config.LLM_PROVIDER == "openai" else "ANTHROPIC_API_KEY"
        raise AgentError(f"The reasoning model is not configured: set {key} in backend/.env")


# ======================================================================== OpenAI
@lru_cache(maxsize=1)
def _openai():
    from openai import AsyncOpenAI
    return AsyncOpenAI()


def _openai_messages(system: str, messages: list[dict]) -> list[dict]:
    return [{"role": "system", "content": system}] + [{"role": m["role"], "content": m["content"]} for m in messages]


def _openai_error(e: Exception) -> AgentError:
    import openai
    if isinstance(e, openai.AuthenticationError):
        return AgentError("OpenAI API key rejected (check OPENAI_API_KEY)")
    if isinstance(e, openai.RateLimitError):
        return AgentError("OpenAI rate limit or quota reached; try again shortly")
    if isinstance(e, openai.APIConnectionError):
        return AgentError(f"Cannot reach the OpenAI API: {e}")
    if isinstance(e, openai.APIStatusError):
        return AgentError(f"OpenAI API error {e.status_code}: {e.message}")
    return AgentError(f"OpenAI error: {e}")


async def _openai_structured(model, effort, system, messages, schema, max_tokens) -> dict:
    import openai
    try:
        r = await _openai().chat.completions.create(
            model=model, reasoning_effort=effort, max_completion_tokens=max_tokens,
            messages=_openai_messages(system, messages),
            response_format={"type": "json_schema", "json_schema": {"name": "aegis_output", "schema": schema, "strict": True}},
        )
    except openai.OpenAIError as e:
        raise _openai_error(e) from e
    choice = r.choices[0]
    if getattr(choice.message, "refusal", None):
        raise AgentError("The model declined this request")
    if choice.finish_reason == "length":
        raise AgentError("Agent output was truncated (max tokens)")
    return json.loads(choice.message.content)


async def _openai_stream(model, effort, system, messages, max_tokens) -> AsyncIterator[str]:
    import openai
    try:
        stream = await _openai().chat.completions.create(
            model=model, reasoning_effort=effort, max_completion_tokens=max_tokens, stream=True,
            messages=_openai_messages(system, messages),
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except openai.OpenAIError as e:
        raise _openai_error(e) from e


# ===================================================================== Anthropic
@lru_cache(maxsize=1)
def _anthropic():
    import anthropic
    return anthropic.AsyncAnthropic()


def _anthropic_common(model: str, effort: str, system: str) -> dict:
    kw = dict(model=model, system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
              output_config={"effort": effort})
    if config.USE_FALLBACKS:
        kw.update(betas=[config.FALLBACK_BETA], fallbacks="default")
    return kw


def _anthropic_error(e: Exception) -> AgentError:
    import anthropic
    if isinstance(e, anthropic.AuthenticationError):
        return AgentError("Claude API key rejected (check ANTHROPIC_API_KEY)")
    if isinstance(e, anthropic.RateLimitError):
        return AgentError("Claude API rate limit reached; try again shortly")
    if isinstance(e, anthropic.APIConnectionError):
        return AgentError(f"Cannot reach the Claude API: {e}")
    if isinstance(e, anthropic.APIStatusError):
        return AgentError(f"Claude API error {e.status_code}: {e.message}")
    return AgentError(f"Claude error: {e}")


async def _anthropic_structured(model, effort, system, messages, schema, max_tokens) -> dict:
    import anthropic
    kw = _anthropic_common(model, effort, system)
    kw["output_config"] = {**kw["output_config"], "format": {"type": "json_schema", "schema": schema}}
    try:
        resp = await _anthropic().beta.messages.create(max_tokens=max_tokens, messages=messages, **kw)
    except anthropic.AnthropicError as e:
        raise _anthropic_error(e) from e
    if resp.stop_reason == "refusal":
        raise AgentError("The model declined this request")
    if resp.stop_reason == "max_tokens":
        raise AgentError("Agent output was truncated (max_tokens)")
    return json.loads("".join(b.text for b in resp.content if b.type == "text"))


async def _anthropic_stream(model, effort, system, messages, max_tokens) -> AsyncIterator[str]:
    import anthropic
    kw = _anthropic_common(model, effort, system)
    try:
        async with _anthropic().beta.messages.stream(max_tokens=max_tokens, messages=messages, **kw) as stream:
            async for text in stream.text_stream:
                yield text
            final = await stream.get_final_message()
            if final.stop_reason == "refusal":
                raise AgentError("The model declined this request")
    except anthropic.AnthropicError as e:
        raise _anthropic_error(e) from e


# ======================================================================= public
async def structured(*, model: str, effort: str, system: str, messages: list[dict], schema: dict,
                     max_tokens: int = 16000) -> dict:
    """One call that must return JSON matching `schema` (structured outputs)."""
    _check()
    if config.LLM_PROVIDER == "anthropic":
        return await _anthropic_structured(model, effort, system, messages, schema, max_tokens)
    return await _openai_structured(model, effort, system, messages, schema, max_tokens)


async def stream_text(*, model: str, effort: str, system: str, messages: list[dict],
                      max_tokens: int = 16000) -> AsyncIterator[str]:
    """Stream plain-text tokens."""
    _check()
    gen = (_anthropic_stream if config.LLM_PROVIDER == "anthropic" else _openai_stream)(model, effort, system, messages, max_tokens)
    async for tok in gen:
        yield tok
