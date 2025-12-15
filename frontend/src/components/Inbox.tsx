import type { Email } from "../types/email";



interface InboxProps {
  emails: Email[];
  onSelect: (email: Email) => void;
}

export function Inbox({ emails, onSelect }: InboxProps) {
  return (
    <div
      style={{
        width: 260,
        borderRight: "1px solid #ddd",
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      <h3>Inbox</h3>

      {emails.map((email) => (
        <div
          key={email.id}
          onClick={() => onSelect(email)}
          style={{
            padding: "8px 6px",
            cursor: "pointer",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ fontWeight: "bold" }}>{email.subject}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{email.from}</div>
        </div>
      ))}
    </div>
  );
}
