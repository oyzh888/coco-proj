"""
Coco AI - FastAPI Backend
Proxies chat requests to OpenClaw Gateway + generates outfit images via DALL-E 3.
"""

import os
import re
import json
import base64
import asyncio
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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

OPENCLAW_BASE_URL = f"http://{OPENCLAW_HOST}:{OPENCLAW_PORT}"
CHAT_ENDPOINT = f"{OPENCLAW_BASE_URL}/v1/chat/completions"
DALLE_ENDPOINT = "https://api.openai.com/v1/images/generations"

DEFAULT_MODEL = "openclaw"

# --- App ---
app = FastAPI(title="Coco AI Backend", version="0.2.0")

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
    closet_image_base64: Optional[str] = None


class ChatResponse(BaseModel):
    text: str
    images: list[str] = []


# --- Helpers ---

def build_openai_messages(message: str, image_base64: Optional[str]) -> list:
    if image_base64:
        content = [
            {"type": "text", "text": message},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
        ]
    else:
        content = message
    return [{"role": "user", "content": content}]


def extract_images_from_text(text: str) -> tuple[str, list[str]]:
    pattern = r'!\[.*?\]\(data:image/[^;]+;base64,([^)]+)\)'
    images = re.findall(pattern, text)
    cleaned = re.sub(pattern, '', text).strip()
    return cleaned, images


def build_openclaw_headers() -> dict:
    return {
        "Authorization": f"Bearer {OPENCLAW_TOKEN}",
        "Content-Type": "application/json",
        "x-openclaw-agent-id": OPENCLAW_AGENT_ID,
    }


async def generate_outfit_image(outfit_description: str) -> Optional[str]:
    """Call DALL-E 3 to generate an outfit image. Returns base64 string or None."""
    if not OPENAI_API_KEY:
        return None

    # Extract key outfit items from description for a clean prompt
    prompt = (
        f"Fashion photography, full outfit on a clothing rack or flat lay. "
        f"Style: {outfit_description[:300]}. "
        f"Clean white background, professional fashion editorial photo, high quality."
    )

    payload = {
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "response_format": "b64_json",
        "quality": "standard",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                DALLE_ENDPOINT,
                json=payload,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["b64_json"]
    except Exception as e:
        print(f"DALL-E error: {e}")
        return None


# --- Routes ---

@app.get("/")
async def root():
    return {
        "service": "Coco AI Backend",
        "status": "ok",
        "version": "0.2.0",
        "docs": "/docs",
        "endpoints": ["/api/chat", "/api/outfit", "/api/chat/stream"],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "agent_id": OPENCLAW_AGENT_ID}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """General chat endpoint - proxies to OpenClaw agent."""
    messages = build_openai_messages(req.message, req.image_base64)
    payload = {"model": DEFAULT_MODEL, "messages": messages}

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(CHAT_ENDPOINT, json=payload, headers=build_openclaw_headers())
        response.raise_for_status()
        data = response.json()

    raw_text = data["choices"][0]["message"]["content"]
    clean_text, images = extract_images_from_text(raw_text)
    return ChatResponse(text=clean_text, images=images)


@app.post("/api/outfit", response_model=ChatResponse)
async def outfit(req: OutfitRequest):
    """
    Dedicated outfit recommendation endpoint.
    1. Asks OpenClaw agent for outfit recommendation (text)
    2. Generates outfit image via DALL-E 3
    Returns text description + generated image.
    """
    message = (
        f"You are a professional fashion stylist. Generate a detailed outfit recommendation.\n\n"
        f"User details:\n"
        f"- Location: {req.location or 'Not specified'}\n"
        f"- Mood: {req.mood or 'Casual'}\n"
        f"- Scene/Occasion: {req.scene or 'Daily'}\n\n"
        f"Please recommend 1 complete outfit. Include:\n"
        f"1. Specific clothing items (top, bottom, outerwear if needed, shoes)\n"
        f"2. Colors and style\n"
        f"3. Why it matches the mood and scene\n"
        f"4. 1-2 styling tips\n\n"
        f"Keep your response concise and practical."
    )
    if req.closet_image_base64:
        message += "\n\nThe user has provided a photo of their closet. Please base recommendations on what you see in the image."

    # Step 1: Get text recommendation from OpenClaw
    messages = build_openai_messages(message, req.closet_image_base64)
    payload = {"model": DEFAULT_MODEL, "messages": messages}

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(CHAT_ENDPOINT, json=payload, headers=build_openclaw_headers())
        response.raise_for_status()
        data = response.json()

    raw_text = data["choices"][0]["message"]["content"]
    clean_text, existing_images = extract_images_from_text(raw_text)

    # Step 2: Generate outfit image with DALL-E 3 (parallel concept)
    image_b64 = await generate_outfit_image(clean_text)

    images = existing_images
    if image_b64:
        images = [image_b64] + existing_images

    return ChatResponse(text=clean_text, images=images)


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """Streaming chat via SSE."""
    messages = build_openai_messages(req.message, req.image_base64)
    payload = {"model": DEFAULT_MODEL, "messages": messages, "stream": True}

    async def event_generator():
        accumulated = ""
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", CHAT_ENDPOINT, json=payload, headers=build_openclaw_headers()) as response:
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
                            yield f"data: {json.dumps({'type': 'text', 'content': delta})}\n\n"
                    except (json.JSONDecodeError, KeyError):
                        continue

        _, images = extract_images_from_text(accumulated)
        for img in images:
            yield f"data: {json.dumps({'type': 'image', 'content': img})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
