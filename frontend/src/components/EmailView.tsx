import type { Email } from "../types/email";

interface EmailViewProps {
  email: Email | null;
}

export function EmailView({ email }: EmailViewProps) {
  if (!email) {
    return (
      <div style={{ padding: 16, borderBottom: "1px solid #333", color: "#bbb" }}>
        <em>Select an email to view</em>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, borderBottom: "1px solid #333" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>{email.subject}</h2>
        {email.unread ? (
          <span style={{ fontSize: 12, letterSpacing: 1, color: "#4ea1ff", fontWeight: 800 }}>
            UNREAD
          </span>
        ) : (
          <span style={{ color: "#666", fontSize: 12 }}>READ</span>
        )}
      </div>

      <div style={{ color: "#aaa", marginTop: 8, marginBottom: 12 }}>
        From: {email.from} {email.to ? `• To: ${email.to}` : ""}
      </div>

      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", color: "#eaeaea", lineHeight: 1.5 }}>
        {email.body}
      </pre>
    </div>
  );
}
