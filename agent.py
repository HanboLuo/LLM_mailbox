# agent.py
"""
Phase 1 Mock Agent

- No external API
- Deterministic behavior
- Simulates an email assistant
- Designed to be replaced by a real LLM later
"""

import re


def generate_reply(email_body: str, user_instruction: str) -> str:
    """
    Mock email assistant:
    - Reads user instruction
    - Reads email content
    - Generates a plausible reply
    """

    # Very simple intent detection (Phase 1 only)
    instruction_lower = user_instruction.lower()

    if "available" in instruction_lower or "有空" in instruction_lower:
        core_reply = (
            "Thank you for your email. I am available next week "
            "and would be happy to meet."
        )
    elif "not available" in instruction_lower or "没空" in instruction_lower:
        core_reply = (
            "Thank you for reaching out. Unfortunately, I am not available next week."
        )
    else:
        core_reply = (
            "Thank you for your email. I will review it and get back to you shortly."
        )

    # Try to extract sender name (very naive, on purpose)
    sender_match = re.search(r"Best,?\s*(.*)", email_body, re.IGNORECASE)
    sender = sender_match.group(1).strip() if sender_match else ""

    reply = f"""Hi{f' {sender}' if sender else ''},

{core_reply}

Best regards,
Hanbo
"""

    return reply
