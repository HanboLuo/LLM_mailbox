from fastapi import FastAPI
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List, Literal, Optional

from agent.llm_agent import run_agent  # DeepSeek if key exists, otherwise mock fallback


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


Role = Literal["user", "assistant", "system"]
Engine = Literal["deepseek", "mock"]

class HistoryTurn(BaseModel):
    role: Role
    content: str

ActionType = Literal["reply", "mark_read", "mark_unread", "create_email", "send_email", "move_email", "clarify"]
MoveDestination = Literal["inbox", "archive", "trash", "spam"]

class AgentAction(BaseModel):
    type: ActionType
    payload: Dict[str, Any] = Field(default_factory=dict)

class AgentLogItem(BaseModel):
    ts: str
    source: Literal["agent", "ui", "system"] = "agent"
    action: str
    email_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)

class AgentRequest(BaseModel):
    email: Dict[str, Any]
    instruction: str
    history: List[HistoryTurn] = Field(default_factory=list)

class AgentResponse(BaseModel):
    actions: List[AgentAction]
    reasoning: List[str] = Field(default_factory=list)
    logs: List[AgentLogItem] = Field(default_factory=list)
    engine: Engine = "mock"
    prompt_record: Optional[Dict[str, Any]] = None


@app.post("/agent/run", response_model=AgentResponse)
def agent_run(req: AgentRequest):
    result = run_agent(
        email=req.email,
        user_instruction=req.instruction,
        history=[t.model_dump() for t in req.history],
    )

    return {
    "actions": result.get("actions", []),
    "reasoning": result.get("reasoning", []),
    "logs": result.get("logs", []),
    "engine": result.get("engine", "mock"),
    "prompt_record": result.get("prompt_record"),
    }

