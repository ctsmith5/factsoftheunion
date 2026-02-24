# Facts of the Union - Real-Time SOTU Fact Checker

## Architecture

### Backend (FastAPI + LangGraph)
- **File**: `backend/main.py`
- **WebSocket**: `/ws` - Real-time claim streaming
- **REST API**: `/api/claims`, `/api/stats`

### Frontend (React + Vite)
- Real-time WebSocket connection to backend
- Animated claim feed with framer-motion
- Scoreboard with live stats

### The Yellow Zone System
Claims are classified into:
- **GREEN** (✅ True): Verifiably accurate
- **YELLOW** (⚠️ Clarified): Stylistic exaggeration of real facts
- **RED** (❌ False): Factually incorrect

## Quick Start

```bash
# Install frontend dependencies
npm install

# Run frontend dev server
npm run dev

# In another terminal, run backend
cd backend
pip install -r requirements.txt
python main.py
```

## Deployment

### Railway.app (Recommended)
1. Push to GitHub
2. Connect Railway to repo
3. Set environment variables:
   - `PERPLEXITY_API_KEY`
   - `GEMINI_API_KEY`
   - `DEEPGRAM_API_KEY`

### Environment Variables
```bash
VITE_WS_URL=ws://localhost:8000/ws
VITE_API_URL=http://localhost:8000
```

## The Yellow Zone Prompt

```
You are the 'Linguistic Bridge' for the State of the Union. Your goal is not to 'catch' the President, but to 'translate' his agenda into factual context.

If a claim is hyperbolic (e.g., 'The best ever'), find the closest supporting metric and label it YELLOW (Clarification Needed).

Provide a 'Neutral Rephrase' that a person from any political party would accept as a factual description of the underlying event.

Avoid 'Gotcha' fact-checking. Prioritize explaining what he is talking about over calling him a liar.
```
