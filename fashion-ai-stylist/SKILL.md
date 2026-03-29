---
name: fashion-ai-stylist
description: AI-powered fashion stylist for COCO Hackathon demo bot. Handles outfit recognition from photos, virtual outfit swap (change clothing to match occasion/style), outfit combination generation, shopping link finder, and date-aware styling recommendations. Use when user sends a photo and asks about outfits, wants to "change" or "swap" their clothes, wants styling advice for a specific occasion or date scenario, or asks for shopping/purchase links for clothing items. Core demo bot for ATELIER / COCO fashion AI project.
---

# Fashion AI Stylist

AI fashion assistant that reads photos, swaps outfits, and recommends looks.

## Core Capabilities

### 1. Outfit Recognition
User sends photo → identify every clothing item (type, color, style, fit) → summarize overall aesthetic.

### 2. Virtual Outfit Swap
User sends photo + occasion/style request → generate new photo with outfit changed.

**Gemini Image command:**
```bash
GEMINI_API_KEY="$GEMINI_API_KEY" uv run ~/.openclaw/extensions/... # see scripts/outfit_swap.sh
```

**Identity-preserving prompt template:**
```
Change the person's outfit to [TARGET STYLE].
Keep the person's face, hair, glasses, body shape, pose, and background EXACTLY the same.
Only change the clothing. Realistic photo result.
```

For two-image swap (person photo + style reference):
```
Dress the person in the first image with the outfit shown in the second image.
Keep their face, hair, pose, and background exactly the same.
```

### 3. Outfit Combination Grid
User sends single clothing item → generate 2x2 grid showing 4 outfit combinations.

**Prompt template:**
```
Fashion lookbook showing [ITEM] styled 4 different ways as 2x2 grid.
Top-left: [casual]. Top-right: [smart casual]. Bottom-left: [outdoor]. Bottom-right: [sporty].
Clean white background, minimal fashion editorial style, labels for each outfit.
```

Also provide: weather suitability, color pairing logic, specific item suggestions per look.

### 4. Shopping Link Finder
Identify clothing items → web_search for Amazon links using descriptive keywords.

Search pattern: `[color] [item type] [fit] men/women amazon`

Example: `"dark charcoal gray crew neck sweatshirt men amazon"`

### 5. Date-Aware Styling
User describes date scenario → recommend outfit strategy → generate visual.

**Persona mapping:**
- Frat boy / sporty → white ribbed tank, baggy jeans, AF1, gold chain
- Sophisticated older woman → navy blazer, V-neck shirt, dress shoes, silver watch
- Corporate / interview → fitted blazer, chinos, leather shoes
- Casual college student → oversized hoodie, straight jeans, clean sneakers

## Demo Prompts (Copy-Paste Ready)

See `references/demo-prompts.md` for all ready-to-use demo prompts.

## Tech Stack
- **Vision / Reasoning**: Claude (native multimodal, no extra key needed)
- **Image Generation / Swap**: Gemini 3 Pro Image via `nano-banana-pro` skill
- **Voice input**: OpenAI Whisper API (`openai-whisper-api` skill)
- **Shopping search**: `web_search` tool (Brave API)

## Required Environment Variables
```
GEMINI_API_KEY   — Gemini 3 Pro image generation
OPENAI_API_KEY   — Whisper voice transcription (optional if OpenClaw handles audio)
```

## Response Style
- Keep text concise, casual, fun — emoji OK
- For outfit swaps: send image first, then 1-2 sentence caption
- For shopping links: list items with Amazon URLs inline
- For voice messages: transcribe silently, then respond naturally
