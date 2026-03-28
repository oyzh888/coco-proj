"""
Coco AI - FastAPI Backend
Proxies chat requests to OpenClaw Gateway's OpenAI-compatible API.
"""

import os
import re
import json
import asyncio
from typing import Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Config ---
OPENCLAW_HOST = os.getenv("OPENCLAW_HOST", "localhost")
OPENCLAW_PORT = os.getenv("OPENCLAW_PORT", "18789")
OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN", "")
OPENCLAW_AGENT_ID = os.getenv("OPENCLAW_AGENT_ID", "steve-personal")

OPENCLAW_BASE_URL = f"http://{OPENCLAW_HOST}:{OPENCLAW_PORT}"
CHAT_ENDPOINT = f"{OPENCLAW_BASE_URL}/v1/chat/completions"

# Default model — can be overridden per request
DEFAULT_MODEL = "claude-3-5-sonnet-20241022"

# --- App ---
app = FastAPI(title="Coco AI Backend", version="0.1.0")

# Allow all origins for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request / Response Models ---

class ChatRequest(BaseModel):
    message: str
    image_base64: Optional[str] = None  # base64-encoded image (no data URI prefix)


class ChatResponse(BaseModel):
    text: str
    images: list[str] = []  # list of base64 strings extracted from response


# --- Helpers ---

def build_openai_messages(message: str, image_base64: Optional[str]) -> list:
    """Convert a user message + optional image into OpenAI message format."""
    if image_base64:
        # Build multimodal content
        content = [
            {"type": "text", "text": message},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}"
                },
            },
        ]
    else:
        content = message

    return [{"role": "user", "content": content}]


def extract_images_from_text(text: str) -> tuple[str, list[str]]:
    """
    Extract inline base64 images from markdown-style image references.
    Pattern: ![alt](data:image/<type>;base64,<data>)
    Returns (cleaned_text, list_of_base64_strings).
    """
    pattern = r'!\[.*?\]\(data:image/[^;]+;base64,([^)]+)\)'
    images = re.findall(pattern, text)
    # Remove the inline image markdown from text so UI doesn't double-render
    cleaned = re.sub(pattern, '', text).strip()
    return cleaned, images


def build_headers() -> dict:
    """Build request headers for OpenClaw Gateway."""
    return {
        "Authorization": f"Bearer {OPENCLAW_TOKEN}",
        "Content-Type": "application/json",
        "x-openclaw-agent-id": OPENCLAW_AGENT_ID,
    }


# --- Routes ---

@app.get("/")
async def root():
    """Root - redirect to docs."""
    return {"service": "Coco AI Backend", "status": "ok", "docs": "/docs", "health": "/health", "endpoints": ["/api/chat", "/api/chat/stream"]}

@app.get("/health")
async def health():
    """Simple health check."""
    return {"status": "ok", "agent_id": OPENCLAW_AGENT_ID}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Send a message (+ optional image) to OpenClaw and return the response.
    Extracts any base64 images from the response text into a separate array.
    """
    messages = build_openai_messages(req.message, req.image_base64)
    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            CHAT_ENDPOINT,
            json=payload,
            headers=build_headers(),
        )
        response.raise_for_status()
        data = response.json()

    # Extract text from the response
    raw_text = data["choices"][0]["message"]["content"]

    # Pull out any embedded base64 images
    clean_text, images = extract_images_from_text(raw_text)

    return ChatResponse(text=clean_text, images=images)


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    Streaming version of /api/chat using Server-Sent Events (SSE).
    Each SSE event is a JSON object with { type, content } where type is
    'text' or 'done'.
    """
    messages = build_openai_messages(req.message, req.image_base64)
    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "stream": True,
    }

    async def event_generator():
        accumulated = ""
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                CHAT_ENDPOINT,
                json=payload,
                headers=build_headers(),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[len("data:"):].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            accumulated += delta
                            event = json.dumps({"type": "text", "content": delta})
                            yield f"data: {event}\n\n"
                    except (json.JSONDecodeError, KeyError):
                        continue

        # After streaming, extract images from accumulated text
        _, images = extract_images_from_text(accumulated)
        if images:
            for img in images:
                event = json.dumps({"type": "image", "content": img})
                yield f"data: {event}\n\n"

        # Signal completion
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
