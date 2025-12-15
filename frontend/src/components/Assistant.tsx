import { useMemo, useState } from "react";
import type { Email } from "../types/email";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentAction =
  | { type: "reply"; content: string }
  | { type: "mark_read" }
  | { type: "ignore" }
  | { type: "ask_clarify"; question: string };

type AgentResult = {
  actions: AgentAction[];
  reasoning: string[];
  assistant_message?: string | null;
};

interface AssistantProps {
  email: Email | null;
  onMarkRead?: (id: string) => void;
}

export function Assistant({ email, onMarkRead }: AssistantProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset chat when switching to a different email
  const emailKey = email?.id ?? "none";
  // lightweight reset when email changes:
  // (如果你希望“每封邮件有独立对话”，这是最直观的做法)
  useMemo(() => {
    setMessages([]);
    setReasoning([]);
    setDraft(null);
    setError(null);
    setInstruction("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailKey]);

  if (!email) return null;

  async function handleGenerate() {
    if (!email) return;

    const emailId = email.id; // capture stable id
    const userText = instruction.trim();
    if (!userText) return;

    setLoading(true);
    setError(null);
    setDraft(null);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(nextMessages);
    setInstruction("");

    try {
      const res = await fetch("http://127.0.0.1:8000/agent/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          messages: nextMessages,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }

      const data: AgentResult = await res.json();

      // Always show reasoning (for transparency)
      setReasoning(data.reasoning ?? []);

      // Optional assistant message (for chat display)
      if (data.assistant_message) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.assistant_message! }]);
      }

      // Execute multiple actions
      for (const action of data.actions ?? []) {
        if (action.type === "reply") {
          setDraft(action.content);
          // Also reflect in chat so it feels like ChatGPT
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Draft generated below." },
          ]);
        }

        if (action.type === "mark_read") {
          onMarkRead?.(emailId);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Marked as read." },
          ]);
        }

        if (action.type === "ask_clarify") {
          setMessages((prev) => [...prev, { role: "assistant", content: action.question }]);
        }

        if (action.type === "ignore") {
          setMessages((prev) => [...prev, { role: "assistant", content: "Okay, I will ignore this." }]);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Assistant</h3>

      {/* Chat history */}
      {messages.length > 0 && (
        <div
          style={{
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            background: "#151515",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {messages.map((m, idx) => (
            <div key={idx} style={{ marginBottom: 10, opacity: 0.95 }}>
              <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{m.content}</div>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="You can type anything here (中文也可以)…"
        style={{
          width: "100%",
          minHeight: 90,
          marginBottom: 8,
          background: "#1e1e1e",
          color: "#fff",
          border: "1px solid #333",
          borderRadius: 8,
          padding: 10,
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #333",
          background: "#222",
          color: "#fff",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Thinking…" : "Generate"}
      </button>

      {error && (
        <div style={{ marginTop: 12, color: "#ff8a8a", whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      {/* Reasoning */}
      {reasoning.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Reasoning</h4>
          <ul style={{ marginTop: 0, paddingLeft: 18, color: "#bbb", lineHeight: 1.4 }}>
            {reasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Draft */}
      {draft && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Draft Reply</h4>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#1e1e1e",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #333",
              color: "#fff",
            }}
          >
            {draft}
          </pre>
        </div>
      )}
    </div>
  );
}
