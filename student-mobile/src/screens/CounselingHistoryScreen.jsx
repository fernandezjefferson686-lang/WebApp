import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
  Platform, StatusBar,
} from "react-native";
import api from "../services/api";

const POLL_MS = 5000;

const fmtDate = raw => { if(!raw) return "—"; const d=new Date(raw); return isNaN(d)?raw:d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}); };
const fmtTime = raw => { if(!raw) return "—"; if(/AM|PM/i.test(raw)) return raw; const [h,m]=raw.split(":"); return `${+h%12||12}:${m} ${+h>=12?"PM":"AM"}`; };

const STATUS = {
  approved:  { bg:"#dcfce7", text:"#16a34a", icon:"✅" },
  pending:   { bg:"#fef9c3", text:"#ca8a04", icon:"⏳" },
  completed: { bg:"#dbeafe", text:"#1d4ed8", icon:"🎓" },
  cancelled: { bg:"#fee2e2", text:"#dc2626", icon:"🚫" },
  rejected:  { bg:"#fee2e2", text:"#dc2626", icon:"❌" },
};

function Badge({ status }) {
  const s = status?.toLowerCase();
  const c = STATUS[s] || { bg:"#f1f5f9", text:"#64748b", icon:"•" };
  return (
    <View style={[B.wrap, { backgroundColor:c.bg }]}>
      <Text style={[B.text, { color:c.text }]}>{c.icon} {status}</Text>
    </View>
  );
}
const B = StyleSheet.create({
  wrap: { paddingHorizontal:10, paddingVertical:5, borderRadius:20 },
  text: { fontSize:11, fontWeight:"700" },
});

function HistoryCard({ item, onPress }) {
  const date    = item.session_date || item.preferred_date || item.date;
  const time    = item.session_time || item.preferred_time || item.time;
  const type    = item.session_type || item.type || "General";
  const concern = item.reason || item.concern || "Counseling Session";
  const status  = item.status?.toLowerCase();

  return (
    <TouchableOpacity
      style={[S.card, status === "approved" && S.cardApproved]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      {status === "approved" && (
        <View style={S.approvedBanner}>
          <Text style={S.approvedBannerText}>🗓️ Session Confirmed</Text>
        </View>
      )}

      <View style={S.cardRow}>
        <View style={[S.dateBlock, { backgroundColor: STATUS[status]?.bg || "#f1f5f9" }]}>
          {date ? (
            <>
              <Text style={[S.dateBlockMonth, { color: STATUS[status]?.text || "#64748b" }]}>
                {new Date(date).toLocaleDateString("en-US", { month:"short" }).toUpperCase()}
              </Text>
              <Text style={[S.dateBlockDay, { color: STATUS[status]?.text || "#64748b" }]}>
                {new Date(date).getDate()}
              </Text>
              <Text style={[S.dateBlockYear, { color: STATUS[status]?.text || "#64748b" }]}>
                {new Date(date).getFullYear()}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize:24 }}>📋</Text>
          )}
        </View>

        <View style={{ flex:1, marginLeft:12 }}>
          <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
            <Text style={S.cardType} numberOfLines={2}>{type}</Text>
            <Badge status={item.status}/>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoIcon}>🕐</Text>
            <Text style={S.infoText}>{fmtTime(time)}</Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoIcon}>📍</Text>
            <Text style={S.infoText}>{item.mode || "Face-to-Face"}</Text>
          </View>
          {concern && concern !== "Counseling Session" && (
            <View style={S.concernRow}>
              <Text style={S.concernText} numberOfLines={2}>{concern}</Text>
            </View>
          )}
        </View>
      </View>

      {item.approval_note && (
        <View style={S.noteSnippet}>
          <Text style={S.noteLabel}>💬 COUNSELOR</Text>
          <Text style={S.noteSnippetText} numberOfLines={2}>{item.approval_note}</Text>
        </View>
      )}
      {item.rejection_note && (
        <View style={[S.noteSnippet, { borderLeftColor:"#ef4444", backgroundColor:"#fef2f2" }]}>
          <Text style={[S.noteLabel, { color:"#dc2626" }]}>💬 REJECTION REASON</Text>
          <Text style={[S.noteSnippetText, { color:"#7f1d1d" }]} numberOfLines={2}>{item.rejection_note}</Text>
        </View>
      )}

      <Text style={S.tapHint}>Tap to see details →</Text>
    </TouchableOpacity>
  );
}

