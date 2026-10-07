# Retina Memory - Response Formatter
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from models import Observation


def relative_time(ts: datetime) -> str:
    now = datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    delta = now - ts
    total_seconds = int(delta.total_seconds())

    if total_seconds < 10:
        return "just now"
    if total_seconds < 60:
        return f"{total_seconds} seconds ago"
    if total_seconds < 120:
        return "1 minute ago"
    if total_seconds < 3600:
        return f"{total_seconds // 60} minutes ago"
    if total_seconds < 7200:
        return "1 hour ago"
    if total_seconds < 86400:
        return f"{total_seconds // 3600} hours ago"
    if total_seconds < 172800:
        return "yesterday"
    return f"{total_seconds // 86400} days ago"


def _position_phrase(position: str) -> str:
    return {"left": "on the left side", "center": "in the center", "right": "on the right side"}.get(position, "nearby")


def _distance_estimate(confidence: float | None, position: str) -> str:
    """
    Estimate approximate distance from confidence score and position.
    Higher confidence = object fills more of the frame = closer.
    """
    if confidence is None:
        return ""
    if confidence >= 0.90:
        return "very close — within arm's reach"
    if confidence >= 0.75:
        return "nearby — about 1 to 2 metres away"
    if confidence >= 0.55:
        return "a few metres away"
    if confidence >= 0.35:
        return "across the room"
    return "far away or partially visible"


def format_memory_response(observation: Optional[Observation], object_name: str) -> str:
    name = object_name.strip().lower() if object_name else "object"
    if observation is None:
        return f"I couldn't find your {name} recently. I haven't seen it in the last 24 hours."

    time_str = relative_time(observation.timestamp)
    pos_phrase = _position_phrase(observation.position)
    distance = _distance_estimate(observation.confidence, observation.position)

    response = f"I last saw your {observation.object} {time_str}, {pos_phrase}"
    if observation.location and observation.location not in ("unknown location", "unknown"):
        response += f" — {observation.location}"
    if distance:
        response += f". It appeared to be {distance}"
    return response + "."


def format_live_vision_prompt_response(object_name: str) -> str:
    return "Please point your camera at what you want me to describe, then tap Scan."
