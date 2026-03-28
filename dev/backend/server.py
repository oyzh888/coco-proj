"""
Coco AI - FastAPI Backend
Proxies to OpenClaw Gateway (OpenAI-compatible API).
OpenClaw is multimodal - it accepts images and can return images via its tools.
The outfit endpoint sends a structured multimodal message and returns whatever
OpenClaw responds with (text + any images it generates).
"""

import os
import re
import json
from typing import Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# --- Config ---
OPENCLAW_HOST = os.getenv("OPENCLAW_HOST", "localhost")
OPENCLAW_PORT = os.getenv("OPENCLAW_PORT", "18789")
OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN", "")
OPENCLAW_AGENT_ID = os.getenv("OPENCLAW_AGENT_ID", "master")

OPENCLAW_BASE_URL = f"http://{OPENCLAW_HOST}:{OPENCLAW_PORT}"
CHAT_ENDPOINT = f"{OPENCLAW_BASE_URL}/v1/chat/completions"
DEFAULT_MODEL = "openclaw"

# --- App ---
app = FastAPI(title="Coco AI Backend", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---

class ChatRequest(BaseModel):
    message: str
    image_base64: Optional[str] = None


class OutfitRequest(BaseModel):
    location: str = ""
    mood: str = ""
    scene: str = ""
    closet_image_base64: Optional[str] = None  # base64, no data URI prefix


class ChatResponse(BaseModel):
    text: str
    images: list[str] = []  # base64 strings


# --- Helpers ---

def build_messages(message: str, image_base64: Optional[str]) -> list:
    """Build OpenAI-format messages with optional image."""
    if image_base64:
        content = [
            {"type": "text", "text": message},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
        ]
    else:
        content = message
    return [{"role": "user", "content": content}]


def extract_images(text: str) -> tuple[str, list[str]]:
    """Pull base64 images out of markdown image syntax in response text."""
    pattern = r'!\[.*?\]\(data:image/[^;]+;base64,([^)]+)\)'
    images = re.findall(pattern, text)
    cleaned = re.sub(pattern, '', text).strip()
    return cleaned, images


def openclaw_headers() -> dict:
    return {
        "Authorization": f"Bearer {OPENCLAW_TOKEN}",
        "Content-Type": "application/json",
        "x-openclaw-agent-id": OPENCLAW_AGENT_ID,
    }


async def call_openclaw(message: str, image_base64: Optional[str] = None) -> ChatResponse:
    """Send a message to OpenClaw and return parsed ChatResponse."""
    messages = build_messages(message, image_base64)
    payload = {"model": DEFAULT_MODEL, "messages": messages}

    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(CHAT_ENDPOINT, json=payload, headers=openclaw_headers())
        resp.raise_for_status()
        data = resp.json()

    raw = data["choices"][0]["message"]["content"]
    text, images = extract_images(raw)
    return ChatResponse(text=text, images=images)


# --- Routes ---

@app.get("/")
async def root():
    return {
        "service": "Coco AI Backend",
        "version": "0.3.0",
        "status": "ok",
        "agent": OPENCLAW_AGENT_ID,
        "docs": "/docs",
        "endpoints": ["/api/chat", "/api/outfit", "/api/chat/stream"],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "agent_id": OPENCLAW_AGENT_ID}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """General-purpose chat. Proxies to OpenClaw with optional image input."""
    return await call_openclaw(req.message, req.image_base64)


@app.post("/api/outfit", response_model=ChatResponse)
async def outfit(req: OutfitRequest):
    """
    Outfit recommendation endpoint.
    Sends a structured multimodal request to OpenClaw.
    OpenClaw handles everything: styling advice, image generation via its tools.
    Returns whatever OpenClaw responds with (text + images if any).
    """
    prompt = (
        "You are a professional fashion stylist. The user wants an outfit recommendation.\n\n"
        f"**User details:**\n"
        f"- Location: {req.location or 'Not specified'}\n"
        f"- Mood: {req.mood or 'Casual'}\n"
        f"- Scene/Occasion: {req.scene or 'Daily'}\n\n"
        "Please:\n"
        "1. Recommend 1 complete outfit (top, bottom, shoes, optional accessories)\n"
        "2. Explain why it fits the mood and scene\n"
        "3. Give 1-2 styling tips\n"
        "4. If you can generate or find an outfit image, please include it\n\n"
        "Keep the response practical and specific."
    )

    if req.closet_image_base64:
        prompt += "\n\nThe user has uploaded a photo of their closet. Please base recommendations on what you can see in the image."

    return await call_openclaw(prompt, req.closet_image_base64)


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """Streaming chat via SSE."""
    messages = build_messages(req.message, req.image_base64)
    payload = {"model": DEFAULT_MODEL, "messages": messages, "stream": True}

    async def generate():
        accumulated = ""
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST", CHAT_ENDPOINT, json=payload, headers=openclaw_headers()
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            accumulated += delta
                            yield f"data: {json.dumps({'type': 'text', 'content': delta})}\n\n"
                    except (json.JSONDecodeError, KeyError):
                        continue

        _, images = extract_images(accumulated)
        for img in images:
            yield f"data: {json.dumps({'type': 'image', 'content': img})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
