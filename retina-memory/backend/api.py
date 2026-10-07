# Retina Memory - API route handlers
from __future__ import annotations

import base64
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from guidance import compute_guidance
from intent import classify_intent_async, extract_object_name
from memory import JSONMemoryStore
from memory_priority import pin_object, unpin_object, load_pinned, importance_score
from memory_semantic import store_observation_semantic, semantic_search, is_semantic_available
from models import (
    CaptureRequest,
    CaptureResponse,
    DetectRequest,
    DetectResponse,
    Observation,
    QueryRequest,
    QueryResponse,
)
from response import format_memory_response, format_live_vision_prompt_response
from vision import VisionTimeoutError, VisionAPIError, get_vision_client

# Language code → human-readable name for LLM prompts
_LANG_NAMES: dict[str, str] = {
    "en-IN": "English (Indian accent)",
    "hi-IN": "Hindi (हिन्दी)",
    "ta-IN": "Tamil (தமிழ்)",
    "te-IN": "Telugu (తెలుగు)",
    "kn-IN": "Kannada (ಕನ್ನಡ)",
    "ml-IN": "Malayalam (മലയാളം)",
    "mr-IN": "Marathi (मराठी)",
    "bn-IN": "Bengali (বাংলা)",
    "gu-IN": "Gujarati (ગુજરાતી)",
    "pa-IN": "Punjabi (ਪੰਜਾਬੀ)",
    "ur-IN": "Urdu (اردو)",
}

def _lang_instruction(language: str) -> str:
    """Return a system-prompt instruction for the given language code."""
    name = _LANG_NAMES.get(language, "English")
    if language == "en-IN":
        return "Respond in clear, natural English."
    return (
        f"You MUST respond entirely in {name}. "
        f"Do NOT use English unless the user wrote in English. "
        f"Use natural, conversational {name} that is easy to understand when spoken aloud."
    )

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Model IDs ────────────────────────────────────────────────────────────────
# Text-only model for translation/queries — Groq (fast, free)
_TEXT_MODEL   = "llama-3.3-70b-versatile"

_store: Optional[JSONMemoryStore] = None
_prev_positions: dict[str, str] = {}


async def _vision_request(prompt: str, image_bytes: bytes, max_tokens: int = 400, temperature: float = 0.1) -> str:
    """Send an image + prompt to the configured vision provider (OpenRouter). Returns raw text."""
    import os, httpx as _httpx
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        raise VisionAPIError("OPENROUTER_API_KEY not configured.")

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "model": "nvidia/nemotron-nano-12b-v2-vl:free",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text",      "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
            ],
        }],
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://retina-memory.app",
        "X-Title":       "Retina Memory",
    }
    async with _httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)

    if not resp.is_success:
        raise VisionAPIError(f"OpenRouter returned {resp.status_code}: {resp.text[:200]}")

    try:
        return resp.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise VisionAPIError(f"Unexpected OpenRouter response: {exc}")


async def _store_semantic_background(observations: list) -> None:
    """Store observations in ChromaDB without blocking the HTTP response."""
    try:
        for obs in observations:
            store_observation_semantic(obs)
    except Exception as exc:
        logger.debug("Background semantic store failed: %s", exc)


def get_store() -> JSONMemoryStore:
    global _store
    if _store is None:
        _store = JSONMemoryStore()
    return _store


# ---------------------------------------------------------------------------
# POST /capture
# ---------------------------------------------------------------------------

