import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SidePanel from "./SidePanel";
import "../css/sidepanel.css";

const API = "http://127.0.0.1:8000/api";

function AdminHome() {
  const navigate = useNavigate();
  const tok      = () => localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
  const hdrs     = () => ({ Authorization: `Bearer ${tok()}`, Accept: "application/json" });

  const [stats,    setStats]    = useState({ students:0, pending:0, sessions:0, followups:0, completed:0, casenotes:0 });
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [time,     setTime]     = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!tok()) { navigate("/", { replace: true }); return; }
    loadDashboard();
  }, []); // eslint-disable-line

  const loadDashboard = async () => {
    try {
      const [reqRes, noteRes] = await Promise.all([
        axios.get(`${API}/admin/counseling-requests`, { headers: hdrs() }),
        axios.get(`${API}/admin/case-notes`,          { headers: hdrs() }),
      ]);

      const requests  = reqRes.data?.requests  || reqRes.data  || [];
      const notes     = noteRes.data?.notes    || [];

      // Compute stats
      const pending   = requests.filter(r => r.status === "Pending").length;
      const approved  = requests.filter(r => r.status === "Approved").length;
      const today     = new Date(); today.setHours(23,59,59,999);
      const thisMonth = requests.filter(r => {
        const d = new Date(r.session_date || r.date);
        return r.status === "Approved" && !isNaN(d) && d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
      }).length;
      const followups = notes.filter(n => n.follow_up_needed).length;

      // Unique students from requests
      const uniqueStudents = new Set(requests.map(r => r.user_id)).size;

      setStats({
        students:  uniqueStudents,
        pending,
        sessions:  thisMonth,
        followups,
        completed: requests.filter(r => r.status === "Approved").length,
        casenotes: notes.length,
      });

      // Build recent activity from real data
      const acts = [];

      // Recent pending requests
      requests.filter(r => r.status === "Pending")
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0,3)
        .forEach(r => acts.push({
          icon:"📋", color:"#eff6ff", iconColor:"#2563eb",
          text:`New appointment request from ${r.student_name || "a student"}`,
          time: timeAgo(r.created_at), path:"/appointment-approval",
        }));

      // Recent case notes
      notes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0,2)
        .forEach(n => acts.push({
          icon:"📝", color:"#f0fdf4", iconColor:"#16a34a",
          text:`Case note saved for ${n.student_name || "a student"}`,
          time: timeAgo(n.created_at), path:"/case-notes",
        }));

      // Follow-ups
      notes.filter(n => n.follow_up_needed)
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0,1)
        .forEach(n => acts.push({
          icon:"🔄", color:"#fff7ed", iconColor:"#d97706",
          text:`Follow-up needed for ${n.student_name || "a student"}`,
          time: timeAgo(n.created_at), path:"/follow-up-status",
        }));

      // Sort all by recency (rough)
      setActivity(acts.slice(0,6));
    } catch(e) {
      if (e.response?.status === 401) { localStorage.removeItem("admin_token"); navigate("/"); }
    } finally { setLoading(false); }
  };

  const timeAgo = raw => {
    if (!raw) return "—";
    const diff = Math.floor((Date.now() - new Date(raw)) / 1000);
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  const greeting = () => {
    const h = time.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const fmtTime = d => d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  const fmtDate = d => d.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });

  const quickActions = [
    { label:"Review Appointments", icon:"✅", path:"/appointment-approval",  bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe", desc:"Approve or reject pending requests" },
    { label:"Schedule Session",    icon:"📅", path:"/schedulesession",        bg:"#f0fdf4", color:"#15803d", border:"#86efac", desc:"Manage upcoming sessions" },
    { label:"Case Notes",          icon:"📝", path:"/case-notes",             bg:"#fdf4ff", color:"#7e22ce", border:"#e9d5ff", desc:"Write and review session notes" },
    { label:"Follow-up Status",    icon:"🔄", path:"/follow-up-status",       bg:"#fff7ed", color:"#c2410c", border:"#fed7aa", desc:"Track students needing follow-up" },
    { label:"Appt. Approval",      icon:"📋", path:"/appointment-approval",   bg:"#fef2f2", color:"#b91c1c", border:"#fecaca", desc:"View all counseling requests" },
    { label:"Messages",            icon:"💬", path:"/notifications",               bg:"#ecfdf5", color:"#065f46", border:"#6ee7b7", desc:"Chat with students" },
  ];

  const statCards = [
    { label:"Total Students",    value:stats.students,  icon:"👩‍🎓", accent:"#2563eb", bg:"#eff6ff" },
    { label:"Pending Requests",  value:stats.pending,   icon:"⏳",  accent: stats.pending>0?"#d97706":"#64748b", bg:stats.pending>0?"#fff7ed":"#f8fafc" },
    { label:"Sessions This Month",value:stats.sessions, icon:"📅",  accent:"#059669", bg:"#ecfdf5" },
    { label:"Follow-ups Needed", value:stats.followups, icon:"🔄",  accent:stats.followups>0?"#dc2626":"#64748b", bg:stats.followups>0?"#fef2f2":"#f8fafc" },
  ];

  return (
    <div className="admin-home">
      <SidePanel onLogout={() => { localStorage.removeItem("admin_token"); navigate("/", { replace:true }); }}/>

      <main className="admin-main" style={{ paddingBottom: 40 }}>

        {/* ── Hero header ── */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)",
          borderRadius: 18, padding: "28px 32px", marginBottom: 24,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16,
          boxShadow: "0 8px 32px rgba(30,58,95,0.35)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,0.04)", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", bottom:-30, right:100, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.03)", pointerEvents:"none" }}/>

          <div>
            <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
              SCS Admin Portal
            </div>
            <h1 style={{ fontSize:26, fontWeight:800, color:"#fff", margin:"0 0 4px", fontFamily:"inherit" }}>
              {greeting()}, Counselor 👋
            </h1>
            <p style={{ color:"rgba(255,255,255,0.6)", fontSize:14, margin:0 }}>
              Here's what's happening in your counseling system today.
            </p>
          </div>

          {/* Live clock */}
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:28, fontWeight:800, color:"#fff", fontVariantNumeric:"tabular-nums", letterSpacing:"0.02em", fontFamily:"monospace" }}>
              {fmtTime(time)}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:2 }}>
              {fmtDate(time)}
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="stats-grid" style={{ marginBottom:24 }}>
          {statCards.map((s,i) => (
            <div key={i} className="stat-card" style={{
              borderTop:`3px solid ${s.accent}`,
              background:"#fff",
              cursor:"pointer",
              transition:"transform 0.15s, box-shadow 0.15s",
            }}
              onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow=""; }}
            >
              <div style={{ width:40, height:40, borderRadius:10, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, marginBottom:8 }}>
                {s.icon}
              </div>
              <span className="stat-value" style={{ color:s.accent, fontSize:28, fontWeight:800 }}>
                {loading ? "—" : s.value}
              </span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:20, alignItems:"start" }}>

          {/* LEFT: Quick Actions */}
          <div>
            <div className="main-card" style={{ marginBottom:20 }}>
              <h3 className="card-title" style={{ marginBottom:18 }}>⚡ Quick Actions</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                {quickActions.map(({ label, icon, path, bg, color, border, desc }) => (
                  <button key={path} onClick={() => navigate(path)}
                    style={{
                      padding:"16px 14px", borderRadius:12, cursor:"pointer", textAlign:"left",
                      border:`1.5px solid ${border}`, background:bg,
                      display:"flex", flexDirection:"column", gap:8,
                      transition:"all 0.15s",
                    }}
                    onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=`0 6px 20px rgba(0,0,0,0.08)`; }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}
                  >
                    <div style={{ fontSize:22 }}>{icon}</div>
                    <div style={{ fontWeight:700, fontSize:13, color, lineHeight:1.3 }}>{label}</div>
                    <div style={{ fontSize:11, color:"#94a3b8", lineHeight:1.4 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div className="main-card" style={{ padding:"20px 22px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <span style={{ fontWeight:700, fontSize:14, color:"#1e3a5f" }}>📊 Session Summary</span>
                  <span style={{ fontSize:11, color:"#94a3b8" }}>This month</span>
                </div>
                {[
                  { label:"Approved",  value:stats.completed, color:"#16a34a", bg:"#f0fdf4" },
                  { label:"Pending",   value:stats.pending,   color:stats.pending>0?"#d97706":"#64748b", bg:stats.pending>0?"#fffbeb":"#f8fafc" },
                  { label:"Case Notes",value:stats.casenotes, color:"#7e22ce", bg:"#fdf4ff" },
                ].map((r,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:i<2?"1px solid #f0f4f8":"none" }}>
                    <span style={{ fontSize:13, color:"#475569" }}>{r.label}</span>
                    <span style={{ fontWeight:800, fontSize:15, color:r.color, background:r.bg, padding:"2px 10px", borderRadius:20 }}>
                      {loading?"—":r.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="main-card" style={{ padding:"20px 22px" }}>
                <div style={{ fontWeight:700, fontSize:14, color:"#1e3a5f", marginBottom:12 }}>🎯 Today's Focus</div>
                {[
                  stats.pending>0   && { icon:"⚠️", text:`${stats.pending} pending appointment${stats.pending>1?"s":""} to review`, path:"/appointment-approval", urgent:true },
                  stats.followups>0 && { icon:"🔄", text:`${stats.followups} student${stats.followups>1?"s":""} need follow-up`, path:"/follow-up-status", urgent:stats.followups>2 },
                  { icon:"📝", text:"Write case notes for today's sessions", path:"/case-notes", urgent:false },
                ].filter(Boolean).slice(0,3).map((item,i) => (
                  <div key={i} onClick={() => navigate(item.path)}
                    style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 0", borderBottom:i<2?"1px solid #f0f4f8":"none", cursor:"pointer" }}>
                    <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{item.icon}</span>
                    <span style={{ fontSize:12, color:item.urgent?"#b91c1c":"#475569", lineHeight:1.4 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Recent Activity */}
          <div className="main-card" style={{ padding:"20px 22px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <h3 className="card-title" style={{ margin:0, fontSize:14 }}>🕐 Recent Activity</h3>
              <button onClick={loadDashboard}
                style={{ fontSize:11, color:"#2563eb", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
                Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign:"center", padding:"24px 0", color:"#94a3b8", fontSize:13 }}>Loading…</div>
            ) : activity.length === 0 ? (
              <div style={{ textAlign:"center", padding:"32px 0" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                <p style={{ fontSize:13, color:"#94a3b8" }}>No recent activity</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {activity.map((a,i) => (
                  <div key={i} onClick={() => navigate(a.path)}
                    style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"11px 0", borderBottom:i<activity.length-1?"1px solid #f0f4f8":"none", cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.opacity="0.75"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="1"}
                  >
                    <div style={{ width:32, height:32, borderRadius:8, background:a.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                      {a.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:"#1a1f2e", lineHeight:1.4, fontWeight:500 }}>{a.text}</div>
                      <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Divider + navigate shortcut */}
            <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid #f0f4f8" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>
                Navigate to
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  { label:"Appointment Approval", path:"/appointment-approval", icon:"✅" },
                  { label:"Schedule Session",      path:"/schedulesession",      icon:"📅" },
                  { label:"Follow-up Status",      path:"/follow-up-status",     icon:"🔄" },
                  { label:"Messages",              path:"/messages",             icon:"💬" },
                ].map(({ label, path, icon }) => (
                  <button key={path} onClick={() => navigate(path)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:8, border:"1px solid #e2e8f0", background:"#f8fafc", cursor:"pointer", textAlign:"left", fontSize:12, fontWeight:600, color:"#1e3a5f" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background="#eff6ff"; e.currentTarget.style.borderColor="#bfdbfe"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="#f8fafc"; e.currentTarget.style.borderColor="#e2e8f0"; }}
                  >
                    <span>{icon}</span> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminHome;