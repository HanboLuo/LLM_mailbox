# LLM Mailbox Agent

An email assistant powered by an LLM-based decision agent.
The agent can decide multiple actions (reply, mark read, delete, create draft, clarify)
and explain its reasoning to the user.

## Features
- Multi-action agent (reply / mark_read / create / delete / clarify)
- Multi-turn conversation (ChatGPT-like)
- Reasoning visualization
- Human-in-the-loop clarification
- Frontend email UI (Gmail-style)

## Architecture
Frontend (React) -> FastAPI -> Agent -> LLM (DeepSeek)

## Demo
1. Select an email
2. Type natural language instruction (English or Chinese)
3. Agent decides actions and explains why

## Example
User: “帮我回复说我下周有空”

Agent:
- reply
- mark_read
- reasoning: ...


