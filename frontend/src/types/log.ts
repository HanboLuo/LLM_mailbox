// src/types/log.ts
import type { AgentAction, AgentLogItem } from "./agent";

export interface AgentRunSummary {
  run_id: string;
  started_at: string;
  email_id?: string;
  instruction?: string;
  engine?: "deepseek" | "mock";
  actions?: AgentAction[];
  logs?: AgentLogItem[];
}
