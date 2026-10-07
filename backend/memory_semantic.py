# Retina Memory - Semantic Memory Store (ChromaDB)
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from models import Observation

logger = logging.getLogger(__name__)

_CHROMA_PATH = str(Path(__file__).parent / "chroma_db")


def _get_collection():
    """Lazy-load ChromaDB collection. Returns None if ChromaDB is unavailable."""
    try:
        import chromadb
        from chromadb.utils import embedding_functions

        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        client = chromadb.PersistentClient(path=_CHROMA_PATH)
        return client.get_or_create_collection(
            name="observations",
            embedding_function=ef,
        )
    except ImportError:
        logger.warning(
            "chromadb or sentence-transformers not installed. "
            "Semantic search unavailable — falling back to keyword search. "
            "Run: pip install chromadb sentence-transformers"
        )
        return None
    except Exception as exc:
        logger.warning("ChromaDB init failed: %s. Falling back to keyword search.", exc)
        return None


_collection = None
_collection_loaded = False


def _collection_instance():
    global _collection, _collection_loaded
    if not _collection_loaded:
        _collection = _get_collection()
        _collection_loaded = True
    return _collection


def store_observation_semantic(obs: Observation) -> None:
    """Store an observation in ChromaDB for semantic retrieval."""
    col = _collection_instance()
    if col is None:
        return

    # Build a rich text document for embedding
    doc = (
        f"{obs.object} {obs.color} {obs.position} {obs.location} "
        f"{obs.timestamp.strftime('%A %B %d %Y %H:%M')}"
    )
    doc_id = f"{obs.object}_{obs.timestamp.isoformat()}"

    try:
        col.upsert(
            documents=[doc],
            metadatas=[{
                "object": obs.object,
                "color": obs.color,
                "position": obs.position,
                "location": obs.location,
                "timestamp": obs.timestamp.astimezone(timezone.utc).isoformat(),
                "confidence": obs.confidence if obs.confidence is not None else 0.0,
            }],
            ids=[doc_id],
        )
    except Exception as exc:
        logger.warning("Failed to store observation in ChromaDB: %s", exc)


def semantic_search(query: str, n_results: int = 3) -> list[Observation]:
    """
    Search observations by semantic similarity.
    Returns up to n_results observations, most relevant first.
    Falls back to empty list if ChromaDB is unavailable.
    """
    col = _collection_instance()
    if col is None:
        return []

    try:
        results = col.query(query_texts=[query], n_results=n_results)
        metadatas = results.get("metadatas", [[]])[0]
        observations = []
        for m in metadatas:
            try:
                observations.append(Observation(
                    object=m["object"],
                    color=m["color"],
                    position=m["position"],
                    location=m["location"],
                    timestamp=datetime.fromisoformat(m["timestamp"]),
                    confidence=float(m.get("confidence", 0.0)) or None,
                ))
            except Exception as exc:
                logger.debug("Skipping malformed ChromaDB result: %s", exc)
        return observations
    except Exception as exc:
        logger.warning("ChromaDB query failed: %s", exc)
        return []


def is_semantic_available() -> bool:
    return _collection_instance() is not None
