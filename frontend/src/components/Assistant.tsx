import { useMemo, useState } from "react";
import type { Email } from "../types/email";
import type { AgentResult, HistoryTurn, AgentLogItem } from "../types/agent";

interface AssistantProps {
  email: Email | null;

  onMarkRead?: (id: string) => void;
  onCreateEmail?: (payload: { to?: string; subject: string; body: string }) => void;
  onSendEmail?: (emailId: string) => void;
  onMoveEmail?: (emailId: string, destination: "inbox" | "archive" | "trash" | "spam") => void;

  onAppendLogs?: (items: AgentLogItem[]) => void;
}

export function Assistant({
  email,
  onMarkRead,
  onCreateEmail,
  onSendEmail,
  onMoveEmail,
  onAppendLogs,
}: AssistantProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  const [draft, setDraft] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [clarify, setClarify] = useState<string | null>(null);
  const [engine, setEngine] = useState<"deepseek" | "mock" | null>(null);

  const [history, setHistory] = useState<HistoryTurn[]>([]);

  const canRun = useMemo(() => !!email && !loading, [email, loading]);

  if (!email) return null;

  const emailId = email.id;

  function pushLocalLog(item: Omit<AgentLogItem, "ts">) {
    const full: AgentLogItem = { ts: new Date().toISOString(), ...item };
    onAppendLogs?.([full]);
  }
  
  function executeActions(actions: AgentResult["actions"] | undefined) {
    if (!actions || actions.length === 0) return;

    for (const a of actions) {
      switch (a.type) {
        case "reply": {
          setDraft(a.payload.draft);

          pushLocalLog({
            source: "ui",
            action: "reply_draft_rendered",
            email_id: emailId,
            details: { length: a.payload.draft?.length ?? 0 },
          });
          break;
        }

        case "mark_read": {
          const id = a.payload.email_id ?? emailId;
          onMarkRead?.(id);

          pushLocalLog({
            source: "ui",
            action: "mark_read_executed",
            email_id: id,
          });
          break;
        }

        case "create_email": {
          onCreateEmail?.({
            to: a.payload.to,
            subject: a.payload.subject,
            body: a.payload.body,
          });

          pushLocalLog({
            source: "ui",
            action: "create_email_executed",
            email_id: emailId,
            details: {
              to: a.payload.to,
              subject: a.payload.subject,
            },
          });
          break;
        }

        case "send_email": {
          const id = a.payload.email_id ?? emailId;
          onSendEmail?.(id);

          pushLocalLog({
            source: "ui",
            action: "send_email_executed",
            email_id: id,
          });
          break;
        }

        case "move_email": {
          const id = a.payload.email_id ?? emailId;
          const destination = a.payload.destination ?? "archive";

          onMoveEmail?.(id, destination);

          pushLocalLog({
            source: "ui",
            action: `move_email_executed:${destination}`,
            email_id: id,
          });
          break;
        }

        case "clarify": {
          setClarify(a.payload.question);

          pushLocalLog({
            source: "ui",
            action: "clarify_rendered",
            email_id: emailId,
            details: { question: a.payload.question },
          });
          break;
        }

        default: {
          // future-proof
          console.warn("Unhandled agent action:", a);
        }
      }
    }
    // return actions.map(a => a.type);
  }


  async function handleGenerate() {
    const userText = instruction.trim();
    if (!userText) return;

    setLoading(true);
    setDraft(null);
    setReasoning([]);
    setClarify(null);

    const nextHistory: HistoryTurn[] = [...history, { role: "user", content: userText }];

    // Log the user instruction (UI-side)
    pushLocalLog({
      source: "ui",
      action: "user_instruction",
      email_id: emailId,
      details: { instruction: userText },
    });

    try {
      const res = await fetch("http://127.0.0.1:8000/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          instruction: userText,
          history: nextHistory,
        }),
      });

      const data: AgentResult = await res.json();

      setEngine(data.engine ?? null);
      setReasoning(data.reasoning ?? []);
      if (data.logs?.length) onAppendLogs?.(data.logs);

      executeActions(data.actions);

      // Append assistant summary turn for multi-turn
      const assistantSummary = (() => {
        const types = (data.actions ?? []).map((x) => x.type).join(", ");
        const mainText =
          (data.actions ?? []).find((x) => x.type === "reply")?.payload?.draft ||
          (data.actions ?? []).find((x) => x.type === "clarify")?.payload?.question ||
          "";
        return `Engine: ${data.engine ?? "unknown"}\nActions: ${types}${mainText ? `\n\n${mainText}` : ""}`;
      })();

      setHistory([...nextHistory, { role: "assistant", content: assistantSummary }]);
      setInstruction("");
    } catch (e) {
      setClarify("Request failed. Please check backend is running and try again.");
      pushLocalLog({
        source: "system",
        action: "request_failed",
        email_id: emailId,
        details: { error: String(e) },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
  style={{
    padding: 16,
    borderTop: "1px solid #222",
    background: "transparent",
  }}
>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Assistant</h3>
        <div style={{ color: "#aaa", fontSize: 12 }}>
          Engine: <span style={{ color: "#ddd" }}>{engine ?? "unknown"}</span>
        </div>
      </div>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Tell the assistant what to do (Chinese is OK). Examples: 'archive this', 'mark as spam', 'reply politely', 'create an email to ...', 'send this draft'."
        style={{
          width: "100%",
          minHeight: 90,
          marginBottom: 10,
          background: "#111",
          color: "#eee",
          border: "1px solid #333",
          borderRadius: 10,
          padding: 10,
          outline: "none",
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
        {loading ? "Thinking..." : "Run"}
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
              background: "#0f0f0f",
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
