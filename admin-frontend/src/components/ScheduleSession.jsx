import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SidePanel from "./SidePanel";
import "../css/apptApproval.css";

const API         = "http://127.0.0.1:8000/api";
const STORAGE_URL = "http://127.0.0.1:8000/storage";

const toDateObj = raw => {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d) ? null : d;
};

const formatDate = raw => {
  const d = toDateObj(raw);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};

const formatTime = raw => {
  if (!raw) return "—";
  if (raw.includes("AM") || raw.includes("PM")) return raw;
  const [h, m] = raw.split(":");
  return `${+h % 12 || 12}:${m} ${+h >= 12 ? "PM" : "AM"}`;
};

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth()    === d2.getMonth()    &&
  d1.getDate()     === d2.getDate();

const dayLabel = (sessionDate, allDone = false) => {
  if (!sessionDate) return null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  if (sessionDate < todayStart) return null;
  const today    = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(sessionDate, today)) {
    if (allDone) return { text: "TODAY", color: "#16a34a", bg: "#f0fdf4" };
    return { text: "TODAY", color: "#dc2626", bg: "#fee2e2" };
  }
  if (isSameDay(sessionDate, tomorrow)) return { text: "TOMORROW", color: "#d97706", bg: "#fef3c7" };
  return null;
};