@router.post("/capture", response_model=CaptureResponse)
async def capture(request: CaptureRequest) -> CaptureResponse:
    start = time.monotonic()
    try:
        image_bytes = base64.b64decode(request.image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    client = get_vision_client()
    try:
        observations = await client.analyze_image(image_bytes)
    except VisionTimeoutError:
        raise HTTPException(status_code=504, detail="Vision model timed out. Frame discarded.")
    except VisionAPIError as exc:
        raise HTTPException(status_code=502, detail=f"Vision API error: {exc}")

    if observations:
        get_store().write_observations(observations)
        # Store in semantic index in background — don't block the response
        import asyncio
        asyncio.create_task(_store_semantic_background(observations))

    return CaptureResponse(
        observations=observations,
        model_used=type(client).__name__,
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )


# ---------------------------------------------------------------------------
# POST /query
# ---------------------------------------------------------------------------

@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest) -> QueryResponse:
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    intent = await classify_intent_async(request.query)
    store = get_store()
    language = request.language or "en-IN"

    if intent == "memory_lookup":
        object_name = extract_object_name(request.query)

        observation: Optional[Observation] = None

        if is_semantic_available():
            matched = semantic_search(request.query, n_results=3)
            observation = matched[0] if matched else None

        if observation is None:
            observation = store.query_observations(object_name)

        # Get English response then translate if needed
        english_response = format_memory_response(observation, object_name)
        if language != "en-IN":
            response_text = await _translate_response(english_response, language)
        else:
            response_text = english_response

        return QueryResponse(
            intent="memory_lookup",
            response_text=response_text,
            observation=observation,
        )

    # live_vision — ask the vision model to describe the scene using a text prompt
    response_text = await _ask_vision_model(request.query, language)
    return QueryResponse(
        intent="live_vision",
        response_text=response_text,
        observation=None,
    )


async def _translate_response(text: str, language: str) -> str:
    """Translate an English response into the target language using Groq."""
    import os, httpx
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return text
    lang_name = _LANG_NAMES.get(language, language)
    try:
        payload = {
            "model": _TEXT_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        f"You are a precise translator. Translate the following text into {lang_name}. "
                        f"Keep the translation natural and suitable for text-to-speech. "
                        f"Preserve all numbers, times, and proper nouns. "
                        f"Return ONLY the translated text, nothing else."
                    ),
                },
                {"role": "user", "content": text},
            ],
            "temperature": 0.1,
            "max_tokens": 300,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
        if response.is_success:
            return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("Translation failed: %s", exc)
    return text  # fallback to English on failure


async def _ask_vision_model(query: str, language: str = "en-IN") -> str:
    """Send a natural language question to Groq LLM, responding in the user's language."""
    import os, httpx

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return "Please point your camera at the scene and tap Scan Now for a description."
    lang_instruction = _lang_instruction(language)
    try:
        payload = {
            "model": _TEXT_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        f"You are a helpful AI assistant for a blind user. "
                        f"Answer questions concisely and clearly. "
                        f"If asked about distance or location, give practical estimates. "
                        f"{lang_instruction}"
                    ),
                },
                {"role": "user", "content": query},
            ],
            "temperature": 0.3,
            "max_tokens": 200,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
        if response.is_success:
            return response.json()["choices"][0]["message"]["content"].strip()
        logger.warning("Groq query returned %d", response.status_code)
    except Exception as exc:
        logger.warning("Groq query failed: %s", exc)

    return "I couldn't process that query. Please try again."


# ---------------------------------------------------------------------------
# POST /detect
# ---------------------------------------------------------------------------

# Synonyms — maps user-provided names to common vision model labels
_SYNONYMS: dict[str, list[str]] = {
    "mug":        ["coffee mug", "cup", "mug", "tea cup"],
    "cup":        ["cup", "mug", "coffee mug", "glass"],
    "phone":      ["phone", "smartphone", "mobile phone", "cell phone", "iphone", "android"],
    "glasses":    ["glasses", "eyeglasses", "spectacles", "sunglasses"],
    "keys":       ["keys", "key", "key ring", "keychain"],
    "wallet":     ["wallet", "purse", "billfold"],
    "laptop":     ["laptop", "computer", "notebook", "macbook"],
    "remote":     ["remote", "remote control", "tv remote"],
    "bag":        ["bag", "backpack", "handbag", "purse", "tote"],
    "book":       ["book", "notebook", "textbook"],
    "bottle":     ["bottle", "water bottle", "plastic bottle"],
    "charger":    ["charger", "cable", "charging cable", "power cable"],
    "headphones": ["headphones", "earphones", "earbuds", "airpods"],
    "watch":      ["watch", "smartwatch", "wristwatch"],
}

