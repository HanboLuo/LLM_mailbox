import type { AgentLogItem } from "../types/agent";

export function LogPanel({ logs }: { logs: AgentLogItem[] }) {
  return (
    <div
  style={{
    padding: 12,
    borderTop: "1px solid #222",
    maxWidth: "100%",
    boxSizing: "border-box",
    overflowX: "hidden",
  }}
>

      <h4 style={{ margin: "0 0 8px" }}>Action Log</h4>
      {logs.length === 0 ? (
        <div style={{ color: "#999", fontSize: 12 }}>No logs yet.</div>
      ) : (
        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #333", borderRadius: 10 }}>
          {logs
            .slice()
            .reverse()
            .map((l, idx) => (
              <div
                key={idx}
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid #222",
                  fontSize: 12,
                  color: "#ddd",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa" }}>
                  <span>{new Date(l.ts).toLocaleString()}</span>
                  <span>
                    {l.source} {l.email_id ? `| email=${l.email_id}` : ""}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: "#fff" }}>{l.action}</span>
                  {l.details ? (
                    <pre style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", color: "#bbb" }}>
                      {JSON.stringify(l.details, null, 2)}
                    </pre>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
