import { useMemo, useState } from "react";
import { Sidebar, type Folder } from "./components/Sidebar";
import { EmailList } from "./components/EmailList";
import { EmailView } from "./components/EmailView";
import { Assistant } from "./components/Assistant";
import { LogPanel } from "./components/LogPanel";

import type { Email } from "./types/email";
import type { AgentLogItem } from "./types/agent";

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
  {
    id: "3",
    from: "Security",
    subject: "Action required: verify now",
    body: "Click this link to verify your account: http://example.com/phish\n\nThanks",
    folder: "inbox",
    unread: true,
  },
];

export default function App() {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [selectedId, setSelectedId] = useState<string | null>(initialEmails[0]?.id ?? null);
  const [logs, setLogs] = useState<AgentLogItem[]>([]);

  const selected = useMemo(() => emails.find((e) => e.id === selectedId) ?? null, [emails, selectedId]);

  const visibleEmails = useMemo(() => emails.filter((e) => e.folder === folder), [emails, folder]);

  function appendLogs(items: AgentLogItem[]) {
    setLogs((prev) => [...prev, ...items]);
  }

  function markRead(id: string) {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, unread: false } : e)));
  }

  function moveEmail(id: string, destination: "archive" | "trash" | "spam") {
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        return { ...e, folder: destination, unread: false };
      })
    );

    appendLogs([
      {
        ts: new Date().toISOString(),
        source: "ui",
        action: `move_email:${destination}`,
        email_id: id,
      },
    ]);

    // If user moved currently selected email away, keep selection but folder may change;
    // optionally clear selection if moved out of current list:
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function createDraft(payload: { to?: string; subject: string; body: string }) {
    const newEmail: Email = {
      id: crypto.randomUUID(),
      from: "Me",
      to: payload.to,
      subject: payload.subject || "(No subject)",
      body: payload.body || "",
      folder: "drafts",
      unread: false,
    };

    setEmails((prev) => [newEmail, ...prev]);
    setFolder("drafts");
    setSelectedId(newEmail.id);

    appendLogs([
      {
        ts: new Date().toISOString(),
        source: "ui",
        action: "create_email",
        email_id: newEmail.id,
        details: { to: payload.to, subject: newEmail.subject },
      },
    ]);
  }

  function sendEmail(emailId: string) {
    // Simple rule: if selected email is in drafts, move it to sent.
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id !== emailId) return e;
        // Only drafts can be "sent" in this simplified UI.
        if (e.folder !== "drafts") return e;
        return { ...e, folder: "sent", unread: false };
      })
    );

    appendLogs([
      {
        ts: new Date().toISOString(),
        source: "ui",
        action: "send_email",
        email_id: emailId,
      },
    ]);
  }

  function handleSelectEmail(email: Email) {
    markRead(email.id);
    setSelectedId(email.id);

    appendLogs([
      {
        ts: new Date().toISOString(),
        source: "ui",
        action: "open_email",
        email_id: email.id,
      },
    ]);
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0b0b", color: "#eee" }}>
      <Sidebar current={folder} onSelect={setFolder} />

      <EmailList emails={visibleEmails} selectedId={selectedId} onSelect={handleSelectEmail} />

      <div
  style={{
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#000",
    minWidth: 0, // VERY IMPORTANT
  }}
>
  {/* Scrollable main content */}
  <div
    style={{
      flex: 1,
      overflowY: "auto",
      minWidth: 0, // prevent children from expanding width
    }}
  >
    <EmailView email={selected} />

    <Assistant
      email={selected}
      onMarkRead={(id) => markRead(id)}
      onCreateEmail={(payload) => createDraft(payload)}
      onSendEmail={(id) => sendEmail(id)}
      onMoveEmail={(id, destination) => moveEmail(id, destination)}
      onAppendLogs={appendLogs}
    />
  </div>

  {/* Fixed bottom action log */}
  <div
    style={{
      borderTop: "1px solid #222",
      background: "#000",
      flexShrink: 0,
    }}
  >
    <LogPanel logs={logs} />
  </div>
</div>

    </div>
  );
}
