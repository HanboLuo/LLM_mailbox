import json
import os
import re
from typing import Any, Dict, List, Optional

import requests


DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
print("Using model:", DEEPSEEK_MODEL)


def _extract_json_object(text: str) -> Optional[dict]:
    """
    Try to extract the first JSON object from arbitrary text.
    """
    if not text:
        return None
    # common: model wraps in ```json ... ```
    m = re.search(r"```(?:json)?\s*({.*?})\s*```", text, flags=re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # fallback: find first {...} block
    m2 = re.search(r"({.*})", text, flags=re.DOTALL)
    if m2:
        try:
            return json.loads(m2.group(1))
        except Exception:
            return None
    return None


def _normalize_result(obj: dict) -> dict:
    """
    Normalize result to:
      {
        "actions": [ { "type": "...", ... } ],
        "reasoning": [ ... ],
        "assistant_message": "..."
      }
    """
    actions = obj.get("actions")
    reasoning = obj.get("reasoning")
    assistant_message = obj.get("assistant_message")

    if not isinstance(actions, list):
        actions = []
    if not isinstance(reasoning, list):
        reasoning = []

    # Ensure each action has type
    cleaned_actions = []
    for a in actions:
        if isinstance(a, dict) and isinstance(a.get("type"), str):
            cleaned_actions.append(a)

    return {
        "actions": cleaned_actions,
        "reasoning": [str(x) for x in reasoning],
        "assistant_message": str(assistant_message) if assistant_message is not None else None,
    }


def _fallback_rule_agent(email: Dict[str, Any], messages: List[Dict[str, str]]) -> dict:
    """
    If no API key, provide a basic but safe agent:
      - If user asks to reply -> reply + mark_read
      - If unclear -> ask_clarify
    """
    last_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user = m.get("content", "")
            break

    reasoning = []
    if email.get("unread"):
        reasoning.append("Email is unread.")
    reasoning.append(f"User said: {last_user}")

    # naive intent
    wants_reply = any(k in last_user.lower() for k in ["reply", "回复", "回", "答复"])
    wants_mark = any(k in last_user.lower() for k in ["mark", "已读", "读了", "不管", "忽略"])

    if wants_reply:
        return {
            "actions": [
                {
                    "type": "reply",
                    "content": (
                        "Dear Prof,\n\n"
                        "Yes, I am available next week. Please let me know what day and time works best for you.\n\n"
                        "Best regards,\n"
                        "Hanbo"
                    ),
                },
                {"type": "mark_read"},
            ],
            "reasoning": reasoning + ["Detected intent to reply; marking as read after drafting reply."],
            "assistant_message": "I drafted a reply and marked the email as read.",
        }

    if wants_mark and not wants_reply:
        return {
            "actions": [{"type": "mark_read"}],
            "reasoning": reasoning + ["Detected intent to mark as read."],
            "assistant_message": "Marked the email as read.",
        }

    return {
        "actions": [
            {
                "type": "ask_clarify",
                "question": "你希望我做什么？是需要我帮你写一封回复，还是只是把邮件标为已读/忽略？",
            }
        ],
        "reasoning": reasoning + ["User intent is ambiguous; asking clarification."],
        "assistant_message": "I need a clarification before acting.",
    }


def run_agent_llm(email: Dict[str, Any], messages: List[Dict[str, str]]) -> dict:
    """
    Main agent:
      - multi-turn messages
      - multi-action output
      - reasoning + ask_clarify
    """
    if not DEEPSEEK_API_KEY:
        return _fallback_rule_agent(email, messages)

    system_prompt = """
You are an email assistant agent.

You receive:
- The current email object (from, subject, body, folder, unread, etc.)
- A multi-turn conversation between user and assistant (messages[])

Your task:
- Decide what to do, possibly MULTIPLE actions.
- Explain your reasoning clearly.
- If the user's intent is ambiguous or you lack key details, DO NOT guess; ask a clarification question.

Allowed actions (you may return multiple):
1) reply: { "type": "reply", "content": "..." }
2) mark_read: { "type": "mark_read" }
3) ignore: { "type": "ignore" }
4) ask_clarify: { "type": "ask_clarify", "question": "..." }

Return STRICT JSON ONLY (no markdown, no extra text) with schema:
{
  "actions": [ ... ],
  "reasoning": ["...", "..."],
  "assistant_message": "A short assistant message to show in chat (optional)"
}

Guidelines:
- Support Chinese and English user input.
- If user asks to draft a reply, also include mark_read unless user explicitly says NOT to.
- Keep replies professional and concise unless user asks otherwise.
""".strip()

    # Construct chat messages for DeepSeek
    # We include email + conversation in a final user message for clarity.
    email_block = {
        "from": email.get("from"),
        "to": email.get("to"),
        "subject": email.get("subject"),
        "body": email.get("body"),
        "folder": email.get("folder"),
        "unread": email.get("unread"),
    }

    convo_lines = []
    for m in messages[-20:]:  # keep last 20 turns
        role = m.get("role", "user")
        content = m.get("content", "")
        convo_lines.append(f"{role.upper()}: {content}")

    user_payload = f"""
CURRENT EMAIL (JSON):
{json.dumps(email_block, ensure_ascii=False)}

CONVERSATION SO FAR:
{chr(10).join(convo_lines)}

Now decide actions.
""".strip()

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }

    body = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ],
        "temperature": 0.2,
    }

    try:
        resp = requests.post(DEEPSEEK_API_URL, headers=headers, json=body, timeout=30)
        status = resp.status_code
        print(f"Calling DeepSeek API... status={status}")

        if status != 200:
            # fallback with error info in reasoning
            fb = _fallback_rule_agent(email, messages)
            fb["reasoning"] = fb.get("reasoning", []) + [f"DeepSeek API error status={status}"]
            return fb

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        obj = _extract_json_object(content)
        if not obj:
            fb = _fallback_rule_agent(email, messages)
            fb["reasoning"] = fb.get("reasoning", []) + ["Failed to parse JSON from model output."]
            return fb

        normalized = _normalize_result(obj)

        # If model returned empty actions, ask clarify (safe)
        if not normalized["actions"]:
            normalized["actions"] = [{
                "type": "ask_clarify",
                "question": "I’m not sure what you want me to do. Do you want a draft reply, mark as read, or ignore?",
            }]
            normalized["reasoning"] = normalized["reasoning"] + ["Model returned no actions; asking clarification."]
        return normalized

    except Exception as e:
        fb = _fallback_rule_agent(email, messages)
        fb["reasoning"] = fb.get("reasoning", []) + [f"Exception calling DeepSeek: {repr(e)}"]
        return fb
