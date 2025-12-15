export type AgentActionType =
  | "reply"
  | "mark_read"
  | "create_email"
  | "delete_email"
  | "clarify";

export type AgentAction =
  | { type: "reply"; payload: { draft: string } }
  | { type: "mark_read"; payload: { email_id?: string } }
  | { type: "delete_email"; payload: { email_id?: string } }
  | { type: "create_email"; payload: { to: string; subject: string; body: string } }
  | { type: "clarify"; payload: { question: string } };

export interface AgentResult {
  actions: AgentAction[];
  reasoning?: string[];
}

export type HistoryTurn = { role: "user" | "assistant" | "system"; content: string };
