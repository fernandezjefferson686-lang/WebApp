import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/student.css";

const API       = "http://127.0.0.1:8000/api";
const COUNSELOR = "Julie Maestrada";

function CounselingRecords() {
  const [records,  setRecords]  = useState([]); // merged session + case note
  const [fetching, setFetching] = useState(true);
  const [filter,   setFilter]   = useState("All"); // All | With Notes | Follow-up
  const [expanded, setExpanded] = useState(null);
  const [search,   setSearch]   = useState("");

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
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API}/user/counseling-requests`, { headers }),
      axios.get(`${API}/user/case-notes`,           { headers }),
    ])
      .then(([sessRes, noteRes]) => {
        const sessions = sessRes.data?.requests || sessRes.data || [];
        const notes    = noteRes.data?.notes    || [];
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

        // Only show Approved + past sessions
        const past = sessions.filter(r => {
          if (r.status !== "Approved") return false;
          const d = new Date(r.session_date || r.date);
          return !isNaN(d) && d <= todayEnd;
        });

        // Merge each session with its case note
        const merged = past.map(r => ({
          ...r,
          note: notes.find(n => n.counseling_request_id === r.id) || null,
        })).sort((a, b) => new Date(b.session_date || b.date) - new Date(a.session_date || a.date));

        setRecords(merged);
      })
      .catch(() => setRecords([]))
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

  const withNotes  = records.filter(r => r.note);
  const followUps  = records.filter(r => r.note?.follow_up_needed);

  const filtered = records.filter(r => {
    if (filter === "With Notes" && !r.note)               return false;
    if (filter === "Follow-up"  && !r.note?.follow_up_needed) return false;
    const q = search.toLowerCase();
    return !q ||
      (r.session_type || r.type || "").toLowerCase().includes(q) ||
      (r.note?.summary || "").toLowerCase().includes(q) ||
      fmtDate(r.session_date || r.date).toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="s-page-header">
        <h1>Counseling Records</h1>
        <p>Session notes and counselor recommendations from your completed sessions</p>
      </div>

      {/* Stats */}
      <div className="s-stats">
        {[
          { label: "Total Sessions",    value: records.length,   icon: "📁" },
          { label: "With Notes",        value: withNotes.length, icon: "📝", accent: withNotes.length > 0 ? "#2563eb" : undefined },
          { label: "Follow-ups Needed", value: followUps.length, icon: "🔄", accent: followUps.length > 0 ? "#d97706" : undefined },
        ].map((s, i) => (
          <div key={i} className="s-stat" style={s.accent ? { borderTop:`3px solid ${s.accent}` } : {}}>
            <span className="s-stat-icon">{s.icon}</span>
            <div className="s-stat-val" style={s.accent ? { color:s.accent } : {}}>{s.value}</div>
            <div className="s-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="s-card">
        {/* Header + search + filter */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <h3 className="s-card-title" style={{ margin:0 }}>Session Notes from Counselor</h3>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", fontSize:"0.85rem" }}>🔍</span>
            <input type="text" placeholder="Search records…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding:"7px 12px 7px 28px", borderRadius:8, border:"1px solid #dde3f0", fontSize:"0.85rem", outline:"none", width:200 }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {[
            { key:"All",        label:`All (${records.length})` },
            { key:"With Notes", label:`📝 With Notes (${withNotes.length})` },
            { key:"Follow-up",  label:`🔄 Follow-up (${followUps.length})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding:"5px 14px", borderRadius:20, fontSize:"0.78rem", fontWeight:600, cursor:"pointer", border:"1.5px solid",
              borderColor: filter === f.key ? "#2563eb" : "#e2e8f0",
              background:  filter === f.key ? "#2563eb" : "#fff",
              color:       filter === f.key ? "#fff"    : "#64748b",
            }}>{f.label}</button>
          ))}
        </div>

        {fetching ? (
          <div className="s-empty"><p style={{ color:"#94a3b8" }}>Loading records…</p></div>
        ) : records.length === 0 ? (
          <div className="s-empty">
            <div className="s-empty-icon">📭</div>
            <p>No counseling records yet.</p>
            <p style={{ fontSize:"0.83rem", color:"#94a3b8", marginTop:4 }}>Records appear here after your approved sessions are completed.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="s-empty"><div className="s-empty-icon">🔍</div><p>No records match your search.</p></div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {filtered.map(r => {
              const tc    = typeColor(r.session_type || r.type);
              const note  = r.note;
              const isExp = expanded === r.id;

              return (
                <div key={r.id}
                  onClick={() => setExpanded(isExp ? null : r.id)}
                  style={{
                    border:`1.5px solid ${isExp ? "#bfdbfe" : tc.border}`,
                    borderLeft:`4px solid ${tc.color}`,
                    borderRadius:12, overflow:"hidden",
                    cursor:"pointer",
                    boxShadow: isExp ? "0 4px 16px rgba(0,0,0,0.07)" : "none",
                    transition:"all 0.2s",
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding:"14px 18px", background: isExp ? "#f8fafc" : "#fff", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>

                    {/* Date + time */}
                    <div style={{ minWidth:130 }}>
                      <div style={{ fontWeight:700, fontSize:"0.9rem", color:"#1e293b" }}>{fmtDate(r.session_date || r.date)}</div>
                      <div style={{ fontSize:"0.78rem", color:"#64748b", marginTop:1 }}>🕐 {fmtTime(r.session_time || r.time)}</div>
                    </div>

                    {/* Type */}
                    <span style={{ background:tc.bg, color:tc.color, border:`1px solid ${tc.border}`, borderRadius:6, padding:"4px 10px", fontSize:"0.75rem", fontWeight:600 }}>
                      {r.session_type || r.type || "—"}
                    </span>

                    {/* Mode */}
                    <span style={{ fontSize:"0.82rem", color:"#475569" }}>
                      {(r.mode||"").toLowerCase().includes("online") ? "💻" : (r.mode||"").toLowerCase().includes("phone") ? "📞" : "🏫"} {r.mode}
                    </span>

                    {/* Note status badge */}
                    <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
                      {note ? (
                        <span style={{ background:"#f0fdf4", color:"#16a34a", border:"1px solid #86efac", borderRadius:20, padding:"3px 10px", fontSize:"0.73rem", fontWeight:700 }}>
                          📝 Notes Available
                        </span>
                      ) : (
                        <span style={{ background:"#f8fafc", color:"#94a3b8", border:"1px solid #e2e8f0", borderRadius:20, padding:"3px 10px", fontSize:"0.73rem", fontWeight:600 }}>
                          ⏳ Awaiting Notes
                        </span>
                      )}
                      {note?.follow_up_needed && (
                        <span style={{ background:"#fff7ed", color:"#d97706", border:"1px solid #fcd34d", borderRadius:20, padding:"3px 10px", fontSize:"0.73rem", fontWeight:700 }}>
                          🔄 Follow-up
                        </span>
                      )}
                      <span style={{ fontSize:"0.75rem", color:"#94a3b8", transition:"transform 0.2s", transform: isExp ? "rotate(180deg)" : "rotate(0deg)", display:"inline-block" }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExp && (
                    <div style={{ padding:"0 18px 18px", background:"#fff" }}>
                      <div style={{ height:1, background:"#f0f4f8", margin:"0 0 14px" }} />

                      {/* Session meta */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8, marginBottom:14 }}>
                        {[
                          { label:"Counselor", value:COUNSELOR },
                          { label:"Date",      value:fmtDate(r.session_date || r.date) },
                          { label:"Time",      value:fmtTime(r.session_time || r.time) },
                          { label:"Mode",      value:r.mode },
                          { label:"Type",      value:r.session_type || r.type },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background:"#f8fafc", borderRadius:8, padding:"8px 12px" }}>
                            <div style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{label}</div>
                            <div style={{ fontSize:"0.84rem", color:"#1e293b", fontWeight:600 }}>{value || "—"}</div>
                          </div>
                        ))}
                      </div>

                      {/* ── Case Notes section ── */}
                      {!note ? (
                        <div style={{ background:"#f8fafc", border:"1px dashed #cbd5e1", borderRadius:10, padding:"18px", textAlign:"center" }}>
                          <div style={{ fontSize:"1.5rem", marginBottom:6 }}>⏳</div>
                          <div style={{ fontWeight:600, color:"#64748b", fontSize:"0.9rem" }}>Session notes not yet available</div>
                          <div style={{ fontSize:"0.8rem", color:"#94a3b8", marginTop:4 }}>Your counselor will add notes after the session is reviewed.</div>
                        </div>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

                          {/* Session notes from counselor */}
                          <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderLeft:"4px solid #0284c7", borderRadius:10, padding:"14px 16px" }}>
                            <div style={{ fontWeight:700, fontSize:"0.8rem", color:"#0369a1", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                              <span>📝</span> Session Notes from Counselor
                            </div>
                            <div style={{ fontSize:"0.88rem", color:"#1e293b", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                              {note.summary}
                            </div>
                          </div>

                          {/* Recommendations */}
                          {note.recommendations && (
                            <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderLeft:"4px solid #16a34a", borderRadius:10, padding:"14px 16px" }}>
                              <div style={{ fontWeight:700, fontSize:"0.8rem", color:"#15803d", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                                <span>💡</span> Counselor's Recommendations
                              </div>
                              <div style={{ fontSize:"0.88rem", color:"#1e293b", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                                {note.recommendations}
                              </div>
                            </div>
                          )}

                          {/* Follow-up schedule */}
                          {note.follow_up_needed && (
                            <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderLeft:"4px solid #f59e0b", borderRadius:10, padding:"14px 16px" }}>
                              <div style={{ fontWeight:700, fontSize:"0.8rem", color:"#d97706", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                                <span>🔄</span> Follow-up Session Scheduled
                              </div>
                              <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                                {note.next_session_date && (
                                  <div style={{ background:"#fff", borderRadius:9, padding:"10px 16px", border:"1px solid #fde68a", display:"flex", alignItems:"center", gap:8 }}>
                                    <span style={{ fontSize:"1.2rem" }}>📅</span>
                                    <div>
                                      <div style={{ fontSize:"0.68rem", color:"#d97706", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>Date</div>
                                      <div style={{ fontSize:"0.95rem", fontWeight:700, color:"#92400e" }}>{fmtDate(note.next_session_date)}</div>
                                    </div>
                                  </div>
                                )}
                                {note.next_session_time && (
                                  <div style={{ background:"#fff", borderRadius:9, padding:"10px 16px", border:"1px solid #fde68a", display:"flex", alignItems:"center", gap:8 }}>
                                    <span style={{ fontSize:"1.2rem" }}>🕐</span>
                                    <div>
                                      <div style={{ fontSize:"0.68rem", color:"#d97706", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>Time</div>
                                      <div style={{ fontSize:"0.95rem", fontWeight:700, color:"#92400e" }}>{fmtTime(note.next_session_time)}</div>
                                    </div>
                                  </div>
                                )}
                                {!note.next_session_date && (
                                  <div style={{ fontSize:"0.85rem", color:"#b45309" }}>
                                    Your counselor will schedule a specific date and time soon.
                                  </div>
                                )}
                              </div>
                              <div style={{ marginTop:10, fontSize:"0.8rem", color:"#92400e", background:"rgba(245,158,11,0.08)", borderRadius:8, padding:"8px 12px" }}>
                                💬 Your counselor has determined that another session would benefit your progress. Please check back for updates or submit a new request.
                              </div>
                            </div>
                          )}

                          {/* No follow-up badge */}
                          {!note.follow_up_needed && (
                            <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
                              <span style={{ fontSize:"1.2rem" }}>✅</span>
                              <div>
                                <div style={{ fontWeight:700, color:"#15803d", fontSize:"0.9rem" }}>Session Complete — No Follow-up Needed</div>
                                <div style={{ fontSize:"0.8rem", color:"#16a34a", marginTop:2 }}>Your counselor has reviewed the session and no further follow-up is required at this time.</div>
                              </div>
                            </div>
                          )}

                          {/* Saved date */}
                          {note.created_at && (
                            <div style={{ fontSize:"0.75rem", color:"#94a3b8", textAlign:"right" }}>
                              Notes saved by counselor on {fmtDate(note.created_at)}
                            </div>
                          )}
                        </div>
                      )}
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

export default CounselingRecords;