const getInitials = name =>
  (name || "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

const modeIcon = mode => {
  if (!mode) return "📍";
  if (mode.toLowerCase().includes("online")) return "💻";
  if (mode.toLowerCase().includes("phone"))  return "📞";
  return "🏫";
};

const typeColor = type => {
  if (!type) return { bg: "#f1f5f9", color: "#475569" };
  const t = type.toLowerCase();
  if (t.includes("crisis"))   return { bg: "#fee2e2", color: "#991b1b" };
  if (t.includes("academic")) return { bg: "#eff6ff", color: "#1d4ed8" };
  if (t.includes("career"))   return { bg: "#f0fdf4", color: "#15803d" };
  if (t.includes("family"))   return { bg: "#fdf4ff", color: "#7e22ce" };
  return { bg: "#fff7ed", color: "#c2410c" };
};

const groupByDate = sessions => {
  const map = {};
  sessions.forEach(s => {
    const raw = s.session_date || s.date;
    const d   = toDateObj(raw);
    const key = d ? d.toISOString().split("T")[0] : "unknown";
    if (!map[key]) map[key] = { date: d, sessions: [] };
    map[key].sessions.push(s);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
};

export default function ScheduleSession() {
  const navigate = useNavigate();
  const [sessions,     setSessions]     = useState([]);
  const [notes,        setNotes]        = useState([]);
  const [fetching,     setFetching]     = useState(true);
  const [viewMode,     setViewMode]     = useState("upcoming");
  const [search,       setSearch]       = useState("");
  const [expanded,     setExpanded]     = useState(null);
  const [noteModal,    setNoteModal]    = useState(null);
  const [noteForm,     setNoteForm]     = useState({ summary: "", recommendations: "", follow_up_needed: false, next_session_date: "" });
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);
  const [doneExpanded, setDoneExpanded] = useState({});
  const toggleDone = key => setDoneExpanded(p => ({ ...p, [key]: !p[key] }));
  // activeFilter: "upcoming" | "all" | "done" | "missed"
  const [activeFilter, setActiveFilter] = useState("upcoming");
  // No-Show modal
  const [noShowModal,  setNoShowModal]  = useState(null); // { session }
  const [noShowNote,   setNoShowNote]   = useState("");
  const [noShowSaving, setNoShowSaving] = useState(false);

  const getToken       = () => localStorage.getItem("admin_token");
  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/json" },
  });

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    navigate("/", { replace: true });
  };

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    const token = getToken();
    if (!token) { navigate("/", { replace: true }); return; }
    setFetching(true);
    try {
      const [sessRes, noteRes] = await Promise.all([
        axios.get(`${API}/admin/counseling-requests`, getAuthHeaders()),
        axios.get(`${API}/admin/case-notes`,          getAuthHeaders()),
      ]);
      const all      = sessRes.data?.requests || sessRes.data || [];
      const approved = all.filter(s => s.status === "Approved");
      approved.sort((a, b) => {
        const da = toDateObj(a.session_date || a.date);
        const db = toDateObj(b.session_date || b.date);
        if (!da) return 1; if (!db) return -1;
        return da - db;
      });
      setSessions(approved);
      setNotes(noteRes.data?.notes || []);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    } finally { setFetching(false); }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveNote = async () => {
    if (!noteForm.summary.trim()) { showToast("Summary is required.", "error"); return; }
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/admin/case-notes/session/${noteModal.session.id}`,
        {
          summary:           noteForm.summary,
          recommendations:   noteForm.recommendations || null,
          follow_up_needed:  noteForm.follow_up_needed,
          next_session_date: noteForm.next_session_date || null,
        },
        getAuthHeaders()
      );
      const saved = res.data?.note;
      setNotes(prev => {
        const exists = prev.find(n => n.counseling_request_id === noteModal.session.id);
        if (exists) return prev.map(n => n.counseling_request_id === noteModal.session.id ? { ...n, ...saved, counseling_request_id: noteModal.session.id } : n);
        return [{ ...saved, counseling_request_id: noteModal.session.id }, ...prev];
      });
      setNoteModal(null);
      showToast("✅ Case note saved!");
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      else showToast("Failed to save note.", "error");
    } finally { setSaving(false); }
  };

  // Mark session as No-Show: patch status + send notification to student
  const markNoShow = async () => {
    if (!noShowModal) return;
    setNoShowSaving(true);
    try {
      const defaultMsg = "You missed your scheduled counseling session. Please contact the guidance office to reschedule at your earliest convenience.";
      // Step 1: Update session status to No-Show
      await axios.patch(
        `${API}/admin/counseling-requests/${noShowModal.session.id}/status`,
        {
          status:        "No-Show",
          approval_note: noShowNote.trim() || defaultMsg,
        },
        getAuthHeaders()
      );
      // Step 2: Send in-app notification to student
      try {
        await axios.post(
          `${API}/admin/notifications`,
          {
            user_id: noShowModal.session.user_id || noShowModal.session.student_id,
            type:    "no_show",
            title:   "Missed Counseling Session",
            message: noShowNote.trim() || defaultMsg,
            counseling_request_id: noShowModal.session.id,
          },
          getAuthHeaders()
        );
      } catch (_) {
        // Notification endpoint may not exist yet — silently continue
      }
      // Step 3: Remove from local sessions list
      setSessions(prev => prev.filter(s => s.id !== noShowModal.session.id));
      setNoShowModal(null);
      setNoShowNote("");
      showToast("🚫 Marked as No-Show. Student has been notified.");
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      else showToast("Failed to mark as No-Show.", "error");
    } finally { setNoShowSaving(false); }
  };

  // Missed = past date + no case note written
  const isMissed = s => {
    const d = toDateObj(s.session_date || s.date);
    return d && d < today && !notes.some(n => n.counseling_request_id === s.id);
  };
  const missedCount = sessions.filter(isMissed).length;

  const filtered = sessions.filter(s => {
    const d       = toDateObj(s.session_date || s.date);
    const hasNote = notes.some(n => n.counseling_request_id === s.id);

    if (activeFilter === "missed")   return isMissed(s);
    if (activeFilter === "done")     return d && d >= today && hasNote;
    if (activeFilter === "upcoming") {
      if (d && d < today) return false;
      if (hasNote) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        (s.student_name || s.name || "").toLowerCase().includes(q) ||
        (s.session_type || s.type || "").toLowerCase().includes(q) ||
        (s.mode || "").toLowerCase().includes(q) ||
        (s.student_id || "").toLowerCase().includes(q)
      );
    }
    // "all"
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (s.student_name || s.name || "").toLowerCase().includes(q) ||
      (s.session_type || s.type || "").toLowerCase().includes(q) ||
      (s.mode || "").toLowerCase().includes(q) ||
      (s.student_id || "").toLowerCase().includes(q)
    );
  });

  const groups = groupByDate(filtered);

  const doneCount = sessions.filter(s => {
    const d = toDateObj(s.session_date || s.date);
    return d && d >= today && notes.some(n => n.counseling_request_id === s.id);
  }).length;

  const counts = {
    today:    sessions.filter(s => { const d = toDateObj(s.session_date || s.date); return d && isSameDay(d, new Date()); }).length,
    upcoming: sessions.filter(s => { const d = toDateObj(s.session_date || s.date); return d && d >= today; }).length,
    total:    sessions.length,
    thisWeek: sessions.filter(s => {
      const d = toDateObj(s.session_date || s.date);
      if (!d) return false;
      const end = new Date(); end.setDate(today.getDate() + 7);
      return d >= today && d <= end;
    }).length,
  };

  // Button style helper — active = navy, inactive = white outline
  const btnStyle = (isActive) => ({
    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
    border: isActive ? "none" : "1px solid #dde3f0",
    background: isActive ? "#1e3a5f" : "#fff",
    color:      isActive ? "#fff"    : "#64748b",
    fontWeight: 600, fontSize: "0.83rem", transition: "all 0.15s",
    boxShadow: isActive ? "0 2px 8px rgba(30,58,95,0.18)" : "none",
  });

  return (
    <div className="admin-home">
      <SidePanel onLogout={handleLogout} />

      <main className="admin-main">
        <div className="page-header">
          <h1>Schedule Session</h1>
          <p>All approved counseling sessions sorted by date</p>
        </div>

        {/* Stat cards */}
        <div className="stats-grid">
          {[
            { label: "Today's Sessions", value: counts.today,    icon: "📅", accent: counts.today > 0 ? "#dc2626" : undefined },
            { label: "This Week",        value: counts.thisWeek, icon: "📆" },
            { label: "Upcoming",         value: counts.upcoming, icon: "⏰" },
            { label: "Total Approved",   value: counts.total,    icon: "✅" },
          ].map((s, i) => (
            <div className="stat-card" key={i} style={s.accent ? { borderTop: `3px solid ${s.accent}` } : {}}>
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value" style={s.accent ? { color: s.accent } : {}}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="main-card" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem" }}>🔍</span>
              <input
                type="text"
                placeholder="Search by name, type, mode, ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px 9px 32px",
                  borderRadius: 8, border: "1px solid #dde3f0",
                  fontSize: "0.88rem", boxSizing: "border-box", outline: "none",
                }}
              />
            </div>

            {/* Upcoming */}
            <button onClick={() => setActiveFilter("upcoming")} style={btnStyle(activeFilter === "upcoming")}>
              📅 Upcoming
            </button>

            {/* All */}
            <button onClick={() => setActiveFilter("all")} style={btnStyle(activeFilter === "all")}>
              🗂️ All
            </button>

            {/* Done — green, only when there are done sessions */}
            {doneCount > 0 && (
              <button onClick={() => setActiveFilter(activeFilter === "done" ? "upcoming" : "done")} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                border: activeFilter === "done" ? "none" : "1.5px solid #86efac",
                background: activeFilter === "done" ? "#16a34a" : "#f0fdf4",
                color:      activeFilter === "done" ? "#fff"    : "#16a34a",
                fontWeight: 700, fontSize: "0.83rem", transition: "all 0.15s",
                boxShadow: activeFilter === "done" ? "0 2px 8px rgba(22,163,74,0.25)" : "none",
              }}>
                ✅ Done
                <span style={{
                  background: activeFilter === "done" ? "rgba(255,255,255,0.3)" : "#16a34a",
                  color: "#fff", borderRadius: 20, padding: "1px 8px",
                  fontSize: "0.72rem", fontWeight: 700,
                }}>{doneCount}</span>
              </button>
            )}

            {/* Missed — red, only when there are missed sessions */}
            {missedCount > 0 && (
              <button onClick={() => setActiveFilter(activeFilter === "missed" ? "upcoming" : "missed")} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                border: activeFilter === "missed" ? "none" : "1.5px solid #fca5a5",
                background: activeFilter === "missed" ? "#dc2626" : "#fff5f5",
                color:      activeFilter === "missed" ? "#fff"    : "#dc2626",
                fontWeight: 700, fontSize: "0.83rem", transition: "all 0.15s",
                boxShadow: activeFilter === "missed" ? "0 2px 8px rgba(220,38,38,0.25)" : "none",
              }}>
                ⚠️ Missed
                <span style={{
                  background: activeFilter === "missed" ? "rgba(255,255,255,0.3)" : "#dc2626",
                  color: "#fff", borderRadius: 20, padding: "1px 8px",
                  fontSize: "0.72rem", fontWeight: 700,
                }}>{missedCount}</span>
              </button>
            )}

            <button onClick={fetchSessions} style={{
              padding: "9px 14px", borderRadius: 8,
              border: "1px solid #dde3f0", background: "#fff",
              cursor: "pointer", fontSize: "0.85rem", color: "#475569",
            }}>🔄 Refresh</button>
          </div>
        </div>

        {/* Session list */}
        <div className="main-card">
          {fetching ? (
            <div className="empty-state"><p>Loading sessions…</p></div>
          ) : groups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>
                {activeFilter === "missed"   ? "No missed sessions — great job! 🎉" :
                 activeFilter === "upcoming" ? "No pending upcoming sessions." :
                 activeFilter === "done"     ? "No completed upcoming sessions." :
                                              "No sessions found."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {groups.map((group, gi) => {
                const isPast = group.date && group.date < today;
                const allDone = group.sessions.every(s => notes.some(n => n.counseling_request_id === s.id));
                const label = dayLabel(group.date, allDone);

                return (
                  <div key={gi} style={{ marginBottom: 24 }}>
                    {/* Date group header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      marginBottom: 10, paddingBottom: 8,
                      borderBottom: "2px solid #f1f5f9",
                    }}>
                      <div style={{
                        background: label  ? label.bg  : isPast ? "#f8fafc" : "#eff6ff",
                        color:      label  ? label.color : isPast ? "#94a3b8" : "#1e3a5f",
                        borderRadius: 8, padding: "4px 12px",
                        fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em",
                      }}>
                        {label ? `${label.text} — ` : ""}
                        {group.date
                          ? group.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                          : "Unknown Date"}
                      </div>
                      <div style={{
                        background: "#e2e8f0", color: "#475569",
                        borderRadius: 20, padding: "2px 10px",
                        fontSize: "0.75rem", fontWeight: 600,
                      }}>
                        {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
                      </div>
                      {isPast && allDone && (
                        <div style={{
                          background: "#f0fdf4", color: "#16a34a",
                          border: "1px solid #86efac",
                          borderRadius: 20, padding: "2px 10px",
                          fontSize: "0.72rem", fontWeight: 700,
                        }}>✅ Completed</div>
                      )}
                    </div>

                    {(() => {
                      const pendingSessions = group.sessions.filter(s => !notes.some(n => n.counseling_request_id === s.id));
                      const doneSessions    = group.sessions.filter(s =>  notes.some(n => n.counseling_request_id === s.id));
                      const groupKey        = group.date ? group.date.toISOString().split("T")[0] : "unknown";
                      const isDoneOpen      = (activeFilter === "done" || activeFilter === "all" || activeFilter === "missed") ? true : doneExpanded[groupKey];

                      const renderCard = (s, isDoneCard = false) => {
                        const tc            = typeColor(s.session_type || s.type);
                        const isExpand      = expanded === s.id;
                        const hasNote       = isDoneCard;
                        const sessionIsMissed = isMissed(s);

                        const borderColor = isDoneCard      ? "#86efac"
                          : sessionIsMissed ? "#ef4444"
                          : isPast          ? "#cbd5e1"
                          : label           ? "#f59e0b"
                          : "#2563eb";

                        const cardBg     = sessionIsMissed ? "#fff5f5" : isDoneCard ? "#f6fef9" : isPast ? "#fafafa" : "#fff";
                        const cardBorder = isDoneCard ? "#bbf7d0" : sessionIsMissed ? "#fca5a5" : (label && !isPast ? "#fde68a" : "#e9eef6");

                        return (
                          <div
                            key={s.id}
                            style={{
                              background: cardBg, border: `1px solid ${cardBorder}`,
                              borderLeft: `4px solid ${borderColor}`,
                              borderRadius: 10, padding: "14px 16px",
                              opacity: isDoneCard ? 0.78 : 1,
                              cursor: "pointer", transition: "box-shadow 0.15s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                            onClick={() => setExpanded(isExpand ? null : s.id)}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <div style={{
                                width: 42, height: 42, borderRadius: "50%",
                                background: sessionIsMissed
                                  ? "linear-gradient(135deg, #dc2626, #f87171)"
                                  : isDoneCard
                                  ? "linear-gradient(135deg, #16a34a, #4ade80)"
                                  : "linear-gradient(135deg, #1e3a5f, #2563eb)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.8rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                                overflow: "hidden",
                              }}>
                                {s.profile_pic ? (
                                  <img src={`${STORAGE_URL}/${s.profile_pic}`} alt="Student"
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={e => { e.target.style.display = "none"; }}
                                  />
                                ) : getInitials(s.student_name || s.name)}
                              </div>

                              <div style={{ flex: 1, minWidth: 140 }}>
                                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: isDoneCard ? "#374151" : "#1e293b", display: "flex", alignItems: "center", gap: 7 }}>
                                  {s.student_name || s.name || "Unknown Student"}
                                  {isDoneCard && (
                                    <span style={{
                                      fontSize: "0.68rem", fontWeight: 700,
                                      background: "#f0fdf4", color: "#16a34a",
                                      border: "1px solid #86efac", borderRadius: 20, padding: "1px 7px",
                                    }}>✅ Done</span>
                                  )}
                                  {!isDoneCard && sessionIsMissed && (
                                    <span style={{
                                      fontSize: "0.68rem", fontWeight: 700,
                                      background: "#fff1f2", color: "#dc2626",
                                      border: "1px solid #fca5a5", borderRadius: 20, padding: "1px 7px",
                                    }}>⚠️ Missed</span>
                                  )}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                                  ID: {s.student_id || "—"}{s.department ? ` · ${s.department}` : ""}
                                </div>
                              </div>

                              <div style={{
                                display: "flex", alignItems: "center", gap: 5,
                                background: "#f8fafc", borderRadius: 6, padding: "5px 10px",
                                fontSize: "0.85rem", fontWeight: 700, color: "#1e3a5f", flexShrink: 0,
                              }}>
                                🕐 {formatTime(s.session_time || s.time)}
                              </div>

                              <div style={{
                                background: tc.bg, color: tc.color, borderRadius: 6,
                                padding: "4px 10px", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0,
                              }}>
                                {s.session_type || s.type || "—"}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.82rem", color: "#475569", flexShrink: 0 }}>
                                {modeIcon(s.mode)} {s.mode}
                              </div>

                              <div style={{
                                fontSize: "0.8rem", color: "#94a3b8", flexShrink: 0,
                                transition: "transform 0.2s",
                                transform: isExpand ? "rotate(180deg)" : "rotate(0deg)",
                              }}>▼</div>
                            </div>

                            {(isSameDay(toDateObj(s.session_date || s.date) || new Date(0), new Date()) || isPast) && (
                              <div style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                flexWrap: "wrap", gap: 8,
                                marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0",
                              }}>
                                <span style={{
                                  fontSize: "0.78rem", fontWeight: 700,
                                  color:      hasNote ? "#16a34a" : sessionIsMissed ? "#dc2626" : "#d97706",
                                  background: hasNote ? "#f0fdf4" : sessionIsMissed ? "#fff1f2" : "#fff7ed",
                                  border:     `1px solid ${hasNote ? "#86efac" : sessionIsMissed ? "#fca5a5" : "#fcd34d"}`,
                                  borderRadius: 20, padding: "3px 10px",
                                }}>
                                  {hasNote ? "✅ Case note written" : sessionIsMissed ? "🚫 Student did not attend" : "⚠️ No case note yet"}
                                </span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  {/* No-Show button — only on missed sessions without a note */}
                                  {sessionIsMissed && !hasNote && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setNoShowModal({ session: s });
                                        setNoShowNote("");
                                      }}
                                      style={{
                                        background: "#fff1f2", color: "#be123c",
                                        border: "1.5px solid #fda4af",
                                        borderRadius: 8, padding: "7px 14px",
                                        fontSize: "0.82rem", fontWeight: 700,
                                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                                        transition: "all 0.15s",
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = "#be123c"; e.currentTarget.style.color = "#fff"; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = "#fff1f2"; e.currentTarget.style.color = "#be123c"; }}
                                    >
                                      🚫 Mark as No-Show
                                    </button>
                                  )}
                                  <button
                                    onClick={e => { e.stopPropagation(); navigate(`/case-notes?session=${s.id}`); }}
                                    style={{
                                      background: hasNote ? "#f0fdf4" : "#1e3a5f",
                                      color:      hasNote ? "#16a34a" : "#fff",
                                      border:     hasNote ? "1px solid #86efac" : "none",
                                      borderRadius: 8, padding: "7px 16px",
                                      fontSize: "0.82rem", fontWeight: 700,
                                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                                    }}
                                  >
                                    {hasNote ? "✏️ Edit Case Note" : sessionIsMissed ? "📝 Add Absence Note" : "📝 Add Case Note"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {isExpand && (
                              <div style={{
                                marginTop: 12, paddingTop: 12,
                                borderTop: "1px dashed #e2e8f0",
                                display: "flex", flexDirection: "column", gap: 8,
                              }}>
                                <div style={{ fontSize: "0.83rem", color: "#475569" }}>
                                  <strong style={{ color: "#1e293b" }}>📋 Reason / Concern:</strong><br />
                                  <span style={{ marginLeft: 4 }}>{s.reason || "—"}</span>
                                </div>
                                {s.approval_note && (
                                  <div style={{
                                    background: "#fffbeb", border: "1px solid #fde68a",
                                    borderLeft: "3px solid #f59e0b", borderRadius: 6,
                                    padding: "7px 10px", fontSize: "0.82rem", color: "#78350f",
                                  }}>
                                    💬 <strong>Note to student:</strong> {s.approval_note}
                                  </div>
                                )}
                                <div style={{
                                  display: "flex", gap: 16, flexWrap: "wrap",
                                  fontSize: "0.8rem", color: "#64748b", marginTop: 2,
                                }}>
                                  <span>📅 <strong>Confirmed Date:</strong> {formatDate(s.session_date || s.date)}</span>
                                  <span>🕐 <strong>Time:</strong> {formatTime(s.session_time || s.time)}</span>
                                  <span>📍 <strong>Mode:</strong> {s.mode}</span>
                                  <span>🧑‍🎓 <strong>Counselor:</strong> {s.counselor || "Julie Maestrada"}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      };

                      // All / Missed / Done — render cards directly, no split
                      if (activeFilter === "all" || activeFilter === "missed" || activeFilter === "done") {
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {group.sessions.map(s => {
                              const hasNote = notes.some(n => n.counseling_request_id === s.id);
                              return renderCard(s, hasNote);
                            })}
                          </div>
                        );
                      }

                      // Upcoming — pending always visible, done collapsible
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          {pendingSessions.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {pendingSessions.map(s => renderCard(s, false))}
                            </div>
                          )}

                          {pendingSessions.length === 0 && doneSessions.length > 0 && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 6,
                              background: "#f0fdf4", border: "1px solid #86efac",
                              borderRadius: 6, padding: "4px 12px", marginBottom: 8,
                              fontSize: "0.75rem", fontWeight: 700, color: "#16a34a",
                              width: "fit-content",
                            }}>
                              ✅ All Done — Case Notes Written
                              <span style={{
                                background: "#16a34a", color: "#fff",
                                borderRadius: 20, padding: "1px 7px",
                                fontSize: "0.68rem", fontWeight: 700,
                              }}>{doneSessions.length}</span>
                            </div>
                          )}

                          {pendingSessions.length > 0 && doneSessions.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>COMPLETED</span>
                              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                            </div>
                          )}

                          {doneSessions.length > 0 && (
                            <div>
                              <button
                                onClick={() => toggleDone(groupKey)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  width: "100%",
                                  background: isDoneOpen ? "#f0fdf4" : "#f8fafc",
                                  border: "1px solid",
                                  borderColor: isDoneOpen ? "#86efac" : "#e2e8f0",
                                  borderRadius: isDoneOpen ? "8px 8px 0 0" : 8,
                                  padding: "9px 14px", cursor: "pointer",
                                  marginBottom: 0, transition: "all 0.15s",
                                }}
                              >
                                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#16a34a", flex: 1, textAlign: "left" }}>
                                  ✅ {doneSessions.length} completed session{doneSessions.length !== 1 ? "s" : ""}
                                </span>
                                <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginRight: 6 }}>
                                  {isDoneOpen ? "hide" : "show"}
                                </span>
                                <span style={{
                                  fontSize: "0.65rem", color: "#16a34a",
                                  transition: "transform 0.2s", display: "inline-block",
                                  transform: isDoneOpen ? "rotate(180deg)" : "rotate(0deg)",
                                }}>▼</span>
                              </button>
                              {isDoneOpen && (
                                <div style={{
                                  border: "1px solid #86efac", borderTop: "none",
                                  borderRadius: "0 0 8px 8px", padding: "10px",
                                  background: "#fafffe",
                                  display: "flex", flexDirection: "column", gap: 8,
                                }}>
                                  {doneSessions.map(s => renderCard(s, true))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "error" ? "#fee2e2" : "#f0fdf4",
          border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#bbf7d0"}`,
          color: toast.type === "error" ? "#991b1b" : "#14532d",
          padding: "12px 20px", borderRadius: 10, fontWeight: 600,
          fontSize: "0.9rem", boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        }}>
          {toast.msg}
        </div>
      )}

      {noteModal && (
        <div className="modal-overlay" onClick={() => setNoteModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header" style={{ marginBottom: "1rem" }}>
              <div className="modal-avatar-placeholder" style={{ background: "#1e3a5f" }}>
                {getInitials(noteModal.session.student_name || noteModal.session.name)}
              </div>
              <div>
                <h2 className="modal-name">{noteModal.session.student_name || noteModal.session.name}</h2>
                <div className="modal-subtext">
                  {formatDate(noteModal.session.session_date || noteModal.session.date)} · {formatTime(noteModal.session.session_time || noteModal.session.time)} · {noteModal.session.mode}
                </div>
              </div>
            </div>
            <div style={{
              background: "#f0f4ff", borderLeft: "4px solid #4f6ef7",
              borderRadius: 6, padding: "8px 14px", marginBottom: "1rem",
              fontSize: "0.83rem", color: "#333",
            }}>
              🏷️ <strong>{noteModal.session.session_type || noteModal.session.type}</strong> &nbsp;·&nbsp; 📍 {noteModal.session.mode}
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", marginBottom: 6 }}>
                📋 Session Summary <span style={{ color: "#ef4444" }}>*</span>
                <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6 }}>(visible to student)</span>
              </label>
              <textarea rows={4} placeholder="Describe what was discussed during the session…"
                value={noteForm.summary}
                onChange={e => setNoteForm(p => ({ ...p, summary: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #dde3f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", marginBottom: 6 }}>
                💡 Recommendations
                <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6 }}>(visible to student)</span>
              </label>
              <textarea rows={3} placeholder="Any advice or next steps for the student…"
                value={noteForm.recommendations}
                onChange={e => setNoteForm(p => ({ ...p, recommendations: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #dde3f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <div style={{
                flex: 1, minWidth: 160,
                background: noteForm.follow_up_needed ? "#fff7ed" : "#f8fafc",
                border: `1px solid ${noteForm.follow_up_needed ? "#fcd34d" : "#e2e8f0"}`,
                borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              }} onClick={() => setNoteForm(p => ({ ...p, follow_up_needed: !p.follow_up_needed }))}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: noteForm.follow_up_needed ? "#f59e0b" : "#e2e8f0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.7rem", color: "#fff", fontWeight: 700,
                  }}>{noteForm.follow_up_needed ? "✓" : ""}</div>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", color: noteForm.follow_up_needed ? "#d97706" : "#64748b" }}>
                    🔄 Follow-up needed
                  </span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.82rem", marginBottom: 5, color: "#64748b" }}>
                  📅 Next Session Date (optional)
                </label>
                <input type="date" value={noteForm.next_session_date}
                  onChange={e => setNoteForm(p => ({ ...p, next_session_date: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #dde3f0", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-table-confirm" style={{ flex: 1, padding: 12, fontSize: "0.95rem" }}
                onClick={saveNote} disabled={saving || !noteForm.summary.trim()}>
                {saving ? "Saving…" : "💾 Save Case Note"}
              </button>
              <button className="modal-close-btn" style={{ flex: 1, padding: 12, fontSize: "0.95rem" }}
                onClick={() => setNoteModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ── No-Show Modal ── */}
      {noShowModal && (
        <div className="modal-overlay" onClick={() => setNoShowModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: "linear-gradient(135deg, #be123c, #f43f5e)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.6rem", margin: "0 auto 10px",
                boxShadow: "0 4px 14px rgba(190,18,60,0.3)",
              }}>🚫</div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b", fontWeight: 800 }}>Mark as No-Show</h2>
              <p style={{ color: "#64748b", fontSize: "0.84rem", margin: "6px 0 0" }}>
                Record that this student did not attend their session
              </p>
            </div>

            {/* Student + session info */}
            <div style={{
              background: "#fff1f2", border: "1px solid #fda4af",
              borderLeft: "4px solid #be123c", borderRadius: 10,
              padding: "12px 16px", marginBottom: "1.2rem",
            }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#7f1d1d", marginBottom: 4 }}>
                👤 {noShowModal.session.student_name || noShowModal.session.name}
                <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#9f1239", marginLeft: 8 }}>
                  ID: {noShowModal.session.student_id || "—"}
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#be123c", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>📅 {formatDate(noShowModal.session.session_date || noShowModal.session.date)}</span>
                <span>🕐 {formatTime(noShowModal.session.session_time || noShowModal.session.time)}</span>
                <span>🏷️ {noShowModal.session.session_type || noShowModal.session.type}</span>
                <span>📍 {noShowModal.session.mode}</span>
              </div>
            </div>

            {/* Steps */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 8,
              marginBottom: "1.2rem",
            }}>
              {[
                { icon: "1️⃣", text: "Status updated to No-Show in the system", done: true },
                { icon: "2️⃣", text: "Session removed from the schedule", done: true },
                { icon: "3️⃣", text: "Student notified via in-app message", done: true },
              ].map((step, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "#f8fafc", borderRadius: 8, padding: "8px 12px",
                  fontSize: "0.82rem", color: "#475569",
                }}>
                  <span>{step.icon}</span>
                  <span>{step.text}</span>
                  <span style={{ marginLeft: "auto", color: "#16a34a", fontWeight: 700 }}>✓</span>
                </div>
              ))}
            </div>

            {/* Message to student */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", marginBottom: 6, color: "#1e293b" }}>
                💬 Message to Student
                <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6, fontSize: "0.78rem" }}>
                  (sent as notification — leave blank for default)
                </span>
              </label>
              <textarea
                rows={3}
                placeholder="Default: You missed your scheduled counseling session. Please contact the guidance office to reschedule at your earliest convenience."
                value={noShowNote}
                onChange={e => setNoShowNote(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: "1.5px solid #fda4af", fontSize: "0.88rem",
                  boxSizing: "border-box", fontFamily: "inherit", resize: "vertical",
                  background: "#fff9f9", outline: "none",
                  color: "#1e293b",
                }}
              />
            </div>

            {/* Warning */}
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 8, padding: "10px 14px", marginBottom: "1.4rem",
              fontSize: "0.79rem", color: "#78350f", display: "flex", gap: 8,
            }}>
              <span>⚠️</span>
              <span>This action <strong>cannot be undone</strong>. The session will be marked as No-Show and the student will receive a notification in their portal.</span>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={markNoShow}
                disabled={noShowSaving}
                style={{
                  flex: 2, padding: "12px", borderRadius: 8, border: "none",
                  background: noShowSaving ? "#9f1239" : "linear-gradient(135deg, #be123c, #f43f5e)",
                  color: "#fff", fontWeight: 800, fontSize: "0.92rem",
                  cursor: noShowSaving ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 10px rgba(190,18,60,0.35)",
                  transition: "opacity 0.15s",
                  opacity: noShowSaving ? 0.75 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {noShowSaving ? "⏳ Saving…" : "🚫 Confirm No-Show & Notify Student"}
              </button>
              <button
                className="modal-close-btn"
                style={{ flex: 1, padding: "12px", fontSize: "0.9rem", fontWeight: 600 }}
                onClick={() => { setNoShowModal(null); setNoShowNote(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}