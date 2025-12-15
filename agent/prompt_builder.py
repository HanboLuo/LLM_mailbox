from typing import Any, Dict, List
import uuid

from agent.prompt_registry import PromptRecord


AGENT_PROTOCOL_V14 = """
You must decide one or more actions from the following list.

Allowed actions (EXACT types):
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
  payload: { "email_id": string, "destination": "inbox" | "archive" | "trash" | "spam" }
- "move to inbox" or "restore" means move_email with destination="inbox"

- clarify
  payload: { "question": string }

Intent mapping rules:
- If the user says "delete", you MUST use move_email with destination="trash".
- If the user says "archive", you MUST use move_email with destination="archive".
- If the user says "spam" / "mark as spam", you MUST use move_email with destination="spam".

Hard constraints:
- Always return JSON only (no Markdown, no prose outside JSON).
- You MUST include an "actions" array field in the JSON output (even if empty is NOT allowed).
- If user intent implies an operation (delete/archive/spam/reply/create/send/mark_read),
  you MUST produce at least one executable action.
- Reasoning without actions is INVALID output.
- If and only if required information is missing, use clarify.

Return JSON in this exact schema:
{
  "actions": [
    { "type": "move_email", "payload": { "email_id": "...", "destination": "trash" } }
  ],
  "reasoning": ["...","..."],
  "logs": [
    { "ts": "ISO-8601", "source": "agent", "action": "decide_action", "email_id": "...", "details": {} }
  ]
}
""".strip()


def build_agent_prompt(
    *,
    email: Dict[str, Any],
    user_instruction: str,
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Build final LLM prompt and record prompt provenance.
    This function is the ONLY entry point for prompt construction.
    """
    run_id = str(uuid.uuid4())
    record = PromptRecord(run_id=run_id)

    system_prompt = (
        "You are an email assistant operating under a strict action protocol.\n"
        "You MUST output valid JSON only.\n"
        "You MUST include an 'actions' field.\n"
        "If the user intent implies an operation (delete, archive, spam, reply, create, send, mark read), "
        "you MUST produce at least one executable action.\n"
        "Natural language reasoning alone is NOT sufficient.\n"
        "If and only if required information is missing, use the 'clarify' action.\n"
        "Do NOT explain actions in prose without emitting them in JSON.\n"
    )

    record.add(role="system", source="agent", content=system_prompt)

    email_body = email.get("body", "")

    # Keep role consistent with PromptRole ("email_body")
    record.add(
        role="email_body",
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
Email context:
- id: {email.get("id")}
- from: {email.get("from")}
- to: {email.get("to", "")}
- subject: {email.get("subject")}
- folder: {email.get("folder")}
- unread: {email.get("unread")}

Email body:
{email_body}

User instruction:
{user_instruction}

Agent protocol:
{AGENT_PROTOCOL_V14}

Now produce the JSON output strictly following the protocol.
""".strip()

    record.add(role="final", source="agent", content=final_prompt)

    return {
        "run_id": run_id,
        "system_prompt": system_prompt,
        "final_prompt": final_prompt,
        "prompt_record": record,
    }
