from typing import Any, Dict, List, Optional
import json
import os
import requests
from datetime import datetime

from agent.prompt_builder import build_agent_prompt
from agent.mock_agent import run_agent as run_mock_agent


DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


def _ts() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None

    return None


def _normalize_v14(
    *,
    raw: Dict[str, Any],
    email: Dict[str, Any],
    engine: str,
    prompt_record: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Normalize agent output to v1.4 protocol.
    IMPORTANT: never drop valid move_email / delete / archive actions.
    """
    email_id = email.get("id")

    raw_actions = raw.get("actions") or []

    # Normalize actions to list
    if isinstance(raw_actions, dict):
        actions = [raw_actions]
    elif isinstance(raw_actions, list):
        actions = raw_actions
    else:
        actions = []

    raw_reasoning = raw.get("reasoning") or []

    if isinstance(raw_reasoning, str):
        reasoning = [raw_reasoning]
    elif isinstance(raw_reasoning, list):
        reasoning = raw_reasoning
    else:
        reasoning = []

    logs = list(raw.get("logs") or [])

    normalized_actions: List[Dict[str, Any]] = []

    for a in actions:
        t = (a.get("type") or "").lower()
        p = a.get("payload") or {}

        # ---------- reply ----------
        if t == "reply":
            normalized_actions.append({
                "type": "reply",
                "payload": {"draft": p.get("draft", "")},
            })

        # ---------- mark read ----------
        elif t == "mark_read":
            normalized_actions.append({
                "type": "mark_read",
                "payload": {"email_id": p.get("email_id") or email_id},
            })

        # ---------- create email ----------
        elif t == "create_email":
            normalized_actions.append({
                "type": "create_email",
                "payload": {
                    "to": p.get("to"),
                    "subject": p.get("subject", ""),
                    "body": p.get("body", ""),
                },
            })

        # ---------- send ----------
        elif t == "send_email":
            normalized_actions.append({
                "type": "send_email",
                "payload": {"email_id": p.get("email_id") or email_id},
            })

        # ---------- canonical move ----------
        elif t == "move_email":
            dest = p.get("destination", "archive")
            if dest not in ("archive", "trash", "spam"):
                dest = "archive"
            normalized_actions.append({
                "type": "move_email",
                "payload": {
                    "email_id": p.get("email_id") or email_id,
                    "destination": dest,
                },
            })

        # ---------- aliases ----------
        elif t in ("delete", "delete_email", "remove", "remove_email"):
            normalized_actions.append({
                "type": "move_email",
                "payload": {
                    "email_id": email_id,
                    "destination": "trash",
                },
            })

        elif t in ("archive", "archive_email"):
            normalized_actions.append({
                "type": "move_email",
                "payload": {
                    "email_id": email_id,
                    "destination": "archive",
                },
            })

        elif t in ("spam", "mark_spam", "report_spam"):
            normalized_actions.append({
                "type": "move_email",
                "payload": {
                    "email_id": email_id,
                    "destination": "spam",
                },
            })

        # ---------- clarify ----------
        elif t == "clarify":
            normalized_actions.append({
                "type": "clarify",
                "payload": {"question": p.get("question", "Could you clarify?")},
            })

    # only fallback if there is truly NOTHING actionable
    has_effect = any(
        a["type"] in ("reply", "move_email", "mark_read", "create_email", "send_email")
        for a in normalized_actions
    )

    if not has_effect:
        normalized_actions = [{
            "type": "clarify",
            "payload": {"question": "I am not sure what to do. Could you clarify?"},
        }]
        reasoning.append("No executable actions detected. Fallback to clarify.")

    logs.append({
        "ts": _ts(),
        "source": "system",
        "action": "engine_used",
        "email_id": email_id,
        "details": {
            "engine": engine,
            "model": DEEPSEEK_MODEL if engine == "deepseek" else "mock",
        },
    })

    return {
        "engine": engine,
        "actions": normalized_actions,
        "reasoning": reasoning,
        "logs": logs,
        "prompt_record": prompt_record,
    }


def run_agent(
    *,
    email: Dict[str, Any],
    user_instruction: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    history = history or []

    built = build_agent_prompt(
        email=email,
        user_instruction=user_instruction,
        history=history,
    )

    system_prompt = built["system_prompt"]
    final_prompt = built["final_prompt"]
    prompt_record = built["prompt_record"].export()

    if not DEEPSEEK_API_KEY:
        mock = run_mock_agent(
            email=email,
            user_instruction=user_instruction,
            history=history,
        )
        return _normalize_v14(
            raw=mock,
            email=email,
            engine="mock",
            prompt_record=prompt_record,
        )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": final_prompt},
    ]

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.3,
    }

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            DEEPSEEK_API_URL,
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        text = data["choices"][0]["message"]["content"]
        parsed = _safe_json_extract(text)

        if not parsed:
            parsed = {
                "actions": [{"type": "clarify"}],
                "reasoning": ["Model output was not valid JSON."],
            }

        return _normalize_v14(
            raw=parsed,
            email=email,
            engine="deepseek",
            prompt_record=prompt_record,
        )

    except Exception as e:
        mock = run_mock_agent(
            email=email,
            user_instruction=user_instruction,
            history=history,
        )
        mock.setdefault("logs", []).append({
            "ts": _ts(),
            "source": "system",
            "action": "deepseek_failed",
            "email_id": email.get("id"),
            "details": {"error": repr(e)},
        })
        return _normalize_v14(
            raw=mock,
            email=email,
            engine="mock",
            prompt_record=prompt_record,
        )
