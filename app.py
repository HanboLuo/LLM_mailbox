from fastapi import FastAPI
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List, Literal, Optional

from agent.llm_agent import run_agent  # 使用 DeepSeek（有 key）或 fallback


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


# ---------- Agent protocol (v1.2) ----------

Role = Literal["user", "assistant", "system"]

class HistoryTurn(BaseModel):
    role: Role
    content: str

ActionType = Literal["reply", "mark_read", "create_email", "delete_email", "clarify"]

class AgentAction(BaseModel):
    type: ActionType
    payload: Dict[str, Any] = Field(default_factory=dict)

class AgentRequest(BaseModel):
    email: Dict[str, Any]
    instruction: str
    history: List[HistoryTurn] = Field(default_factory=list)

class AgentResponse(BaseModel):
    actions: List[AgentAction]
    reasoning: List[str] = Field(default_factory=list)


@app.post("/agent/reply", response_model=AgentResponse)
def agent_reply(req: AgentRequest):
    result = run_agent(
        email=req.email,
        user_instruction=req.instruction,
        history=[t.model_dump() for t in req.history],
    )
    # 确保字段存在
    return {
        "actions": result.get("actions", []),
        "reasoning": result.get("reasoning", []),
    }
