import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SidePanel from "./SidePanel";
import "../css/sidepanel.css";

const API     = "http://127.0.0.1:8000/api";
const POLL_MS = 4000;

// ─── Helpers ──────────────────────────────────────────────────
const getInitials = n =>
  (n || "?").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

const fmtTime = iso => {
  if (!iso) return "";
  if (typeof iso === "string" && iso.includes("•")) return iso.split("•")[1]?.trim() || "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const fmtDay = iso => {
  if (!iso) return "";
  const d   = new Date(typeof iso === "string" && iso.includes("•") ? iso.split("•")[0] : iso);
  const now = new Date();
  if (isNaN(d)) return "";
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const buildConversations = (msgs = []) => {
  const map = {};
  msgs.forEach(m => {
    const otherId = m.sender_type === "admin" ? m.receiver_id : m.sender_id;
    if (!map[otherId]) {
      map[otherId] = { id: otherId, name: "Student", initials: "ST", thread: [], unread: 0 };
    }
    if (m.sender_type !== "admin" && m.from && m.from !== "You") {
      map[otherId].name     = m.from;
      map[otherId].initials = getInitials(m.from);
    }
    map[otherId].thread.push(m);
    if (!m.is_read && m.sender_type !== "admin") map[otherId].unread++;
  });
  return Object.values(map)
    .map(c => ({
      ...c,
      thread: [...c.thread].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    }))
    .sort((a, b) => {
      const at = a.thread[a.thread.length - 1]?.created_at || 0;
      const bt = b.thread[b.thread.length - 1]?.created_at || 0;
      return new Date(bt) - new Date(at);
    });
};

// ─── Date Separator (like Messenger) ──────────────────────────
const DateSep = ({ label }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    margin: "18px 0 12px", userSelect: "none",
  }}>
    <div style={{ flex: 1, height: 1, background: "#e8ecf4" }} />
    <span style={{
      fontSize: 11, color: "#94a3b8", fontWeight: 600,
      background: "#fff", padding: "3px 12px",
      borderRadius: 20, border: "1px solid #e8ecf4",
      whiteSpace: "nowrap", letterSpacing: "0.3px",
    }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: "#e8ecf4" }} />
  </div>
);

