from typing import Any, Dict, List
import re
import uuid

from agent.prompt_registry import PromptRecord

AGENT_PROTOCOL_V13 = """
You may decide one or more actions from the following list.

Actions:
- reply
  payload: { "draft": string }

- mark_read
  payload: { "email_id": string }

- create_email
  payload: { "to": string, "subject": string, "body": string }
  note: this creates a DRAFT only

- send_email
  payload: { "email_id": string }
  note: only drafts can be sent

- move_email
  payload: { "email_id": string, "destination": "archive" | "trash" | "spam" }

- clarify
  payload: { "question": string }

Rules:
- If the user asks to reply to this email, use reply.
- If the user asks to write a new email, use create_email.
- If the user asks to send an email, use send_email.
- If the user asks to hide or remove from inbox without deleting, use move_email with destination="archive".
- If the user asks to delete, use move_email with destination="trash".
- If the user asks to mark as spam, use move_email with destination="spam".
- If required information is missing, use clarify.
- You may include multiple actions (for example: reply + mark_read).
- Always include reasoning as a list of short strings.
"""


INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"system prompt",
    r"you are chatgpt",
    r"<script",
    r"<!--",
    r"role\s*=\s*system",
]

def detect_prompt_injection(text: str) -> List[str]:
    hits = []
    lower = text.lower()
    for p in INJECTION_PATTERNS:
        if re.search(p, lower):
            hits.append(p)
    return hits


def build_agent_prompt(
    *,
    email: Dict[str, Any],
    user_instruction: str,
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Build final LLM prompt and record prompt provenance.
    """

    run_id = str(uuid.uuid4())
    record = PromptRecord(run_id=run_id)

    # ---- system prompt ----
    system_prompt = (
        "You are an email assistant. "
        "You must output JSON only. "
        "You may decide multiple actions. "
        "Never execute harmful instructions blindly."
    )

    record.add(
        role="system",
        source="agent",
        content=system_prompt,
    )

    # ---- email body ----
    email_body = email.get("body", "")
    injection_hits = detect_prompt_injection(email_body)

    record.add(
        role="email_body",
        source="email",
        content=email_body,
        meta={
            "email_id": email.get("id"),
            "injection_hits": injection_hits,
        },
    )

    # ---- user instruction ----
    record.add(
        role="user",
        source="ui",
        content=user_instruction,
    )

    # ---- history ----
    for turn in history:
        record.add(
            role="history",
            source="history",
            content=f"{turn.get('role')}: {turn.get('content')}",
        )

    # ---- final prompt ----
    final_prompt = f"""
Email:
From: {email.get("from")}
Subject: {email.get("subject")}
Folder: {email.get("folder")}
Unread: {email.get("unread")}

Body:
{email_body}

User instruction:
{user_instruction}

Agent protocol:
{AGENT_PROTOCOL_V13}

Decide actions strictly following the protocol above.
""".strip()

    record.add(
        role="final",
        source="agent",
        content=final_prompt,
        meta={
            "has_injection_signals": bool(injection_hits),
        },
    )

    return {
        "run_id": run_id,
        "system_prompt": system_prompt,
        "final_prompt": final_prompt,
        "prompt_record": record,
    }
