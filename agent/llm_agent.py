# agent/llm_agent.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
import json
import os
import requests
from datetime import datetime, timezone

from agent.prompt_builder import build_agent_prompt
from agent.experiment_config import ExperimentConfig
from agent.mock_agent import run_agent as run_mock_agent


DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        chunk = text[start : end + 1]
        try:
            return json.loads(chunk)
        except Exception:
            return None
    return None


def _coerce_logs(raw_logs: Any, *, run_id: str, email_id: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not isinstance(raw_logs, list):
        return out

    for item in raw_logs:
        if not isinstance(item, dict):
            continue
        ts = item.get("ts")
        if not isinstance(ts, str) or "T" not in ts:
            ts = _ts()

        details = item.get("details")
        if details is None:
            details = {}
        if not isinstance(details, dict):
            details = {"value": details}

        details = {**details, "run_id": run_id}

        out.append({
            "ts": ts,
            "source": item.get("source", "agent"),
            "action": item.get("action", "model_log"),
            "email_id": item.get("email_id", email_id),
            "details": details,
        })

    return out


def _normalize_v14(
    *,
    raw: Dict[str, Any],
    email: Dict[str, Any],
    engine: str,
    prompt_record_export: Dict[str, Any],
    run_id: str,
    final_prompt: str,
    config: ExperimentConfig,
) -> Dict[str, Any]:
    email_id = email.get("id")

    raw_actions = raw.get("actions") or []
    if isinstance(raw_actions, dict):
        actions = [raw_actions]
    elif isinstance(raw_actions, list):
        actions = raw_actions
    else:
        actions = []

    raw_reasoning = raw.get("reasoning") or []
    if isinstance(raw_reasoning, str):
        reasoning: List[str] = [raw_reasoning]
    elif isinstance(raw_reasoning, list):
        reasoning = [str(x) for x in raw_reasoning]
    else:
        reasoning = []

    logs: List[Dict[str, Any]] = _coerce_logs(raw.get("logs"), run_id=run_id, email_id=email_id)

    normalized_actions: List[Dict[str, Any]] = []

    for a in actions:
        if not isinstance(a, dict):
            continue
        t = (a.get("type") or "").lower()
        p = a.get("payload") or {}
        if not isinstance(p, dict):
            p = {}

        if t == "reply":
            normalized_actions.append({"type": "reply", "payload": {"draft": p.get("draft", "")}})

        elif t == "mark_read":
            normalized_actions.append({"type": "mark_read", "payload": {"email_id": p.get("email_id") or email_id}})

        elif t == "mark_unread":
            normalized_actions.append({"type": "mark_unread", "payload": {"email_id": p.get("email_id") or email_id}})

        elif t == "create_email":
            normalized_actions.append({
                "type": "create_email",
                "payload": {
                    "to": p.get("to"),
                    "subject": p.get("subject", ""),
                    "body": p.get("body", ""),
                },
            })

        elif t == "send_email":
            normalized_actions.append({"type": "send_email", "payload": {"email_id": p.get("email_id") or email_id}})

        elif t == "move_email":
            dest = p.get("destination", "archive")
            VALID_DESTINATIONS = ("inbox", "archive", "trash", "spam")
            if dest not in VALID_DESTINATIONS:
                dest = "archive"
            normalized_actions.append({"type": "move_email", "payload": {"email_id": p.get("email_id") or email_id, "destination": dest}})

        elif t in ("delete", "delete_email", "remove", "remove_email"):
            normalized_actions.append({"type": "move_email", "payload": {"email_id": email_id, "destination": "trash"}})

        elif t in ("archive", "archive_email"):
            normalized_actions.append({"type": "move_email", "payload": {"email_id": email_id, "destination": "archive"}})

        elif t in ("spam", "mark_spam", "report_spam"):
            normalized_actions.append({"type": "move_email", "payload": {"email_id": email_id, "destination": "spam"}})

        elif t == "clarify":
            normalized_actions.append({"type": "clarify", "payload": {"question": p.get("question", "Could you clarify?")}})

    has_effect = any(
        a["type"] in ("reply", "move_email", "mark_read", "mark_unread", "create_email", "send_email")
        for a in normalized_actions
    )
    if not has_effect:
        normalized_actions = [{"type": "clarify", "payload": {"question": "I am not sure what to do. Could you clarify?"}}]
        reasoning.append("No executable actions detected. Fallback to clarify.")

    # authoritative decide_action (don’t trust model time)
    logs.append({
        "ts": _ts(),
        "source": "agent",
        "action": "decide_action",
        "email_id": email_id,
        "details": {"run_id": run_id, "engine": engine},
    })

    logs.append({
        "ts": _ts(),
        "source": "system",
        "action": "engine_used",
        "email_id": email_id,
        "details": {"engine": engine, "model": DEEPSEEK_MODEL if engine == "deepseek" else "mock", "run_id": run_id},
    })

    logs.append({
        "ts": _ts(),
        "source": "system",
        "action": "final_prompt_used",
        "email_id": email_id,
        "details": {"prompt": final_prompt, "run_id": run_id},
    })

    if config.log_reasoning:
        logs.append({
            "ts": _ts(),
            "source": "system",
            "action": "reasoning_dump",
            "email_id": email_id,
            "details": {"reasoning": reasoning, "run_id": run_id},
        })

    returned_reasoning = [] if config.hide_reasoning else reasoning

    return {
        "engine": engine,
        "run_id": run_id,
        "actions": normalized_actions,
        "reasoning": returned_reasoning,
        "logs": logs,
        "prompt_record": prompt_record_export,  # ✅ export 后再返回
    }


def _call_deepseek(final_prompt: str) -> Dict[str, Any]:
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY is not set.")

    headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [{"role": "user", "content": final_prompt}],
        "temperature": 0.2,
    }

    resp = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()
    data = resp.json()

    content = data["choices"][0]["message"]["content"]
    parsed = _safe_json_extract(content)
    if not parsed:
        return {"actions": [], "reasoning": ["Model returned non-JSON output."], "logs": [], "raw_text": content}
    return parsed


def run_agent(
    *,
    email: Dict[str, Any],
    user_instruction: str,
    history: List[Dict[str, str]] | None = None,
    engine: str = "deepseek",
    config: ExperimentConfig | None = None,
) -> Dict[str, Any]:
    if history is None:
        history = []
    if config is None:
        config = ExperimentConfig.from_env()

    prompt_pack = build_agent_prompt(email=email, user_instruction=user_instruction, history=history, config=config)

    run_id = prompt_pack["run_id"]
    final_prompt = prompt_pack["final_prompt"]
    prompt_record = prompt_pack["prompt_record"]
    prompt_record_export = prompt_record.export()  # ✅ here

    if engine == "mock":
        raw = run_mock_agent(email=email, user_instruction=user_instruction, history=history)  # type: ignore
        return _normalize_v14(
            raw=raw,
            email=email,
            engine="mock",
            prompt_record_export=prompt_record_export,
            run_id=run_id,
            final_prompt=final_prompt,
            config=config,
        )

    raw = _call_deepseek(final_prompt)
    return _normalize_v14(
        raw=raw,
        email=email,
        engine="deepseek",
        prompt_record_export=prompt_record_export,
        run_id=run_id,
        final_prompt=final_prompt,
        config=config,
    )