const FILTERS = ["All", "Pending", "Approved", "Cancelled", "Rejected"];

export default function CounselingHistoryScreen() {
  const [sessions,   setSessions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [filter,     setFilter]     = useState("All");
  const pollRef = useRef(null);

  const loadSessions = async (silent = true) => {
    try {
      const res = await api.get("/user/counseling-requests");
      setSessions(res.data?.requests || res.data || []);
    } catch {}
    finally { if (!silent) { setLoading(false); setRefreshing(false); } }
  };

  useEffect(() => {
    loadSessions(false);
    pollRef.current = setInterval(() => loadSessions(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  const filtered = filter === "All"
    ? sessions
    : sessions.filter(s => s.status?.toLowerCase() === filter.toLowerCase());

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "All"
      ? sessions.length
      : sessions.filter(s => s.status?.toLowerCase() === f.toLowerCase()).length;
    return acc;
  }, {});

  if (loading) return (
    <View style={{ flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#f8fafc" }}>
      <ActivityIndicator size="large" color="#1e3a5f"/>
      <Text style={{ marginTop:12, color:"#64748b" }}>Loading history…</Text>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:"#f8fafc" }}>

      {/* ── Header ── */}
      <View style={S.header}>
        <Text style={S.headerTitle}>📋 Counseling History</Text>
        <Text style={S.headerSub}>{sessions.length} total session{sessions.length !== 1 ? "s" : ""}</Text>
        <View style={S.statsRow}>
          {[
            { label:"Pending",   count:counts["Pending"],   color:"#fbbf24" },
            { label:"Approved",  count:counts["Approved"],  color:"#4ade80" },
            { label:"Cancelled", count:counts["Cancelled"], color:"#f87171" },
          ].map(s => (
            <View key={s.label} style={S.statItem}>
              <Text style={[S.statCount, { color:s.color }]}>{s.count}</Text>
              <Text style={S.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Filter tabs — fixed row, always fully visible, never scrolls ── */}
      <View style={S.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[S.filterTab, filter === f && S.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
          >
            <Text
              style={[S.filterTabText, filter === f && S.filterTabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {f}
            </Text>
            {counts[f] > 0 && (
              <View style={[S.countBadge, filter === f && S.countBadgeActive]}>
                <Text style={[S.countBadgeText, filter === f && S.countBadgeTextActive]}>
                  {counts[f]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Session list ── */}
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding:16, paddingBottom:40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadSessions(false); }}
          />
        }
        renderItem={({ item }) => <HistoryCard item={item} onPress={setSelected}/>}
        ListEmptyComponent={
          <View style={S.empty}>
            <Text style={{ fontSize:48, marginBottom:12 }}>
              {filter === "All" ? "📭" : STATUS[filter.toLowerCase()]?.icon || "🔍"}
            </Text>
            <Text style={S.emptyTitle}>No {filter === "All" ? "" : filter} sessions</Text>
            <Text style={S.emptySub}>
              {filter === "All"
                ? "You have no counseling sessions yet."
                : `No ${filter.toLowerCase()} sessions found.`}
            </Text>
          </View>
        }
      />

      {/* ── Detail Modal ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle}/>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <Text style={S.modalTitle}>Session Details</Text>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  style={{ width:32, height:32, borderRadius:16, backgroundColor:"#f1f5f9", alignItems:"center", justifyContent:"center" }}
                >
                  <Text style={{ fontSize:16, color:"#64748b", fontWeight:"700" }}>✕</Text>
                </TouchableOpacity>
              </View>

              {selected && (
                <>
                  <Badge status={selected.status}/>

                  <View style={S.modalDateBox}>
                    <View style={S.modalDateItem}>
                      <Text style={S.modalDateIcon}>📅</Text>
                      <Text style={S.modalDateLabel}>Date</Text>
                      <Text style={S.modalDateVal}>
                        {fmtDate(selected.session_date || selected.preferred_date || selected.date)}
                      </Text>
                    </View>
                    <View style={S.modalDateDivider}/>
                    <View style={S.modalDateItem}>
                      <Text style={S.modalDateIcon}>🕐</Text>
                      <Text style={S.modalDateLabel}>Time</Text>
                      <Text style={S.modalDateVal}>
                        {fmtTime(selected.session_time || selected.preferred_time || selected.time)}
                      </Text>
                    </View>
                  </View>

                  {[
                    ["Session Type", selected.session_type || selected.type || "—"],
                    ["Mode",         selected.mode || "Face-to-Face"],
                    ["Submitted",    fmtDate(selected.created_at)],
                  ].map(([l, v]) => (
                    <View key={l} style={S.detailRow}>
                      <Text style={S.detailLabel}>{l}</Text>
                      <Text style={S.detailVal}>{v}</Text>
                    </View>
                  ))}

                  {(selected.reason || selected.concern) && (
                    <View style={S.noteBox}>
                      <Text style={S.noteBoxLabel}>📝 YOUR REASON / CONCERN</Text>
                      <Text style={S.noteBoxText}>{selected.reason || selected.concern}</Text>
                    </View>
                  )}
                  {selected.approval_note && (
                    <View style={[S.noteBox, { backgroundColor:"#f0fdf4", borderColor:"#86efac", marginTop:10 }]}>
                      <Text style={[S.noteBoxLabel, { color:"#16a34a" }]}>✅ COUNSELOR'S NOTE</Text>
                      <Text style={[S.noteBoxText,  { color:"#14532d" }]}>{selected.approval_note}</Text>
                    </View>
                  )}
                  {selected.rejection_note && (
                    <View style={[S.noteBox, { backgroundColor:"#fef2f2", borderColor:"#fca5a5", marginTop:10 }]}>
                      <Text style={[S.noteBoxLabel, { color:"#dc2626" }]}>❌ REJECTION REASON</Text>
                      <Text style={[S.noteBoxText,  { color:"#7f1d1d" }]}>{selected.rejection_note}</Text>
                    </View>
                  )}
                  <View style={{ height:20 }}/>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  // Header
  header:             { backgroundColor:"#1e3a5f", paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24)+12:54, paddingBottom:16, paddingHorizontal:20 },
  headerTitle:        { fontSize:22, fontWeight:"800", color:"#fff" },
  headerSub:          { fontSize:13, color:"rgba(255,255,255,0.6)", marginTop:2, marginBottom:12 },
  statsRow:           { flexDirection:"row", gap:8 },
  statItem:           { flex:1, alignItems:"center", backgroundColor:"rgba(255,255,255,0.1)", borderRadius:10, paddingVertical:8 },
  statCount:          { fontSize:20, fontWeight:"800" },
  statLabel:          { fontSize:10, color:"rgba(255,255,255,0.7)", fontWeight:"600", marginTop:2 },

  // Filter row — fixed, never scrolls, all tabs always visible
  filterRow:          {
    flexDirection:"row",
    backgroundColor:"#fff",
    borderBottomWidth:1,
    borderBottomColor:"#e2e8f0",
    paddingHorizontal:6,
    paddingVertical:8,
  },
  filterTab:          {
    flex:1,
    alignItems:"center",
    justifyContent:"center",
    paddingVertical:8,
    paddingHorizontal:3,
    borderRadius:10,
    marginHorizontal:2,
    backgroundColor:"#f1f5f9",
    minHeight:44,
  },
  filterTabActive:    { backgroundColor:"#1e3a5f" },
  filterTabText:      { fontSize:11, fontWeight:"700", color:"#64748b", textAlign:"center" },
  filterTabTextActive:{ color:"#fff" },
  countBadge:         { marginTop:3, backgroundColor:"#e2e8f0", borderRadius:10, minWidth:18, paddingHorizontal:5, alignItems:"center" },
  countBadgeActive:   { backgroundColor:"rgba(255,255,255,0.25)" },
  countBadgeText:     { fontSize:10, fontWeight:"800", color:"#475569" },
  countBadgeTextActive:{ color:"#fff" },

  // Card
  card:               { backgroundColor:"#fff", borderRadius:16, marginBottom:12, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:8, elevation:2, overflow:"hidden" },
  cardApproved:       { borderWidth:1.5, borderColor:"#86efac" },
  approvedBanner:     { backgroundColor:"#f0fdf4", paddingHorizontal:14, paddingVertical:6, borderBottomWidth:1, borderBottomColor:"#bbf7d0" },
  approvedBannerText: { fontSize:11, fontWeight:"700", color:"#16a34a" },
  cardRow:            { flexDirection:"row", padding:14 },
  dateBlock:          { width:58, borderRadius:12, alignItems:"center", justifyContent:"center", paddingVertical:10 },
  dateBlockMonth:     { fontSize:10, fontWeight:"800", letterSpacing:1 },
  dateBlockDay:       { fontSize:24, fontWeight:"900", lineHeight:28 },
  dateBlockYear:      { fontSize:10, fontWeight:"600", opacity:0.7 },
  cardType:           { fontSize:13, fontWeight:"700", color:"#1e3a5f", flex:1, marginRight:8, lineHeight:18 },
  infoRow:            { flexDirection:"row", alignItems:"center", marginBottom:3 },
  infoIcon:           { fontSize:12, marginRight:5 },
  infoText:           { fontSize:12, color:"#64748b" },
  concernRow:         { marginTop:6, backgroundColor:"#f8fafc", borderRadius:8, padding:8 },
  concernText:        { fontSize:12, color:"#475569", lineHeight:16 },
  noteSnippet:        { marginHorizontal:14, marginBottom:10, backgroundColor:"#eff6ff", borderRadius:8, padding:10, borderLeftWidth:3, borderLeftColor:"#93c5fd" },
  noteLabel:          { fontSize:10, fontWeight:"700", color:"#64748b", marginBottom:3 },
  noteSnippetText:    { fontSize:12, color:"#475569" },
  tapHint:            { fontSize:11, color:"#94a3b8", textAlign:"right", paddingHorizontal:14, paddingBottom:10 },

  // Empty
  empty:              { alignItems:"center", paddingTop:60 },
  emptyTitle:         { fontSize:18, fontWeight:"700", color:"#1e3a5f", marginBottom:6 },
  emptySub:           { fontSize:13, color:"#64748b", textAlign:"center" },

  // Modal
  modalOverlay:       { flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" },
  modalSheet:         { backgroundColor:"#fff", borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, maxHeight:"88%" },
  modalHandle:        { width:40, height:4, borderRadius:2, backgroundColor:"#e2e8f0", alignSelf:"center", marginBottom:20 },
  modalTitle:         { fontSize:18, fontWeight:"800", color:"#1e3a5f" },
  modalDateBox:       { flexDirection:"row", backgroundColor:"#f8fafc", borderRadius:14, padding:16, marginVertical:16, borderWidth:1, borderColor:"#e2e8f0" },
  modalDateItem:      { flex:1, alignItems:"center" },
  modalDateDivider:   { width:1, backgroundColor:"#e2e8f0", marginHorizontal:12 },
  modalDateIcon:      { fontSize:22, marginBottom:4 },
  modalDateLabel:     { fontSize:10, fontWeight:"700", color:"#94a3b8", letterSpacing:0.5, marginBottom:4 },
  modalDateVal:       { fontSize:13, fontWeight:"700", color:"#1e3a5f", textAlign:"center" },
  detailRow:          { flexDirection:"row", justifyContent:"space-between", paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  detailLabel:        { fontSize:13, color:"#64748b", fontWeight:"600" },
  detailVal:          { fontSize:13, color:"#1e293b", fontWeight:"500", textAlign:"right", flex:1, marginLeft:16 },
  noteBox:            { backgroundColor:"#f8fafc", borderRadius:10, padding:14, marginTop:14, borderWidth:1, borderColor:"#e2e8f0" },
  noteBoxLabel:       { fontSize:10, fontWeight:"700", color:"#94a3b8", letterSpacing:0.5, marginBottom:6 },
  noteBoxText:        { fontSize:14, color:"#475569", lineHeight:22 },
});