// ─── Bubble (Messenger-style grouping) ────────────────────────
const Bubble = ({ msg, prevMsg, nextMsg, initials }) => {
  const mine    = msg.sender_type === "admin";
  const showDay = !prevMsg ||
    fmtDay(msg.created_at || msg.time) !== fmtDay(prevMsg.created_at || prevMsg.time);
  const isFirst = !prevMsg || prevMsg.sender_type !== msg.sender_type || showDay;
  const isLast  = !nextMsg || nextMsg.sender_type !== msg.sender_type ||
    fmtDay(msg.created_at || msg.time) !== fmtDay(nextMsg.created_at || nextMsg.time);

  // Grouped bubble radius — matches Messenger style
  const radius = mine
    ? `${isFirst ? 18 : 5}px 18px 18px ${isLast ? 18 : 5}px`
    : `18px ${isFirst ? 18 : 5}px ${isLast ? 18 : 5}px 18px`;

  return (
    <>
      {showDay && <DateSep label={fmtDay(msg.created_at || msg.time)} />}
      <div style={{
        display: "flex",
        flexDirection: mine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 6,
        marginBottom: isLast ? 8 : 2,
        paddingLeft:  mine ? 60 : 0,
        paddingRight: mine ? 0  : 60,
      }}>
        {/* Avatar — only on last bubble of group */}
        {!mine && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: isLast ? "linear-gradient(135deg,#1e3a5f,#2563eb)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 800, color: "#fff",
          }}>
            {isLast ? initials : ""}
          </div>
        )}

        <div style={{ maxWidth: "72%" }}>
          <div style={{
            padding: "9px 13px",
            borderRadius: radius,
            background: mine
              ? "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)"
              : "#f0f2f5",
            color: mine ? "#fff" : "#1e293b",
            fontSize: 13.5, lineHeight: 1.5,
            boxShadow: mine
              ? "0 1px 6px rgba(37,99,235,0.22)"
              : "0 1px 2px rgba(0,0,0,0.06)",
            opacity: msg._pending ? 0.55 : 1,
            transition: "opacity 0.25s",
            wordBreak: "break-word",
          }}>
            {msg.body}
          </div>

          {/* Timestamp only on last bubble in group */}
          {isLast && (
            <div style={{
              fontSize: 10, color: "#94a3b8", marginTop: 3,
              textAlign: mine ? "right" : "left",
              display: "flex", gap: 3,
              justifyContent: mine ? "flex-end" : "flex-start",
              alignItems: "center",
              paddingLeft: mine ? 0 : 4,
            }}>
              <span>{fmtTime(msg.created_at || msg.time)}</span>
              {mine && (
                <span style={{ color: msg._pending ? "#f59e0b" : "#60a5fa", fontSize: 11 }}>
                  {msg._pending ? "⏳" : "✓"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────
export default function Messages() {
  const navigate = useNavigate();
  const tok  = () => localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
  const hdrs = () => ({ Authorization: `Bearer ${tok()}`, Accept: "application/json" });

  const [conversations, setConversations] = useState([]);
  const [students,      setStudents]      = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [view,          setView]          = useState("idle"); // "idle"|"chat"|"compose"
  const [newMsg,        setNewMsg]        = useState({ receiver_id: "", subject: "", body: "" });
  const [text,          setText]          = useState("");
  const [sending,       setSending]       = useState(false);
  const [sent,          setSent]          = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");

  const bottomRef   = useRef(null);
  const pollRef     = useRef(null);
  const activeIdRef = useRef(null);
  const lastMsgRef  = useRef(null);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // ── Fetch & poll ─────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = true) => {
    try {
      const res    = await axios.get(`${API}/admin/messages`, { headers: hdrs() });
      const convos = buildConversations(res.data.messages || []);
      setConversations(convos);

      // Scroll if genuinely new message in active thread
      const curId = activeIdRef.current;
      if (curId) {
        const fresh  = convos.find(c => c.id === curId);
        const lastId = fresh?.thread[fresh.thread.length - 1]?.id;
        if (lastId && lastId !== lastMsgRef.current) {
          lastMsgRef.current = lastId;
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
        }
      }
    } catch (e) {
      if (e.response?.status === 401) { localStorage.removeItem("admin_token"); navigate("/"); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    fetchAll(false);
    axios.get(`${API}/admin/students`, { headers: hdrs() })
      .then(r => setStudents(r.data.students || [])).catch(() => {});
    pollRef.current = setInterval(() => fetchAll(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []); // eslint-disable-line

  // ── Derived ──────────────────────────────────────────────────
  const activeConvo = conversations.find(c => c.id === activeId) || null;
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const thread      = conversations.find(c => c.id === activeId)?.thread
                    || activeConvo?.thread || [];

  const filtered = search.trim()
    ? conversations.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const lastPreview = c => {
    const m = c.thread[c.thread.length - 1];
    if (!m) return "";
    return (m.sender_type === "admin" ? "You: " : "") + (m.body?.slice(0, 46) || "");
  };

  // ── Open conversation ─────────────────────────────────────────
  const openConvo = async convo => {
    setActiveId(convo.id);
    setView("chat");
    setText("");
    lastMsgRef.current = convo.thread[convo.thread.length - 1]?.id || null;

    // Scroll to bottom immediately
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 100);

    // Mark unread as read
    for (const m of convo.thread.filter(x => !x.is_read && x.sender_type !== "admin")) {
      try { await axios.get(`${API}/admin/messages/${m.id}`, { headers: hdrs() }); } catch {}
    }
    setConversations(prev => prev.map(c =>
      c.id === convo.id
        ? { ...c, unread: 0, thread: c.thread.map(m => ({ ...m, is_read: true })) }
        : c
    ));
  };

  // ── Send reply ────────────────────────────────────────────────
  const sendReply = async () => {
    if (!text.trim() || !activeConvo || sending) return;
    setSending(true);
    const body   = text.trim();
    setText("");
    const tempId = `temp_${Date.now()}`;
    const temp   = {
      id: tempId, sender_type: "admin", from: "You", body,
      is_read: true, created_at: new Date().toISOString(), _pending: true,
    };
    setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, thread: [...c.thread, temp] } : c
    ));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

    try {
      await axios.post(`${API}/admin/messages`,
        { receiver_id: activeId, subject: "Message", body }, { headers: hdrs() });
      await fetchAll(true);
    } catch {
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, thread: c.thread.filter(m => m.id !== tempId) } : c
      ));
      setText(body);
      alert("Failed to send.");
    } finally { setSending(false); }
  };

  // ── Send new ──────────────────────────────────────────────────
  const sendNew = async e => {
    e.preventDefault();
    if (!newMsg.receiver_id || !newMsg.body.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/admin/messages`, {
        receiver_id: newMsg.receiver_id,
        subject: newMsg.subject || "Message",
        body: newMsg.body,
      }, { headers: hdrs() });
      const rid = newMsg.receiver_id;
      setSent(true);
      setNewMsg({ receiver_id: "", subject: "", body: "" });
      await fetchAll(true);
      setTimeout(() => { setSent(false); setView("chat"); setActiveId(+rid); }, 1500);
    } catch { alert("Failed to send."); }
    finally { setSending(false); }
  };

  // ════════════════════════════════════════════════════════════
  return (
    <div className="admin-home">
      <SidePanel onLogout={() => { localStorage.removeItem("admin_token"); navigate("/", { replace: true }); }} />
      <main className="admin-main">

        <div className="page-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            Messages
            {totalUnread > 0 && (
              <span style={{
                background: "#ef4444", color: "#fff", fontSize: 11,
                borderRadius: 20, padding: "2px 10px", fontWeight: 700,
              }}>{totalUnread} new</span>
            )}
          </h1>
          <p>Chat with students and respond to inquiries</p>
        </div>

        {/*
          ★ KEY LAYOUT FIX ★
          The outer shell has a fixed height and overflow:hidden.
          Each column uses display:flex + flexDirection:column.
          The scrollable areas have flex:1 + overflowY:auto.
          The header and input bar have flexShrink:0 so they never shrink.
          This is exactly how Messenger/WhatsApp Web achieves fixed-position
          headers/footers with a scrollable message area in between.
        */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          height: "calc(100vh - 178px)",   // fixed height — critical
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",               // clips children to rounded corners
        }}>

          {/* ══ LEFT: Conversation list ══ */}
          <div style={{
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            background: "#f8fafc",
            overflow: "hidden",             // column must not overflow
          }}>

            {/* Sidebar header — never scrolls */}
            <div style={{
              padding: "14px 16px",
              background: "#1e3a5f",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                Chats
                {totalUnread > 0 && (
                  <span style={{
                    marginLeft: 8, background: "#ef4444", color: "#fff",
                    fontSize: 10, borderRadius: 10, padding: "1px 7px", fontWeight: 700,
                  }}>{totalUnread}</span>
                )}
              </span>
              <button
                onClick={() => { setView("compose"); setActiveId(null); }}
                title="New Message"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.28)",
                  color: "#fff", fontSize: 15, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✏️</button>
            </div>

            {/* Search bar — never scrolls */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                  fontSize: 13, color: "#94a3b8", pointerEvents: "none",
                }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search conversations…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px 8px 30px",
                    border: "1.5px solid #e2e8f0", borderRadius: 10,
                    fontSize: 13, outline: "none", background: "#fff",
                    color: "#1e293b", boxSizing: "border-box", fontFamily: "inherit",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#2563eb"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
            </div>

            {/* ★ Scrollable conversation list ★ */}
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                  <div style={{ fontSize: 13 }}>Loading…</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                  <p style={{ fontSize: 13, margin: 0 }}>
                    {search ? "No results found" : "No conversations yet"}
                  </p>
                </div>
              ) : filtered.map(c => {
                const last     = c.thread[c.thread.length - 1];
                const isActive = activeId === c.id && view === "chat";
                return (
                  <div
                    key={c.id}
                    onClick={() => openConvo(c)}
                    style={{
                      padding: "11px 14px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 11,
                      background: isActive ? "#eff6ff" : "transparent",
                      borderLeft: `3px solid ${isActive ? "#2563eb" : "transparent"}`,
                      borderBottom: "1px solid #f0f4f8",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f1f5f9"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%",
                        background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: "#fff",
                      }}>{c.initials}</div>
                      {c.unread > 0 && (
                        <div style={{
                          position: "absolute", top: -2, right: -2,
                          width: 17, height: 17, borderRadius: "50%",
                          background: "#ef4444", border: "2px solid #f8fafc",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, fontWeight: 800, color: "#fff",
                        }}>{c.unread}</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "baseline", marginBottom: 3,
                      }}>
                        <span style={{
                          fontSize: 13.5, fontWeight: c.unread > 0 ? 800 : 600,
                          color: "#1a1f2e", whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140,
                        }}>{c.name}</span>
                        <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0, marginLeft: 4 }}>
                          {fmtTime(last?.created_at || last?.time)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 12, whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis",
                        color: c.unread > 0 ? "#1e3a5f" : "#94a3b8",
                        fontWeight: c.unread > 0 ? 600 : 400,
                      }}>{lastPreview(c)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══ RIGHT: Chat / Compose / Idle ══ */}
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* ── COMPOSE VIEW ── */}
            {view === "compose" && (
              <>
                <div style={{
                  padding: "13px 20px", borderBottom: "1px solid #e2e8f0",
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#1e3a5f", flexShrink: 0,
                }}>
                  <button
                    onClick={() => setView("idle")}
                    style={{
                      background: "rgba(255,255,255,0.15)", border: "none",
                      cursor: "pointer", color: "#fff", fontWeight: 700,
                      width: 30, height: 30, borderRadius: "50%", fontSize: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >←</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>New Message</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px" }}>
                  {sent ? (
                    <div style={{ textAlign: "center", paddingTop: 80 }}>
                      <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1f2e", margin: "0 0 6px" }}>Message sent!</p>
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Redirecting to conversation…</p>
                    </div>
                  ) : (
                    <form onSubmit={sendNew} style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
                      <div>
                        <label style={ST.lbl}>To (Student)</label>
                        <select value={newMsg.receiver_id} onChange={e => setNewMsg(p => ({ ...p, receiver_id: e.target.value }))} required style={ST.inp}>
                          <option value="">Select student…</option>
                          {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={ST.lbl}>Subject (optional)</label>
                        <input type="text" value={newMsg.subject} onChange={e => setNewMsg(p => ({ ...p, subject: e.target.value }))} placeholder="Subject…" style={ST.inp} />
                      </div>
                      <div>
                        <label style={ST.lbl}>Message</label>
                        <textarea value={newMsg.body} onChange={e => setNewMsg(p => ({ ...p, body: e.target.value }))} placeholder="Write your message…" required style={{ ...ST.inp, minHeight: 140, resize: "vertical" }} />
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="submit" disabled={sending} style={ST.btnPrimary}>{sending ? "Sending…" : "Send Message →"}</button>
                        <button type="button" onClick={() => setView("idle")} style={ST.btnSecondary}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}

            {/* ── CHAT VIEW ── */}
            {view === "chat" && activeConvo && (
              <>
                {/* Chat header — fixed, never scrolls */}
                <div style={{
                  padding: "11px 20px", borderBottom: "1px solid #e2e8f0",
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#1e3a5f", flexShrink: 0,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "linear-gradient(135deg,#2563eb,#60a5fa)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
                  }}>{activeConvo.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{activeConvo.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Student</div>
                  </div>
                </div>

                {/*
                  ★ THE SCROLLABLE MESSAGE AREA ★
                  flex:1          → takes all remaining vertical space
                  overflowY:auto  → scrolls when content exceeds the area
                  display:flex + flexDirection:column → messages stack naturally
                  This is the core fix that makes message history scrollable
                  while keeping the header and input bar fixed in place.
                */}
                <div style={{
                  flex: 1,
                  overflowY: "auto",
                  overflowX: "hidden",
                  padding: "12px 20px 4px",
                  display: "flex",
                  flexDirection: "column",
                  background: "#fff",
                }}>
                  {thread.length === 0 ? (
                    <div style={{
                      flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      color: "#94a3b8", paddingBottom: 40,
                    }}>
                      <div style={{ fontSize: 44, marginBottom: 10 }}>👋</div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#64748b", margin: "0 0 4px" }}>
                        Start the conversation
                      </p>
                      <p style={{ fontSize: 13, margin: 0 }}>Send a message to {activeConvo.name}</p>
                    </div>
                  ) : (
                    thread.map((msg, i) => (
                      <Bubble
                        key={msg.id}
                        msg={msg}
                        prevMsg={thread[i - 1] || null}
                        nextMsg={thread[i + 1] || null}
                        initials={activeConvo.initials}
                      />
                    ))
                  )}
                  {/* Scroll anchor */}
                  <div ref={bottomRef} style={{ height: 8, flexShrink: 0 }} />
                </div>

                {/* Input bar — fixed at bottom, never scrolls */}
                <div style={{
                  padding: "10px 14px",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex", gap: 8, alignItems: "flex-end",
                  background: "#fff", flexShrink: 0,
                }}>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                    }}
                    placeholder={`Message ${activeConvo.name}…  (Enter to send, Shift+Enter for newline)`}
                    rows={1}
                    style={{
                      flex: 1, padding: "10px 14px",
                      border: "1.5px solid #e2e8f0", borderRadius: 22,
                      fontSize: 13.5, fontFamily: "inherit",
                      outline: "none", resize: "none", lineHeight: 1.5,
                      maxHeight: 120, overflowY: "auto",
                      color: "#1e293b", background: "#f8fafc",
                      transition: "border-color 0.2s",
                    }}
                    onFocus={e => e.target.style.borderColor = "#2563eb"}
                    onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!text.trim() || sending}
                    style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: text.trim()
                        ? "linear-gradient(135deg,#1e3a5f,#2563eb)"
                        : "#e2e8f0",
                      border: "none",
                      color: text.trim() ? "#fff" : "#94a3b8",
                      fontSize: 18, cursor: text.trim() ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "all 0.2s",
                      boxShadow: text.trim() ? "0 2px 8px rgba(37,99,235,0.3)" : "none",
                    }}
                  >➤</button>
                </div>
              </>
            )}

            {/* ── IDLE STATE ── */}
            {view === "idle" && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "#94a3b8", padding: 40, textAlign: "center",
              }}>
                <div style={{ fontSize: 58, marginBottom: 16 }}>💬</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#64748b", margin: "0 0 6px" }}>
                  Student Messages
                </p>
                <p style={{ fontSize: 13, margin: "0 0 24px" }}>
                  Select a conversation or start a new one
                </p>
                <button onClick={() => setView("compose")} style={ST.btnPrimary}>
                  ✏️ New Message
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Thin custom scrollbars */}
        <style>{`
          div::-webkit-scrollbar { width: 5px; height: 5px; }
          div::-webkit-scrollbar-track { background: transparent; }
          div::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          div::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}</style>

      </main>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────
const ST = {
  lbl: {
    fontSize: 11, fontWeight: 700, color: "#475569",
    letterSpacing: "0.5px", textTransform: "uppercase",
    display: "block", marginBottom: 7,
  },
  inp: {
    width: "100%", padding: "10px 13px",
    border: "1.5px solid #e0e3ec", borderRadius: 10,
    fontSize: 14, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", color: "#1a1f2e", background: "#f8fafc",
  },
  btnPrimary: {
    padding: "11px 28px",
    background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
    color: "#fff", border: "none", borderRadius: 10,
    fontWeight: 700, fontSize: 14, cursor: "pointer",
    boxShadow: "0 2px 8px rgba(37,99,235,0.28)",
  },
  btnSecondary: {
    padding: "11px 22px", background: "#f1f5f9",
    color: "#64748b", border: "none", borderRadius: 10,
    fontWeight: 600, fontSize: 14, cursor: "pointer",
  },
};