# Smoothing buffer per target — last N confidence scores
_confidence_buffer: dict[str, list[float]] = {}
_SMOOTH_N = 3  # average over last 3 frames

# Dedicated detect prompt with few-shot examples for accuracy
_DETECT_PROMPT_TEMPLATE = """Find "{target}" in this image. Be precise.

Rules:
- position: left third=left, middle third=center, right third=right
- size: very_large=fills >40% frame (arm reach), large=20-40% (<1m), medium=5-20% (1-2m), small=<5% (>2m)
- confidence: how certain you are 0.0-1.0
- vertical: top|middle|bottom of frame

Examples:
User asks for "wallet", sees wallet on left side close up → {{"found":true,"position":"left","vertical":"bottom","size":"large","confidence":0.92}}
User asks for "keys", nothing visible → {{"found":false,"position":"not_found","vertical":null,"size":null,"confidence":0.0}}
User asks for "phone", phone centered far away → {{"found":true,"position":"center","vertical":"middle","size":"small","confidence":0.78}}

Now find "{target}". Return ONLY valid JSON, no markdown:"""


def _get_synonyms(target: str) -> list[str]:
    """Return all known aliases for a target object name."""
    target = target.lower().strip()
    for key, aliases in _SYNONYMS.items():
        if target == key or target in aliases:
            return aliases
    return [target]


def _smooth_confidence(target: str, new_conf: float) -> float:
    """Exponential moving average of confidence to reduce jitter."""
    buf = _confidence_buffer.setdefault(target, [])
    buf.append(new_conf)
    if len(buf) > _SMOOTH_N:
        buf.pop(0)
    return sum(buf) / len(buf)


@router.post("/detect", response_model=DetectResponse)
async def detect(request: DetectRequest) -> DetectResponse:
    if not request.target_object or not request.target_object.strip():
        raise HTTPException(status_code=400, detail="target_object must not be empty.")

    try:
        image_bytes = base64.b64decode(request.image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    target = request.target_object.strip().lower()
    prev   = _prev_positions.get(target)

    prompt    = _DETECT_PROMPT_TEMPLATE.format(target=target)

    import os, json as _json
    try:
        raw = await _vision_request(prompt, image_bytes, max_tokens=100, temperature=0.0)
        if raw.startswith("```"):
            raw = "\n".join(l for l in raw.split("\n") if not l.startswith("```")).strip()
        data = _json.loads(raw)

        if data.get("found"):
            position   = data.get("position", "center")
            raw_conf   = float(data.get("confidence", 0.8))
            smoothed   = _smooth_confidence(target, raw_conf)
            size       = data.get("size")
            vertical   = data.get("vertical")
            guidance   = compute_guidance(position, prev, smoothed, size, vertical)
            _prev_positions[target] = position
            return DetectResponse(position=position, confidence=round(smoothed, 3), guidance=guidance)

    except Exception as exc:
        logger.warning("Detect failed: %s", exc)

    _prev_positions[target] = "not_found"
    _smooth_confidence(target, 0.0)
    return DetectResponse(position="not_found", confidence=0.0, guidance=compute_guidance("not_found", prev))


# ---------------------------------------------------------------------------
# GET /memory/recent
# ---------------------------------------------------------------------------

@router.get("/memory/recent")
async def get_recent_memory(limit: int = 20):
    store = get_store()
    observations = store.get_recent(limit=min(limit, 100))
    pinned = load_pinned()

    # Count frequency only from the recent slice, not the full store
    freq: dict[str, int] = {}
    for obs in observations:
        freq[obs.object] = freq.get(obs.object, 0) + 1

    enriched = []
    for obs in observations:
        enriched.append({
            **obs.model_dump(),
            "importance": importance_score(obs, freq.get(obs.object, 1), pinned),
            "pinned": obs.object in pinned,
        })

    return {"observations": enriched}


# ---------------------------------------------------------------------------
# DELETE /memory
# ---------------------------------------------------------------------------

@router.delete("/memory")
async def clear_memory():
    get_store().clear_all()
    return {"status": "cleared", "message": "All observations have been deleted."}


# ---------------------------------------------------------------------------
# POST /memory/pin
# ---------------------------------------------------------------------------

class PinRequest(BaseModel):
    object: str
    pinned: bool = True


@router.post("/memory/pin")
async def pin_memory_object(request: PinRequest):
    name = request.object.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="object must not be empty.")
    if request.pinned:
        pin_object(name)
        return {"status": "pinned", "object": name}
    else:
        unpin_object(name)
        return {"status": "unpinned", "object": name}


