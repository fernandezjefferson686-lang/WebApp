import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SidePanel from "./SidePanel";
import "../css/sidepanel.css";

const API         = "http://127.0.0.1:8000/api";
const STORAGE_URL = "http://127.0.0.1:8000/storage";

const fmtDate  = r => { if (!r) return "—"; const d = new Date(r); return isNaN(d) ? r : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const fmtTime  = r => { if (!r) return "—"; if (/AM|PM/i.test(r)) return r; const [h,m] = r.split(":"); return `${+h%12||12}:${m} ${+h>=12?"PM":"AM"}`; };
const initials = n => (n||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();

const TYPE = {
  academic: { c:"#2563eb", bg:"#eff6ff", b:"#bfdbfe", icon:"📚" },
  crisis:   { c:"#dc2626", bg:"#fef2f2", b:"#fca5a5", icon:"🚨" },
  career:   { c:"#059669", bg:"#ecfdf5", b:"#6ee7b7", icon:"💼" },
  personal: { c:"#ea580c", bg:"#fff7ed", b:"#fed7aa", icon:"💬" },
  default:  { c:"#475569", bg:"#f8fafc", b:"#e2e8f0", icon:"📋" },
};
const getTC = t => {
  if (!t) return TYPE.default;
  const s = t.toLowerCase();
  if (s.includes("crisis"))   return TYPE.crisis;
  if (s.includes("academic")) return TYPE.academic;
  if (s.includes("career"))   return TYPE.career;
  if (s.includes("personal")||s.includes("emotional")) return TYPE.personal;
  return TYPE.default;
};

const daysUntil = raw => {
  if (!raw) return null;
  const d = new Date(raw); d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((d - today) / (1000*60*60*24));
};
const urgencyLabel = days => {
  if (days === null) return null;
  if (days < 0)  return { text:`${Math.abs(days)}d overdue`, bg:"#fef2f2", color:"#dc2626", border:"#fca5a5" };
  if (days === 0)return { text:"Today",       bg:"#fee2e2", color:"#dc2626", border:"#fca5a5" };
  if (days <= 2) return { text:`In ${days}d`, bg:"#fff7ed", color:"#d97706", border:"#fcd34d" };
  if (days <= 7) return { text:`In ${days}d`, bg:"#fffbeb", color:"#b45309", border:"#fde68a" };
  return             { text:`In ${days}d`, bg:"#f0fdf4", color:"#16a34a", border:"#86efac" };
};

const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const isOverdue  = f => f.fu_status === "Pending" && f.next_session && new Date(f.next_session) < todayStart();

/* ── Session is "now" if: today OR overdue (regardless of exact time) ── */
const isSessionNow = f => {
  if (f.fu_status !== "Pending") return false;
  const days = daysUntil(f.next_session);
  if (days === null) return false;
  return days <= 0; // today (0) or overdue (negative)
};

export default function FollowUpStatus() {
  const navigate = useNavigate();

  const [followUps,     setFollowUps]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState("All");
  const [search,        setSearch]        = useState("");
  const [expanded,      setExpanded]      = useState(null);
  const [toast,         setToast]         = useState(null);
  const [reschedModal,  setReschedModal]  = useState(null);
  const [reschedDate,   setReschedDate]   = useState("");
  const [reschedTime,   setReschedTime]   = useState("");
  const [reschedSaving, setReschedSaving] = useState(false);
  const [now,           setNow]           = useState(new Date()); // ticks every minute

  // Tick every minute so "session now" updates in real time
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const tok  = () => localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
  const auth = () => ({ headers: { Authorization: `Bearer ${tok()}`, Accept: "application/json" } });
  const out  = useCallback(() => { localStorage.removeItem("admin_token"); navigate("/", { replace: true }); }, [navigate]);
  const pop  = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    if (!tok()) { out(); return; }
    setLoading(true);
    try {
      const [sR, nR] = await Promise.all([
        axios.get(`${API}/admin/counseling-requests`, auth()),
        axios.get(`${API}/admin/case-notes`,          auth()),
      ]);
      const sessions = sR.data?.requests || sR.data || [];
      const notes    = (nR.data?.notes || []).filter(n => n.follow_up_needed);

      const merged = notes.map(n => {
        const sess = sessions.find(s => s.id === n.counseling_request_id);
        return {
          id:                n.id,
          note_id:           n.id,
          session_id:        n.counseling_request_id,
          student_name:      sess?.student_name || sess?.name || "Unknown Student",
          student_id:        sess?.student_id   || "—",
          department:        sess?.department   || "",
          profile_pic:       sess?.profile_pic  || null,
          concern:           sess?.session_type || sess?.type || "General",
          last_session:      sess?.session_date || sess?.date || null,
          last_time:         sess?.session_time || sess?.time || null,
          mode:              sess?.mode         || "—",
          next_session:      n.next_session_date || null,
          next_session_time: n.next_session_time || null,
          notes:             n.summary          || "",
          recommendations:   n.recommendations  || "",
          fu_status:         n.fu_status        || "Pending",
          fu_done_note:      n.fu_done_note     || "",
          created_at:        n.created_at       || null,
        };
      }).sort((a, b) => {
        const da = a.next_session ? new Date(a.next_session) : new Date(9e15);
        const db = b.next_session ? new Date(b.next_session) : new Date(9e15);
        return da - db;
      });

      setFollowUps(merged);
    } catch (e) { if (e.response?.status === 401) out(); }
    finally { setLoading(false); }
  }, [out]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* ── Reschedule ── */
  const reschedule = async () => {
    if (!reschedModal || !reschedDate) { pop("Please select a new date.", "error"); return; }
    setReschedSaving(true);
    try {
      await axios.patch(`${API}/admin/case-notes/${reschedModal.note_id}/reschedule`,
        { next_session_date: reschedDate, next_session_time: reschedTime||null }, auth());
    } catch (e) { if (e.response?.status === 401) { out(); return; } }
    finally {
      setFollowUps(prev => prev.map(f => f.id === reschedModal.id
        ? { ...f, next_session:reschedDate, next_session_time:reschedTime, fu_status:"Pending" } : f));
      setReschedModal(null); setReschedDate(""); setReschedTime(""); setReschedSaving(false);
      pop("📅 Follow-up rescheduled!");
    }
  };

  const counts = {
    All:       followUps.length,
    Pending:   followUps.filter(f => f.fu_status==="Pending" && !isOverdue(f)).length,
    Overdue:   followUps.filter(isOverdue).length,
    Completed: followUps.filter(f => f.fu_status==="Completed").length,
  };

  // Count how many sessions are happening now (need case notes)
  const sessionNowCount = followUps.filter(isSessionNow).length;

  const displayed = followUps.filter(f => {
    if (filter==="Pending"   && (f.fu_status!=="Pending"||isOverdue(f))) return false;
    if (filter==="Overdue"   && !isOverdue(f))                           return false;
    if (filter==="Completed" && f.fu_status!=="Completed")               return false;
    if (filter==="Now"       && !isSessionNow(f))                        return false;
    const q = search.toLowerCase();
    return !q || (f.student_name||"").toLowerCase().includes(q) || (f.concern||"").toLowerCase().includes(q);
  });

  // suppress unused warning
  void now;

  return (
    <div className="admin-home">
      <SidePanel onLogout={out}/>
      <main className="admin-main">
        <div className="page-header">
          <h1>Follow-up Status</h1>
          <p>Track students who need a follow-up counseling session</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label:"Total Follow-ups", value:counts.All,       icon:"🔄" },
            { label:"Pending",          value:counts.Pending,   icon:"⏳", accent:counts.Pending>0?"#d97706":undefined },
            { label:"Overdue",          value:counts.Overdue,   icon:"⚠️", accent:counts.Overdue>0?"#dc2626":undefined },
            { label:"Completed",        value:counts.Completed, icon:"✅", accent:counts.Completed>0?"#16a34a":undefined },
          ].map((s,i)=>(
            <div key={i} className="stat-card" style={s.accent?{borderTop:`3px solid ${s.accent}`}:{}}>
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value" style={s.accent?{color:s.accent}:{}}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Session happening NOW banner ── */}
        {sessionNowCount > 0 && (
          <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",border:"none",borderRadius:12,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",boxShadow:"0 4px 16px rgba(37,99,235,0.25)"}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem",flexShrink:0}}>
              📝
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>
                {sessionNowCount} follow-up session{sessionNowCount>1?"s":""} happening now!
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2}}>
                These students' scheduled follow-up time has arrived. Add case notes for their sessions.
              </div>
            </div>
            <button onClick={()=>setFilter("Now")}
              style={{padding:"9px 18px",borderRadius:8,background:"#fff",color:"#1e3a5f",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}}>
              📝 View & Add Notes →
            </button>
          </div>
        )}

        {/* Overdue banner */}
        {counts.Overdue > 0 && (
          <div style={{background:"#fef2f2",border:"1.5px solid #fca5a5",borderRadius:10,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:20}}>🚨</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"#991b1b"}}>{counts.Overdue} follow-up{counts.Overdue>1?"s":""} overdue</div>
              <div style={{fontSize:12,color:"#b91c1c",marginTop:1}}>These students missed their scheduled follow-up. Please contact them immediately.</div>
            </div>
            <button onClick={()=>setFilter("Overdue")} style={{padding:"7px 16px",borderRadius:8,background:"#dc2626",color:"#fff",border:"none",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              View Overdue →
            </button>
          </div>
        )}

        <div className="main-card">
          {/* Toolbar */}
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{position:"relative",flex:1,minWidth:200}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>🔍</span>
              <input type="text" placeholder="Search by student name or concern…" value={search}
                onChange={e=>setSearch(e.target.value)}
                style={{width:"100%",padding:"9px 12px 9px 32px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fafbfd",boxSizing:"border-box"}}
              />
              {search && <button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16}}>×</button>}
            </div>
            <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:8,padding:3,flexWrap:"wrap"}}>
              {[
                {key:"All",       label:"All",                                                     count:counts.All},
                {key:"Now",       label:"📝 Now",                                                  count:sessionNowCount},
                {key:"Pending",   label:"Pending",                                                  count:counts.Pending},
                {key:"Overdue",   label:"⚠️ Overdue",                                              count:counts.Overdue},
                {key:"Completed", label:"✅ Done",                                                 count:counts.Completed},
              ].map(f=>(
                <button key={f.key} onClick={()=>setFilter(f.key)} style={{
                  padding:"6px 12px",borderRadius:6,border:"none",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"inherit",
                  background:filter===f.key
                    ? (f.key==="Overdue"?"#dc2626":f.key==="Completed"?"#16a34a":f.key==="Now"?"#2563eb":"#1e3a5f")
                    : "transparent",
                  color:filter===f.key?"#fff":"#64748b",
                  position:"relative",
                }}>
                  {f.label} ({f.count})
                  {/* Pulsing dot for "Now" tab when there are sessions */}
                  {f.key==="Now" && f.count>0 && filter!=="Now" && (
                    <span style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/>
                  )}
                </button>
              ))}
            </div>
            <button onClick={load} style={{padding:"9px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",fontSize:12,color:"#475569",fontWeight:600}}>🔄 Refresh</button>
          </div>

          {/* List */}
          {loading ? (
            <div className="empty-state"><p style={{color:"#94a3b8"}}>Loading follow-ups…</p></div>
          ) : displayed.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{filter==="Completed"?"🎉":filter==="Now"?"⏰":"📭"}</div>
              <p>
                {filter==="Completed" ? "No completed follow-ups yet." :
                 filter==="Now"       ? "No sessions happening right now." :
                 filter==="Overdue"   ? "No overdue follow-ups — great job! 🎉" :
                 followUps.length===0 ? "No follow-ups found. They appear when you save a case note with \"Another session needed\" checked." :
                 "No follow-ups match your search."}
              </p>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {displayed.map(f => {
                const t         = getTC(f.concern);
                const days      = daysUntil(f.next_session);
                const urgency   = urgencyLabel(days);
                const overdue   = isOverdue(f);
                const isDone    = f.fu_status === "Completed";
                const sessionOn = isSessionNow(f);
                const isExp     = expanded?.id === f.id;

                return (
                  <div key={f.id} style={{
                    border:`1.5px solid ${isExp?"#bfdbfe":sessionOn?"#3b82f6":overdue?"#fca5a5":"#eef2f8"}`,
                    borderLeft:`4px solid ${sessionOn?"#2563eb":overdue?"#dc2626":isDone?"#16a34a":t.c}`,
                    borderRadius:12,overflow:"hidden",
                    boxShadow:sessionOn?"0 0 0 3px rgba(59,130,246,0.12)":isExp?"0 4px 20px rgba(0,0,0,0.07)":"none",
                    opacity:isDone?0.85:1,transition:"all 0.2s",
                  }}>

                    {/* ── Session Now highlight bar ── */}
                    {sessionOn && (
                      <div style={{background:"linear-gradient(90deg,#1e3a5f,#2563eb)",padding:"7px 18px",display:"flex",alignItems:"center",gap:10}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:"#fff",flexShrink:0,boxShadow:"0 0 0 3px rgba(255,255,255,0.35)"}}/>
                        <span style={{color:"#fff",fontWeight:700,fontSize:12}}>
                          📝 Follow-up session time{f.next_session_time?` (${fmtTime(f.next_session_time)})`:""} has arrived — click Add Case Note below
                        </span>
                      </div>
                    )}

                    {/* Card header */}
                    <div onClick={()=>setExpanded(isExp?null:f)}
                      style={{padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:isExp?"#f8fafc":"#fff"}}>
                      {/* Avatar */}
                      <div style={{width:42,height:42,borderRadius:"50%",flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",
                        background:sessionOn?"linear-gradient(135deg,#2563eb,#3b82f6)":overdue?"linear-gradient(135deg,#dc2626,#f87171)":isDone?"linear-gradient(135deg,#16a34a,#4ade80)":`linear-gradient(135deg,#1e3a5f,${t.c})`}}>
                        {f.profile_pic?<img src={`${STORAGE_URL}/${f.profile_pic}`} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.onerror=null;}}/>:initials(f.student_name)}
                      </div>
                      {/* Info */}
                      <div style={{flex:1,minWidth:160}}>
                        <div style={{fontWeight:700,fontSize:14,color:"#1a1f2e",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                          {f.student_name}
                          {isDone    && <span style={{fontSize:11,fontWeight:700,background:"#f0fdf4",color:"#16a34a",border:"1px solid #86efac",borderRadius:20,padding:"1px 8px"}}>✅ Completed</span>}
                          {overdue   && <span style={{fontSize:11,fontWeight:700,background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:20,padding:"1px 8px"}}>⚠️ Overdue</span>}
                          {sessionOn && !isDone && <span style={{fontSize:11,fontWeight:700,background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:20,padding:"1px 8px"}}>🔔 Now</span>}
                        </div>
                        <div style={{fontSize:12,color:"#6b7a99",marginTop:1}}>{[f.student_id&&`ID: ${f.student_id}`,f.department].filter(Boolean).join(" · ")}</div>
                        <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{background:t.bg,color:t.c,border:`1px solid ${t.b}`,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{t.icon} {f.concern}</span>
                          <span style={{fontSize:12,color:"#64748b"}}>Last: {fmtDate(f.last_session)} · {fmtTime(f.last_time)}</span>
                        </div>
                      </div>
                      {/* Next session */}
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#94a3b8"}}>NEXT SESSION</div>
                        <div style={{fontWeight:700,fontSize:13,color:sessionOn?"#2563eb":overdue?"#dc2626":"#1e3a5f"}}>
                          {f.next_session ? fmtDate(f.next_session) : "Not set"}
                        </div>
                        {f.next_session_time && !isDone && (
                          <div style={{fontSize:12,color:sessionOn?"#2563eb":overdue?"#dc2626":"#475569",fontWeight:600}}>
                            🕐 {fmtTime(f.next_session_time)}
                          </div>
                        )}
                        {urgency && !isDone && (
                          <span style={{background:urgency.bg,color:urgency.color,border:`1px solid ${urgency.border}`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                            {urgency.text}
                          </span>
                        )}
                      </div>
                      {/* Actions */}
                      <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}} onClick={e=>e.stopPropagation()}>
                        {!isDone && (
                          <>
                            <button onClick={()=>{setReschedModal(f);setReschedDate(f.next_session||"");setReschedTime(f.next_session_time||"");}}
                              style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:600,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontFamily:"inherit"}}>
                              📅 Reschedule
                            </button>

                            {/* Today or overdue: Add Case Note */}
                            {sessionOn && (
                              <button onClick={()=>navigate(`/case-notes?session=${f.session_id}`)}
                                style={{padding:"6px 16px",borderRadius:8,fontSize:12,fontWeight:700,border:"none",background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                                📝 Add Case Note
                              </button>
                            )}
                          </>
                        )}
                        {isDone && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✅ Done</span>}
                        <span style={{color:"#cbd5e1",fontSize:14,display:"inline-block",transition:"transform 0.2s",transform:isExp?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExp && (
                      <div style={{padding:"0 18px 18px",background:"#fff"}}>
                        <div style={{height:1,background:"#f0f4f8",margin:"0 0 14px"}}/>

                        {/* Next session info */}
                        {f.next_session && !isDone && (
                          <div style={{background:sessionOn?"#eff6ff":"#fffbeb",border:`1px solid ${sessionOn?"#bfdbfe":"#fde68a"}`,borderLeft:`4px solid ${sessionOn?"#2563eb":"#f59e0b"}`,borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
                            <div style={{fontWeight:700,fontSize:12,color:sessionOn?"#1d4ed8":"#d97706",textTransform:"uppercase",letterSpacing:"0.05em",width:"100%",marginBottom:4}}>
                              {sessionOn?"📝 Session Now — Add Case Notes":"🔄 Scheduled Follow-up Session"}
                            </div>
                            <div style={{background:"#fff",borderRadius:8,padding:"10px 16px",border:`1px solid ${sessionOn?"#bfdbfe":"#fde68a"}`,display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:"1.2rem"}}>📅</span>
                              <div>
                                <div style={{fontSize:"0.68rem",color:sessionOn?"#1d4ed8":"#d97706",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Date</div>
                                <div style={{fontSize:"0.95rem",fontWeight:700,color:sessionOn?"#1e40af":"#92400e"}}>{fmtDate(f.next_session)}</div>
                              </div>
                            </div>
                            {f.next_session_time && (
                              <div style={{background:"#fff",borderRadius:8,padding:"10px 16px",border:`1px solid ${sessionOn?"#bfdbfe":"#fde68a"}`,display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:"1.2rem"}}>🕐</span>
                                <div>
                                  <div style={{fontSize:"0.68rem",color:sessionOn?"#1d4ed8":"#d97706",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Time</div>
                                  <div style={{fontSize:"0.95rem",fontWeight:700,color:sessionOn?"#1e40af":"#92400e"}}>{fmtTime(f.next_session_time)}</div>
                                </div>
                              </div>
                            )}
                            {sessionOn && (
                              <button onClick={()=>navigate(`/case-notes?session=${f.session_id}`)}
                                style={{padding:"10px 20px",borderRadius:9,background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 2px 10px rgba(37,99,235,0.3)",marginLeft:"auto"}}>
                                📝 Add Case Note for This Session →
                              </button>
                            )}
                          </div>
                        )}

                        {f.notes && (
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>Previous Session Notes</div>
                            <div style={{background:"#f8fafc",borderRadius:9,padding:"12px 14px",fontSize:13,color:"#334155",lineHeight:1.7,borderLeft:`3px solid ${t.c}`,whiteSpace:"pre-wrap"}}>{f.notes}</div>
                          </div>
                        )}
                        {f.recommendations && (
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>Recommendations Given</div>
                            <div style={{background:"#f0fdf4",borderRadius:9,padding:"12px 14px",fontSize:13,color:"#166534",lineHeight:1.7,borderLeft:"3px solid #86efac",whiteSpace:"pre-wrap"}}>{f.recommendations}</div>
                          </div>
                        )}
                        {isDone && f.fu_done_note && (
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>Completion Note</div>
                            <div style={{background:"#ecfdf5",borderRadius:9,padding:"12px 14px",fontSize:13,color:"#065f46",lineHeight:1.7,borderLeft:"3px solid #34d399"}}>{f.fu_done_note}</div>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{padding:"4px 12px",borderRadius:20,fontSize:12,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0"}}>📍 {f.mode}</span>
                          {f.created_at && <span style={{padding:"4px 12px",borderRadius:20,fontSize:12,color:"#94a3b8",background:"#f8fafc",border:"1px solid #e2e8f0"}}>Note saved: {fmtDate(f.created_at)}</span>}
                          <button onClick={()=>navigate(`/case-notes?session=${f.session_id}`)}
                            style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600,border:`1px solid ${t.b}`,background:t.bg,color:t.c,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto"}}>
                            📝 View / Edit Case Note →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {toast && <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,padding:"12px 20px",borderRadius:10,fontWeight:600,fontSize:14,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",background:toast.type==="error"?"#fee2e2":"#f0fdf4",border:`1px solid ${toast.type==="error"?"#fca5a5":"#bbf7d0"}`,color:toast.type==="error"?"#991b1b":"#14532d"}}>{toast.msg}</div>}

      {/* Mark Done removed — counselor adds case note instead */}

      {/* Reschedule Modal */}
      {reschedModal && (
        <div className="modal-overlay" onClick={()=>setReschedModal(null)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:"2.2rem",marginBottom:8}}>📅</div>
              <h2 className="modal-name" style={{marginBottom:6}}>Reschedule Follow-up</h2>
              <p style={{color:"#64748b",fontSize:13}}>Set a new follow-up date and time for <strong>{reschedModal.student_name}</strong>.</p>
            </div>
            <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:13,color:"#334155"}}>
              <div style={{fontWeight:700,marginBottom:4,color:"#1e3a5f"}}>Current scheduled</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",color:isOverdue(reschedModal)?"#dc2626":"#475569",fontWeight:isOverdue(reschedModal)?700:400}}>
                <span>{reschedModal.next_session ? fmtDate(reschedModal.next_session) : "Not set"}</span>
                {reschedModal.next_session_time && <span>🕐 {fmtTime(reschedModal.next_session_time)}</span>}
                {isOverdue(reschedModal) && <span>⚠️ Overdue</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:160,display:"flex",flexDirection:"column",gap:6}}>
                <label style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>📅 New Date *</label>
                <input type="date" value={reschedDate} min={new Date().toISOString().split("T")[0]}
                  onChange={e=>setReschedDate(e.target.value)}
                  style={{padding:"10px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,fontFamily:"inherit",outline:"none",background:"#fff",boxSizing:"border-box"}}
                  onFocus={e=>{e.target.style.borderColor="#3b82f6";}} onBlur={e=>{e.target.style.borderColor="#e2e8f0";}}
                />
              </div>
              <div style={{flex:1,minWidth:160,display:"flex",flexDirection:"column",gap:6}}>
                <label style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>🕐 New Time</label>
                <input type="time" value={reschedTime} onChange={e=>setReschedTime(e.target.value)}
                  style={{padding:"10px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,fontFamily:"inherit",outline:"none",background:"#fff",boxSizing:"border-box"}}
                  onFocus={e=>{e.target.style.borderColor="#3b82f6";}} onBlur={e=>{e.target.style.borderColor="#e2e8f0";}}
                />
              </div>
            </div>
            {reschedDate && (
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#92400e"}}>
                📋 <strong>New schedule:</strong> {fmtDate(reschedDate)}{reschedTime?` at ${fmtTime(reschedTime)}`:""}
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button onClick={reschedule} disabled={reschedSaving||!reschedDate}
                style={{flex:2,padding:13,background:(!reschedDate||reschedSaving)?"#94a3b8":"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",border:"none",borderRadius:9,fontWeight:700,fontSize:14,cursor:(!reschedDate||reschedSaving)?"not-allowed":"pointer"}}>
                {reschedSaving?"Saving…":"📅 Confirm Reschedule"}
              </button>
              <button onClick={()=>{setReschedModal(null);setReschedDate("");setReschedTime("");}}
                style={{flex:1,padding:13,background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:9,fontWeight:600,fontSize:14,cursor:"pointer"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}