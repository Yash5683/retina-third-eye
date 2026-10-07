# Retina Memory

AI-powered assistive app for blind and visually impaired users. Passively scans the environment, remembers object locations, and helps users find items through voice queries and haptic guidance.

## Quick Start

### Backend
```bash
cd retina-memory/backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY if using real Gemini API
uvicorn main:app --reload
```

### Frontend
```bash
cd retina-memory/frontend
npm install
npm run dev
```

### Demo Mode
Open http://localhost:5173?demo=true to run without a real camera or API key.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| VISION_PROVIDER | dummy | `gemini` or `dummy` |
| GEMINI_API_KEY | (empty) | Required when VISION_PROVIDER=gemini |
| MAX_ENTRIES | 100 | Circular buffer size |
