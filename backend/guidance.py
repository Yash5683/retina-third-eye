# Retina Memory - Directional Guidance Engine
from __future__ import annotations

from typing import Literal, Optional

Position = Literal["left", "center", "right", "not_found"]
Size     = Literal["small", "medium", "large", "very_large"]

# Distance estimates based on apparent object size in frame
_SIZE_TO_DISTANCE: dict[str, str] = {
    "very_large": "within arm's reach (< 0.5 m)",
    "large":      "very close (about 0.5–1 m)",
    "medium":     "nearby (about 1–2 m)",
    "small":      "further away (about 2–4 m)",
}

# Confidence thresholds
_CONF_HIGH   = 0.80   # reliable detection
_CONF_MEDIUM = 0.55   # acceptable
_CONF_LOW    = 0.35   # uncertain


def _distance_from_size(size: Optional[str]) -> str:
    if size and size in _SIZE_TO_DISTANCE:
        return _SIZE_TO_DISTANCE[size]
    return "distance unknown"


def compute_guidance(
    current: Position,
    previous: Optional[Position] = None,
    confidence: float = 0.0,
    size: Optional[Size] = None,
) -> dict:
    """
    Compute a spoken instruction, vibration pattern, and distance estimate.

    Args:
        current:    Position returned by the current detection frame.
        previous:   Position from the previous frame (for movement context).
        confidence: Detection confidence 0.0–1.0.
        size:       Apparent object size in frame for distance estimation.

    Returns:
        {
            "instruction": str,       # spoken to the user
            "vibrate":     list[int], # navigator.vibrate() pattern (ms on/off)
            "distance":    str,       # human-readable distance estimate
            "confirmed":   bool,      # True only when high-confidence center detection
        }
    """
    distance = _distance_from_size(size)

    if current == "not_found":
        return {
            "instruction": "Object not visible. Sweep slowly left to right.",
            "vibrate": [],
            "distance": "not visible",
            "confirmed": False,
        }

    if current == "center":
        confirmed = confidence >= _CONF_HIGH

        if size == "very_large" and confirmed:
            return {
                "instruction": f"Object is right in front of you, {distance}. Reach forward.",
                "vibrate": [200, 80, 200, 80, 200, 80, 400],
                "distance": distance,
                "confirmed": True,
            }
        if size == "large" and confirmed:
            return {
                "instruction": f"Object is directly ahead, {distance}.",
                "vibrate": [200, 100, 200, 100, 200],
                "distance": distance,
                "confirmed": True,
            }
        if confirmed:
            return {
                "instruction": f"Object is centered ahead, {distance}. Move forward.",
                "vibrate": [150, 100, 150],
                "distance": distance,
                "confirmed": True,
            }
        # Medium confidence center
        return {
            "instruction": f"Object appears to be ahead, {distance}. Hold still.",
            "vibrate": [100],
            "distance": distance,
            "confirmed": False,
        }

    if current == "left":
        if previous == "center":
            return {
                "instruction": "Slightly to your right.",
                "vibrate": [80, 40, 80],
                "distance": distance,
                "confirmed": False,
            }
        if confidence >= _CONF_HIGH:
            return {
                "instruction": f"Object is to your left, {distance}. Turn left.",
                "vibrate": [100, 50, 100],
                "distance": distance,
                "confirmed": False,
            }
        return {
            "instruction": "Move left.",
            "vibrate": [100],
            "distance": distance,
            "confirmed": False,
        }

    if current == "right":
        if previous == "center":
            return {
                "instruction": "Slightly to your left.",
                "vibrate": [80, 40, 80],
                "distance": distance,
                "confirmed": False,
            }
        if confidence >= _CONF_HIGH:
            return {
                "instruction": f"Object is to your right, {distance}. Turn right.",
                "vibrate": [100, 50, 100],
                "distance": distance,
                "confirmed": False,
            }
        return {
            "instruction": "Move right.",
            "vibrate": [100],
            "distance": distance,
            "confirmed": False,
        }

    return {"instruction": "Keep scanning.", "vibrate": [], "distance": distance, "confirmed": False}
