#!/bin/bash
# outfit_swap.sh — Generate outfit swap image using Gemini 3 Pro
# Usage: ./outfit_swap.sh <person_photo> <output_name> "<style_prompt>" [reference_photo]
#
# Examples:
#   ./outfit_swap.sh /path/person.jpg opera-look.png "Change to elegant opera attire"
#   ./outfit_swap.sh /path/person.jpg date-look.png "Casual frat boy date outfit" /path/style-ref.jpg

PERSON_PHOTO="$1"
OUTPUT_NAME="$2"
STYLE_PROMPT="$3"
REFERENCE_PHOTO="$4"

NANO_BANANA="/usr/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py"
OUTPUT_DIR="/app/steve/clawd"

FULL_PROMPT="${STYLE_PROMPT}. Keep the person's face, hair, glasses, body shape, pose, and background EXACTLY the same. Only change the clothing. Realistic photo result."

if [ -n "$REFERENCE_PHOTO" ]; then
    GEMINI_API_KEY="$GEMINI_API_KEY" uv run "$NANO_BANANA" \
        --prompt "$FULL_PROMPT" \
        --filename "$OUTPUT_NAME" \
        -i "$PERSON_PHOTO" \
        -i "$REFERENCE_PHOTO" \
        --resolution 2K
else
    GEMINI_API_KEY="$GEMINI_API_KEY" uv run "$NANO_BANANA" \
        --prompt "$FULL_PROMPT" \
        --filename "$OUTPUT_NAME" \
        -i "$PERSON_PHOTO" \
        --resolution 2K
fi
