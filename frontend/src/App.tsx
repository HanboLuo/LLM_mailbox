import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type Folder } from "./components/Sidebar";
import { EmailList } from "./components/EmailList";
import { EmailView } from "./components/EmailView";
import { Assistant } from "./components/Assistant";
import { LogPanel } from "./components/LogPanel";

import type { Email } from "./types/email";
import type { AgentLogItem } from "./types/agent";

/* ---------------- initial data ---------------- */

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

const STORAGE_KEYS = {
  emails: "emails",
  folder: "ui_folder",
  selectedId: "ui_selected_email_id",
  logs: "agent_logs",
  bottomTab: "ui_bottom_tab",
};

/* ---------------- utils ---------------- */

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type BottomTab = "log" | "runs";

/* ========================================================= */
/* ======================= App ============================== */
/* ========================================================= */

export default function App() {
  /* ---------- refs ---------- */

  // one-time exemption for auto mark-read
  const skipNextAutoMarkReadRef = useRef<Set<string>>(new Set());
  const currentRunIdRef = useRef<string | null>(null);

  /* ---------- states ---------- */

  const allowedFolders: Folder[] = [
    "inbox",
    "sent",
    "drafts",
    "trash",
    "archive",
    "spam",
  ] as any;

  const [folder, setFolder] = useState<Folder>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.folder);
    const val = raw as Folder | null;
    return val && allowedFolders.includes(val) ? val : "inbox";
  });

  const [emails, setEmails] = useState<Email[]>(() =>
    safeJsonParse(localStorage.getItem(STORAGE_KEYS.emails), initialEmails)
  );

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.selectedId);
    return raw ?? initialEmails[0]?.id ?? null;
  });

  const [logs, setLogs] = useState<AgentLogItem[]>(() =>
    safeJsonParse(localStorage.getItem(STORAGE_KEYS.logs), [])
  );

  const [bottomTab, setBottomTab] = useState<BottomTab>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.bottomTab);
    return raw === "runs" ? "runs" : "log";
  });

  /* ---------- persist ---------- */

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.folder, folder);
  }, [folder]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.emails, JSON.stringify(emails));
  }, [emails]);

  useEffect(() => {
    if (selectedId)
      localStorage.setItem(STORAGE_KEYS.selectedId, selectedId);
    else localStorage.removeItem(STORAGE_KEYS.selectedId);
  }, [selectedId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bottomTab, bottomTab);
  }, [bottomTab]);

  /* ---------- derived ---------- */

  const visibleEmails = useMemo(
    () => emails.filter((e) => e.folder === folder),
    [emails, folder]
  );

  const selected = useMemo(
    () => emails.find((e) => e.id === selectedId) ?? null,
    [emails, selectedId]
  );

  /* ---------- helpers ---------- */

  function appendLogs(items: AgentLogItem[]) {
    setLogs((prev) => {
      const normalized = items.map((it) => {
        const details =
          it.details && typeof it.details === "object"
            ? { ...it.details }
            : {};

        if (it.source === "ui" && it.action === "user_instruction") {
          const runId = crypto.randomUUID();
          currentRunIdRef.current = runId;
          return { ...it, details: { ...details, run_id: runId } };
        }

        const runId = details.run_id ?? currentRunIdRef.current;
        if (runId) {
          return { ...it, details: { ...details, run_id: runId } };
        }

        return it;
      });

      return [...prev, ...normalized];
    });
  }

  function markRead(id: string) {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, unread: false } : e))
    );
  }

  function markUnread(id: string) {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, unread: true } : e))
    );

    skipNextAutoMarkReadRef.current.add(id);

    appendLogs([
      {
        ts: new Date().toISOString(),
        source: "ui",
        action: "mark_unread",
        email_id: id,
      },
    ]);
  }

  function moveEmail(
    id: string,
    destination: Folder | "inbox" | "archive" | "trash" | "spam"
  ) {
    setEmails((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, folder: destination as any, unread: false } : e
      )
    );
  }

  function createDraft(payload: {
    to?: string;
    subject: string;
    body: string;
  }) {
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
  }

  function sendEmail(id: string) {
    setEmails((prev) =>
      prev.map((e) =>
        e.id === id && e.folder === "drafts"
          ? { ...e, folder: "sent", unread: false }
          : e
      )
    );
  }

  function handleSelectEmail(email: Email) {
    const id = email.id;

    if (skipNextAutoMarkReadRef.current.has(id)) {
      skipNextAutoMarkReadRef.current.delete(id);
    } else {
      markRead(id);
    }

    setSelectedId(id);
  }

  function clearSession() {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  }

  /* ---------- render ---------- */

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0b0b" }}>
      <Sidebar current={folder} onSelect={setFolder} />

      <EmailList
        emails={visibleEmails}
        selectedId={selectedId}
        onSelect={handleSelectEmail}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <EmailView email={selected} />

          <Assistant
            email={selected}
            onMarkRead={markRead}
            onMarkUnread={markUnread}
            onCreateEmail={createDraft}
            onSendEmail={sendEmail}
            onMoveEmail={moveEmail}
            onAppendLogs={appendLogs}
          />
        </div>

        <div style={{ borderTop: "1px solid #222" }}>
          <div style={{ display: "flex", gap: 8, padding: 12 }}>
            <button onClick={() => setBottomTab("log")}>Action Log</button>
            <button onClick={() => setBottomTab("runs")}>Run History</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => downloadJson("agent_logs.json", logs)}>
              Export logs
            </button>
            <button onClick={clearSession}>Clear session</button>
          </div>

          {bottomTab === "log" ? (
            <LogPanel logs={logs} />
          ) : (
            <div style={{ padding: 12, color: "#999" }}>
              Run history panel unchanged
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
