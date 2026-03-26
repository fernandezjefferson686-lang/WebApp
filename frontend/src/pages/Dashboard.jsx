import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/student.css";
import "../css/dashboard.css";

const API         = "http://127.0.0.1:8000/api";
const STORAGE_URL = "http://127.0.0.1:8000/storage";
const COUNSELOR   = "Julie Maestrada";

function Dashboard() {
  const navigate = useNavigate();

  const [requests,  setRequests]  = useState([]);
  const [caseNotes, setCaseNotes] = useState([]);
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [time,      setTime]      = useState(new Date());

  const getToken = () => JSON.parse(localStorage.getItem("user"))?.token;
  const getUser  = () => JSON.parse(localStorage.getItem("user")) || {};

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const user = getUser();
    if (!user?.token) { navigate("/", { replace: true }); return; }
    window.history.pushState(null, "", window.location.href);
    const handleBack = () => window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handleBack);
    loadData();
    return () => window.removeEventListener("popstate", handleBack);
  }, []); // eslint-disable-line

  const loadData = async () => {
    const token = getToken();
    if (!token) return;
    const hdrs = { Authorization: `Bearer ${token}` };
    try {
      const [reqRes, noteRes, profRes] = await Promise.all([
        axios.get(`${API}/user/counseling-requests`, { headers: hdrs }),
        axios.get(`${API}/user/case-notes`,           { headers: hdrs }),
        axios.get(`${API}/user/profile`,              { headers: hdrs }),
      ]);
      setRequests(reqRes.data?.requests || reqRes.data || []);
      setCaseNotes(noteRes.data?.notes  || []);
      setProfile(profRes.data?.profile  || null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ── Derived values ──
  const user       = getUser();
  const firstName  = profile?.full_name?.split(" ")[0] || user?.name?.split(" ")[0] || "Student";
  const profilePic = profile?.profile_pic ? `${STORAGE_URL}/${profile.profile_pic}` : null;
  const initials   = (profile?.full_name || user?.name || "S").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

  const pending   = requests.filter(r => r.status === "Pending").length;
  const upcoming  = requests.filter(r => {
    if (r.status !== "Approved") return false;
    const d = new Date(r.session_date || r.date);
    return !isNaN(d) && d >= new Date();
  }).length;
  const completed = requests.filter(r => {
    if (r.status !== "Approved") return false;
    const d = new Date(r.session_date || r.date);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    return !isNaN(d) && d <= todayEnd;
  }).length;
  const followUp  = caseNotes.find(n => n.follow_up_needed && n.fu_status !== "Completed");

  const nextSession = requests
    .filter(r => r.status === "Approved" && new Date(r.session_date || r.date) >= new Date())
    .sort((a, b) => new Date(a.session_date || a.date) - new Date(b.session_date || b.date))[0] || null;

  const recentReqs = [...requests]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  const latestNote = caseNotes.length
    ? [...caseNotes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    : null;

  // ── Helpers ──
  const greeting = () => {
    const h = time.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const fmtDate = raw => {
    if (!raw) return "—";
    const d = new Date(raw);
    return isNaN(d) ? raw : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const fmtTime = raw => {
    if (!raw) return "";
    if (/AM|PM/i.test(raw)) return raw;
    const [h, m] = raw.split(":");
    return `${+h % 12 || 12}:${m} ${+h >= 12 ? "PM" : "AM"}`;
  };

  const statusStyle = s => {
    if (s === "Approved")  return { background:"#f0fdf4", color:"#16a34a", borderColor:"#86efac" };
    if (s === "Pending")   return { background:"#fff7ed", color:"#d97706", borderColor:"#fcd34d" };
    if (s === "Rejected")  return { background:"#fef2f2", color:"#dc2626", borderColor:"#fca5a5" };
    if (s === "Cancelled") return { background:"#f8fafc", color:"#64748b", borderColor:"#e2e8f0" };
    return { background:"#f8fafc", color:"#64748b", borderColor:"#e2e8f0" };
  };

  const typeAccent = type => {
    if (!type) return "#2563eb";
    const t = type.toLowerCase();
    if (t.includes("crisis"))   return "#dc2626";
    if (t.includes("academic")) return "#2563eb";
    if (t.includes("career"))   return "#059669";
    return "#ea580c";
  };

  const quickActions = [
    { label:"Book a Session",  icon:"📋", path:"/counseling-request", bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe", desc:"Request a new counseling appointment" },
    { label:"My Records",      icon:"📁", path:"/counseling-records", bg:"#f0fdf4", color:"#15803d", border:"#86efac", desc:"View session notes from your counselor" },
    { label:"Session History", icon:"🕐", path:"/counseling-history", bg:"#fdf4ff", color:"#7e22ce", border:"#e9d5ff", desc:"See all your past counseling sessions" },
    { label:"Messages",        icon:"💬", path:"/messages",           bg:"#ecfdf5", color:"#065f46", border:"#6ee7b7", desc:"Chat with your counselor" },
  ];

  const stats = [
    { label:"Total Requests",    value: requests.length, icon:"📋", accent:"#2563eb" },
    { label:"Pending",           value: pending,          icon:"⏳", accent: pending>0  ? "#d97706" : "#64748b" },
    { label:"Upcoming Sessions", value: upcoming,         icon:"📅", accent: upcoming>0 ? "#059669" : "#64748b" },
    { label:"Completed",         value: completed,        icon:"✅", accent:"#16a34a" },
  ];

  return (
    <div>

      {/* ══ HERO BANNER ══ */}
      <div className="db-hero">
        <div className="db-hero-circle-1" />
        <div className="db-hero-circle-2" />

        <div className="db-hero-left">
          <div className="db-hero-avatar">
            {profilePic
              ? <img src={profilePic} alt="" onError={e => { e.target.style.display = "none"; }} />
              : initials}
          </div>
          <div>
            <div className="db-hero-tag">Student Portal</div>
            <h1 className="db-hero-title">{greeting()}, {firstName} 👋</h1>
            <p className="db-hero-sub">
              {profile?.department
                ? `${profile.department}${profile.year_level ? ` · Year ${profile.year_level}` : ""}`
                : "Welcome to your counseling portal"}
            </p>
          </div>
        </div>

        {nextSession ? (
          <div className="db-next-session" onClick={() => navigate("/counseling-request")}>
            <div className="db-next-session-label">Next Session</div>
            <div className="db-next-session-date">📅 {fmtDate(nextSession.session_date || nextSession.date)}</div>
            <div className="db-next-session-meta">
              🕐 {fmtTime(nextSession.session_time || nextSession.time)} · {nextSession.mode}
            </div>
          </div>
        ) : (
          <button className="db-hero-cta" onClick={() => navigate("/counseling-request")}>
            📋 Book a Session
          </button>
        )}
      </div>

      {/* ══ STATS ══ */}
      <div className="s-stats" style={{ marginBottom: 20 }}>
        {stats.map((s, i) => (
          <div key={i} className="s-stat" style={{ borderTop: `3px solid ${s.accent}` }}>
            <span className="s-stat-icon">{s.icon}</span>
            <div className="s-stat-val" style={{ color: s.accent }}>{loading ? "—" : s.value}</div>
            <div className="s-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══ FOLLOW-UP ALERT ══ */}
      {followUp && (
        <div className="db-followup-alert" onClick={() => navigate("/counseling-records")}>
          <span className="db-followup-icon">🔄</span>
          <div style={{ flex: 1 }}>
            <div className="db-followup-title">Follow-up Session Scheduled</div>
            <div className="db-followup-desc">
              Your counselor has scheduled a follow-up session
              {followUp.next_session_date
                ? ` on ${fmtDate(followUp.next_session_date)}${followUp.next_session_time ? ` at ${fmtTime(followUp.next_session_time)}` : ""}`
                : ""}. Check your Counseling Records for details.
            </div>
          </div>
          <span className="db-followup-link">View →</span>
        </div>
      )}

      {/* ══ TWO-COLUMN LAYOUT ══ */}
      <div className="db-grid">

        {/* ── LEFT ── */}
        <div className="db-left">

          {/* Quick Actions */}
          <div className="s-card">
            <h3 className="s-card-title" style={{ marginBottom: 16 }}>⚡ Quick Actions</h3>
            <div className="db-actions-grid">
              {quickActions.map(({ label, icon, path, bg, color, border, desc }) => (
                <button key={path} className="db-action-btn"
                  style={{ background: bg, border: `1.5px solid ${border}` }}
                  onClick={() => navigate(path)}>
                  <span className="db-action-icon">{icon}</span>
                  <span className="db-action-label" style={{ color }}>{label}</span>
                  <span className="db-action-desc">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Requests */}
          <div className="s-card">
            <div className="db-req-header">
              <h3 className="s-card-title" style={{ margin: 0 }}>📋 My Recent Requests</h3>
              <button className="db-req-link" onClick={() => navigate("/counseling-request")}>
                View all →
              </button>
            </div>

            {loading ? (
              <div className="db-loading">Loading…</div>
            ) : recentReqs.length === 0 ? (
              <div className="s-empty">
                <div className="s-empty-icon">📭</div>
                <p>No requests yet.</p>
                <button className="s-btn-primary" onClick={() => navigate("/counseling-request")} style={{ marginTop: 8 }}>
                  Book Your First Session
                </button>
              </div>
            ) : (
              <div className="db-req-list">
                {recentReqs.map(r => (
                  <div key={r.id} className="db-req-item"
                    style={{ borderLeft: `3px solid ${typeAccent(r.session_type || r.type)}` }}>
                    <div className="db-req-info">
                      <div className="db-req-type">{r.session_type || r.type || "General"}</div>
                      <div className="db-req-meta">
                        📅 {fmtDate(r.session_date || r.date)}
                        {(r.session_time || r.time) && <> · 🕐 {fmtTime(r.session_time || r.time)}</>}
                        {r.mode && <> · {r.mode}</>}
                      </div>
                    </div>
                    <span className="db-status-pill" style={statusStyle(r.status)}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="db-right">

          {/* Counselor card */}
          <div className="s-card db-sidebar-card">
            <h3 className="s-card-title" style={{ marginBottom: 14, fontSize: 13 }}>🩺 Your Counselor</h3>
            <div className="db-counselor-row">
              <div className="db-counselor-avatar">JM</div>
              <div>
                <div className="db-counselor-name">{COUNSELOR}</div>
                <div className="db-counselor-role">Guidance Counselor</div>
              </div>
            </div>
            <div className="db-counselor-info">
              <div className="db-counselor-info-row"><span>📍</span> Guidance Office, Room 201</div>
              <div className="db-counselor-info-row"><span>🕐</span> Mon–Fri, 8AM–5PM</div>
            </div>
            <button className="s-btn-primary" onClick={() => navigate("/counseling-request")}
              style={{ width: "100%", fontSize: 13 }}>
              📋 Request Session
            </button>
          </div>

          {/* Tips card */}
          <div className="s-card db-sidebar-card" style={{ padding: "18px 20px" }}>
            <h3 className="s-card-title" style={{ marginBottom: 12, fontSize: 13 }}>💡 Counseling Tips</h3>
            <div className="db-tips-list">
              {[
                { icon:"🧘", tip:"Take 5 deep breaths before your session to calm your nerves." },
                { icon:"📝", tip:"Write down your main concerns beforehand so you don't forget." },
                { icon:"🤝", tip:"Be honest with your counselor — everything is confidential." },
                { icon:"📅", tip:"Attend follow-up sessions — they help track your progress." },
              ].map((item, i) => (
                <div key={i} className="db-tip-row">
                  <span className="db-tip-icon">{item.icon}</span>
                  <span className="db-tip-text">{item.tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Latest session note */}
          {latestNote && (
            <div className="s-card db-sidebar-card" style={{ padding: "18px 20px" }}>
              <div className="db-note-header">
                <h3 className="s-card-title" style={{ margin: 0, fontSize: 13 }}>📝 Latest Session Note</h3>
                <button className="db-note-link" onClick={() => navigate("/counseling-records")}>
                  View all →
                </button>
              </div>
              <div className="db-note-date">
                {fmtDate(latestNote.created_at)} · {latestNote.session_type || "Session"}
              </div>
              <div className="db-note-body">
                {latestNote.summary?.slice(0, 120)}{latestNote.summary?.length > 120 ? "…" : ""}
              </div>
              {latestNote.follow_up_needed && (
                <div className="db-note-followup">
                  🔄 Follow-up scheduled
                  {latestNote.next_session_date && ` · ${fmtDate(latestNote.next_session_date)}`}
                  {latestNote.next_session_time && ` at ${fmtTime(latestNote.next_session_time)}`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;