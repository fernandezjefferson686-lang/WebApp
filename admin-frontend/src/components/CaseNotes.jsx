import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import SidePanel from "./SidePanel";

const API         = "http://127.0.0.1:8000/api";
const STORAGE_URL = "http://127.0.0.1:8000/storage";

const fmtDate  = r => { if (!r) return "—"; const d = new Date(r); return isNaN(d) ? r : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); };
const fmtShort = r => { if (!r) return "—"; const d = new Date(r); return isNaN(d) ? r : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const fmtTime  = r => { if (!r) return "—"; if (/AM|PM/i.test(r)) return r; const [h,m] = r.split(":"); return `${+h%12||12}:${m} ${+h>=12?"PM":"AM"}`; };
const initials = n => (n||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();

const TYPE = {
  academic: { c:"#2563eb", bg:"#eff6ff", b:"#bfdbfe", icon:"📚" },
  crisis:   { c:"#dc2626", bg:"#fef2f2", b:"#fca5a5", icon:"🚨" },
  career:   { c:"#059669", bg:"#ecfdf5", b:"#6ee7b7", icon:"💼" },
  personal: { c:"#ea580c", bg:"#fff7ed", b:"#fed7aa", icon:"💬" },
  default:  { c:"#475569", bg:"#f8fafc", b:"#e2e8f0", icon:"📋" },
};
const tc = t => {
  if (!t) return TYPE.default;
  const s = t.toLowerCase();
  if (s.includes("crisis"))   return TYPE.crisis;
  if (s.includes("academic")) return TYPE.academic;
  if (s.includes("career"))   return TYPE.career;
  if (s.includes("personal")||s.includes("emotional")) return TYPE.personal;
  return TYPE.default;
};

// ── EMPTY now includes next_session_time ──
const EMPTY = { summary:"", recommendations:"", follow_up_needed:false, next_session_date:"", next_session_time:"" };

export default function CaseNotes() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [sessions,    setSessions]    = useState([]);
  const [notes,       setNotes]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [active,      setActive]      = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("All");
  const [expanded,    setExpanded]    = useState(null);
  const [delTarget,   setDelTarget]   = useState(null);
  const [dateMissing, setDateMissing] = useState(false);
  const [timeMissing, setTimeMissing] = useState(false); // ── NEW

  const tok  = () => localStorage.getItem("admin_token")||localStorage.getItem("token")||"";
  const auth = () => ({ headers:{ Authorization:`Bearer ${tok()}`, Accept:"application/json" } });
  const out  = () => { localStorage.removeItem("admin_token"); navigate("/",{replace:true}); };
  const pop  = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  useEffect(()=>{ load(); },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    if (!tok()) { navigate("/",{replace:true}); return; }
    setLoading(true);
    try {
      const [sR,nR] = await Promise.all([
        axios.get(`${API}/admin/counseling-requests`, auth()),
        axios.get(`${API}/admin/case-notes`,          auth()),
      ]);
      const now = new Date(); now.setHours(23,59,59,999);
      const sess = (sR.data?.requests||sR.data||[])
        .filter(s => { if(s.status!=="Approved") return false; const d=new Date(s.session_date||s.date); return !isNaN(d)&&d<=now; })
        .sort((a,b)=>new Date(b.session_date||b.date)-new Date(a.session_date||a.date));
      setSessions(sess);
      const fetchedNotes = nR.data?.notes||[];
      setNotes(fetchedNotes);
      const sid = params.get("session");
      if (sid) { const t = sess.find(s=>String(s.id)===String(sid)); if (t) openWrite(t, fetchedNotes); }
    } catch(e) { if(e.response?.status===401) out(); }
    finally { setLoading(false); }
  };

  const openWrite = (session, notesOverride) => {
    const list = notesOverride||notes;
    const ex   = list.find(n=>n.counseling_request_id===session.id);
    setActive(session);
    setForm(ex ? {
      summary:            ex.summary            || "",
      recommendations:    ex.recommendations    || "",
      follow_up_needed:   ex.follow_up_needed   || false,
      next_session_date:  ex.next_session_date  || "",
      next_session_time:  ex.next_session_time  || "", // ── NEW
    } : {...EMPTY});
    setDateMissing(false);
    setTimeMissing(false);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  /* ── Save with follow-up date + time validation ── */
  const save = async () => {
    if (!form.summary.trim()) {
      pop("⚠️ Session notes cannot be empty. Please write what was discussed.", "error");
      return;
    }
    if (form.follow_up_needed && !form.next_session_date.trim()) {
      setDateMissing(true);
      setTimeMissing(false);
      pop("📅 Please set a next session date. You checked that another session is needed.", "error");
      document.getElementById("followup-section")?.scrollIntoView({ behavior:"smooth", block:"center" });
      return;
    }
    if (form.follow_up_needed && !form.next_session_time.trim()) {
      setTimeMissing(true);
      setDateMissing(false);
      pop("🕐 Please set a next session time as well.", "error");
      document.getElementById("followup-section")?.scrollIntoView({ behavior:"smooth", block:"center" });
      return;
    }

    setDateMissing(false);
    setTimeMissing(false);
    setSaving(true);
    try {
      const res = await axios.post(`${API}/admin/case-notes/session/${active.id}`,
        {
          summary:           form.summary,
          recommendations:   form.recommendations||null,
          follow_up_needed:  form.follow_up_needed,
          next_session_date: form.next_session_date||null,
          next_session_time: form.next_session_time||null, // ── NEW
        },
        auth()
      );
      const saved = res.data?.note;
      setNotes(prev => {
        const ex = prev.find(n=>n.counseling_request_id===active.id);
        return ex ? prev.map(n=>n.counseling_request_id===active.id?{...n,...saved}:n)
                  : [{...saved, counseling_request_id:active.id},...prev];
      });
      pop("✅ Case note saved successfully!");
      setTimeout(()=>setActive(null), 1000);
    } catch(e) {
      if(e.response?.status===401) out();
      else pop("Failed to save. Please try again.", "error");
    } finally { setSaving(false); }
  };

  const del = async id => {
    try {
      await axios.delete(`${API}/admin/case-notes/${id}`, auth());
      setNotes(prev=>prev.filter(n=>n.id!==id));
      if(expanded?.id===id) setExpanded(null);
      setDelTarget(null);
      pop("Note deleted.");
    } catch(e) { if(e.response?.status===401) out(); }
  };

  const merged = sessions.map(s=>({...s, note: notes.find(n=>n.counseling_request_id===s.id)||null }));

  const recentNotes = notes
    .map(n=>{ const s=sessions.find(x=>x.id===n.counseling_request_id); return s?{...n,session:s}:null; })
    .filter(Boolean)
    .filter(n=>{
      if(filter==="Follow-up"&&!n.follow_up_needed) return false;
      const q=search.toLowerCase();
      return !q||(n.session?.student_name||"").toLowerCase().includes(q)||(n.session?.session_type||"").toLowerCase().includes(q);
    })
    .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));

  /* ════════════════════
     WRITE VIEW
  ════════════════════ */
  if (active) {
    const t      = tc(active.session_type||active.type);
    const isEdit = !!notes.find(n=>n.counseling_request_id===active.id);

    const saveDisabled = saving
      || !form.summary.trim()
      || (form.follow_up_needed && !form.next_session_date)
      || (form.follow_up_needed && !form.next_session_time); // ── NEW condition

    const anyMissing = dateMissing || timeMissing;

    return (
      <div className="admin-home">
        <SidePanel onLogout={out}/>
        <main className="admin-main" style={{maxWidth:860}}>

          {/* Breadcrumb */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            <button onClick={()=>setActive(null)} style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",color:"#64748b",fontWeight:600,fontSize:13,padding:"6px 10px",borderRadius:8}}>
              ← Back to Case Notes
            </button>
            <span style={{color:"#e2e8f0"}}>›</span>
            <span style={{fontSize:13,color:"#94a3b8"}}>{active.student_name||"Student"}</span>
            <span style={{marginLeft:"auto",background:isEdit?"#eff6ff":"#f0fdf4",color:isEdit?"#2563eb":"#16a34a",border:`1px solid ${isEdit?"#bfdbfe":"#86efac"}`,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700}}>
              {isEdit?"✏️ Editing Note":"✍️ New Note"}
            </span>
          </div>

          {/* Session banner */}
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e3a5f)",borderRadius:14,padding:"18px 22px",marginBottom:24,borderLeft:`5px solid ${t.c}`,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:t.c,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:16,flexShrink:0,overflow:"hidden"}}>
              {active.profile_pic
                ? <img src={`${STORAGE_URL}/${active.profile_pic}`} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";}}/>
                : initials(active.student_name||active.name)}
            </div>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontWeight:800,fontSize:17}}>{active.student_name||active.name||"Unknown"}</div>
              <div style={{color:"rgba(255,255,255,0.5)",fontSize:12,marginTop:2}}>{[active.student_id&&`ID: ${active.student_id}`,active.department].filter(Boolean).join(" · ")}</div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[
                {label:`${t.icon} ${active.session_type||active.type||"General"}`, style:{background:t.bg,color:t.c,border:`1px solid ${t.b}`}},
                {label:`📅 ${fmtDate(active.session_date||active.date)}`},
                {label:`🕐 ${fmtTime(active.session_time||active.time)}`},
                {label:`📍 ${active.mode||"—"}`},
              ].map((p,i)=>(
                <span key={i} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.8)",border:"1px solid rgba(255,255,255,0.15)",...(p.style||{})}}>{p.label}</span>
              ))}
            </div>
            {active.reason && (
              <div style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"rgba(255,255,255,0.65)"}}>
                <strong style={{color:"rgba(255,255,255,0.4)",textTransform:"uppercase",fontSize:10,letterSpacing:"0.05em"}}>Reason: </strong>{active.reason}
              </div>
            )}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* Section 1: Session Notes */}
            <div style={{background:"#fff",borderRadius:12,padding:"22px 24px",border:"1px solid #eef2f8",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:"#1e3a5f",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800}}>1</div>
                  <span style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Session Notes</span>
                  <span style={{background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:700}}>Required</span>
                </div>
                <span style={{fontSize:11,color:"#94a3b8",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:20,padding:"2px 10px"}}>📖 Visible to student</span>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {[
                  {e:"😌",l:"Calm",    t:"Student appeared calm and composed throughout the session."},
                  {e:"😟",l:"Anxious", t:"Student showed signs of anxiety during the session."},
                  {e:"😔",l:"Sad",     t:"Student appeared sad and somewhat withdrawn."},
                  {e:"😤",l:"Upset",   t:"Student expressed frustration or emotional distress."},
                  {e:"🌱",l:"Hopeful", t:"Student seemed hopeful and open to guidance."},
                  {e:"🛡️",l:"Guarded", t:"Student was initially guarded but gradually opened up."},
                ].map((m,i)=>(
                  <button key={i} onClick={()=>setForm(p=>({...p,summary:p.summary?`${p.summary}\n${m.t}`:m.t}))}
                    style={{padding:"4px 12px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                    {m.e} {m.l}
                  </button>
                ))}
              </div>
              <textarea rows={8}
                placeholder={"Write session notes here...\n\nDocument:\n• What topics were discussed\n• Student's emotional state and responses\n• Interventions or techniques used\n• Key quotes or concerns raised"}
                value={form.summary}
                onChange={e=>setForm(p=>({...p,summary:e.target.value}))}
                style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e8edf5",fontSize:14,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical",lineHeight:1.8,outline:"none",background:"#fafbfd",color:"#1e293b"}}
                onFocus={e=>{e.target.style.borderColor="#3b82f6"; e.target.style.boxShadow="0 0 0 3px rgba(59,130,246,0.09)";}}
                onBlur={e=>{e.target.style.borderColor="#e8edf5"; e.target.style.boxShadow="none";}}
              />
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12,color:"#94a3b8"}}>
                <span>{form.summary.trim().split(/\s+/).filter(Boolean).length} words</span>
                {form.summary && <button onClick={()=>setForm(p=>({...p,summary:""}))} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:12,fontWeight:600}}>Clear</button>}
              </div>
            </div>

            {/* Section 2: Recommendations */}
            <div style={{background:"#fff",borderRadius:12,padding:"22px 24px",border:"1px solid #eef2f8",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:"#1e3a5f",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800}}>2</div>
                  <span style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Recommendations & Next Steps</span>
                  <span style={{background:"#f8fafc",color:"#94a3b8",border:"1px solid #e2e8f0",borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:600}}>Optional</span>
                </div>
                <span style={{fontSize:11,color:"#94a3b8",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:20,padding:"2px 10px"}}>📖 Visible to student</span>
              </div>
              <p style={{fontSize:13,color:"#94a3b8",margin:"0 0 10px"}}>Advice, action items, and resources discussed with the student.</p>
              <textarea rows={4}
                placeholder={"e.g.:\n• Practice deep breathing 10 minutes daily\n• Follow up with professor regarding missed exams\n• Schedule appointment with school physician"}
                value={form.recommendations}
                onChange={e=>setForm(p=>({...p,recommendations:e.target.value}))}
                style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e8edf5",fontSize:14,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical",lineHeight:1.8,outline:"none",background:"#fafbfd",color:"#1e293b"}}
                onFocus={e=>{e.target.style.borderColor="#3b82f6"; e.target.style.boxShadow="0 0 0 3px rgba(59,130,246,0.09)";}}
                onBlur={e=>{e.target.style.borderColor="#e8edf5"; e.target.style.boxShadow="none";}}
              />
            </div>

            {/* Section 3: Follow-up with Date + Time */}
            <div id="followup-section" style={{
              background:"#fff", borderRadius:12, padding:"22px 24px",
              border: anyMissing ? "2px solid #ef4444" : "1px solid #eef2f8",
              boxShadow: anyMissing ? "0 0 0 4px rgba(239,68,68,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
              transition:"border 0.2s, box-shadow 0.2s",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:anyMissing?"#ef4444":"#1e3a5f",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,transition:"background 0.2s"}}>3</div>
                <span style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>Follow-up Plan</span>
                {anyMissing && (
                  <span style={{background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                    ⚠️ {dateMissing ? "Date required" : "Time required"}
                  </span>
                )}
              </div>

              {/* Toggle */}
              <div style={{marginBottom:16}}>
                <button type="button"
                  onClick={()=>{ setForm(p=>({...p,follow_up_needed:!p.follow_up_needed,next_session_date:"",next_session_time:""})); setDateMissing(false); setTimeMissing(false); }}
                  style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"14px 18px", borderRadius:10, cursor:"pointer", textAlign:"left",
                    border:`1.5px solid ${form.follow_up_needed?"#f59e0b":"#e2e8f0"}`,
                    background:form.follow_up_needed?"#fffbeb":"#fafbfd",
                    width:"100%", transition:"all 0.15s",
                  }}>
                  <div style={{width:22,height:22,borderRadius:6,background:form.follow_up_needed?"#f59e0b":"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:800,flexShrink:0}}>
                    {form.follow_up_needed?"✓":""}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:form.follow_up_needed?"#d97706":"#64748b"}}>Another session needed</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Check if student requires a follow-up counseling session</div>
                  </div>
                </button>
              </div>

              {/* Date + Time row — shown when follow-up is checked */}
              {form.follow_up_needed && (
                <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>

                  {/* Date picker */}
                  <div style={{flex:1,minWidth:180,display:"flex",flexDirection:"column",gap:6}}>
                    <label style={{fontSize:12,fontWeight:700,color:dateMissing?"#ef4444":"#d97706",display:"flex",alignItems:"center",gap:5}}>
                      📅 Next session date
                      <span style={{background:dateMissing?"#fef2f2":"#fff7ed",color:dateMissing?"#ef4444":"#d97706",border:`1px solid ${dateMissing?"#fecaca":"#fcd34d"}`,borderRadius:10,padding:"0px 7px",fontSize:10,fontWeight:700}}>
                        {dateMissing?"Required ⚠️":"Required"}
                      </span>
                    </label>
                    <input type="date"
                      value={form.next_session_date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={e=>{ setForm(p=>({...p,next_session_date:e.target.value})); setDateMissing(false); }}
                      style={{
                        padding:"10px 12px",borderRadius:8,
                        border:dateMissing?"2px solid #ef4444":`1.5px solid #f59e0b`,
                        fontSize:14,fontFamily:"inherit",outline:"none",
                        background:"#fff",color:"#1e293b",
                        boxShadow:dateMissing?"0 0 0 3px rgba(239,68,68,0.12)":"none",
                        transition:"all 0.2s",
                      }}
                      onFocus={e=>{ e.target.style.borderColor=dateMissing?"#ef4444":"#f59e0b"; }}
                      onBlur={e=>{ e.target.style.borderColor=dateMissing?"#ef4444":"#f59e0b"; }}
                    />
                    {!form.next_session_date && (
                      <div style={{fontSize:11,color:dateMissing?"#ef4444":"#d97706",display:"flex",alignItems:"center",gap:3,marginTop:1}}>
                        {dateMissing?"⚠️ Date is required to save.":"📅 Select a date for the follow-up."}
                      </div>
                    )}
                  </div>

                  {/* Time picker */}
                  <div style={{flex:1,minWidth:180,display:"flex",flexDirection:"column",gap:6}}>
                    <label style={{fontSize:12,fontWeight:700,color:timeMissing?"#ef4444":"#d97706",display:"flex",alignItems:"center",gap:5}}>
                      🕐 Next session time
                      <span style={{background:timeMissing?"#fef2f2":"#fff7ed",color:timeMissing?"#ef4444":"#d97706",border:`1px solid ${timeMissing?"#fecaca":"#fcd34d"}`,borderRadius:10,padding:"0px 7px",fontSize:10,fontWeight:700}}>
                        {timeMissing?"Required ⚠️":"Required"}
                      </span>
                    </label>
                    <input type="time"
                      value={form.next_session_time}
                      onChange={e=>{ setForm(p=>({...p,next_session_time:e.target.value})); setTimeMissing(false); }}
                      style={{
                        padding:"10px 12px",borderRadius:8,
                        border:timeMissing?"2px solid #ef4444":`1.5px solid #f59e0b`,
                        fontSize:14,fontFamily:"inherit",outline:"none",
                        background:"#fff",color:"#1e293b",
                        boxShadow:timeMissing?"0 0 0 3px rgba(239,68,68,0.12)":"none",
                        transition:"all 0.2s",
                      }}
                      onFocus={e=>{ e.target.style.borderColor=timeMissing?"#ef4444":"#f59e0b"; }}
                      onBlur={e=>{ e.target.style.borderColor=timeMissing?"#ef4444":"#f59e0b"; }}
                    />
                    {!form.next_session_time && (
                      <div style={{fontSize:11,color:timeMissing?"#ef4444":"#d97706",display:"flex",alignItems:"center",gap:3,marginTop:1}}>
                        {timeMissing?"⚠️ Time is required to save.":"🕐 Select a time for the follow-up."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview when both are filled */}
              {form.follow_up_needed && form.next_session_date && form.next_session_time && (
                <div style={{marginTop:14,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                  <span style={{fontSize:16}}>📋</span>
                  <div>
                    <span style={{fontWeight:700,color:"#d97706"}}>Follow-up scheduled: </span>
                    <span style={{color:"#78350f"}}>
                      {fmtDate(form.next_session_date)} at {fmtTime(form.next_session_time)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Save / Cancel */}
            <div style={{display:"flex",gap:12,paddingBottom:32}}>
              <button onClick={save} disabled={saveDisabled}
                style={{
                  flex:2, padding:"14px 24px",
                  background: saveDisabled
                    ? (form.follow_up_needed && (!form.next_session_date||!form.next_session_time) ? "#f59e0b" : "#94a3b8")
                    : `linear-gradient(135deg,#1e3a5f,${t.c})`,
                  color:"#fff", border:"none", borderRadius:10,
                  fontWeight:700, fontSize:15,
                  cursor:saveDisabled?"not-allowed":"pointer",
                  boxShadow:saveDisabled?"none":"0 4px 16px rgba(37,99,235,0.25)",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  transition:"all 0.2s",
                }}>
                {saving ? "Saving..." :
                 (form.follow_up_needed && !form.next_session_date) ? "📅 Set follow-up date to save" :
                 (form.follow_up_needed && !form.next_session_time) ? "🕐 Set follow-up time to save" :
                 `💾 ${isEdit?"Update":"Save"} Case Note`}
              </button>
              <button onClick={()=>{ setActive(null); setDateMissing(false); setTimeMissing(false); }}
                style={{flex:1,padding:"14px",background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer"}}>
                Cancel
              </button>
            </div>
          </div>
        </main>
        {toast && <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,padding:"12px 20px",borderRadius:10,fontWeight:600,fontSize:14,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",background:toast.type==="error"?"#fee2e2":"#f0fdf4",border:`1px solid ${toast.type==="error"?"#fca5a5":"#bbf7d0"}`,color:toast.type==="error"?"#991b1b":"#14532d"}}>{toast.msg}</div>}
      </div>
    );
  }

  /* ════════════════════
     MAIN VIEW
  ════════════════════ */
  const counts = { All: recentNotes.length, "Follow-up": notes.filter(n=>n.follow_up_needed).length };

  return (
    <div className="admin-home">
      <SidePanel onLogout={out}/>
      <main className="admin-main">
        <div className="page-header">
          <h1>Case Notes</h1>
          <p>View and manage session notes for approved counseling sessions</p>
        </div>

        <div className="stats-grid">
          {[
            { label:"Total Sessions", value:merged.length,                              icon:"📋" },
            { label:"Notes Written",  value:notes.length,                               icon:"📝", accent:"#16a34a" },
            { label:"Needs Notes",    value:merged.filter(s=>!s.note).length,           icon:"⚠️", accent:merged.filter(s=>!s.note).length>0?"#d97706":undefined },
            { label:"Follow-ups",     value:notes.filter(n=>n.follow_up_needed).length, icon:"🔄" },
          ].map((s,i)=>(
            <div key={i} className="stat-card" style={s.accent?{borderTop:`3px solid ${s.accent}`}:{}}>
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value" style={s.accent?{color:s.accent}:{}}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="main-card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <h3 className="card-title" style={{margin:0}}>
              📝 Case Notes
              <span style={{marginLeft:8,background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:12,padding:"2px 10px",fontSize:12,fontWeight:700}}>{recentNotes.length}</span>
            </h3>
            <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:8,padding:3}}>
              {["All","Follow-up"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 14px",borderRadius:6,border:"none",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"inherit",background:filter===f?"#1e3a5f":"transparent",color:filter===f?"#fff":"#64748b"}}>
                  {f} <span style={{opacity:0.7}}>({counts[f]||0})</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{position:"relative",marginBottom:16}}>
            <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>🔍</span>
            <input type="text" placeholder="Search by student name or session type…"
              value={search} onChange={e=>setSearch(e.target.value)}
              style={{width:"100%",padding:"10px 12px 10px 36px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:14,fontFamily:"inherit",outline:"none",background:"#fafbfd",boxSizing:"border-box"}}
            />
            {search && <button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:18}}>×</button>}
          </div>

          {loading ? (
            <div className="empty-state"><p style={{color:"#94a3b8"}}>Loading case notes…</p></div>
          ) : recentNotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>{notes.length===0?"No case notes yet. Add notes from the Schedule Session page.":"No notes match your search."}</p>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {recentNotes.map(n => {
                const s = n.session;
                const t = tc(s?.session_type||s?.type);
                const isExp = expanded?.id === n.id;
                return (
                  <div key={n.id} style={{border:`1.5px solid ${isExp?"#bfdbfe":"#eef2f8"}`,borderLeft:`4px solid ${t.c}`,borderRadius:12,overflow:"hidden",boxShadow:isExp?"0 4px 20px rgba(0,0,0,0.07)":"none",transition:"all 0.2s"}}>
                    <div onClick={()=>setExpanded(isExp?null:n)} style={{padding:"14px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,background:isExp?"#f8fafc":"#fff"}}>
                      <div style={{width:40,height:40,borderRadius:"50%",background:t.c,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",overflow:"hidden"}}>
                        {s?.profile_pic ? <img src={`${STORAGE_URL}/${s.profile_pic}`} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.onerror=null;}}/> : initials(s?.student_name)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14,color:"#1a1f2e"}}>{s?.student_name||"Unknown Student"}</div>
                        <div style={{fontSize:12,color:"#6b7a99",marginTop:1}}>{[s?.student_id&&`ID: ${s.student_id}`,s?.department].filter(Boolean).join(" · ")}</div>
                        <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{fontSize:12,color:"#64748b"}}>📅 {fmtShort(s?.session_date||s?.date)} · {fmtTime(s?.session_time||s?.time)}</span>
                          <span style={{background:t.bg,color:t.c,border:`1px solid ${t.b}`,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>{t.icon} {s?.session_type||s?.type}</span>
                          {n.follow_up_needed && <span style={{background:"#fff7ed",color:"#d97706",border:"1px solid #fcd34d",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:600}}>🔄 Follow-up</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>openWrite(s)} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,border:`1.5px solid ${t.c}`,background:t.bg,color:t.c,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                        <button onClick={()=>setDelTarget(n)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,border:"1px solid #fecaca",background:"#fff",color:"#dc2626",cursor:"pointer"}}>🗑️</button>
                        <span style={{color:"#cbd5e1",fontSize:14,transform:isExp?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",display:"inline-block"}}>▾</span>
                      </div>
                    </div>
                    {isExp && (
                      <div style={{padding:"0 18px 18px",background:"#fff"}}>
                        <div style={{height:1,background:"#f0f4f8",margin:"0 0 16px"}}/>
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:7}}>Session Notes</div>
                          <div style={{background:"#f8fafc",borderRadius:9,padding:"13px 16px",fontSize:14,color:"#334155",lineHeight:1.8,borderLeft:`3px solid ${t.c}`,whiteSpace:"pre-wrap"}}>{n.summary||"—"}</div>
                        </div>
                        {n.recommendations && (
                          <div style={{marginBottom:14}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:7}}>Recommendations</div>
                            <div style={{background:"#f0fdf4",borderRadius:9,padding:"13px 16px",fontSize:14,color:"#166534",lineHeight:1.8,borderLeft:"3px solid #86efac",whiteSpace:"pre-wrap"}}>{n.recommendations}</div>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          <span style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600,background:n.follow_up_needed?"#fff7ed":"#f0fdf4",color:n.follow_up_needed?"#d97706":"#16a34a",border:`1px solid ${n.follow_up_needed?"#fcd34d":"#86efac"}`}}>
                            {n.follow_up_needed?"🔄 Follow-up needed":"✅ No follow-up needed"}
                          </span>
                          {/* ── Show date AND time in the expanded view ── */}
                          {n.next_session_date && (
                            <span style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600,background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe"}}>
                              📅 {fmtShort(n.next_session_date)}
                              {n.next_session_time && <> · 🕐 {fmtTime(n.next_session_time)}</>}
                            </span>
                          )}
                          {n.created_at && <span style={{padding:"4px 12px",borderRadius:20,fontSize:12,color:"#94a3b8",background:"#f8fafc",border:"1px solid #e2e8f0"}}>Saved: {fmtShort(n.created_at)}</span>}
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

      {delTarget && (
        <div className="modal-overlay" onClick={()=>setDelTarget(null)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"2.5rem",marginBottom:10}}>🗑️</div>
              <h2 className="modal-name" style={{marginBottom:8}}>Delete Case Note?</h2>
              <p style={{color:"#64748b",fontSize:14,marginBottom:24}}>This will permanently remove the case note for <strong>{delTarget.session?.student_name}</strong>. This cannot be undone.</p>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>del(delTarget.id)} style={{flex:1,padding:12,background:"#dc2626",color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer"}}>Yes, Delete</button>
                <button onClick={()=>setDelTarget(null)} style={{flex:1,padding:12,background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}