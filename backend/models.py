# Retina Memory - models
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, field_validator


class Observation(BaseModel):
    """A single object observation captured by the scanner."""

    object: str
    color: str
    position: Literal["left", "center", "right"]
    location: str
    timestamp: datetime
    confidence: Optional[float] = None
    size: Optional[Literal["small", "medium", "large", "very_large"]] = None

    model_config = {
        "json_encoders": {datetime: lambda v: v.astimezone(timezone.utc).isoformat()}
    }

    @field_validator("object", "color", "location")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip().lower()

    @field_validator("confidence")
    @classmethod
    def confidence_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("confidence must be between 0.0 and 1.0")
        return v


# ---------------------------------------------------------------------------
# API Request / Response schemas
# ---------------------------------------------------------------------------


class CaptureRequest(BaseModel):
    """POST /capture — base64-encoded JPEG image."""
    image: str


class CaptureResponse(BaseModel):
    """Response from POST /capture."""
    observations: list[Observation]
    model_used: str
    processing_time_ms: float


class QueryRequest(BaseModel):
    """POST /query — transcribed user query."""
    query: str
    language: str = "en-IN"  # BCP-47 language code from frontend settings


class QueryResponse(BaseModel):
    """Response from POST /query."""
    intent: Literal["memory_lookup", "live_vision"]
    response_text: str
    observation: Optional[Observation] = None


class DetectRequest(BaseModel):
    """POST /detect — base64-encoded JPEG + target object name."""
    image: str
    target_object: str


class DetectResponse(BaseModel):
    """Response from POST /detect."""
    position: Literal["left", "center", "right", "not_found"]
    confidence: float
    guidance: dict = {}  # {"instruction": str, "vibrate": list[int], "distance": str}
