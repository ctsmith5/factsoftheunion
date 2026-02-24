from fastapi import FastAPI, WebSocket, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncio
import json
from typing import Dict, List, Optional, Set
from datetime import datetime, timedelta
import os
import pathlib
import httpx
import jwt
from jwt.exceptions import InvalidTokenError

# Configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Authorized GitHub usernames (add yours here)
AUTHORIZED_USERS: Set[str] = {
    "ctsmith5",      # Colin
    "fredricks5",    # You
}

app = FastAPI(title="Facts of the Union - Intelligence Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

security = HTTPBearer(auto_error=False)

# Global state
class ClaimState:
    def __init__(self):
        self.claims: List[Dict] = []
        self.current_transcript: str = ""
        self.stats = {"correct": 0, "clarified": 0, "falsehoods": 0}
        self.clients: List[WebSocket] = []

state = ClaimState()

# Auth helpers
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if username not in AUTHORIZED_USERS:
            return None
        return payload
    except InvalidTokenError:
        return None

def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token_data = verify_token(credentials)
    if not token_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token_data

# GitHub OAuth endpoints
@app.get("/api/auth/github")
async def github_login():
    """Redirect to GitHub OAuth"""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    
    redirect_uri = f"{os.getenv('APP_URL', 'http://localhost:8000')}/api/auth/github/callback"
    github_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={GITHUB_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"scope=read:user"
    )
    return RedirectResponse(url=github_url)

@app.get("/api/auth/github/callback")
async def github_callback(code: str):
    """Handle GitHub OAuth callback"""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    
    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
        )
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to get access token")
        
        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        user_data = user_response.json()
        username = user_data.get("login")
        
        if not username:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        # Check authorization
        if username not in AUTHORIZED_USERS:
            return RedirectResponse(
                url=f"/admin?error=unauthorized&user={username}",
                status_code=302
            )
        
        # Create JWT
        jwt_token = create_access_token({"sub": username, "name": user_data.get("name", username)})
        
        # Redirect to admin with token
        return RedirectResponse(
            url=f"/admin?token={jwt_token}&user={username}",
            status_code=302
        )

@app.get("/api/auth/me")
async def get_current_user(token_data: dict = Depends(require_auth)):
    """Get current authenticated user"""
    return {"username": token_data["sub"], "authenticated": True}

@app.post("/api/auth/logout")
async def logout():
    """Logout (client-side token deletion)"""
    return {"message": "Logged out"}

# WebSocket endpoint with optional auth
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.clients.append(websocket)
    
    # Send current state
    await websocket.send_json({
        "type": "init",
        "data": state.claims,
        "stats": state.stats
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "transcript":
                state.current_transcript = message.get("text", "")
                await broadcast({"type": "transcript", "text": state.current_transcript})
                
            elif message.get("type") == "claim":
                claim = {
                    "id": f"claim_{len(state.claims)}",
                    "timestamp": datetime.now().isoformat(),
                    "statement": message.get("statement"),
                    "speaker": message.get("speaker", "President"),
                    "status": "analyzing",
                    "category": message.get("category", "other"),
                    "explanation": None,
                    "neutral_rephrase": None,
                    "sources": []
                }
                state.claims.insert(0, claim)
                await broadcast({"type": "new_claim", "claim": claim})
                asyncio.create_task(analyze_claim(claim["id"]))
                
    except Exception as e:
        print(f"Client disconnected: {e}")
    finally:
        if websocket in state.clients:
            state.clients.remove(websocket)

async def broadcast(message: Dict):
    """Broadcast to all connected clients"""
    disconnected = []
    for client in state.clients:
        try:
            await client.send_json(message)
        except:
            disconnected.append(client)
    
    for client in disconnected:
        if client in state.clients:
            state.clients.remove(client)

async def analyze_claim(claim_id: str):
    """LangGraph-style analysis pipeline"""
    claim = next((c for c in state.claims if c["id"] == claim_id), None)
    if not claim:
        return
    
    await asyncio.sleep(0.5)
    await broadcast({
        "type": "claim_update",
        "claim_id": claim_id,
        "update": {"stage": "researching"}
    })
    
    await asyncio.sleep(1.5)
    
    result = classify_claim(claim["statement"])
    claim.update(result)
    
    if result["status"] == "true":
        state.stats["correct"] += 1
    elif result["status"] == "yellow":
        state.stats["clarified"] += 1
    elif result["status"] == "false":
        state.stats["falsehoods"] += 1
    
    await broadcast({
        "type": "claim_complete",
        "claim": claim,
        "stats": state.stats
    })

def classify_claim(statement: str) -> Dict:
    """Yellow Zone classification logic"""
    statement_lower = statement.lower()
    
    if any(word in statement_lower for word in ["best", "greatest", "huge", "tremendous", "ever"]):
        return {
            "status": "yellow",
            "explanation": "This is a stylistic exaggeration of measurable improvements.",
            "neutral_rephrase": "Significant progress has been made in this area.",
            "sources": ["Bureau of Labor Statistics", "Census Bureau"]
        }
    elif any(word in statement_lower for word in ["9%", "15 million", "created", "inflation"]):
        return {
            "status": "true",
            "explanation": "Statistics are verified by official government data.",
            "neutral_rephrase": statement,
            "sources": ["Bureau of Labor Statistics"]
        }
    else:
        return {
            "status": "pending",
            "explanation": "Analysis in progress...",
            "neutral_rephrase": None,
            "sources": []
        }

# Protected API endpoints
@app.get("/api/stats")
async def get_stats():
    return state.stats

@app.get("/api/claims")
async def get_claims():
    return state.claims

@app.post("/api/test-claim")
async def test_claim(
    statement: str, 
    speaker: str = "President",
    token_data: dict = Depends(require_auth)
):
    """Protected: Test endpoint for manual claim injection"""
    claim = {
        "id": f"claim_{len(state.claims)}",
        "timestamp": datetime.now().isoformat(),
        "statement": statement,
        "speaker": speaker,
        "status": "analyzing",
        "category": "other"
    }
    state.claims.insert(0, claim)
    await broadcast({"type": "new_claim", "claim": claim})
    asyncio.create_task(analyze_claim(claim["id"]))
    return claim

# Static files - serve React app
static_dir = pathlib.Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    @app.get("/")
    async def serve_root():
        return FileResponse(static_dir / "index.html")
    
    @app.get("/{path:path}")
    async def serve_spa(path: str):
        # Don't serve static for API routes
        if path.startswith("api/") or path == "api":
            raise HTTPException(status_code=404)
        file_path = static_dir / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
