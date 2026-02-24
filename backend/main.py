from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from typing import Dict, List, Optional
from datetime import datetime
import os

app = FastAPI(title="Facts of the Union - Intelligence Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state - shared across all clients
class ClaimState:
    def __init__(self):
        self.claims: List[Dict] = []
        self.current_transcript: str = ""
        self.stats = {"correct": 0, "clarified": 0, "falsehoods": 0}
        self.clients: List[WebSocket] = []

state = ClaimState()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.clients.append(websocket)
    
    # Send current state to new client
    await websocket.send_json({
        "type": "init",
        "claims": state.claims,
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
                
                # Trigger async analysis
                asyncio.create_task(analyze_claim(claim["id"]))
                
    except Exception as e:
        print(f"Client disconnected: {e}")
    finally:
        state.clients.remove(websocket)

async def broadcast(message: Dict):
    """Broadcast to all connected clients"""
    disconnected = []
    for client in state.clients:
        try:
            await client.send_json(message)
        except:
            disconnected.append(client)
    
    # Clean up disconnected clients
    for client in disconnected:
        state.clients.remove(client)

async def analyze_claim(claim_id: str):
    """LangGraph-style analysis pipeline"""
    claim = next((c for c in state.claims if c["id"] == claim_id), None)
    if not claim:
        return
    
    # Stage 1: Decomposition (is this verifiable?)
    await asyncio.sleep(0.5)  # Simulate processing
    await broadcast({
        "type": "claim_update",
        "claim_id": claim_id,
        "update": {"stage": "researching"}
    })
    
    # Stage 2: Research via Perplexity API
    await asyncio.sleep(1.5)  # Simulate Perplexity call
    
    # Stage 3: Yellow Zone Classification
    # This is where the magic happens
    result = classify_claim(claim["statement"])
    
    claim.update(result)
    
    # Update stats
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
    # Simplified version - in production this calls Gemini + Perplexity
    
    statement_lower = statement.lower()
    
    # Mock classification logic
    if any(word in statement_lower for word in ["best", "greatest", "huge", "tremendous"]):
        return {
            "status": "yellow",
            "explanation": "This is a stylistic exaggeration of measurable improvements.",
            "neutral_rephrase": "Significant progress has been made in this area.",
            "sources": ["Bureau of Labor Statistics", "Census Bureau"]
        }
    elif any(word in statement_lower for word in ["9%", "15 million", "created"]):
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

@app.get("/api/stats")
async def get_stats():
    return state.stats

@app.get("/api/claims")
async def get_claims():
    return state.claims

@app.post("/api/test-claim")
async def test_claim(statement: str, speaker: str = "President"):
    """Test endpoint for manual claim injection"""
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
