import { useMemo, useState } from "react";
import type { Email } from "../types/email";
import type { AgentResult, HistoryTurn } from "../types/agent";

interface AssistantProps {
  email: Email | null;
  onMarkRead?: (id: string) => void;
  onDeleteEmail?: (id: string) => void;
  onCreateEmail?: (payload: { to?: string; subject: string; body: string }) => void;
}

export function Assistant({ email, onMarkRead, onDeleteEmail, onCreateEmail }: AssistantProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  const [draft, setDraft] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [clarify, setClarify] = useState<string | null>(null);

  // multi-turn history (like ChatGPT)
  const [history, setHistory] = useState<HistoryTurn[]>([]);

  const canRun = useMemo(() => !!email && !loading, [email, loading]);

  if (!email) return null;
  const emailId = email.id; // stable id (fix TS null warning)

  async function handleGenerate() {
    const userText = instruction.trim();
    if (!userText) return;

    setLoading(true);
    setDraft(null);
    setReasoning([]);
    setClarify(null);

    // append to local history
    const nextHistory: HistoryTurn[] = [...history, { role: "user", content: userText }];

    try {
      const res = await fetch("http://127.0.0.1:8000/agent/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          instruction: userText,
          history: nextHistory,
        }),
      });

      const data: AgentResult = await res.json();

      setReasoning(data.reasoning ?? []);

      // Execute actions (multi-action)
      for (const a of data.actions ?? []) {
        if (a.type === "reply") {
          setDraft(a.payload.draft);
        }

        if (a.type === "mark_read") {
          onMarkRead?.(emailId);
        }

        if (a.type === "delete_email") {
          onDeleteEmail?.(emailId);
        }

        if (a.type === "create_email") {
          onCreateEmail?.({
            to: a.payload.to,
            subject: a.payload.subject,
            body: a.payload.body,
          });
        }

        if (a.type === "clarify") {
          setClarify(a.payload.question);
        }
      }

      // append assistant summary turn for multi-turn
      const assistantSummary = (() => {
        const types = (data.actions ?? []).map((x) => x.type).join(", ");
        const mainText =
          (data.actions ?? []).find((x) => x.type === "reply")?.payload?.draft ||
          (data.actions ?? []).find((x) => x.type === "clarify")?.payload?.question ||
          "";
        return `Actions: ${types}${mainText ? `\n\n${mainText}` : ""}`;
      })();

      setHistory([...nextHistory, { role: "assistant", content: assistantSummary }]);
    } catch (e) {
      setClarify("Request failed. Please check backend is running and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Assistant</h3>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Tell the assistant what to do… (Chinese is OK)"
        style={{
          width: "100%",
          minHeight: 90,
          marginBottom: 10,
          background: "#222",
          color: "#eee",
          border: "1px solid #333",
          borderRadius: 8,
          padding: 10,
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={!canRun}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #333",
          background: "#1b1b1b",
          color: "#fff",
          cursor: canRun ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Thinking…" : "Generate"}
      </button>

      {reasoning.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: "12px 0 8px" }}>Reasoning</h4>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#bbb", lineHeight: 1.6 }}>
            {reasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {clarify && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: "12px 0 8px" }}>Clarify</h4>
          <div style={{ color: "#ffd27d", whiteSpace: "pre-wrap" }}>{clarify}</div>
        </div>
      )}

      {draft && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: "12px 0 8px" }}>Draft Reply</h4>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#1e1e1e",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              color: "#eee",
              lineHeight: 1.5,
            }}
          >
            {draft}
          </pre>
        </div>
      )}
    </div>
  );
}
