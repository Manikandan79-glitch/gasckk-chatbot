"use client";
import { useState, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:8000";

/* ─────────────────────── types ─────────────────────── */
interface Stats {
  total_users: number;
  total_prompts: number;
  active_today: number;
}
interface User {
  id: number;
  email: string;
  joined: string;
}
interface HistoryItem {
  id: number;
  email: string;
  query: string;
  response: string;
  time: string;
}
interface Engine {
  name: string;
  status: string;
  color: string;
}

/* ─────────────────────── main component ─────────────────────── */
export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading]   = useState(false);

  // Dashboard state
  const [tab, setTab]           = useState<"stats" | "users" | "history" | "models" | "upload">("stats");
  const [stats, setStats]       = useState<Stats | null>(null);
  const [users, setUsers]       = useState<User[]>([]);
  const [history, setHistory]   = useState<HistoryItem[]>([]);
  const [engines, setEngines]   = useState<Engine[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal]= useState(0);
  const [histPages, setHistPages]= useState(1);
  const [search, setSearch]     = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  // Upload tab state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadType, setUploadType]   = useState<"syllabus" | "question_paper" | "circular" | "timetable">("syllabus");
  const [uploadDept, setUploadDept]   = useState("Mathematics");
  const [uploading, setUploading]     = useState(false);
  const [uploadResults, setUploadResults] = useState<{name: string; status: string; ok: boolean}[]>([]);
  const [syncMsg, setSyncMsg]         = useState("");
  const [syncing, setSyncing]         = useState(false);

  /* ── login ── */
  const handleLogin = async () => {
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        setLoggedIn(true);
      } else {
        const d = await res.json();
        setLoginError(d.detail || "Invalid credentials.");
      }
    } catch {
      setLoginError("Cannot connect to server. Is the backend running?");
    }
    setLoading(false);
  };

  /* ── fetch helpers ── */
  const fetchStats = useCallback(async () => {
    const r = await fetch(`${API}/api/admin/stats`);
    if (r.ok) setStats(await r.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    const r = await fetch(`${API}/api/admin/users`);
    if (r.ok) {
      const d = await r.json();
      setUsers(d.users);
    }
  }, []);

  const fetchHistory = useCallback(async (page: number) => {
    const r = await fetch(`${API}/api/admin/history?page=${page}&limit=20`);
    if (r.ok) {
      const d = await r.json();
      setHistory(d.history);
      setHistTotal(d.total);
      setHistPages(d.pages);
    }
  }, []);

  const fetchEngines = useCallback(async () => {
    const r = await fetch(`${API}/api/admin/model-status`);
    if (r.ok) {
      const d = await r.json();
      setEngines(d.engines);
    }
  }, []);

  /* ── load data on tab change ── */
  useEffect(() => {
    if (!loggedIn) return;
    if (tab === "stats")   fetchStats();
    if (tab === "users")   fetchUsers();
    if (tab === "history") fetchHistory(histPage);
    if (tab === "models")  fetchEngines();
  }, [loggedIn, tab, histPage, fetchStats, fetchUsers, fetchHistory, fetchEngines]);

  /* ── bulk PDF upload ── */
  const handleBulkUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setUploadResults([]);
    const results: {name: string; status: string; ok: boolean}[] = [];

    for (const file of uploadFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", uploadType);
        formData.append("department", uploadDept);
        const res = await fetch(`${API}/api/upload-pdf`, { method: "POST", body: formData });
        const d = await res.json();
        results.push({ name: file.name, status: res.ok ? "✅ Indexed" : `❌ ${d.detail}`, ok: res.ok });
      } catch {
        results.push({ name: file.name, status: "❌ Connection error", ok: false });
      }
    }
    setUploadResults(results);
    setUploadFiles([]);
    setUploading(false);
  };

  /* ── website sync ── */
  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("Crawling college portal...");
    try {
      const res = await fetch(`${API}/api/sync-website`, { method: "POST" });
      const d = await res.json();
      setSyncMsg(res.ok ? "✅ College website synced successfully!" : `❌ ${d.detail || "Sync failed"}`);
    } catch {
      setSyncMsg("❌ Connection error. Is backend running?");
    } finally {
      setSyncing(false);
    }
  };

  /* ── filtered users ── */
  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  /* ── filtered history ── */
  const filteredHistory = history.filter(h =>
    h.email.toLowerCase().includes(search.toLowerCase()) ||
    h.query.toLowerCase().includes(search.toLowerCase())
  );

  /* ══════════════════════ Login Screen ══════════════════════ */
  if (!loggedIn) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{
              width: "64px", height: "64px",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              borderRadius: "16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "28px", margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
            }}>🏛️</div>
            <h1 style={{ color: "#f1f5f9", fontSize: "22px", fontWeight: 700, margin: "0 0 6px" }}>
              GASCKK Admin Portal
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
              Government Arts &amp; Science College Palkulam
            </p>
          </div>

          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "10px",
                padding: "12px 16px",
                color: "#f1f5f9",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "10px",
                padding: "12px 16px",
                color: "#f1f5f9",
                fontSize: "14px",
                outline: "none",
              }}
            />
            {loginError && (
              <p style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#fca5a5",
                fontSize: "13px",
                margin: 0,
              }}>{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                border: "none",
                borderRadius: "10px",
                padding: "13px",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {loading ? "Signing in…" : "🔐 Sign In as Admin"}
            </button>
          </div>

          <p style={{ textAlign: "center", color: "#64748b", fontSize: "12px", marginTop: "20px" }}>
            This portal is restricted to college administrators only.
          </p>
        </div>
      </div>
    );
  }

  /* ══════════════════════ Dashboard ══════════════════════ */
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
    fontSize: "13px",
    background: active
      ? "linear-gradient(135deg,#3b82f6,#8b5cf6)"
      : "rgba(255,255,255,0.06)",
    color: active ? "#fff" : "#94a3b8",
    transition: "all 0.2s",
  });

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    padding: "24px",
  };

  const statBox = (icon: string, label: string, value: number | string, accent: string) => (
    <div style={{
      ...cardStyle,
      display: "flex", alignItems: "center", gap: "16px",
      borderLeft: `4px solid ${accent}`,
    }}>
      <div style={{
        fontSize: "28px", width: "48px", height: "48px",
        background: `${accent}22`, borderRadius: "12px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <div>
        <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>{label}</p>
        <p style={{ color: "#f1f5f9", fontSize: "26px", fontWeight: 700, margin: 0 }}>{value}</p>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "#f1f5f9",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Top Nav */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "14px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "22px" }}>🏛️</span>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>GASCKK Admin Panel</h2>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>Government Arts &amp; Science College Palkulam</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: "20px",
            padding: "4px 12px",
            fontSize: "11px",
            color: "#4ade80",
            fontWeight: 600,
          }}>● LIVE</span>
          <button
            onClick={() => setLoggedIn(false)}
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "8px",
              padding: "7px 14px",
              color: "#f87171",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >🚪 Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Tab Nav */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
          <button style={tabStyle(tab === "stats")}   onClick={() => setTab("stats")}>📊 Dashboard</button>
          <button style={tabStyle(tab === "users")}   onClick={() => setTab("users")}>👥 Users</button>
          <button style={tabStyle(tab === "history")} onClick={() => setTab("history")}>💬 Prompt History</button>
          <button style={tabStyle(tab === "models")}  onClick={() => setTab("models")}>⚡ AI Engine Status</button>
          <button style={tabStyle(tab === "upload")}  onClick={() => setTab("upload")}>📂 Upload Documents</button>
        </div>

        {/* ── STATS TAB ── */}
        {tab === "stats" && (
          <div>
            <h3 style={{ color: "#94a3b8", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px" }}>
              System Overview
            </h3>
            {stats ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: "16px", marginBottom: "28px" }}>
                {statBox("👤", "Total Registered Users",  stats.total_users,  "#3b82f6")}
                {statBox("💬", "Total Prompts Processed", stats.total_prompts, "#8b5cf6")}
                {statBox("🟢", "Active Users Today",      stats.active_today,  "#22c55e")}
              </div>
            ) : (
              <p style={{ color: "#64748b" }}>Loading stats…</p>
            )}

            {/* Info Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: "16px" }}>
              <div style={cardStyle}>
                <h4 style={{ color: "#3b82f6", margin: "0 0 10px", fontSize: "14px" }}>🔗 Admin Credentials</h4>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 6px" }}>Email: <code style={{ color: "#60a5fa" }}>admin@gasckk.edu.in</code></p>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>Portal: <code style={{ color: "#60a5fa" }}>http://localhost:3000/admin</code></p>
              </div>
              <div style={cardStyle}>
                <h4 style={{ color: "#8b5cf6", margin: "0 0 10px", fontSize: "14px" }}>🤖 Active AI Engines</h4>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>• Groq gpt-oss-120b  •  NVIDIA llama-3.2-11b</p>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>• OpenRouter DeepSeek V4</p>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>• Gemini 2.5 Flash (camera vision)</p>
              </div>
              <div style={cardStyle}>
                <h4 style={{ color: "#22c55e", margin: "0 0 10px", fontSize: "14px" }}>🏫 College Info</h4>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Government Arts &amp; Science College</p>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Palkulam, Tamil Nadu</p>
                <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>Affiliated: Manonmaniam Sundaranar University</p>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <h3 style={{ color: "#f1f5f9", margin: 0 }}>👥 Registered Users ({filteredUsers.length})</h3>
              <input
                placeholder="Search by email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  color: "#f1f5f9",
                  fontSize: "13px",
                  outline: "none",
                  width: "220px",
                }}
              />
            </div>
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      }}>
                        <td style={tdStyle}>{u.id}</td>
                        <td style={tdStyle}>
                          <span style={{
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.2)",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            fontSize: "12px",
                            color: "#60a5fa",
                          }}>{u.email}</span>
                        </td>
                        <td style={{ ...tdStyle, color: "#94a3b8", fontSize: "12px" }}>{u.joined || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <h3 style={{ color: "#f1f5f9", margin: 0 }}>💬 Prompt History ({histTotal} total)</h3>
              <input
                placeholder="Search email or query…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  color: "#f1f5f9",
                  fontSize: "13px",
                  outline: "none",
                  width: "240px",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredHistory.length === 0 ? (
                <p style={{ color: "#64748b", textAlign: "center", padding: "32px" }}>No history found.</p>
              ) : (
                filteredHistory.map(h => (
                  <div key={h.id} style={{
                    ...cardStyle,
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                    borderColor: expanded === h.id ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)",
                  }} onClick={() => setExpanded(expanded === h.id ? null : h.id)}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.2)",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            fontSize: "11px",
                            color: "#60a5fa",
                          }}>{h.email}</span>
                          <span style={{ color: "#475569", fontSize: "11px" }}>{h.time}</span>
                        </div>
                        <p style={{ color: "#e2e8f0", fontSize: "13px", margin: 0, fontWeight: 500 }}>
                          💬 {h.query.length > 120 ? h.query.slice(0, 120) + "…" : h.query}
                        </p>
                      </div>
                      <span style={{ color: "#64748b", fontSize: "16px", marginTop: "2px" }}>
                        {expanded === h.id ? "▲" : "▼"}
                      </span>
                    </div>
                    {expanded === h.id && (
                      <div style={{
                        marginTop: "14px",
                        paddingTop: "14px",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}>
                        <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          AI Response (preview)
                        </p>
                        <p style={{
                          color: "#cbd5e1",
                          fontSize: "13px",
                          margin: 0,
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: "8px",
                          padding: "12px",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.6,
                        }}>
                          {h.response || "—"}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {histPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
                <button
                  disabled={histPage <= 1}
                  onClick={() => { setHistPage(p => p - 1); setExpanded(null); }}
                  style={paginationBtnStyle(histPage <= 1)}
                >← Prev</button>
                <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                  Page {histPage} of {histPages}
                </span>
                <button
                  disabled={histPage >= histPages}
                  onClick={() => { setHistPage(p => p + 1); setExpanded(null); }}
                  style={paginationBtnStyle(histPage >= histPages)}
                >Next →</button>
              </div>
            )}
          </div>
        )}

        {/* ── MODELS TAB ── */}
        {tab === "models" && (
          <div>
            <h3 style={{ color: "#f1f5f9", margin: "0 0 20px" }}>⚡ AI Engine Status</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: "16px" }}>
              {engines.length === 0 ? (
                <p style={{ color: "#64748b" }}>Loading engine status…</p>
              ) : (
                engines.map((eng, i) => (
                  <div key={i} style={{
                    ...cardStyle,
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    borderLeft: `4px solid ${eng.color === "green" ? "#22c55e" : "#ef4444"}`,
                  }}>
                    <div style={{
                      width: "12px", height: "12px", borderRadius: "50%",
                      background: eng.color === "green" ? "#22c55e" : "#ef4444",
                      boxShadow: eng.color === "green" ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
                      flexShrink: 0,
                    }} />
                    <div>
                      <p style={{ color: "#f1f5f9", fontSize: "14px", fontWeight: 600, margin: "0 0 3px" }}>{eng.name}</p>
                      <p style={{
                        fontSize: "12px",
                        margin: 0,
                        color: eng.color === "green" ? "#4ade80" : "#f87171",
                        fontWeight: 500,
                      }}>
                        {eng.status === "online" ? "● Online" : "○ Offline"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pipeline Info */}
            <div style={{ ...cardStyle, marginTop: "24px" }}>
              <h4 style={{ color: "#8b5cf6", margin: "0 0 14px", fontSize: "14px" }}>🔄 Fallback Pipeline Order</h4>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {["Groq", "NVIDIA NIM", "OpenRouter", "Gemini 2.5 Flash"].map((name, i, arr) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      background: "rgba(139,92,246,0.15)",
                      border: "1px solid rgba(139,92,246,0.3)",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "13px",
                      color: "#c4b5fd",
                      fontWeight: 600,
                    }}>
                      {i + 1}. {name}
                    </div>
                    {i < arr.length - 1 && <span style={{ color: "#475569", fontSize: "20px" }}>→</span>}
                  </div>
                ))}
              </div>
              <p style={{ color: "#64748b", fontSize: "12px", margin: "12px 0 0" }}>
                If Groq fails or rate-limits, NVIDIA is tried. If NVIDIA fails, OpenRouter is tried. Gemini is the final fallback.
              </p>
            </div>
          </div>
        )}

        {/* ── UPLOAD TAB ── */}
        {tab === "upload" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Sync Website Card */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ color: "#94a3b8", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px" }}>
                🌐 Sync College Website
              </h3>
              <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 16px" }}>
                Crawl and re-index all content from the official GASCKK college website into the AI knowledge base.
              </p>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  background: syncing ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#059669,#10b981)",
                  border: "none", borderRadius: "10px", padding: "12px 24px",
                  color: "#fff", fontSize: "14px", fontWeight: 600,
                  cursor: syncing ? "not-allowed" : "pointer", opacity: syncing ? 0.7 : 1,
                }}
              >
                {syncing ? "⏳ Syncing..." : "🔄 Start Website Sync"}
              </button>
              {syncMsg && (
                <p style={{ marginTop: "12px", fontSize: "13px", color: syncMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>
                  {syncMsg}
                </p>
              )}
            </div>

            {/* Bulk Upload Card */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ color: "#94a3b8", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 16px" }}>
                📂 Upload Syllabus / Question Papers / Documents
              </h3>

              {/* Document Type */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Document Type
                </label>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {[
                    { val: "syllabus", label: "📘 Syllabus" },
                    { val: "question_paper", label: "📝 Question Paper" },
                    { val: "circular", label: "📋 Circular / Notice" },
                    { val: "timetable", label: "🗓️ Timetable" },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setUploadType(opt.val as any)}
                      style={{
                        padding: "8px 16px", borderRadius: "8px", border: "1px solid",
                        borderColor: uploadType === opt.val ? "#3b82f6" : "rgba(255,255,255,0.1)",
                        background: uploadType === opt.val ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                        color: uploadType === opt.val ? "#60a5fa" : "#94a3b8",
                        fontSize: "13px", cursor: "pointer", fontWeight: uploadType === opt.val ? 700 : 400,
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Department Selector */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Department
                </label>
                <select
                  value={uploadDept}
                  onChange={e => setUploadDept(e.target.value)}
                  style={{
                    background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "8px", padding: "10px 14px", color: "#e2e8f0",
                    fontSize: "13px", outline: "none", width: "100%", maxWidth: "360px",
                    WebkitAppearance: "none", appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    paddingRight: "32px",
                  }}
                >
                  {["Mathematics","Physics","Chemistry","Commerce","Tamil","English",
                    "BCA","MSC Mathematics","MA English","MCom","All Departments"
                  ].map(d => <option key={d} value={d} style={{ background: "#1e293b", color: "#e2e8f0" }}>{d}</option>)}
                </select>
              </div>

              {/* File Picker */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Select PDF Files (multiple allowed)
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={e => setUploadFiles(Array.from(e.target.files || []))}
                  style={{
                    display: "block", background: "rgba(255,255,255,0.05)",
                    border: "2px dashed rgba(59,130,246,0.4)", borderRadius: "10px",
                    padding: "20px", color: "#94a3b8", fontSize: "13px", width: "100%",
                    boxSizing: "border-box", cursor: "pointer",
                  }}
                />
                {uploadFiles.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <p style={{ color: "#60a5fa", fontSize: "13px", margin: "0 0 6px" }}>
                      📎 {uploadFiles.length} file(s) selected:
                    </p>
                    {uploadFiles.map((f, i) => (
                      <div key={i} style={{ color: "#94a3b8", fontSize: "12px", padding: "3px 0" }}>
                        • {f.name} ({(f.size / 1024).toFixed(1)} KB)
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <button
                onClick={handleBulkUpload}
                disabled={uploading || uploadFiles.length === 0}
                style={{
                  background: (uploading || uploadFiles.length === 0)
                    ? "rgba(255,255,255,0.05)"
                    : "linear-gradient(135deg,#3b82f6,#8b5cf6)",
                  border: "none", borderRadius: "10px", padding: "12px 28px",
                  color: "#fff", fontSize: "14px", fontWeight: 600,
                  cursor: (uploading || uploadFiles.length === 0) ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? "⏳ Uploading & Indexing..." : `📤 Upload ${uploadFiles.length > 0 ? uploadFiles.length : ""} PDF${uploadFiles.length !== 1 ? "s" : ""} to AI`}
              </button>

              {/* Results */}
              {uploadResults.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <p style={{ color: "#94a3b8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" }}>
                    Upload Results
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {uploadResults.map((r, i) => (
                      <div key={i} style={{
                        background: r.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                        border: `1px solid ${r.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                        borderRadius: "8px", padding: "10px 14px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ color: "#e2e8f0", fontSize: "13px" }}>📄 {r.name}</span>
                        <span style={{ color: r.ok ? "#4ade80" : "#f87171", fontSize: "13px", fontWeight: 600 }}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── shared style helpers ─── */
const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: "#e2e8f0",
};

const paginationBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "rgba(255,255,255,0.04)" : "rgba(59,130,246,0.15)",
  border: "1px solid rgba(59,130,246,0.2)",
  borderRadius: "8px",
  padding: "8px 16px",
  color: disabled ? "#475569" : "#60a5fa",
  fontSize: "13px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 500,
});
