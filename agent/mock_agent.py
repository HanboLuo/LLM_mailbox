from typing import Any, Dict, List, Optional
from datetime import datetime

def _ts() -> str:
    return datetime.utcnow().isoformat() + "Z"

def run_agent(email: Dict[str, Any], user_instruction: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    history = history or []
    reasoning: List[str] = []
    logs: List[Dict[str, Any]] = []

    email_id = email.get("id")

    if email.get("unread"):
        reasoning.append("Email is unread.")
    reasoning.append(f"User instruction: {user_instruction}")

    text = user_instruction.strip().lower()

    actions: List[Dict[str, Any]] = []

    def log(action: str, details: Dict[str, Any] | None = None):
        logs.append({
            "ts": _ts(),
            "source": "agent",
            "action": action,
            "email_id": email_id,
            "details": details or {},
        })

    # Move to spam / trash / archive
    if any(k in text for k in ["spam", "垃圾", "垃圾邮件", "举报", "标记为垃圾"]):
        actions.append({"type": "move_email", "payload": {"email_id": email_id, "destination": "spam"}})
        actions.append({"type": "mark_read", "payload": {"email_id": email_id}})
        reasoning.append("Heuristic: user asked to mark as spam.")
        log("decide_move_email", {"destination": "spam"})
        log("decide_mark_read", {})
        return {"actions": actions, "reasoning": reasoning, "logs": logs}

    if any(k in text for k in ["trash", "delete", "remove", "删", "删除", "丢掉"]):
        actions.append({"type": "move_email", "payload": {"email_id": email_id, "destination": "trash"}})
        actions.append({"type": "mark_read", "payload": {"email_id": email_id}})
        reasoning.append("Heuristic: user asked to move to trash.")
        log("decide_move_email", {"destination": "trash"})
        log("decide_mark_read", {})
        return {"actions": actions, "reasoning": reasoning, "logs": logs}

    if any(k in text for k in ["archive", "归档", "隐藏", "收起来"]):
        actions.append({"type": "move_email", "payload": {"email_id": email_id, "destination": "archive"}})
        actions.append({"type": "mark_read", "payload": {"email_id": email_id}})
        reasoning.append("Heuristic: user asked to archive.")
        log("decide_move_email", {"destination": "archive"})
        log("decide_mark_read", {})
        return {"actions": actions, "reasoning": reasoning, "logs": logs}

    # Send draft
    if any(k in text for k in ["send", "发送", "发出去"]):
        actions.append({"type": "send_email", "payload": {"email_id": email_id}})
        reasoning.append("Heuristic: user asked to send an email (only drafts can be sent in UI).")
        log("decide_send_email", {})
        return {"actions": actions, "reasoning": reasoning, "logs": logs}

    # Create new email (draft)
    if any(k in text for k in ["create", "compose", "draft", "新建", "写一封"]) and any(k in text for k in ["email", "邮件", "mail"]):
        actions.append({
            "type": "create_email",
            "payload": {
                "to": "",
                "subject": "Draft",
                "body": "Please provide recipient, subject, and key details if missing.",
            }
        })
        reasoning.append("Heuristic: user asked to create a new email draft.")
        log("decide_create_email", {})
        return {"actions": actions, "reasoning": reasoning, "logs": logs}

    # Reply
    if any(k in text for k in ["reply", "回复", "回信"]):
        draft = (
            "Hi,\n\n"
            "Thank you for your email. I will follow up shortly.\n\n"
            "Best regards,\n"
            "Hanbo"
        )
        actions.append({"type": "reply", "payload": {"draft": draft}})
        actions.append({"type": "mark_read", "payload": {"email_id": email_id}})
        reasoning.append("Heuristic: user asked to reply; also mark as read.")
        log("decide_reply", {"draft_len": len(draft)})
        log("decide_mark_read", {})
        return {"actions": actions, "reasoning": reasoning, "logs": logs}

    # Clarify
    actions.append({
        "type": "clarify",
        "payload": {
            "question": "I am not sure what you want. Do you want to reply, create a new draft, send a draft, or move this email to archive/trash/spam?"
        }
    })
    reasoning.append("Heuristic: instruction is ambiguous; ask for clarification.")
    log("decide_clarify", {})
    return {"actions": actions, "reasoning": reasoning, "logs": logs}
