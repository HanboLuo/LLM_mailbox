import json
import os
from typing import Any, Dict, List, Optional

import requests

from agent.mock_agent import run_agent as run_mock_agent


DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
print("Using model:",DEEPSEEK_MODEL)

def _safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    """
    Try to parse JSON. If model returns extra text, attempt to extract the first {...} block.
    """
    try:
        return json.loads(text)
    except Exception:
        pass

    # try to extract substring between first { and last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        try:
            return json.loads(candidate)
        except Exception:
            return None
    return None


def _normalize_result(result: Dict[str, Any], email: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize to v1.2 protocol:
    {
      actions: [{type, payload}, ...],
      reasoning: [..]
    }
    """
    reasoning = result.get("reasoning") or []
    actions = result.get("actions") or []

    # Back-compat: if returned single {action, reply/...}
    if not actions and "action" in result:
        single = result["action"]
        payload = {}
        if single == "reply":
            payload = {"draft": result.get("reply") or result.get("content") or ""}
        actions = [{"type": single, "payload": payload}]

    # Ensure types and required payload fields
    normalized: List[Dict[str, Any]] = []
    email_id = email.get("id")

    for a in actions:
        t = a.get("type")
        p = a.get("payload") or {}

        if t == "reply":
            # draft text
            draft = p.get("draft") or p.get("body") or p.get("content") or ""
            normalized.append({"type": "reply", "payload": {"draft": draft}})

        elif t == "mark_read":
            normalized.append({"type": "mark_read", "payload": {"email_id": email_id}})

        elif t == "delete_email":
            # default delete current email
            normalized.append({"type": "delete_email", "payload": {"email_id": p.get("email_id") or email_id}})

        elif t == "create_email":
            # create draft email
            normalized.append(
                {
                    "type": "create_email",
                    "payload": {
                        "to": p.get("to", ""),
                        "subject": p.get("subject", ""),
                        "body": p.get("body", ""),
                    },
                }
            )

        elif t == "clarify":
            normalized.append({"type": "clarify", "payload": {"question": p.get("question", "Could you clarify?")}})

    # If model produced nothing, clarify
    if not normalized:
        normalized = [{"type": "clarify", "payload": {"question": "I’m not sure what you want me to do. Could you clarify?"}}]

    return {"actions": normalized, "reasoning": reasoning}


def run_agent(email: Dict[str, Any], user_instruction: str, history: List[Dict[str, str]] | None = None) -> Dict[str, Any]:
    """
    v1.2 agent:
    - If DEEPSEEK_API_KEY exists: call DeepSeek
    - else: fallback to mock agent
    """
    history = history or []

    # Always include minimal reasoning steps locally
    base_reasoning: List[str] = []
    if email.get("unread"):
        base_reasoning.append("Email is unread")
    base_reasoning.append(f"User instruction: {user_instruction}")

    if not DEEPSEEK_API_KEY:
        mock = run_mock_agent(email=email, user_instruction=user_instruction, history=history)
        # merge reasoning
        merged = {"actions": mock.get("actions", []), "reasoning": base_reasoning + (mock.get("reasoning") or [])}
        return _normalize_result(merged, email)

    system = (
        "You are an email assistant. "
        "You MUST output JSON only. "
        "You can decide multiple actions. "
        "Be concise and professional."
    )

    # We feed history for multi-turn
    messages = [{"role": "system", "content": system}]

    # Past turns
    for t in history:
        r = t.get("role")
        c = t.get("content")
        if r in ("user", "assistant", "system") and isinstance(c, str):
            messages.append({"role": r, "content": c})

    prompt = f"""
Email context:
- id: {email.get("id")}
- from: {email.get("from")}
- to: {email.get("to", "")}
- subject: {email.get("subject")}
- folder: {email.get("folder")}
- unread: {email.get("unread")}
- body:
{email.get("body")}

User instruction:
{user_instruction}

Decide one or more actions from:
- reply (payload: {{ "draft": "..." }})
- mark_read (payload: {{ "email_id": "{email.get("id")}" }})
- create_email (payload: {{ "to": "...", "subject": "...", "body": "..." }})  # create a DRAFT
- delete_email (payload: {{ "email_id": "{email.get("id")}" }})              # move to trash
- clarify (payload: {{ "question": "..." }})

Rules:
- If user asks to write a new email to someone, use create_email.
- If user asks to remove/discard/delete, use delete_email.
- If user asks to reply to this email, use reply.
- If user indicates they’ve read it or wants to mark it, use mark_read.
- If missing critical info (recipient, time, etc.), use clarify.
- You MAY include multiple actions (e.g., reply + mark_read).
- Always include reasoning as a list of bullet-like strings.

Return JSON ONLY in this exact format:
{{
  "actions": [
    {{ "type": "...", "payload": {{ ... }} }}
  ],
  "reasoning": ["...", "..."]
}}
""".strip()

    messages.append({"role": "user", "content": prompt})

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.3,
    }

    try:
        print("Calling DeepSeek API...")
        resp = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=60)
        print("DeepSeek API status:", resp.status_code)
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        parsed = _safe_json_extract(text)

        if not parsed:
            # fallback to clarify
            result = {
                "actions": [{"type": "clarify", "payload": {"question": "I couldn’t parse the model output. Could you rephrase?"}}],
                "reasoning": base_reasoning + ["Model output was not valid JSON."],
            }
            return _normalize_result(result, email)

        # merge base reasoning + model reasoning
        merged_reasoning = base_reasoning + (parsed.get("reasoning") or [])
        merged = {"actions": parsed.get("actions") or [], "reasoning": merged_reasoning}
        return _normalize_result(merged, email)

    except Exception as e:
        # fallback to mock when API fails
        print("DeepSeek call failed:", repr(e))
        mock = run_mock_agent(email=email, user_instruction=user_instruction, history=history)
        merged = {"actions": mock.get("actions", []), "reasoning": base_reasoning + ["DeepSeek call failed; used mock fallback."] + (mock.get("reasoning") or [])}
        return _normalize_result(merged, email)
