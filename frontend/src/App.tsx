import { useMemo, useState } from "react";
import { Sidebar, type Folder } from "./components/Sidebar";
import { EmailList } from "./components/EmailList";
import { EmailView } from "./components/EmailView";
import { Assistant } from "./components/Assistant";
import type { Email } from "./types/email";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleEmails = useMemo(
    () => emails.filter((e) => e.folder === folder),
    [emails, folder]
  );

  const selectedEmail = useMemo(() => {
    if (!selectedId) return null;
    return emails.find((e) => e.id === selectedId) ?? null;
  }, [emails, selectedId]);

  const markReadById = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, unread: false } : e)));
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedId(email.id);
    markReadById(email.id);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar current={folder} onSelect={setFolder} />

      <EmailList emails={visibleEmails} selectedId={selectedId} onSelect={handleSelectEmail} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <EmailView email={selectedEmail} />
        <Assistant email={selectedEmail} onMarkRead={markReadById} />
      </div>
    </div>
  );
}
