# Retina Memory - JSON circular buffer memory store
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from db import MemoryStore
from models import Observation

_DEFAULT_MAX_ENTRIES = int(os.getenv("MAX_ENTRIES", "100"))
_DEFAULT_MEMORY_PATH = Path(__file__).parent / "memory.json"


class JSONMemoryStore(MemoryStore):
    """Persistent memory store backed by a JSON file with circular buffer."""

    def __init__(
        self,
        path: Optional[Path] = None,
        max_entries: int = _DEFAULT_MAX_ENTRIES,
    ) -> None:
        self._path = Path(path) if path else _DEFAULT_MEMORY_PATH
        self._max_entries = max_entries
        self._ensure_file()

    def write_observations(self, observations: list[Observation]) -> None:
        if not observations:
            return
        data = self._load()
        entries: list[dict[str, Any]] = data.get("entries", [])
        for obs in observations:
            entries.append(self._obs_to_dict(obs))
        if len(entries) > self._max_entries:
            from memory_priority import prioritized_eviction
            entries = prioritized_eviction(entries, self._max_entries)
        data["entries"] = entries
        self._save(data)

    def query_observations(self, object_name: str) -> Optional[Observation]:
        target = object_name.strip().lower()
        data = self._load()
        entries = data.get("entries", [])
        for entry in reversed(entries):
            if entry.get("object", "").lower() == target:
                return self._dict_to_obs(entry)
        return None

    def clear_all(self) -> None:
        self._save({"version": 1, "entries": []})

    def get_recent(self, limit: int = 20) -> list[Observation]:
        data = self._load()
        entries = data.get("entries", [])
        return [self._dict_to_obs(e) for e in entries[-limit:]]

    def get_all(self) -> list[Observation]:
        data = self._load()
        return [self._dict_to_obs(e) for e in data.get("entries", [])]

    def _ensure_file(self) -> None:
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._save({"version": 1, "entries": []})

    def _load(self) -> dict[str, Any]:
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {"version": 1, "entries": []}

    def _save(self, data: dict[str, Any]) -> None:
        dir_ = self._path.parent
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=dir_, delete=False, suffix=".tmp"
        ) as tmp:
            json.dump(data, tmp, ensure_ascii=False, indent=2, default=str)
            tmp_path = tmp.name
        os.replace(tmp_path, self._path)

    @staticmethod
    def _obs_to_dict(obs: Observation) -> dict[str, Any]:
        return {
            "object": obs.object,
            "color": obs.color,
            "position": obs.position,
            "location": obs.location,
            "timestamp": obs.timestamp.astimezone(timezone.utc).isoformat(),
            "confidence": obs.confidence,
        }

    @staticmethod
    def _dict_to_obs(entry: dict[str, Any]) -> Observation:
        return Observation(
            object=entry["object"],
            color=entry.get("color", "unknown"),
            position=entry["position"],
            location=entry.get("location", "unknown location"),
            timestamp=datetime.fromisoformat(entry["timestamp"]),
            confidence=entry.get("confidence"),
        )
