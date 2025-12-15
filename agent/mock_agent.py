from typing import Dict, List, Any


def run_agent(email: Dict[str, Any], user_instruction: str, history: List[Dict[str, str]] | None = None) -> Dict[str, Any]:
    history = history or []
    reasoning: List[str] = []

    if email.get("unread"):
        reasoning.append("Email is unread")

    reasoning.append(f"User instruction: {user_instruction}")

    text = user_instruction.lower().strip()

    actions: List[Dict[str, Any]] = []

    # very simple heuristics
    if any(k in text for k in ["删", "删除", "remove", "delete", "discard", "trash"]):
        actions.append({"type": "delete_email", "payload": {"email_id": email.get("id")}})
        actions.append({"type": "mark_read", "payload": {"email_id": email.get("id")}})
        reasoning.append("Heuristic: user asked to delete.")

    elif any(k in text for k in ["新建", "写一封", "compose", "draft", "发给", "给"]) and any(k in text for k in ["邮件", "email"]):
        actions.append(
            {
                "type": "create_email",
                "payload": {
                    "to": "",
                    "subject": "Draft",
                    "body": "Please provide recipient and key details if missing.",
                },
            }
        )
        reasoning.append("Heuristic: user asked to create a new email.")

    elif any(k in text for k in ["回复", "reply", "回信"]):
        actions.append(
            {
                "type": "reply",
                "payload": {
                    "draft": (
                        "Dear Prof,\n\n"
                        "Thank you for your email. I am available next week. "
                        "Please let me know what day and time works best for you.\n\n"
                        "Best regards,\n"
                        "Hanbo"
                    )
                },
            }
        )
        actions.append({"type": "mark_read", "payload": {"email_id": email.get("id")}})
        reasoning.append("Heuristic: user asked to reply; also mark as read.")

    else:
        actions.append({"type": "clarify", "payload": {"question": "What would you like me to do with this email (reply, delete, or create a new draft)?"}})
        reasoning.append("Heuristic: unclear instruction; ask to clarify.")

    return {"actions": actions, "reasoning": reasoning}
