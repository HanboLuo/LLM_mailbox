import type { Email } from "../types/email";

interface EmailViewProps {
  email: Email | null;
}

export function EmailView({ email }: EmailViewProps) {
  if (!email) {
    return (
      <div style={{ padding: 16 }}>
        <em>Select an email to view</em>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        borderBottom: "1px solid #ddd",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Read / Unread 状态标签 */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: email.unread ? "#4c8bf5" : "#999",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {email.unread ? "Unread" : "Read"}
      </div>

      <h2 style={{ margin: "4px 0 0 0" }}>{email.subject}</h2>

      <div style={{ color: "#555", marginBottom: 12 }}>
        From: {email.from}
      </div>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
          lineHeight: 1.5,
        }}
      >
        {email.body}
      </pre>
    </div>
  );
}
