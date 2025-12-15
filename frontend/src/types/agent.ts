export type AgentActionType =
  | "reply"
  | "mark_read"
  | "create_email"
  | "send_email"
  | "move_email"
  | "clarify";

// export type MoveDestination = "inbox" | "archive" | "trash" | "spam";

export type AgentAction =
  | { type: "reply"; payload: { draft: string } }
  | { type: "mark_read"; payload: { email_id: string } }
  | { type: "create_email"; payload: { to?: string; subject: string; body: string } }
  | { type: "send_email"; payload: { email_id: string } }
  | { type: "move_email"; payload: { email_id: string; destination: "inbox" | "archive" | "trash" | "spam" } }
  | { type: "clarify"; payload: { question: string } };

export interface AgentLogItem {
  ts: string; // ISO string
  source: "agent" | "ui" | "system";
  action: string;
  email_id?: string;
  details?: Record<string, unknown>;
}

export interface AgentResult {
  actions: AgentAction[];
  reasoning?: string[];
  logs?: AgentLogItem[];
  engine?: "deepseek" | "mock";
}

export type HistoryTurn = { role: "user" | "assistant" | "system"; content: string };
