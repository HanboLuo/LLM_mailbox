from typing import Any, Dict, List, Literal, Optional
from datetime import datetime
import json
import hashlib

PromptRole = Literal[
    "system",
    "user",
    "email_body",
    "history",
    "injected",
    "final",
    "model_output",
]

class PromptRecord:
    """
    A structured record of prompts used in one agent run.
    This is NOT a chat log. It is a prompt provenance log.
    """

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.created_at = datetime.utcnow().isoformat() + "Z"
        self.items: List[Dict[str, Any]] = []

    def add(
        self,
        *,
        role: PromptRole,
        content: str,
        source: str,
        meta: Optional[Dict[str, Any]] = None,
    ):
        self.items.append(
            {
                "ts": datetime.utcnow().isoformat() + "Z",
                "role": role,
                "source": source,   # e.g. "ui", "email", "system", "agent"
                "content": content,
                "meta": meta or {},
                "hash": self._hash(content),
            }
        )

    def export(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "created_at": self.created_at,
            "items": self.items,
        }

    @staticmethod
    def _hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()
