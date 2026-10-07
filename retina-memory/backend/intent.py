# Retina Memory - Intent Router
from __future__ import annotations

import logging
import os
from typing import Literal

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Keyword lists (case-insensitive matching) — used as offline fallback
# ---------------------------------------------------------------------------

_MEMORY_LOOKUP_KEYWORDS: list[str] = [
    "where did i leave",
    "where did i put",
    "where did i place",
    "where have i put",
    "where is my",
    "where are my",
    "where's my",
    "have you seen my",
    "find my",
    "locate my",
    "did you see my",
    "where is the",
    "where are the",
    "find the",
    "locate the",
    "where's the",
    "last seen",
    "did i leave",
    "what did you see",
    "what have you seen",
    "in the last",
    "recently seen",
]

_LIVE_VISION_KEYWORDS: list[str] = [
    "what is this",
    "what's this",
    "what am i holding",
    "what am i looking at",
    "describe what you see",
    "describe the scene",
    "what do you see",
    "what's in front",
    "what is in front",
    "what's around me",
    "what is around me",
    "describe",
    "tell me what",
    "scan now",
    "look around",
    "what's here",
    "what is here",
]

# ---------------------------------------------------------------------------
# Keyword-based classifier (pure function, no I/O, always available)
# ---------------------------------------------------------------------------


def _classify_keywords(query: str) -> Literal["memory_lookup", "live_vision"]:
    lower = query.strip().lower()
    has_memory = any(kw in lower for kw in _MEMORY_LOOKUP_KEYWORDS)
    has_vision = any(kw in lower for kw in _LIVE_VISION_KEYWORDS)
    if has_vision and not has_memory:
        return "live_vision"
    return "memory_lookup"


# ---------------------------------------------------------------------------
# LLM-based classifier (async, requires INTENT_PROVIDER=groq)
# ---------------------------------------------------------------------------

_INTENT_PROMPT = """You are an intent classifier for an AI assistant that helps blind users find objects.

Classify the following query as exactly one of:
- memory_lookup: the user is asking about something they saw before, trying to find a lost item, or asking about past observations
- live_vision: the user wants to know what is currently visible in front of them right now

Query: "{query}"

Examples:
- "Where did I leave my keys?" → memory_lookup
- "Did I leave my phone somewhere?" → memory_lookup
- "What did you see in the last 10 minutes?" → memory_lookup
- "Where is my wallet?" → memory_lookup
- "What is this?" → live_vision
- "What am I holding?" → live_vision
- "Describe what you see" → live_vision
- "What's in front of me?" → live_vision

Reply with ONLY the classification word, nothing else."""


async def _classify_llm(query: str) -> Literal["memory_lookup", "live_vision"] | None:
    """Call Groq to classify intent. Returns None on any failure."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return None

    try:
        import httpx

        prompt = _INTENT_PROMPT.format(query=query)
        payload = {
            "model": "llama-3.1-8b-instant",  # text-only, fast, cheap
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
            "max_tokens": 10,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)

        if not response.is_success:
            return None

        raw = response.json()["choices"][0]["message"]["content"].strip().lower()

        if raw in ("memory_lookup", "live_vision"):
            return raw  # type: ignore[return-value]

        if "live_vision" in raw:
            return "live_vision"
        if "memory_lookup" in raw:
            return "memory_lookup"

        return None
    except Exception as exc:
        logger.debug("LLM intent classification failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def classify_intent(query: str) -> Literal["memory_lookup", "live_vision"]:
    """
    Synchronous keyword-based intent classification.
    Always available, works offline.
    """
    if not query or not query.strip():
        return "memory_lookup"
    return _classify_keywords(query)


async def classify_intent_async(query: str) -> Literal["memory_lookup", "live_vision"]:
    """
    Async intent classification.
    Uses Groq LLM when INTENT_PROVIDER=groq, otherwise keyword matching.
    Always falls back to keyword matching on any failure.
    """
    if not query or not query.strip():
        return "memory_lookup"

    provider = os.getenv("INTENT_PROVIDER", "keyword").lower()

    if provider == "groq":
        llm_result = await _classify_llm(query)
        if llm_result is not None:
            logger.debug("LLM intent: %s for query: %s", llm_result, query[:50])
            return llm_result
        logger.debug("LLM intent failed, falling back to keyword matching")

    return _classify_keywords(query)


def extract_object_name(query: str) -> str:
    """
    Extract the object name from a memory-lookup query by stripping
    common query prefixes.

    Examples:
        "where is my wallet"       -> "wallet"
        "find my keys"             -> "keys"
        "where did I leave glasses" -> "glasses"
        "where is table"           -> "table"
        "table"                    -> "table"
    """
    lower = query.strip().lower().rstrip("?").strip()

    # Ordered from most specific to least specific
    prefixes = [
        "where did i leave my ",
        "where did i put my ",
        "where did i place my ",
        "where have i put my ",
        "where did i leave ",
        "where did i put ",
        "where is my ",
        "where are my ",
        "where's my ",
        "have you seen my ",
        "find my ",
        "locate my ",
        "did you see my ",
        "did i leave my ",
        "where is the ",
        "where are the ",
        "find the ",
        "locate the ",
        "where's the ",
        "where is ",
        "where are ",
        "find ",
        "locate ",
        "show me ",
        "tell me where ",
        "do you know where ",
        "can you find ",
        "i'm looking for my ",
        "i am looking for my ",
        "i'm looking for ",
        "i am looking for ",
        "looking for my ",
        "looking for ",
        "search for my ",
        "search for ",
        "can you find my ",
        "can you find the ",
        "can you find ",
    ]

    for prefix in prefixes:
        if lower.startswith(prefix):
            return lower[len(prefix):].strip()

    # Fallback: strip common question words from the start
    # e.g. "where table" -> "table", "my keys" -> "keys"
    noise_words = ["where", "is", "are", "my", "the", "a", "an", "have", "you", "seen", "did", "i", "left", "put"]
    words = lower.split()
    # Remove leading noise words but keep at least one word
    while len(words) > 1 and words[0] in noise_words:
        words = words[1:]

    return " ".join(words)
