import type { Email } from "../types/email";

interface EmailListProps {
  emails: Email[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
}

export function EmailList({ emails, selectedId, onSelect }: EmailListProps) {
  return (
    <div
      style={{
        width: 380,
        borderRight: "1px solid #333",
        overflowY: "auto",
        background: "#1f1f1f",
      }}
    >
      {emails.map((email) => {
        const selected = selectedId === email.id;

        return (
          <div
            key={email.id}
            onClick={() => onSelect(email)}
            style={{
              padding: "12px 14px",
              cursor: "pointer",
              background: selected ? "#2a2a2a" : "transparent",
              borderBottom: "1px solid #2a2a2a",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <div style={{ marginTop: 6, width: 10 }}>
              {email.unread ? (
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "#4ea1ff" }} />
              ) : null}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: "#eaeaea" }}>{email.from}</span>
              </div>

              <div style={{ fontWeight: email.unread ? 800 : 500, color: "#f2f2f2" }}>
                {email.subject}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#aaa",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {email.body.replace(/\n/g, " ")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
