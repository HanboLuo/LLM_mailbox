import type { AgentAction } from "./agent";

export interface AgentLog {
  timestamp: number;
  email_id: string | null;
  instruction: string;
  actions: AgentAction[];
  reasoning: string[];
  model: "llm" | "mock";
}
