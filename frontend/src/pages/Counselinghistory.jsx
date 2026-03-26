import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/student.css";

const API       = "http://127.0.0.1:8000/api";
const COUNSELOR = "Julie Maestrada";

function CounselingHistory() {
  const [history,  setHistory]  = useState([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("All");

  const getToken = () => JSON.parse(localStorage.getItem("user"))?.token;

  const fmtDate = raw => {
    if (!raw) return "—";
    const d = new Date(raw);
    return isNaN(d) ? raw : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const fmtTime = raw => {
    if (!raw) return "—";
    if (/AM|PM/i.test(raw)) return raw;
    const [h, m] = raw.split(":");
    return `${+h % 12 || 12}:${m} ${+h >= 12 ? "PM" : "AM"}`;
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    axios.get(`${API}/user/counseling-requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const all      = res.data?.requests || res.data || [];
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        // Show ALL approved sessions (past or today) regardless of case note
        const past = all
          .filter(r => {
            if (r.status !== "Approved") return false;
            const d = new Date(r.session_date || r.date);
            return !isNaN(d) && d <= todayEnd;
          })
          .sort((a, b) => new Date(b.session_date || b.date) - new Date(a.session_date || a.date));
        setHistory(past);
      })
      .catch(() => setHistory([]))
      .finally(() => setFetching(false));
  }, []);

  const typeColor = type => {
    if (!type) return { bg:"#f1f5f9", color:"#475569", border:"#e2e8f0" };
    const t = type.toLowerCase();
    if (t.includes("crisis"))   return { bg:"#fff1f2", color:"#be123c", border:"#fecdd3" };
    if (t.includes("academic")) return { bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe" };
    if (t.includes("career"))   return { bg:"#f0fdf4", color:"#15803d", border:"#bbf7d0" };
    if (t.includes("family"))   return { bg:"#fdf4ff", color:"#7e22ce", border:"#e9d5ff" };
    return { bg:"#fff7ed", color:"#c2410c", border:"#fed7aa" };
  };

  const modeIcon = m => {
    if (!m) return "📍";
    if (m.toLowerCase().includes("online")) return "💻";
    if (m.toLowerCase().includes("phone"))  return "📞";
    return "🏫";
  };

  const types    = ["All", ...new Set(history.map(r => r.session_type || r.type).filter(Boolean))];
  const filtered = history.filter(r => {
    const matchType = filter === "All" || (r.session_type || r.type) === filter;
    const q = search.toLowerCase();
    return matchType && (!q ||
      (r.session_type || r.type || "").toLowerCase().includes(q) ||
      (r.mode || "").toLowerCase().includes(q) ||
      fmtDate(r.session_date || r.date).toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="s-page-header">
        <h1>Counseling History</h1>
        <p>Your approved and completed counseling sessions with {COUNSELOR}</p>
      </div>

      {/* Stats */}
      <div className="s-stats">
        {[
          { label: "Total Sessions", value: history.length, icon: "📋" },
          { label: "This Year",      value: history.filter(r => new Date(r.session_date||r.date).getFullYear() === new Date().getFullYear()).length, icon: "📆" },
          { label: "Face-to-Face",   value: history.filter(r => (r.mode||"").toLowerCase().includes("face")).length,  icon: "🏫" },
          { label: "Online / Phone", value: history.filter(r => !(r.mode||"").toLowerCase().includes("face")).length, icon: "💻" },
        ].map((s, i) => (
          <div className="s-stat" key={i}>
            <span className="s-stat-icon">{s.icon}</span>
            <div className="s-stat-val">{s.value}</div>
            <div className="s-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="s-card">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <h3 className="s-card-title" style={{ margin:0 }}>Session Records</h3>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", fontSize:"0.85rem" }}>🔍</span>
            <input type="text" placeholder="Search sessions…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding:"7px 12px 7px 28px", borderRadius:8, border:"1px solid #dde3f0", fontSize:"0.85rem", outline:"none", width:200 }}
            />
          </div>
        </div>

        {/* Type filter tabs */}
        {types.length > 1 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)} style={{
                padding:"5px 12px", borderRadius:20, fontSize:"0.78rem", fontWeight:600, cursor:"pointer", border:"1px solid",
                borderColor: filter === t ? "#1e3a5f" : "#e2e8f0",
                background:  filter === t ? "#1e3a5f" : "#fff",
                color:       filter === t ? "#fff"    : "#64748b",
              }}>{t}</button>
            ))}
          </div>
        )}

        {fetching ? (
          <div className="s-empty"><p style={{ color:"#94a3b8" }}>Loading history…</p></div>
        ) : history.length === 0 ? (
          <div className="s-empty">
            <div className="s-empty-icon">📭</div>
            <p>No completed sessions yet.</p>
            <p style={{ fontSize:"0.83rem", color:"#94a3b8", marginTop:4 }}>Sessions appear here after their scheduled date has passed.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="s-empty"><div className="s-empty-icon">🔍</div><p>No sessions match your search.</p></div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(r => {
              const tc      = typeColor(r.session_type || r.type);
              const isExp   = expanded === r.id;
              return (
                <div key={r.id}
                  onClick={() => setExpanded(isExp ? null : r.id)}
                  style={{ border:`1px solid ${tc.border}`, borderLeft:`4px solid ${tc.color}`, borderRadius:10, padding:"14px 16px", background:"#fff", cursor:"pointer", transition:"box-shadow 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                >
                  {/* Main row */}
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", background:"#f0fdf4", border:"2px solid #86efac", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>✅</div>
                    <div style={{ minWidth:120 }}>
                      <div style={{ fontWeight:700, fontSize:"0.9rem", color:"#1e293b" }}>{fmtDate(r.session_date || r.date)}</div>
                      <div style={{ fontSize:"0.78rem", color:"#64748b" }}>🕐 {fmtTime(r.session_time || r.time)}</div>
                    </div>
                    <div style={{ background:tc.bg, color:tc.color, border:`1px solid ${tc.border}`, borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", fontWeight:600, flexShrink:0 }}>
                      {r.session_type || r.type || "—"}
                    </div>
                    <div style={{ fontSize:"0.82rem", color:"#475569", flexShrink:0 }}>{modeIcon(r.mode)} {r.mode}</div>
                    <div style={{ marginLeft:"auto", background:"#f0fdf4", color:"#16a34a", border:"1px solid #86efac", borderRadius:20, padding:"3px 10px", fontSize:"0.73rem", fontWeight:700, flexShrink:0 }}>
                      ✔ Completed
                    </div>
                    <div style={{ fontSize:"0.75rem", color:"#94a3b8", transition:"transform 0.2s", transform: isExp ? "rotate(180deg)" : "rotate(0deg)" }}>▼</div>
                  </div>

                  {/* Expanded: session info only — NO case notes here */}
                  {isExp && (
                    <div style={{ marginTop:12, paddingTop:12, borderTop:"1px dashed #e2e8f0", display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:10 }}>
                        {[
                          { label:"Counselor", value:COUNSELOR },
                          { label:"Date",      value:fmtDate(r.session_date || r.date) },
                          { label:"Time",      value:fmtTime(r.session_time || r.time) },
                          { label:"Mode",      value:r.mode },
                          { label:"Type",      value:r.session_type || r.type },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 12px" }}>
                            <div style={{ fontSize:"0.7rem", color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{label}</div>
                            <div style={{ fontSize:"0.85rem", color:"#1e293b", fontWeight:600 }}>{value || "—"}</div>
                          </div>
                        ))}
                      </div>

                      {/* Reason */}
                      <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px", fontSize:"0.83rem", color:"#475569" }}>
                        <div style={{ fontWeight:700, color:"#1e293b", marginBottom:4, fontSize:"0.78rem", textTransform:"uppercase", letterSpacing:"0.05em" }}>📋 Reason / Concern</div>
                        {r.reason || "—"}
                      </div>

                      {/* Approval note */}
                      {r.approval_note && (
                        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderLeft:"3px solid #f59e0b", borderRadius:8, padding:"9px 12px", fontSize:"0.82rem", color:"#78350f" }}>
                          💬 <strong>Counselor's Note:</strong> {r.approval_note}
                        </div>
                      )}

                      {/* Link hint to Counseling Records */}
                      <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"10px 14px", fontSize:"0.82rem", color:"#1d4ed8", display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:"1rem" }}>📁</span>
                        <span>Session notes and counselor recommendations are available in <strong>Counseling Records</strong>.</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CounselingHistory;