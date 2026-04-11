# Retina Memory - FastAPI application entry point
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env file if present
load_dotenv(Path(__file__).parent / ".env")

from api import router
from memory import JSONMemoryStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Shared memory store instance (initialised on startup)
memory_store: JSONMemoryStore | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise shared resources on startup."""
    global memory_store
    memory_store = JSONMemoryStore()
    logger.info("Memory store initialised at %s", memory_store._path)
    yield
    logger.info("Retina Memory backend shutting down.")


app = FastAPI(
    title="Retina Memory API",
    description="AI-powered assistive memory for blind and visually impaired users.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server and any localhost origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins for local network access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "service": "retina-memory"}


@app.get("/network-info")
async def network_info():
    """Return the machine's local network IP for phone camera QR code."""
    import socket
    try:
        # Connect to an external address to find the outbound interface IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return {"ip": ip, "frontend_url": f"https://{ip}:5173"}
