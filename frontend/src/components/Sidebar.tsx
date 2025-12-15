// src/components/Sidebar.tsx

export type Folder =
  | "inbox"
  | "sent"
  | "drafts"
  | "archive"
  | "trash"
  | "spam";

interface SidebarProps {
  current: Folder;
  onSelect: (folder: Folder) => void;
}

export function Sidebar({ current, onSelect }: SidebarProps) {
  const folders: { key: Folder; label: string }[] = [
    { key: "inbox", label: "Inbox" },
    { key: "sent", label: "Sent" },
    { key: "drafts", label: "Drafts" },
    { key: "archive", label: "Archive" },
    { key: "spam", label: "Spam" },
    { key: "trash", label: "Trash" },
  ];

  return (
    <div
      style={{
        width: 220,
        borderRight: "1px solid #333",
        padding: "16px 8px",
        fontSize: 14,
        background: "#0b0b0b",
        color: "#eee",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          color: "#aaa",
          fontSize: 12,
          marginBottom: 8,
          paddingLeft: 12,
          letterSpacing: 1,
        }}
      >
        MAIL
      </div>

      {folders.map((f) => (
        <div
          key={f.key}
          onClick={() => onSelect(f.key)}
          style={{
            padding: "10px 12px",
            marginBottom: 4,
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: current === f.key ? 600 : 400,
            background: current === f.key ? "#2a2a2a" : "transparent",
            color: current === f.key ? "#fff" : "#ccc",
          }}
        >
          {f.label}
        </div>
      ))}
    </div>
  );
}