# ---------------------------------------------------------------------------
# POST /train
# ---------------------------------------------------------------------------

class TrainRequest(BaseModel):
    image: str
    label: str


@router.post("/train")
async def train(request: TrainRequest):
    """
    Receive a live camera frame + user-provided label.
    Groq analyzes the frame and saves the object to persistent memory.
    """
    if not request.label or not request.label.strip():
        raise HTTPException(status_code=400, detail="label must not be empty.")

    try:
        image_bytes = base64.b64decode(request.image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    client = get_vision_client()
    label = request.label.strip().lower()

    try:
        observations = await client.analyze_image(image_bytes)
    except VisionTimeoutError:
        raise HTTPException(status_code=504, detail="Vision model timed out.")
    except VisionAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    matched = next(
        (o for o in observations if label in o.object.lower() or o.object.lower() in label),
        None,
    )

    if matched:
        obs = Observation(
            object=label,
            color=matched.color,
            position=matched.position,
            location=matched.location,
            timestamp=datetime.now(timezone.utc),
            confidence=matched.confidence,
        )
    else:
        first = observations[0] if observations else None
        obs = Observation(
            object=label,
            color=first.color if first else "unknown",
            position=first.position if first else "center",
            location=first.location if first else "in the frame",
            timestamp=datetime.now(timezone.utc),
            confidence=0.75,
        )

    get_store().write_observations([obs])
    store_observation_semantic(obs)

    return {
        "success": True,
        "observation": obs.model_dump(),
        "message": f"Trained: '{obs.object}' saved — {obs.position}, {obs.location}.",
    }


# ---------------------------------------------------------------------------
# POST /path-guidance
# ---------------------------------------------------------------------------

class PathGuidanceRequest(BaseModel):
    image: str


_PATH_GUIDANCE_PROMPT = """You are a navigation assistant for a blind user. Analyze this image and provide step-by-step walking instructions.

Look at:
- Clear path ahead (floor/ground space)
- Obstacles (furniture, walls, steps, doors)
- Turns needed (left/right)
- Approximate distances in steps (1 step ≈ 0.75m)

Return JSON:
{
  "steps": ["instruction 1", "instruction 2", ...],
  "clear": true/false,
  "summary": "one sentence overview"
}

Rules:
- Maximum 5 steps
- Each step: short, clear, actionable (e.g. "Walk forward 3 steps", "Turn left at the wall", "Step over the threshold")
- If path is blocked: steps should say how to navigate around
- If completely clear: ["Walk forward freely, path is clear"]
- Return ONLY valid JSON, no markdown."""


@router.post("/path-guidance")
async def path_guidance(request: PathGuidanceRequest):
    """Analyze camera frame and return step-by-step navigation instructions."""
    try:
        image_bytes = base64.b64decode(request.image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    import json as _json
    try:
        raw = await _vision_request(_PATH_GUIDANCE_PROMPT, image_bytes, max_tokens=300, temperature=0.1)
        if raw.startswith("```"):
            raw = "\n".join(l for l in raw.split("\n") if not l.startswith("```")).strip()
        data = _json.loads(raw)
        return {
            "steps":   data.get("steps", []),
            "clear":   data.get("clear", True),
            "summary": data.get("summary", ""),
        }
    except _json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Could not parse path guidance response.")
    except VisionAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.warning("Path guidance failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))


# ---------------------------------------------------------------------------
# POST /obstacle-scan
# ---------------------------------------------------------------------------

class ObstacleScanRequest(BaseModel):
    image: str


_OBSTACLE_PROMPT = """You are a safety assistant for a blind user. Scan this image for immediate obstacles or hazards in the path ahead.

Focus on:
- Objects on the floor (bags, shoes, cables)
- Furniture blocking the path
- Steps or level changes
- Walls or doors very close
- People in the way

Return JSON:
{
  "obstacle": true/false,
  "type": "object name or null",
  "urgency": "low|medium|high",
  "instruction": "short spoken warning (max 6 words) or null"
}

urgency:
- high: immediate danger within 1 step (step edge, wall, person very close)
- medium: obstacle within 2-3 steps (chair, bag on floor)
- low: distant or minor hazard

If path is clear: {"obstacle": false, "type": null, "urgency": null, "instruction": null}
Return ONLY valid JSON, no markdown."""


@router.post("/obstacle-scan")
async def obstacle_scan(request: ObstacleScanRequest):
    """Scan for obstacles in the path and return urgency + spoken warning."""
    try:
        image_bytes = base64.b64decode(request.image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    import json as _json
    try:
        raw = await _vision_request(_OBSTACLE_PROMPT, image_bytes, max_tokens=80, temperature=0.0)
        if raw.startswith("```"):
            raw = "\n".join(l for l in raw.split("\n") if not l.startswith("```")).strip()
        data = _json.loads(raw)
        return {
            "obstacle":    data.get("obstacle", False),
            "type":        data.get("type"),
            "urgency":     data.get("urgency"),
            "instruction": data.get("instruction"),
        }
    except Exception as exc:
        logger.debug("Obstacle scan failed: %s", exc)
        return {"obstacle": False, "type": None, "urgency": None, "instruction": None}


# ---------------------------------------------------------------------------
# POST /ocr
# ---------------------------------------------------------------------------

class OcrRequest(BaseModel):
    image: str
    language: str = "en-IN"   # BCP-47 — used to instruct the model on output language


_OCR_PROMPT = """You are a precise OCR (Optical Character Recognition) engine for a blind user.

Carefully read ALL text visible in this image. Include:
- Signs, labels, posters, banners
- Product names, packaging text
- Printed documents, books, newspapers
- Handwritten notes
- Screen text, digital displays
- Prices, numbers, dates
- Any other readable text

Rules:
- Preserve the original reading order (top to bottom, left to right)
- Keep line breaks where they naturally occur
- Do NOT describe the image — only extract text
- If no text is visible, return exactly: NO_TEXT

Return ONLY the extracted text, nothing else."""


@router.post("/ocr")
async def ocr_scan(request: OcrRequest):
    """
    Extract all readable text from a camera frame using Groq vision.
    Returns the raw text and a spoken-friendly version.
    """
    try:
        image_bytes = base64.b64decode(request.image)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    lang_hint = _lang_instruction(request.language)
    ocr_prompt_with_lang = f"{_OCR_PROMPT}\n\n{lang_hint}"

    try:
        raw_text = await _vision_request(ocr_prompt_with_lang, image_bytes, max_tokens=600, temperature=0.0)

        if raw_text == "NO_TEXT" or not raw_text:
            return {
                "found": False,
                "text": "",
                "spoken": "No readable text found in the image.",
            }

        # Build a spoken-friendly version
        spoken = raw_text.replace("\n\n", ". ").replace("\n", ", ").strip()
        import re
        spoken = re.sub(r'[,\.]{2,}', '.', spoken)
        spoken = f"I can read: {spoken}"

        return {
            "found": True,
            "text":  raw_text,
            "spoken": spoken,
        }

    except HTTPException:
        raise
    except VisionAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.warning("OCR scan failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
