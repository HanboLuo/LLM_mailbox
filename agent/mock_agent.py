# agent/mock_agent.py
from typing import Dict, List

def run_agent(email: Dict, user_instruction: str) -> Dict:
    reasoning: List[str] = []

    if email.get("unread"):
        reasoning.append("Email is unread")

    reasoning.append(f"User instruction: {user_instruction}")

    instruction_lower = user_instruction.lower()

    if "reply" in instruction_lower or "回复" in instruction_lower:
        return {
            "action": "reply",
            "reply": (
                "Hi Prof,\n\n"
                "Thank you for your email. I am available next week.\n\n"
                "Best regards,\n"
                "Hanbo"
            ),
            "reasoning": reasoning,
        }

    if "mark read" in instruction_lower or "ignore" in instruction_lower:
        return {
            "action": "mark_read",
            "reply": None,
            "reasoning": reasoning,
        }

    return {
        "action": "ignore",
        "reply": None,
        "reasoning": reasoning,
    }
