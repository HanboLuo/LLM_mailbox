from typing import Any, Dict, List
import re
import uuid

from agent.prompt_registry import PromptRecord


AGENT_PROTOCOL_V14 = """
You may decide one or more actions from the following list.

Actions:
- reply
  payload: { "draft": string }

- mark_read
  payload: { "email_id": string }

- create_email
  payload: { "to": string, "subject": string, "body": string }

- send_email
  payload: { "email_id": string }

- move_email
  payload: { "email_id": string, "destination": "archive" | "trash" | "spam" }

- delete
- archive
- spam

- clarify
  payload: { "question": string }

Rules:
- "delete" means move_email with destination="trash"
- "archive" means move_email with destination="archive"
- "spam" means move_email with destination="spam"
- Always return JSON.
- Always include reasoning.
"""


def build_agent_prompt(
    *,
    email: Dict[str, Any],
    user_instruction: str,
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    run_id = str(uuid.uuid4())
    record = PromptRecord(run_id=run_id)

    system_prompt = (
        "You are an email assistant. "
        "You must output JSON only. "
        "Follow the agent protocol strictly."
    )

    record.add(role="system", source="agent", content=system_prompt)

    email_body = email.get("body", "")

    record.add(
        role="email",
        source="email",
        content=email_body,
        meta={"email_id": email.get("id")},
    )

    record.add(
        role="user",
        source="ui",
        content=user_instruction,
    )

    for turn in history:
        record.add(
            role="history",
            source="history",
            content=f"{turn.get('role')}: {turn.get('content')}",
        )

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
{AGENT_PROTOCOL_V14}
""".strip()

    record.add(role="final", source="agent", content=final_prompt)

    return {
        "run_id": run_id,
        "system_prompt": system_prompt,
        "final_prompt": final_prompt,
        "prompt_record": record,
    }
