from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List, Optional

from agent.llm_agent import run_agent_llm


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AgentRequest(BaseModel):
    email: Dict[str, Any]
    messages: List[ChatMessage]  # multi-turn chat history


@app.post("/agent/reply")
def agent_reply(req: AgentRequest):
    """
    Returns:
      {
        "actions": [{ "type": "...", ... }],
        "reasoning": ["...", ...],
        "assistant_message": "..."   # optional, for chat display
      }
    """
    result = run_agent_llm(email=req.email, messages=[m.model_dump() for m in req.messages])
    return result
