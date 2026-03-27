import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform, StatusBar, Modal, FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../services/api";

const COUNSELOR = "Julie Torreon Maestrado";
const EMPTY = { date:"", time:"", type:"Academic Counseling", mode:"Face-to-Face", reason:"" };
const POLL_MS = 5000;

const fmtDate = raw => { if(!raw) return "—"; const d=new Date(raw); return isNaN(d)?raw:d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const fmtTime = raw => { if(!raw) return "—"; if(/AM|PM/i.test(raw)) return raw; const [h,m]=raw.split(":"); return `${+h%12||12}:${m} ${+h>=12?"PM":"AM"}`; };

// ── Calendar Date Picker ─────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function CalendarPicker({ visible, onSelect, onClose, selectedDate }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const cells       = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const prevMonth = () => {
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const isSelected = (day) => {
    if (!day || !selectedDate) return false;
    return `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` === selectedDate;
  };
  const isToday   = (day) => day && day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isPast    = (day) => { if(!day) return false; const d=new Date(viewYear,viewMonth,day); d.setHours(0,0,0,0); const t=new Date(); t.setHours(0,0,0,0); return d<t; };
  const isWeekend = (day) => day && [0,6].includes(new Date(viewYear, viewMonth, day).getDay());
  const isPrevDisabled = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={CAL.overlay} activeOpacity={1} onPress={onClose}>
        <View style={CAL.sheet}>
          <View style={CAL.handle}/>
          <View style={CAL.header}>
            <Text style={CAL.headerSub}>Select Appointment Date</Text>
            <View style={CAL.nav}>
              <TouchableOpacity style={[CAL.navBtn, isPrevDisabled && CAL.navBtnDisabled]} onPress={prevMonth} disabled={isPrevDisabled}>
                <Text style={[CAL.navArrow, isPrevDisabled && { color:"#cbd5e1" }]}>‹</Text>
              </TouchableOpacity>
              <View style={{ alignItems:"center" }}>
                <Text style={CAL.navMonth}>{MONTHS[viewMonth]}</Text>
                <Text style={CAL.navYear}>{viewYear}</Text>
              </View>
              <TouchableOpacity style={CAL.navBtn} onPress={nextMonth}>
                <Text style={CAL.navArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={CAL.legendRow}>
            <View style={CAL.legendItem}><View style={[CAL.legendDot,{backgroundColor:"#1e3a5f"}]}/><Text style={CAL.legendText}>Selected</Text></View>
            <View style={CAL.legendItem}><View style={[CAL.legendDot,{backgroundColor:"#bfdbfe"}]}/><Text style={CAL.legendText}>Today</Text></View>
            <View style={CAL.legendItem}><View style={[CAL.legendDot,{backgroundColor:"#fca5a5"}]}/><Text style={CAL.legendText}>Weekend</Text></View>
          </View>
          <View style={CAL.dayRow}>
            {DAYS_SHORT.map(d => (
              <Text key={d} style={[CAL.dayHeader, (d==="Sun"||d==="Sat") && { color:"#ef4444" }]}>{d}</Text>
            ))}
          </View>
          <View style={CAL.grid}>
            {cells.map((day, i) => {
              const past=isPast(day), weekend=isWeekend(day), sel=isSelected(day), tod=isToday(day);
              return (
                <TouchableOpacity key={i}
                  style={[CAL.cell, sel&&CAL.cellSelected, tod&&!sel&&CAL.cellToday, !day&&{opacity:0}]}
                  disabled={!day||past||weekend}
                  onPress={() => { onSelect(`${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`); onClose(); }}
                  activeOpacity={0.7}>
                  <Text style={[CAL.cellText, sel&&CAL.cellTextSelected, tod&&!sel&&CAL.cellTextToday, past&&CAL.cellTextDisabled, weekend&&CAL.cellTextWeekend]}>
                    {day||""}
                  </Text>
                  {tod&&!sel&&<View style={CAL.todayDot}/>}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={CAL.hint}>Tap a weekday to select · Weekends unavailable</Text>
          <TouchableOpacity style={CAL.closeBtn} onPress={onClose}>
            <Text style={CAL.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Time Picker ──────────────────────────────────────────────
const TIME_SLOTS = [
  { label:"8:00 AM",  value:"08:00" },{ label:"9:00 AM",  value:"09:00" },
  { label:"10:00 AM", value:"10:00" },{ label:"11:00 AM", value:"11:00" },
  { label:"1:00 PM",  value:"13:00" },{ label:"2:00 PM",  value:"14:00" },
  { label:"3:00 PM",  value:"15:00" },{ label:"4:00 PM",  value:"16:00" },
];

function TimePicker({ visible, onSelect, onClose, selectedTime }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={CAL.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[CAL.sheet, { maxHeight:"50%" }]}>
          <View style={CAL.handle}/>
          <Text style={CAL.navTitle}>Select Time</Text>
          <View style={{ height:12 }}/>
          <FlatList data={TIME_SLOTS} keyExtractor={i=>i.value} renderItem={({ item }) => {
            const sel = item.value === selectedTime;
            return (
              <TouchableOpacity style={[TM.slot, sel&&TM.slotActive]} onPress={() => { onSelect(item.value); onClose(); }} activeOpacity={0.7}>
                <Text style={TM.slotIcon}>🕐</Text>
                <Text style={[TM.slotText, sel&&TM.slotTextActive]}>{item.label}</Text>
                {sel && <Text style={TM.check}>✓</Text>}
              </TouchableOpacity>
            );
          }}/>
          <TouchableOpacity style={CAL.closeBtn} onPress={onClose}>
            <Text style={CAL.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Approved:  { bg:"#f0fdf4", color:"#16a34a", icon:"✅" },
    Pending:   { bg:"#fff7ed", color:"#d97706", icon:"⏳" },
    Rejected:  { bg:"#fef2f2", color:"#dc2626", icon:"❌" },
    Cancelled: { bg:"#f8fafc", color:"#64748b", icon:"🚫" },
  };
  const c = map[status] || map.Pending;
  return (
    <View style={[S.pill, { backgroundColor:c.bg }]}>
      <Text style={[S.pillText, { color:c.color }]}>{c.icon} {status}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function CounselingRequestScreen() {
  const [form,     setForm]     = useState(EMPTY);
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(true);
  const [tab,      setTab]      = useState("form");
  const [showCal,  setShowCal]  = useState(false);
  const [showTime, setShowTime] = useState(false);
  const pollRef   = useRef(null);
  const scrollRef = useRef(null);

  const fetchRequests = async (silent = true) => {
    try {
      const r = await api.get("/user/counseling-requests");
      setRequests(r.data?.requests || r.data || []);
    } catch {}
    finally { if (!silent) setFetching(false); }
  };

  useEffect(() => {
    fetchRequests(false);
    pollRef.current = setInterval(() => fetchRequests(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  const handleSubmit = async () => {
    if (!form.date)          { Alert.alert("Missing Date",   "Please select a preferred date."); return; }
    if (!form.time)          { Alert.alert("Missing Time",   "Please select a preferred time."); return; }
    if (!form.reason.trim()) { Alert.alert("Missing Reason", "Please describe your concern."); return; }
    setLoading(true);
    try {
      const res = await api.post("/user/counseling-requests", {
        counselor: COUNSELOR, session_date: form.date, session_time: form.time,
        session_type: form.type, mode: form.mode, reason: form.reason,
      });
      setRequests(prev => [res.data?.request || res.data, ...prev]);
      setForm(EMPTY); setTab("list");
      Alert.alert("✅ Submitted", "Your counseling request has been submitted!");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to submit. Please try again.");
    } finally { setLoading(false); }
  };

  const cancelRequest = async (id) => {
    Alert.alert("Cancel Request", "Are you sure you want to cancel this request?", [
      { text:"No" },
      { text:"Yes, Cancel", style:"destructive", onPress: async () => {
        try { await api.patch(`/user/counseling-requests/${id}/cancel`, {}); } catch {}
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status:"Cancelled" } : r));
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":"height"} keyboardVerticalOffset={Platform.OS==="ios"?0:20}>
      <View style={{ flex:1, backgroundColor:"#f8fafc" }}>

        {/* Tabs */}
        <View style={S.tabs}>
          <TouchableOpacity style={[S.tab, tab==="form"&&S.tabActive]} onPress={()=>setTab("form")}>
            <Text style={[S.tabText, tab==="form"&&S.tabTextActive]}>📋 New Request</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.tab, tab==="list"&&S.tabActive]} onPress={()=>setTab("list")}>
            <Text style={[S.tabText, tab==="list"&&S.tabTextActive]}>📄 My Requests ({requests.length})</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={{ padding:16, paddingBottom:40 }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>

          {tab === "form" ? (
            <View>
              {/* Counselor banner */}
              <View style={S.counselorBanner}>
                <View style={S.counselorAvatar}>
                  <Text style={{color:"#fff",fontWeight:"800",fontSize:15}}>JM</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={S.counselorName}>{COUNSELOR}</Text>
                  <Text style={S.counselorRole}>School Counselor · Guidance Office</Text>
                  <Text style={{fontSize:11,color:"#22c55e",fontWeight:"600"}}>● Available for sessions</Text>
                </View>
              </View>

              <View style={S.card}>
                <Text style={S.cardTitle}>New Session Request</Text>

                <Text style={S.label}>Session Type</Text>
                <View style={S.pickerWrap}>
                  <Picker selectedValue={form.type} onValueChange={v=>setForm(p=>({...p,type:v}))}>
                    <Picker.Item label="📘 Academic Counseling"             value="Academic Counseling"/>
                    <Picker.Item label="💬 Personal / Emotional Counseling" value="Personal / Emotional Counseling"/>
                    <Picker.Item label="👨‍👩‍👧 Family Counseling"                value="Family Counseling"/>
                    <Picker.Item label="💼 Career Counseling"               value="Career Counseling"/>
                    <Picker.Item label="⚠️ Crisis Intervention"             value="Crisis Intervention"/>
                  </Picker>
                </View>

                <Text style={S.label}>Preferred Date *</Text>
                <TouchableOpacity style={S.pickerBtn} onPress={()=>setShowCal(true)} activeOpacity={0.8}>
                  <Text style={S.pickerBtnIcon}>📅</Text>
                  <View style={{ flex:1 }}>
                    <Text style={form.date ? S.pickerBtnValue : S.pickerBtnPlaceholder}>
                      {form.date ? fmtDate(form.date) : "Tap to select a date"}
                    </Text>
                    {form.date && <Text style={S.pickerBtnSub}>{form.date}</Text>}
                  </View>
                  <Text style={S.pickerBtnArrow}>›</Text>
                </TouchableOpacity>

                <Text style={S.label}>Preferred Time *</Text>
                <TouchableOpacity style={S.pickerBtn} onPress={()=>setShowTime(true)} activeOpacity={0.8}>
                  <Text style={S.pickerBtnIcon}>🕐</Text>
                  <Text style={form.time ? S.pickerBtnValue : S.pickerBtnPlaceholder}>
                    {form.time ? fmtTime(form.time) : "Tap to select a time slot"}
                  </Text>
                  <Text style={S.pickerBtnArrow}>›</Text>
                </TouchableOpacity>

                <Text style={S.label}>Mode of Session</Text>
                <View style={S.modeRow}>
                  {["Face-to-Face","Online"].map(m => (
                    <TouchableOpacity key={m} style={[S.modeBtn, form.mode===m&&S.modeBtnActive]}
                      onPress={()=>setForm(p=>({...p,mode:m}))} activeOpacity={0.8}>
                      <Text style={[S.modeBtnText, form.mode===m&&S.modeBtnTextActive]}>
                        {m==="Face-to-Face" ? "🏫 Face-to-Face" : "💻 Online"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={S.label}>Reason / Concern *</Text>
                <View style={S.textAreaWrap}>
                  <TextInput style={S.textArea}
                    placeholder="Briefly describe what you'd like to discuss..."
                    placeholderTextColor="#94a3b8" value={form.reason}
                    onChangeText={v=>setForm(p=>({...p,reason:v}))}
                    multiline numberOfLines={4} textAlignVertical="top"/>
                </View>

                {(form.date || form.time) && (
                  <View style={S.summaryBox}>
                    <Text style={S.summaryTitle}>📋 Request Summary</Text>
                    <Text style={S.summaryRow}>Type: <Text style={S.summaryVal}>{form.type}</Text></Text>
                    {form.date&&<Text style={S.summaryRow}>Date: <Text style={S.summaryVal}>{fmtDate(form.date)}</Text></Text>}
                    {form.time&&<Text style={S.summaryRow}>Time: <Text style={S.summaryVal}>{fmtTime(form.time)}</Text></Text>}
                    <Text style={S.summaryRow}>Mode: <Text style={S.summaryVal}>{form.mode}</Text></Text>
                  </View>
                )}

                <TouchableOpacity style={S.btn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#fff"/> : <Text style={S.btnText}>Submit Request →</Text>}
                </TouchableOpacity>
              </View>
            </View>

          ) : (
            <View>
              <Text style={[S.cardTitle, { marginBottom:14 }]}>My Requests</Text>

              {fetching ? (
                <View style={{ alignItems:"center", padding:30 }}>
                  <ActivityIndicator color="#1e3a5f"/>
                  <Text style={{ color:"#94a3b8", marginTop:8 }}>Loading…</Text>
                </View>
              ) : requests.length === 0 ? (
                <View style={S.empty}>
                  <Text style={S.emptyIcon}>📭</Text>
                  <Text style={S.emptyText}>No requests yet.</Text>
                </View>
              ) : requests.map(r => (
                <View key={r.id} style={S.reqCard}>
                  <View style={S.reqHeader}>
                    <Text style={S.reqType}>{r.session_type||r.type||"General"}</Text>
                    <StatusBadge status={r.status}/>
                  </View>
                  <Text style={S.reqMeta}>📅 {fmtDate(r.session_date||r.date)}  ·  🕐 {fmtTime(r.session_time||r.time)}</Text>
                  <Text style={S.reqMeta}>📍 {r.mode}</Text>
                  {r.status==="Approved" && (
                    <View style={S.approvedBanner}>
                      <Text style={{fontSize:13,fontWeight:"800",color:"#14532d"}}>🗓️ Session Confirmed!</Text>
                      <Text style={{fontSize:12,color:"#166534",marginTop:3}}>
                        {fmtDate(r.session_date||r.date)} · {fmtTime(r.session_time||r.time)} · {r.mode}
                      </Text>
                    </View>
                  )}
                  {r.approval_note && (
                    <View style={S.noteBanner}>
                      <Text style={{fontSize:11,fontWeight:"700",color:"#78350f"}}>💬 Counselor's Note</Text>
                      <Text style={{fontSize:12,color:"#78350f",marginTop:2}}>{r.approval_note}</Text>
                    </View>
                  )}
                  {r.rejection_note && (
                    <View style={S.rejectBanner}>
                      <Text style={{fontSize:11,fontWeight:"700",color:"#7f1d1d"}}>❌ Reason for Rejection</Text>
                      <Text style={{fontSize:12,color:"#7f1d1d",marginTop:2}}>{r.rejection_note}</Text>
                    </View>
                  )}
                  {r.status==="Pending" && (
                    <TouchableOpacity style={S.cancelBtn} onPress={()=>cancelRequest(r.id)}>
                      <Text style={S.cancelBtnText}>Cancel Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={{height:40}}/>
        </ScrollView>

        <CalendarPicker visible={showCal} selectedDate={form.date} onSelect={d=>setForm(p=>({...p,date:d}))} onClose={()=>setShowCal(false)}/>
        <TimePicker     visible={showTime} selectedTime={form.time} onSelect={t=>setForm(p=>({...p,time:t}))} onClose={()=>setShowTime(false)}/>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  tabs:               { flexDirection:"row", backgroundColor:"#1e3a5f", borderBottomWidth:1, borderBottomColor:"rgba(255,255,255,0.15)", paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24)+4:44 },
  tab:                { flex:1, paddingVertical:14, alignItems:"center" },
  tabActive:          { borderBottomWidth:3, borderBottomColor:"#fff" },
  tabText:            { fontSize:13, color:"rgba(255,255,255,0.6)", fontWeight:"600" },
  tabTextActive:      { color:"#fff" },
  card:               { backgroundColor:"#fff", borderRadius:14, padding:18, marginBottom:16, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:8, elevation:2 },
  cardTitle:          { fontSize:16, fontWeight:"700", color:"#1e3a5f" },
  counselorBanner:    { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:14, flexDirection:"row", alignItems:"center", gap:14, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:2 },
  counselorAvatar:    { width:46, height:46, borderRadius:23, backgroundColor:"#1e3a5f", alignItems:"center", justifyContent:"center" },
  counselorName:      { fontWeight:"700", fontSize:14, color:"#1e3a5f" },
  counselorRole:      { fontSize:11, color:"#64748b" },
  label:              { fontSize:11, fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8, marginTop:4 },
  pickerWrap:         { borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, marginBottom:16, backgroundColor:"#f8fafc", overflow:"hidden" },
  pickerBtn:          { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:12, padding:14, backgroundColor:"#f8fafc", marginBottom:16 },
  pickerBtnIcon:      { fontSize:20, marginRight:12 },
  pickerBtnValue:     { fontSize:15, color:"#1e293b", fontWeight:"600" },
  pickerBtnPlaceholder:{ fontSize:14, color:"#94a3b8" },
  pickerBtnSub:       { fontSize:11, color:"#94a3b8", marginTop:2 },
  pickerBtnArrow:     { fontSize:20, color:"#94a3b8", marginLeft:8 },
  modeRow:            { flexDirection:"row", gap:10, marginBottom:16 },
  modeBtn:            { flex:1, borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, paddingVertical:12, alignItems:"center", backgroundColor:"#f8fafc" },
  modeBtnActive:      { backgroundColor:"#1e3a5f", borderColor:"#1e3a5f" },
  modeBtnText:        { fontSize:13, fontWeight:"600", color:"#64748b" },
  modeBtnTextActive:  { color:"#fff" },
  textAreaWrap:       { borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, marginBottom:16, backgroundColor:"#f8fafc" },
  textArea:           { padding:12, fontSize:14, color:"#1e293b", minHeight:100 },
  summaryBox:         { backgroundColor:"#eff6ff", borderRadius:10, padding:14, marginBottom:16, borderWidth:1, borderColor:"#bfdbfe" },
  summaryTitle:       { fontSize:12, fontWeight:"700", color:"#1d4ed8", marginBottom:8 },
  summaryRow:         { fontSize:13, color:"#475569", marginBottom:3 },
  summaryVal:         { fontWeight:"700", color:"#1e3a5f" },
  btn:                { backgroundColor:"#1e3a5f", borderRadius:12, paddingVertical:15, alignItems:"center", marginTop:4, elevation:3 },
  btnText:            { color:"#fff", fontWeight:"700", fontSize:15 },
  reqCard:            { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:12, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:2 },
  reqHeader:          { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
  reqType:            { fontWeight:"700", fontSize:14, color:"#1e293b", flex:1, marginRight:8 },
  reqMeta:            { fontSize:12, color:"#64748b", marginTop:3 },
  pill:               { borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  pillText:           { fontSize:11, fontWeight:"700" },
  approvedBanner:     { marginTop:10, backgroundColor:"#f0fdf4", borderRadius:10, padding:12, borderLeftWidth:3, borderLeftColor:"#16a34a" },
  noteBanner:         { marginTop:8, backgroundColor:"#fffbeb", borderRadius:10, padding:12, borderLeftWidth:3, borderLeftColor:"#f59e0b" },
  rejectBanner:       { marginTop:8, backgroundColor:"#fef2f2", borderRadius:10, padding:12, borderLeftWidth:3, borderLeftColor:"#ef4444" },
  cancelBtn:          { marginTop:10, backgroundColor:"#fef2f2", borderRadius:8, padding:10, alignItems:"center", borderWidth:1, borderColor:"#fecaca" },
  cancelBtnText:      { color:"#dc2626", fontWeight:"700", fontSize:12 },
  empty:              { alignItems:"center", padding:30 },
  emptyIcon:          { fontSize:32, marginBottom:8 },
  emptyText:          { fontSize:13, color:"#94a3b8" },
});

const CAL = StyleSheet.create({
  overlay:         { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  sheet:           { backgroundColor:"#fff", borderTopLeftRadius:28, borderTopRightRadius:28, padding:20, paddingBottom:34, maxHeight:"85%" },
  handle:          { width:40, height:4, borderRadius:2, backgroundColor:"#e2e8f0", alignSelf:"center", marginBottom:12 },
  header:          { marginBottom:16 },
  headerSub:       { fontSize:12, color:"#94a3b8", fontWeight:"600", textAlign:"center", marginBottom:12 },
  nav:             { flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#f8fafc", borderRadius:14, padding:10 },
  navBtn:          { width:40, height:40, borderRadius:20, backgroundColor:"#fff", alignItems:"center", justifyContent:"center", elevation:2, shadowColor:"#000", shadowOpacity:0.06, shadowRadius:4 },
  navBtnDisabled:  { backgroundColor:"#f8fafc", elevation:0 },
  navArrow:        { fontSize:24, color:"#1e3a5f", fontWeight:"700" },
  navMonth:        { fontSize:18, fontWeight:"800", color:"#1e3a5f" },
  navYear:         { fontSize:12, color:"#94a3b8", fontWeight:"600" },
  navTitle:        { fontSize:16, fontWeight:"700", color:"#1e3a5f", textAlign:"center" },
  legendRow:       { flexDirection:"row", justifyContent:"center", gap:16, marginBottom:12 },
  legendItem:      { flexDirection:"row", alignItems:"center", gap:4 },
  legendDot:       { width:10, height:10, borderRadius:5 },
  legendText:      { fontSize:11, color:"#64748b" },
  dayRow:          { flexDirection:"row", marginBottom:6 },
  dayHeader:       { flex:1, textAlign:"center", fontSize:11, fontWeight:"700", color:"#94a3b8", paddingVertical:4 },
  grid:            { flexDirection:"row", flexWrap:"wrap" },
  cell:            { width:"14.28%", aspectRatio:1, alignItems:"center", justifyContent:"center", borderRadius:100 },
  cellSelected:    { backgroundColor:"#1e3a5f" },
  cellToday:       { backgroundColor:"#eff6ff", borderWidth:1.5, borderColor:"#2563eb" },
  cellText:        { fontSize:15, color:"#1e293b", fontWeight:"500" },
  cellTextSelected:{ color:"#fff", fontWeight:"800" },
  cellTextToday:   { color:"#2563eb", fontWeight:"700" },
  cellTextDisabled:{ color:"#e2e8f0" },
  cellTextWeekend: { color:"#fca5a5" },
  todayDot:        { width:4, height:4, borderRadius:2, backgroundColor:"#2563eb", position:"absolute", bottom:4 },
  hint:            { textAlign:"center", fontSize:11, color:"#94a3b8", marginTop:10, marginBottom:10 },
  closeBtn:        { backgroundColor:"#f1f5f9", borderRadius:14, paddingVertical:14, alignItems:"center", marginTop:4 },
  closeBtnText:    { fontSize:14, fontWeight:"700", color:"#64748b" },
});

const TM = StyleSheet.create({
  slot:            { flexDirection:"row", alignItems:"center", paddingVertical:14, paddingHorizontal:20, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  slotActive:      { backgroundColor:"#eff6ff" },
  slotIcon:        { fontSize:18, marginRight:14 },
  slotText:        { fontSize:15, color:"#1e293b", flex:1 },
  slotTextActive:  { color:"#1e3a5f", fontWeight:"700" },
  check:           { fontSize:16, color:"#1e3a5f", fontWeight:"900" },
});