# Dev - Development Prototypes

This directory contains development prototypes for the Coco AI project.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│   Frontend  │────▶│   Backend   │────▶│ OpenClaw Gateway │────▶│ AI Agent │
│  React+Vite │     │   FastAPI   │     │  :18789/v1/chat  │     │          │
│  :5173      │◀────│   :8000     │◀────│  /completions    │◀────│          │
└─────────────┘     └─────────────┘     └──────────────────┘     └──────────┘
```

## Setup

### Backend

```bash
cd dev/backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your OpenClaw host and token
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd dev/frontend
npm install
npm run dev
```

### Open

Navigate to http://localhost:5173

## API Overview

- `POST /api/chat` — Send a message (with optional image) and get a response
- `POST /api/chat/stream` — Streaming version via SSE
