# Facts of the Union - Real-Time SOTU Fact Checker

## Architecture

### Backend (FastAPI + LangGraph)
- **File**: `backend/main.py`
- **WebSocket**: `/ws` - Real-time claim streaming
- **REST API**: `/api/claims`, `/api/stats`
- **Auth**: GitHub OAuth with JWT

### Frontend (React + Vite)
- Real-time WebSocket connection to backend
- Animated claim feed with framer-motion
- Scoreboard with live stats
- Protected admin panel with GitHub OAuth

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

## GitHub OAuth Setup (Required for Admin Access)

1. Go to https://github.com/settings/applications/new
2. Create a new OAuth App:
   - **Application name**: Facts of the Union Admin
   - **Homepage URL**: `http://localhost:8000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:8000/api/auth/github/callback`
3. Copy the Client ID and Client Secret
4. Add authorized GitHub usernames in `backend/main.py`:
   ```python
   AUTHORIZED_USERS = {
       "ctsmith5",      # Colin
       "fredricks5",    # You
       # Add more here
   }
   ```
5. Set environment variables:
   ```bash
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   JWT_SECRET=your_random_secret_key
   APP_URL=http://localhost:8000
   ```

## Deployment

### Railway.app (Recommended)
1. Push to GitHub
2. Connect Railway to repo
3. Set environment variables:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `JWT_SECRET` (generate with `openssl rand -hex 32`)
   - `APP_URL` (your Railway URL)
   - `PERPLEXITY_API_KEY` (optional, for AI research)
   - `GEMINI_API_KEY` (optional, for AI classification)

4. Update GitHub OAuth callback URL to your Railway URL:
   - `https://your-app.railway.app/api/auth/github/callback`

### Environment Variables
```bash
# Required
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
JWT_SECRET=xxx
APP_URL=https://your-domain.com

# Optional (for AI features)
PERPLEXITY_API_KEY=xxx
GEMINI_API_KEY=xxx
DEEPGRAM_API_KEY=xxx

# Frontend
VITE_WS_URL=wss://your-domain.com/ws
VITE_API_URL=https://your-domain.com
```

## The Yellow Zone Prompt

```
You are the 'Linguistic Bridge' for the State of the Union. Your goal is not to 'catch' the President, but to 'translate' his agenda into factual context.

If a claim is hyperbolic (e.g., 'The best ever'), find the closest supporting metric and label it YELLOW (Clarification Needed).

Provide a 'Neutral Rephrase' that a person from any political party would accept as a factual description of the underlying event.

Avoid 'Gotcha' fact-checking. Prioritize explaining what he is talking about over calling him a liar.
```

## Admin Access

The admin panel is protected by GitHub OAuth:
- Navigate to `/admin`
- Click "Continue with GitHub"
- Only authorized users (defined in `AUTHORIZED_USERS`) can access
- JWT tokens expire after 24 hours

## API Endpoints

### Public
- `GET /api/claims` - List all fact checks
- `GET /api/stats` - Get scoreboard stats
- `WS /ws` - WebSocket for real-time updates

### Protected (Requires Auth)
- `POST /api/test-claim` - Inject a test claim
- `GET /api/auth/me` - Get current user

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a PR

The project is open source and welcomes contributions!
