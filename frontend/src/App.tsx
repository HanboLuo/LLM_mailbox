import { useEffect, useMemo, useRef, useState } from "react";
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

const STORAGE_KEYS = {
  emails: "emails",
  folder: "ui_folder",
  selectedId: "ui_selected_email_id",
  logs: "agent_logs",
  bottomTab: "ui_bottom_tab",
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type BottomTab = "log" | "runs";

function RunHistoryPanel({
  logs,
  onRestoreRunLogsToMainLog,
}: {
  logs: AgentLogItem[];
  onRestoreRunLogsToMainLog?: (runId: string) => void;
}) {
  // Group logs by details.run_id
  const runs = useMemo(() => {
    const map = new Map<
      string,
      {
        run_id: string;
        startedAt: string;
        email_id?: string;
        instruction?: string;
        engine?: string;
        actions: string[];
        items: AgentLogItem[];
      }
    >();

    for (const item of logs) {
      const details = item.details as any;
      const runId: string | undefined = details?.run_id;
      if (!runId) continue;

      if (!map.has(runId)) {
        map.set(runId, {
          run_id: runId,
          startedAt: item.ts,
          email_id: item.email_id,
          instruction: undefined,
          engine: undefined,
          actions: [],
          items: [],
        });
      }

      const r = map.get(runId)!;
      r.items.push(item);

      // update startedAt (earliest)
      if (new Date(item.ts).getTime() < new Date(r.startedAt).getTime()) {
        r.startedAt = item.ts;
      }

      // capture instruction from user_instruction log
      if (item.action === "user_instruction") {
        const inst = details?.instruction;
        if (typeof inst === "string") r.instruction = inst;
      }

      // capture engine from engine_used log (backend/system)
      if (item.action === "engine_used") {
        const eng = details?.engine;
        if (typeof eng === "string") r.engine = eng;
      }

      // capture executed actions (UI logs)
      if (item.action.startsWith("move_email_executed:")) {
        r.actions.push(item.action.replace("move_email_executed:", "move_email="));
      } else if (item.action === "mark_read_executed") {
        r.actions.push("mark_read");
      } else if (item.action === "send_email_executed") {
        r.actions.push("send_email");
      } else if (item.action === "create_email_executed") {
        r.actions.push("create_email");
      } else if (item.action === "reply_draft_rendered") {
        r.actions.push("reply");
      } else if (item.action === "clarify_rendered") {
        r.actions.push("clarify");
      }
    }

    // sort runs by startedAt desc
    const arr = Array.from(map.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    // de-dup actions
    for (const r of arr) {
      r.actions = Array.from(new Set(r.actions));
    }

    return arr;
  }, [logs]);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runs.find((r) => r.run_id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  useEffect(() => {
    // auto-select latest run
    if (!selectedRunId && runs.length > 0) setSelectedRunId(runs[0].run_id);
  }, [runs, selectedRunId]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h4 style={{ margin: "0 0 8px" }}>Run History</h4>
        <div style={{ color: "#777", fontSize: 12 }}>
          runs: <span style={{ color: "#bbb" }}>{runs.length}</span>
        </div>
      </div>

      {runs.length === 0 ? (
        <div style={{ color: "#999", fontSize: 12 }}>No runs yet. Trigger the agent once to start a run.</div>
      ) : (
        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
          {/* left: run list */}
          <div
            style={{
              width: 320,
              maxWidth: "40%",
              border: "1px solid #333",
              borderRadius: 10,
              overflow: "hidden",
              flexShrink: 0,
              background: "#0b0b0b",
            }}
          >
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {runs.map((r) => {
                const active = r.run_id === selectedRunId;
                return (
                  <div
                    key={r.run_id}
                    onClick={() => setSelectedRunId(r.run_id)}
                    style={{
                      padding: "10px 10px",
                      cursor: "pointer",
                      borderBottom: "1px solid #222",
                      background: active ? "#141414" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ color: "#ddd", fontSize: 12 }}>
                        {new Date(r.startedAt).toLocaleString()}
                      </div>
                      <div style={{ color: "#888", fontSize: 12 }}>{r.engine ?? "unknown"}</div>
                    </div>

                    <div style={{ marginTop: 6, color: "#bbb", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.instruction ?? "(no instruction captured)"}
                    </div>

                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8, color: "#777", fontSize: 12 }}>
                      <span>email={r.email_id ?? "?"}</span>
                      <span style={{ color: "#999" }}>{r.actions.length ? r.actions.join(", ") : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* right: run details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedRun ? (
              <div
                style={{
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: 10,
                  background: "#0b0b0b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#aaa", fontSize: 12 }}>run_id</div>
                    <div style={{ color: "#fff", fontSize: 12, wordBreak: "break-all" }}>{selectedRun.run_id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => downloadJson(`run_${selectedRun.run_id}.json`, selectedRun)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #333",
                        background: "#151515",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Export run
                    </button>
                    {onRestoreRunLogsToMainLog && (
                      <button
                        onClick={() => onRestoreRunLogsToMainLog(selectedRun.run_id)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #333",
                          background: "#151515",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Focus logs
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 10, color: "#aaa", fontSize: 12 }}>logs</div>
                <div style={{ marginTop: 6, maxHeight: 160, overflowY: "auto", border: "1px solid #222", borderRadius: 10 }}>
                  {selectedRun.items
                    .slice()
                    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
                    .map((l, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 10px",
                          borderBottom: "1px solid #222",
                          fontSize: 12,
                          color: "#ddd",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#888" }}>
                          <span>{new Date(l.ts).toLocaleString()}</span>
                          <span>
                            {l.source} {l.email_id ? `| email=${l.email_id}` : ""}
                          </span>
                        </div>

                        <div style={{ marginTop: 4 }}>
                          <span style={{ color: "#fff" }}>{l.action}</span>
                          {l.details ? (
                            <pre style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", color: "#bbb" }}>
                              {JSON.stringify(l.details, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div style={{ color: "#999", fontSize: 12 }}>Select a run to view details.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // ---------- folder (persist) ----------
  const allowedFolders: Folder[] = ["inbox", "sent", "drafts", "trash", "archive", "spam"] as any;

  const [folder, setFolder] = useState<Folder>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.folder);
    const val = raw as Folder | null;
    return val && (allowedFolders as any).includes(val) ? val : "inbox";
  });

  // ---------- emails (persist) ----------
  const [emails, setEmails] = useState<Email[]>(() => {
    return safeJsonParse<Email[]>(localStorage.getItem(STORAGE_KEYS.emails), initialEmails);
  });

  // ---------- selectedId (persist) ----------
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.selectedId);
    return raw ?? (initialEmails[0]?.id ?? null);
  });

  // ---------- logs (persist) ----------
  const [logs, setLogs] = useState<AgentLogItem[]>(() => {
    return safeJsonParse<AgentLogItem[]>(localStorage.getItem(STORAGE_KEYS.logs), []);
  });

  // ---------- bottom tab ----------
  const [bottomTab, setBottomTab] = useState<BottomTab>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.bottomTab);
    return raw === "runs" ? "runs" : "log";
  });

  // current run context (client-side), used to tag logs with a run_id
  const currentRunIdRef = useRef<string | null>(null);

  // ---------- persist effects ----------
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.folder, folder);
  }, [folder]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.emails, JSON.stringify(emails));
  }, [emails]);

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEYS.selectedId, selectedId);
    else localStorage.removeItem(STORAGE_KEYS.selectedId);
  }, [selectedId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bottomTab, bottomTab);
  }, [bottomTab]);

  // ---------- derived ----------
  const visibleEmails = useMemo(() => emails.filter((e) => e.folder === folder), [emails, folder]);
  const selected = useMemo(() => emails.find((e) => e.id === selectedId) ?? null, [emails, selectedId]);

  // ensure selectedId is valid after load / folder switch
  useEffect(() => {
    if (selectedId && emails.some((e) => e.id === selectedId)) return;

    // fallback: pick first visible email, else first email overall
    const next = visibleEmails[0]?.id ?? emails[0]?.id ?? null;
    setSelectedId(next);
  }, [emails, visibleEmails, selectedId]);

  useEffect(() => {
    // if selected email is not in current folder, select first email in this folder (gmail-like)
    if (!selectedId) return;
    const sel = emails.find((e) => e.id === selectedId);
    if (!sel) return;
    if (sel.folder !== folder) {
      setSelectedId(visibleEmails[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  // ---------- helpers ----------
  function appendLogs(items: AgentLogItem[]) {
    setLogs((prev) => {
      const normalized: AgentLogItem[] = items.map((it) => {
        // normalize details into object so we can inject run_id
        const rawDetails: any = it.details;
        const detailsObj =
          rawDetails && typeof rawDetails === "object" && !Array.isArray(rawDetails)
            ? { ...rawDetails }
            : rawDetails
            ? { value: rawDetails }
            : undefined;

        // detect run start from UI instruction
        if (it.source === "ui" && it.action === "user_instruction") {
          const runId = crypto.randomUUID();
          currentRunIdRef.current = runId;
          const details = { ...(detailsObj ?? {}), run_id: runId };
          return { ...it, details };
        }

        // tag everything else with current run_id (if exists and not already tagged)
        const runId = detailsObj?.run_id ?? currentRunIdRef.current ?? undefined;
        if (runId) {
          const details = { ...(detailsObj ?? {}), run_id: runId };
          return { ...it, details };
        }

        return it;
      });

      return [...prev, ...normalized];
    });
  }

  function markRead(id: string) {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, unread: false } : e)));
  }

  // allow restore-to-inbox as well
  function moveEmail(id: string, destination: Folder | "inbox" | "archive" | "trash" | "spam") {
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        return { ...e, folder: destination as any, unread: false };
      })
    );

    appendLogs([
      {
        ts: new Date().toISOString(),
        source: "ui",
        action: `move_email_manual:${destination}`,
        email_id: id,
      },
    ]);

    // // If user moved currently selected email away, keep selection consistent:
    // setSelectedId((cur) => {
    //   if (cur !== id) return cur;
    //   // pick another email in current folder after move
    //   const after = emails
    //     .filter((e) => e.id !== id && e.folder === folder)
    //     .sort((a, b) => (a.id > b.id ? 1 : -1));
    //   return after[0]?.id ?? null;
    // });
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
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id !== emailId) return e;
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

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.emails);
    localStorage.removeItem(STORAGE_KEYS.folder);
    localStorage.removeItem(STORAGE_KEYS.selectedId);
    localStorage.removeItem(STORAGE_KEYS.logs);
    localStorage.removeItem(STORAGE_KEYS.bottomTab);
    window.location.reload();
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
          minWidth: 0,
        }}
      >
        {/* Scrollable main content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            minWidth: 0,
          }}
        >
          <EmailView email={selected} />

          <Assistant
            email={selected}
            onMarkRead={(id) => markRead(id)}
            onCreateEmail={(payload) => createDraft(payload)}
            onSendEmail={(id) => sendEmail(id)}
            // allow inbox restore if your agent starts outputting it
            onMoveEmail={(id, destination) => moveEmail(id, destination as any)}
            onAppendLogs={appendLogs}
          />
        </div>

        {/* Fixed bottom panel: tabs */}
        <div
          style={{
            borderTop: "1px solid #222",
            background: "#000",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 8, padding: 12, borderBottom: "1px solid #151515" }}>
            <button
              onClick={() => setBottomTab("log")}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #333",
                background: bottomTab === "log" ? "#1b1b1b" : "#0f0f0f",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Action Log
            </button>

            <button
              onClick={() => setBottomTab("runs")}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #333",
                background: bottomTab === "runs" ? "#1b1b1b" : "#0f0f0f",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Run History
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => downloadJson("agent_logs.json", logs)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "#0f0f0f",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Export logs
            </button>

            <button
              onClick={clearSession}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "#0f0f0f",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Clear session
            </button>
          </div>

          {bottomTab === "log" ? (
            <LogPanel logs={logs} />
          ) : (
            <RunHistoryPanel logs={logs} />
          )}
        </div>
      </div>
    </div>
  );
}
