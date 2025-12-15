import type { Email } from "../types/email";

interface EmailListProps {
  emails: Email[];
  selectedId: string | null;
  onSelect: (email: Email) => void;
}

export function EmailList({
  emails,
  selectedId,
  onSelect,
}: EmailListProps) {
  return (
    <div
      style={{
        width: 360,
        borderRight: "1px solid #333",
        overflowY: "auto",
      }}
    >
      {emails.map((email) => {
        const selected = selectedId === email.id;
        const unread = email.unread;

        return (
          <div
            key={email.id}
            onClick={() => onSelect(email)}
            style={{
              padding: "10px 14px",
              cursor: "pointer",
              background: selected
                ? "#2a2a2a"
                : unread
                ? "#1f1f1f"
                : "transparent",
              borderBottom: "1px solid #2a2a2a",
              display: "flex",
              gap: 8,
            }}
          >
            {/* 蓝点 */}
            <div
              style={{
                width: 8,
                display: "flex",
                justifyContent: "center",
                paddingTop: 6,
              }}
            >
              {unread && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4c8bf5",
                  }}
                />
              )}
            </div>

            {/* 邮件内容 */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontWeight: unread ? 700 : 500,
                  }}
                >
                  {email.from}
                </span>
              </div>

              <div
                style={{
                  fontWeight: unread ? 700 : 500,
                }}
              >
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
