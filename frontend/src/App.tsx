import { useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { EmailList } from "./components/EmailList";
import { EmailView } from "./components/EmailView";
import { Assistant } from "./components/Assistant";
import type { Email, Folder } from "./types/email";

const initialEmails: Email[] = [
  {
    id: "1",
    from: "Prof",
    subject: "Meeting next week",
    body: "Hi Hanbo,\nAre you available next week?\n\nProf",
    folder: "inbox",
    unread: true,
  },
  {
    id: "2",
    from: "Admin",
    subject: "Account notice",
    body: "Please review the attached policy update.",
    folder: "inbox",
    unread: true,
  },
];

export default function App() {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [selectedId, setSelectedId] = useState<string | null>(initialEmails[0]?.id ?? null);

  const selected = useMemo(
    () => emails.find((e) => e.id === selectedId) ?? null,
    [emails, selectedId]
  );

  const visibleEmails = useMemo(
    () => emails.filter((e) => e.folder === folder),
    [emails, folder]
  );

  const markRead = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, unread: false } : e)));
  };

  const moveToTrash = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, folder: "trash", unread: false } : e)));
    setSelectedId(null);
  };

  const createDraft = (draft: { to?: string; subject: string; body: string }) => {
    const newEmail: Email = {
      id: crypto.randomUUID(),
      from: "Me",
      to: draft.to,
      subject: draft.subject || "(No subject)",
      body: draft.body || "",
      folder: "drafts",
      unread: false,
    };
    setEmails((prev) => [newEmail, ...prev]);
    setFolder("drafts");
    setSelectedId(newEmail.id);
  };

  const handleSelectEmail = (email: Email) => {
    // click -> mark read
    markRead(email.id);
    setSelectedId(email.id);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar current={folder} onSelect={setFolder} />

      <EmailList
        emails={visibleEmails}
        selectedId={selectedId}
        onSelect={handleSelectEmail}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <EmailView email={selected} />

        <Assistant
          email={selected}
          onMarkRead={(id) => markRead(id)}
          onDeleteEmail={(id) => moveToTrash(id)}
          onCreateEmail={(payload) => createDraft(payload)}
        />
      </div>
    </div>
  );
}
