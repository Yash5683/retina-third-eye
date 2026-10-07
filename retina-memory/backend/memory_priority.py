# Retina Memory - Memory Prioritization & Cleanup
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from models import Observation

# Default pinned objects — always kept regardless of score
_DEFAULT_PINNED = {"wallet", "keys", "phone", "glasses", "medication", "cane"}

# Load user-configured pinned objects from env (comma-separated)
_env_pinned = os.getenv("PINNED_OBJECTS", "")
PINNED_OBJECTS: set[str] = _DEFAULT_PINNED | {
    o.strip().lower() for o in _env_pinned.split(",") if o.strip()
}

_PINS_FILE = Path(__file__).parent / "pinned_objects.json"


def load_pinned() -> set[str]:
    """Load pinned objects from persistent file + env defaults."""
    pinned = set(PINNED_OBJECTS)
    if _PINS_FILE.exists():
        try:
            data = json.loads(_PINS_FILE.read_text())
            pinned |= {o.lower() for o in data.get("pinned", [])}
        except Exception:
            pass
    return pinned


def pin_object(object_name: str) -> None:
    """Persist a pinned object to disk."""
    pinned = load_pinned()
    pinned.add(object_name.strip().lower())
    _PINS_FILE.write_text(json.dumps({"pinned": sorted(pinned)}, indent=2))


def unpin_object(object_name: str) -> None:
    """Remove a pinned object."""
    pinned = load_pinned()
    pinned.discard(object_name.strip().lower())
    _PINS_FILE.write_text(json.dumps({"pinned": sorted(pinned)}, indent=2))


def importance_score(
    obs: Observation,
    times_seen: int = 1,
    pinned: set[str] | None = None,
) -> float:
    """
    Compute an importance score 0.0–1.0 for an observation.

    Factors:
    - Recency:   decays linearly over 24 hours (weight 0.4)
    - Frequency: how often the object has been seen, caps at 10 (weight 0.3)
    - Pinned:    user-marked important objects always score high (weight 0.3)
    """
    if pinned is None:
        pinned = load_pinned()

    now = datetime.now(timezone.utc)
    ts = obs.timestamp
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    age_hours = (now - ts).total_seconds() / 3600
    recency = max(0.0, 1.0 - age_hours / 24)
    frequency = min(1.0, times_seen / 10)
    is_pinned = 1.0 if obs.object.lower() in pinned else 0.0

    return round(0.4 * recency + 0.3 * frequency + 0.3 * is_pinned, 4)


def should_prune(
    obs: Observation,
    times_seen: int = 1,
    threshold: float = 0.05,
    pinned: set[str] | None = None,
) -> bool:
    """Return True if the observation is low-importance and safe to evict."""
    if pinned is None:
        pinned = load_pinned()
    # Never prune pinned objects
    if obs.object.lower() in pinned:
        return False
    return importance_score(obs, times_seen, pinned) < threshold


def prioritized_eviction(
    entries: list[dict[str, Any]],
    max_entries: int,
) -> list[dict[str, Any]]:
    """
    Evict entries when the buffer is over capacity.
    Prunes low-importance entries first; falls back to oldest-first.
    """
    if len(entries) <= max_entries:
        return entries

    pinned = load_pinned()

    # Count how many times each object appears (for frequency scoring)
    freq: dict[str, int] = {}
    for e in entries:
        name = e.get("object", "").lower()
        freq[name] = freq.get(name, 0) + 1

    def score(entry: dict[str, Any]) -> float:
        try:
            obs = Observation(
                object=entry["object"],
                color=entry.get("color", "unknown"),
                position=entry["position"],
                location=entry.get("location", "unknown"),
                timestamp=datetime.fromisoformat(entry["timestamp"]),
                confidence=entry.get("confidence"),
            )
            return importance_score(obs, freq.get(obs.object, 1), pinned)
        except Exception:
            return 0.0

    # Sort by score ascending — lowest importance first for eviction
    sorted_entries = sorted(entries, key=score)
    # Keep the highest-importance max_entries
    return sorted(sorted_entries[-max_entries:], key=lambda e: e.get("timestamp", ""))
