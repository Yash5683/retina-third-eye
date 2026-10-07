# Retina Memory - Vision Model client (Groq only)
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional, Union

import httpx
from dotenv import load_dotenv

from models import Observation

logger = logging.getLogger(__name__)

# Shared persistent HTTP client — reuses TCP connections for speed
_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
    return _http_client


class VisionTimeoutError(Exception):
    """Raised when the Vision Model does not respond within the timeout."""


class VisionAPIError(Exception):
    """Raised when the Vision Model returns an unexpected error."""


VISION_PROMPT = """Analyze this image. Return a JSON array of visible objects.
Each object: {"object":"name","color":"color","position":"left|center|right","location":"where it is","confidence":0.0-1.0,"size":"small|medium|large|very_large"}
- size: apparent size in frame (small=far, very_large=very close/within arm's reach)
- position: left|center|right based on horizontal position
Include ALL visible objects. Return ONLY the JSON array, no markdown.
If nothing visible: []"""


def parse_vision_response(raw: str) -> list[Observation]:
    """Parse a raw LLM response string into a list of Observations. Never raises."""
    if not raw or not raw.strip():
        return []

    cleaned = raw.strip()
    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        lines = [l for l in cleaned.split("\n") if not l.startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        data = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Vision response is not valid JSON: %s", raw[:200])
        return []

    if not isinstance(data, list):
        return []

    observations: list[Observation] = []
    now = datetime.now(timezone.utc)

    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            obs = Observation(
                object=item.get("object", ""),
                color=item.get("color", "unknown"),
                position=item.get("position", ""),
                location=item.get("location", "unknown location"),
                timestamp=now,
                confidence=item.get("confidence"),
                size=item.get("size"),
            )
            observations.append(obs)
        except Exception as exc:
            logger.debug("Discarding invalid observation item %s: %s", item, exc)

    return observations


class DummyVisionClient:
    """Returns fixed sample observations — used when VISION_PROVIDER=dummy."""

    _SAMPLES = [
        {"object": "wallet",  "color": "brown",  "position": "center", "location": "on the side table", "confidence": 0.92},
        {"object": "keys",    "color": "silver", "position": "left",   "location": "on the coffee table", "confidence": 0.88},
        {"object": "phone",   "color": "black",  "position": "right",  "location": "on the desk", "confidence": 0.95},
    ]

    async def analyze_image(self, image_bytes: bytes) -> list[Observation]:
        now = datetime.now(timezone.utc)
        return [
            Observation(object=s["object"], color=s["color"], position=s["position"],  # type: ignore
                        location=s["location"], timestamp=now, confidence=s["confidence"])
            for s in self._SAMPLES
        ]


class HuggingFaceVisionClient:
    """
    Vision client using Hugging Face free Serverless Inference API.
    Uses Llava / BLIP for image understanding.
    Get a free token at huggingface.co → Settings → Access Tokens
    """

    _API_URL = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
    _VQA_URL = "https://api-inference.huggingface.co/models/dandelin/vilt-b32-finetuned-vqa"

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = api_key or os.getenv("HF_API_KEY", "")
        if not self._api_key:
            raise ValueError("HF_API_KEY is required. Get a free token at huggingface.co/settings/tokens")

    async def analyze_image(self, image_bytes: bytes) -> list[Observation]:
        """
        Use HF BLIP captioning to describe the scene, then parse into observations.
        Falls back to a generic observation if parsing fails.
        """
        headers = {"Authorization": f"Bearer {self._api_key}"}

        try:
            response = await get_http_client().post(
                self._API_URL,
                content=image_bytes,
                headers={**headers, "Content-Type": "image/jpeg"},
            )
        except httpx.TimeoutException as exc:
            raise VisionTimeoutError("HuggingFace API timed out") from exc
        except httpx.RequestError as exc:
            raise VisionAPIError(f"Network error: {exc}") from exc

        if response.status_code == 503:
            raise VisionAPIError("HuggingFace model is loading. Please try again in 20 seconds.")
        if response.status_code == 429:
            raise VisionAPIError("HuggingFace rate limit. Please wait a moment.")
        if not response.is_success:
            raise VisionAPIError(f"HuggingFace returned {response.status_code}: {response.text[:200]}")

        try:
            result = response.json()
            # BLIP returns [{"generated_text": "a photo of ..."}]
            caption = result[0].get("generated_text", "") if isinstance(result, list) else ""
        except Exception:
            return []

        if not caption:
            return []

        # Parse caption into observations
        now = datetime.now(timezone.utc)
        observations = []

        # Extract objects from caption using simple NLP
        import re
        # Common object patterns in captions
        words = re.findall(r'\b([a-z]+(?:\s+[a-z]+)?)\b', caption.lower())
        object_keywords = {
            'person', 'man', 'woman', 'child', 'people',
            'chair', 'table', 'desk', 'sofa', 'couch', 'bed',
            'phone', 'laptop', 'computer', 'keyboard', 'monitor',
            'book', 'cup', 'mug', 'bottle', 'glass',
            'window', 'door', 'wall', 'floor', 'ceiling',
            'bag', 'wallet', 'keys', 'glasses',
            'car', 'bicycle', 'dog', 'cat',
        }

        found = []
        for word in words:
            if word in object_keywords and word not in found:
                found.append(word)

        if not found:
            # Use the whole caption as a single observation
            observations.append(Observation(
                object="scene",
                color="unknown",
                position="center",
                location=caption[:100],
                timestamp=now,
                confidence=0.7,
            ))
        else:
            positions = ["left", "center", "right"]
            for i, obj in enumerate(found[:6]):
                observations.append(Observation(
                    object=obj,
                    color="unknown",
                    position=positions[i % 3],  # type: ignore
                    location=caption[:80],
                    timestamp=now,
                    confidence=0.75,
                ))

        return observations


class OpenRouterVisionClient:
    """Vision client using OpenRouter API — free tier with $1 credit on signup."""

    _API_URL = "https://openrouter.ai/api/v1/chat/completions"
    _MODEL   = "nvidia/nemotron-nano-12b-v2-vl:free"  # Free vision model on OpenRouter

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        if not self._api_key:
            raise ValueError("OPENROUTER_API_KEY is required. Get a free key at openrouter.ai")

    async def analyze_image(self, image_bytes: bytes) -> list[Observation]:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "model": self._MODEL,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text",      "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                ],
            }],
            "temperature": 0.1,
            "max_tokens": 400,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://retina-memory.app",
            "X-Title": "Retina Memory",
        }

        try:
            response = await get_http_client().post(self._API_URL, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise VisionTimeoutError("OpenRouter API timed out") from exc
        except httpx.RequestError as exc:
            raise VisionAPIError(f"Network error: {exc}") from exc

        if response.status_code == 429:
            raise VisionAPIError("OpenRouter rate limit. Please wait a moment.")
        if not response.is_success:
            raise VisionAPIError(f"OpenRouter returned {response.status_code}: {response.text[:200]}")

        try:
            json_response = response.json()
            logger.info("OpenRouter response keys: %s", list(json_response.keys()))
            raw_text = json_response["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            logger.warning("Unexpected OpenRouter response: %s | Full: %s", exc, response.text[:300])
            return []

        return parse_vision_response(raw_text)


class GroqVisionClient:
    """Vision client using Groq vision API via OpenAI-compatible Chat Completions."""

    _API_URL = "https://api.groq.com/openai/v1/chat/completions"
    _MODEL   = "llama-3.2-11b-vision-preview"

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = api_key or os.getenv("GROQ_API_KEY", "")
        if not self._api_key:
            raise ValueError("GROQ_API_KEY is required. Get a free key at console.groq.com")

    async def analyze_image(self, image_bytes: bytes) -> list[Observation]:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        # Use OpenAI-compatible Chat Completions (not Responses API)
        payload = {
            "model": self._MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": VISION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                        },
                    ],
                }
            ],
            "temperature": 0.1,
            "max_tokens": 400,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        last_exc: Optional[Exception] = None
        for attempt, wait in enumerate([0, 3, 8]):
            if wait:
                logger.info("Groq retry %d — waiting %ds", attempt, wait)
                await asyncio.sleep(wait)
            try:
                response = await get_http_client().post(self._API_URL, json=payload, headers=headers)
            except httpx.TimeoutException as exc:
                raise VisionTimeoutError("Groq API timed out") from exc
            except httpx.RequestError as exc:
                raise VisionAPIError(f"Network error: {exc}") from exc

            if response.status_code == 429:
                retry_after = int(response.headers.get("retry-after", 5))
                logger.warning("Groq 429 — retry-after: %ds", retry_after)
                last_exc = VisionAPIError("Rate limit reached. Please wait a moment.")
                if attempt < 2 and retry_after <= 10:
                    await asyncio.sleep(retry_after)
                    continue
                raise VisionAPIError("Rate limit reached. Please wait a moment before scanning again.")

            if not response.is_success:
                raise VisionAPIError(f"Groq returned {response.status_code}: {response.text[:200]}")

            try:
                # Standard Chat Completions response shape
                raw_text = response.json()["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as exc:
                logger.warning("Unexpected Groq response structure: %s", exc)
                return []

            return parse_vision_response(raw_text)

        raise last_exc or VisionAPIError("Groq API failed after retries")


def get_vision_client() -> Union[GroqVisionClient, DummyVisionClient]:
    """
    Return the vision client based on VISION_PROVIDER env var.
    Re-reads .env on every call so changes take effect without restart.
    Supports: groq | huggingface | openrouter | dummy
    """
    load_dotenv(override=True)
    provider = os.getenv("VISION_PROVIDER", "dummy").lower()
    if provider == "groq":
        return GroqVisionClient()
    if provider == "huggingface" or provider == "hf":
        return HuggingFaceVisionClient()
    if provider == "openrouter":
        return OpenRouterVisionClient()
    logger.info("Using DummyVisionClient (VISION_PROVIDER=%s)", provider)
    return DummyVisionClient()
