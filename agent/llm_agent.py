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
    """
    Extract JSON from model output safely.
    """
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
    """
    email_id = email.get("id")

    actions = raw.get("actions") or []
    reasoning = raw.get("reasoning") or []
    logs = raw.get("logs") or []

    normalized_actions: List[Dict[str, Any]] = []

    for a in actions:
        t = a.get("type")
        p = a.get("payload") or {}

        if t == "reply":
            normalized_actions.append({
                "type": "reply",
                "payload": {"draft": p.get("draft", "")},
            })

        elif t == "mark_read":
            normalized_actions.append({
                "type": "mark_read",
                "payload": {"email_id": p.get("email_id") or email_id},
            })

        elif t == "create_email":
            normalized_actions.append({
                "type": "create_email",
                "payload": {
                    "to": p.get("to", ""),
                    "subject": p.get("subject", ""),
                    "body": p.get("body", ""),
                },
            })

        elif t == "send_email":
            normalized_actions.append({
                "type": "send_email",
                "payload": {"email_id": p.get("email_id") or email_id},
            })

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

        elif t == "clarify":
            normalized_actions.append({
                "type": "clarify",
                "payload": {"question": p.get("question", "Could you clarify?")},
            })

    if not normalized_actions:
        normalized_actions = [{
            "type": "clarify",
            "payload": {"question": "I am not sure what to do. Could you clarify?"},
        }]
        reasoning.append("No valid actions produced. Fallback to clarify.")

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
    """
    v1.4 Agent:
    - PromptBuilder is the ONLY prompt source
    - PromptRecord is always returned
    """
    history = history or []

    # ---------- Build prompt (唯一入口) ----------
    built = build_agent_prompt(
        email=email,
        user_instruction=user_instruction,
        history=history,
    )

    system_prompt = built["system_prompt"]
    final_prompt = built["final_prompt"]
    prompt_record = built["prompt_record"].export()

    # ---------- No LLM key: fallback ----------
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

    # ---------- Call DeepSeek ----------
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
            return _normalize_v14(
                raw={
                    "actions": [{
                        "type": "clarify",
                        "payload": {"question": "Model output could not be parsed."},
                    }],
                    "reasoning": ["Model output was not valid JSON."],
                    "logs": [{
                        "ts": _ts(),
                        "source": "system",
                        "action": "parse_failed",
                        "email_id": email.get("id"),
                        "details": {"raw": text[:1000]},
                    }],
                },
                email=email,
                engine="deepseek",
                prompt_record=prompt_record,
            )

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
