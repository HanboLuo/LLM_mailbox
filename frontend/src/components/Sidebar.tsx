// src/components/Sidebar.tsx
export type Folder = "inbox" | "sent" | "drafts" | "trash";

interface SidebarProps {
  current: Folder;
  onSelect: (folder: Folder) => void;
}

export function Sidebar({ current, onSelect }: SidebarProps) {
  const folders: { key: Folder; label: string }[] = [
    { key: "inbox", label: "Inbox" },
    { key: "sent", label: "Sent" },
    { key: "drafts", label: "Drafts" },
    { key: "trash", label: "Trash" },
  ];

  return (
  <div
    style={{
      width: 220,
      borderRight: "1px solid #333",
      padding: "16px 8px",
      fontSize: 14,
    }}
  >
    <div
      style={{
        color: "#aaa",
        fontSize: 12,
        marginBottom: 8,
        paddingLeft: 12,
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
        }}
      >
        {f.label}
      </div>
    ))}
  </div>
);

}
