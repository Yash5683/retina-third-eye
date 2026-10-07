# Retina Memory - storage abstraction
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from models import Observation


class MemoryStore(ABC):
    """Abstract base class for the Retina Memory storage layer."""

    @abstractmethod
    def write_observations(self, observations: list[Observation]) -> None:
        """Persist a list of observations to the store."""

    @abstractmethod
    def query_observations(self, object_name: str) -> Optional[Observation]:
        """Return the most recent observation matching object_name (case-insensitive)."""

    @abstractmethod
    def clear_all(self) -> None:
        """Delete all stored observations."""

    @abstractmethod
    def get_recent(self, limit: int = 20) -> list[Observation]:
        """Return the last `limit` observations, most recent last."""

    @abstractmethod
    def get_all(self) -> list[Observation]:
        """Return all stored observations."""
