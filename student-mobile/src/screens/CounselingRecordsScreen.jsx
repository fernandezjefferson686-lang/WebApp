import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
  Platform, StatusBar,
} from "react-native";
import api from "../services/api";

const POLL_MS = 5000;

const fmtDate = raw => { if(!raw) return "—"; const d=new Date(raw); return isNaN(d)?raw:d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}); };
const fmtTime = raw => { if(!raw) return ""; if(/AM|PM/i.test(raw)) return raw; const [h,m]=raw.split(":"); return `${+h%12||12}:${m} ${+h>=12?"PM":"AM"}`; };

function RecordCard({ item, onPress }) {
  const req       = item.counseling_request || {};
  const date      = req.session_date||item.session_date||req.preferred_date||item.preferred_date;
  const time      = req.session_time||item.session_time||req.preferred_time||item.preferred_time;
  const type      = req.session_type||item.session_type||"Counseling Session";
  const mode      = req.mode||item.mode||"Face-to-Face";
  const summary   = item.summary||item.notes||"";
  const recommend = item.recommendations||"";
  const hasFollowUp = item.follow_up_needed && item.fu_status !== "Completed";

  return (
    <TouchableOpacity style={S.card} onPress={()=>onPress(item)} activeOpacity={0.8}>
      <View style={S.cardHeader}>
        <View style={S.completedBadge}><Text style={S.completedText}>✅ Completed</Text></View>
        <Text style={S.cardId}>#{item.id}</Text>
      </View>

      <View style={S.infoGrid}>
        <View style={S.infoCell}>
          <Text style={S.infoCellIcon}>📅</Text>
          <Text style={S.infoCellLabel}>Date</Text>
          <Text style={S.infoCellVal}>{fmtDate(date)}</Text>
        </View>
        <View style={S.infoDivider}/>
        <View style={S.infoCell}>
          <Text style={S.infoCellIcon}>🕐</Text>
          <Text style={S.infoCellLabel}>Time</Text>
          <Text style={S.infoCellVal}>{fmtTime(time)||"—"}</Text>
        </View>
        <View style={S.infoDivider}/>
        <View style={S.infoCell}>
          <Text style={S.infoCellIcon}>{mode==="Online"?"💻":"🏫"}</Text>
          <Text style={S.infoCellLabel}>Mode</Text>
          <Text style={S.infoCellVal}>{mode}</Text>
        </View>
      </View>

      <View style={S.typeRow}><Text style={S.typeLabel}>📋 {type}</Text></View>

      {summary ? (
        <View style={S.noteSnippet}>
          <Text style={S.noteLabel}>📝 SUMMARY</Text>
          <Text style={S.noteText} numberOfLines={2}>{summary}</Text>
        </View>
      ) : null}

      {recommend ? (
        <View style={[S.noteSnippet,{borderLeftColor:"#2563eb",backgroundColor:"#eff6ff"}]}>
          <Text style={[S.noteLabel,{color:"#2563eb"}]}>💡 RECOMMENDATIONS</Text>
          <Text style={[S.noteText,{color:"#1e40af"}]} numberOfLines={2}>{recommend}</Text>
        </View>
      ) : null}

      {hasFollowUp && (
        <View style={[S.noteSnippet,{borderLeftColor:"#f59e0b",backgroundColor:"#fffbeb"}]}>
          <Text style={[S.noteLabel,{color:"#ca8a04"}]}>🔄 FOLLOW-UP NEEDED</Text>
          <Text style={[S.noteText,{color:"#92400e"}]}>Status: {item.fu_status||"Pending"}</Text>
        </View>
      )}

      {!summary && !recommend && !hasFollowUp && (
        <Text style={S.noNotes}>No notes recorded for this session.</Text>
      )}

      <Text style={S.tapHint}>Tap for full details →</Text>
    </TouchableOpacity>
  );
}

export default function CounselingRecordsScreen() {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const pollRef = useRef(null);

  const loadRecords = async (silent = true) => {
    try {
      const res = await api.get("/user/case-notes");
      setRecords(res.data?.notes||res.data?.records||res.data||[]);
    } catch {}
    finally { if (!silent) { setLoading(false); setRefreshing(false); } }
  };

  useEffect(() => {
    loadRecords(false);
    pollRef.current = setInterval(() => loadRecords(true), POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  if (loading) return (
    <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#f8fafc"}}>
      <ActivityIndicator size="large" color="#1e3a5f"/>
      <Text style={{marginTop:12,color:"#64748b"}}>Loading records…</Text>
    </View>
  );

  const sel     = selected;
  const selReq  = sel?.counseling_request || {};
  const selDate = selReq.session_date||sel?.session_date||selReq.preferred_date;
  const selTime = selReq.session_time||sel?.session_time||selReq.preferred_time;
  const selMode = selReq.mode||sel?.mode||"Face-to-Face";
  const selType = selReq.session_type||sel?.session_type||"Counseling Session";

  return (
    <View style={{flex:1,backgroundColor:"#f8fafc"}}>

      {/* Header — plain, no live badge */}
      <View style={S.header}>
        <Text style={S.headerTitle}>📁 Counseling Records</Text>
        <Text style={S.headerSub}>
          Completed sessions · {records.length} record{records.length!==1?"s":""}
        </Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={i=>String(i.id)}
        contentContainerStyle={{padding:16,paddingBottom:40}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={()=>{setRefreshing(true);loadRecords(false);}}
          />
        }
        renderItem={({item})=><RecordCard item={item} onPress={setSelected}/>}
        ListEmptyComponent={
          <View style={S.empty}>
            <Text style={{fontSize:48,marginBottom:12}}>📁</Text>
            <Text style={S.emptyTitle}>No records yet</Text>
            <Text style={S.emptySub}>
              Your counseling records will appear here after sessions are completed and notes are added by your counselor.
            </Text>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={()=>setSelected(null)}>
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle}/>
            <ScrollView showsVerticalScrollIndicator={false}>

              <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <Text style={S.modalTitle}>Session Record</Text>
                <TouchableOpacity
                  style={{width:32,height:32,borderRadius:16,backgroundColor:"#f1f5f9",alignItems:"center",justifyContent:"center"}}
                  onPress={()=>setSelected(null)}>
                  <Text style={{fontSize:16,color:"#64748b",fontWeight:"700"}}>✕</Text>
                </TouchableOpacity>
              </View>

              {selected && (
                <>
                  <View style={[S.completedBadge,{alignSelf:"flex-start",marginBottom:16}]}>
                    <Text style={S.completedText}>✅ Completed</Text>
                  </View>

                  <View style={S.modalInfoGrid}>
                    <View style={S.modalInfoCell}>
                      <Text style={S.modalInfoIcon}>📅</Text>
                      <Text style={S.modalInfoLabel}>Date</Text>
                      <Text style={S.modalInfoVal}>{fmtDate(selDate)}</Text>
                    </View>
                    <View style={S.infoDivider}/>
                    <View style={S.modalInfoCell}>
                      <Text style={S.modalInfoIcon}>🕐</Text>
                      <Text style={S.modalInfoLabel}>Time</Text>
                      <Text style={S.modalInfoVal}>{fmtTime(selTime)||"—"}</Text>
                    </View>
                    <View style={S.infoDivider}/>
                    <View style={S.modalInfoCell}>
                      <Text style={S.modalInfoIcon}>{selMode==="Online"?"💻":"🏫"}</Text>
                      <Text style={S.modalInfoLabel}>Mode</Text>
                      <Text style={S.modalInfoVal}>{selMode}</Text>
                    </View>
                  </View>

                  {[
                    ["Session Type", selType],
                    ["Counselor",    selected.counselor_name||"Julie Maestrada"],
                  ].map(([l,v])=>(
                    <View key={l} style={S.detailRow}>
                      <Text style={S.detailLabel}>{l}</Text>
                      <Text style={S.detailVal}>{v}</Text>
                    </View>
                  ))}

                  {selected.follow_up_needed && (
                    <View style={S.detailRow}>
                      <Text style={S.detailLabel}>Follow-up</Text>
                      <Text style={[S.detailVal,{color:selected.fu_status==="Completed"?"#16a34a":"#d97706",fontWeight:"700"}]}>
                        {selected.fu_status||"Pending"}
                      </Text>
                    </View>
                  )}

                  <View style={[S.noteBox,{marginTop:16}]}>
                    <Text style={S.noteBoxLabel}>📝 SUMMARY</Text>
                    <Text style={[S.noteBoxText,!(selected.summary||selected.notes)&&{color:"#94a3b8"}]}>
                      {selected.summary||selected.notes||"No summary recorded."}
                    </Text>
                  </View>

                  {selected.recommendations && (
                    <View style={[S.noteBox,{backgroundColor:"#eff6ff",borderColor:"#bfdbfe",marginTop:10}]}>
                      <Text style={[S.noteBoxLabel,{color:"#2563eb"}]}>💡 RECOMMENDATIONS</Text>
                      <Text style={[S.noteBoxText,{color:"#1e40af"}]}>{selected.recommendations}</Text>
                    </View>
                  )}

                  {selected.next_session_date && (
                    <View style={[S.noteBox,{backgroundColor:"#f0fdf4",borderColor:"#86efac",marginTop:10}]}>
                      <Text style={[S.noteBoxLabel,{color:"#16a34a"}]}>📅 NEXT SESSION SCHEDULED</Text>
                      <Text style={[S.noteBoxText,{color:"#15803d",fontWeight:"700"}]}>
                        {fmtDate(selected.next_session_date)}
                        {selected.next_session_time?`  🕐 ${fmtTime(selected.next_session_time)}`:""}
                      </Text>
                    </View>
                  )}

                  {selected.follow_up_needed && selected.fu_status !== "Completed" && (
                    <View style={[S.noteBox,{backgroundColor:"#fffbeb",borderColor:"#fde68a",marginTop:10}]}>
                      <Text style={[S.noteBoxLabel,{color:"#ca8a04"}]}>🔄 FOLLOW-UP REQUIRED</Text>
                      <Text style={[S.noteBoxText,{color:"#92400e"}]}>
                        A follow-up session has been scheduled. Please check with your counselor for details.
                      </Text>
                    </View>
                  )}

                  <View style={{height:20}}/>
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
  header:          { backgroundColor:"#1e3a5f", paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24)+12:54, paddingBottom:20, paddingHorizontal:20 },
  headerTitle:     { fontSize:22, fontWeight:"800", color:"#fff" },
  headerSub:       { fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:4 },
  card:            { backgroundColor:"#fff", borderRadius:16, marginBottom:12, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:8, elevation:2, overflow:"hidden" },
  cardHeader:      { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, paddingTop:12, paddingBottom:8, borderBottomWidth:1, borderBottomColor:"#f0f4f8" },
  completedBadge:  { backgroundColor:"#dcfce7", paddingHorizontal:10, paddingVertical:5, borderRadius:20 },
  completedText:   { fontSize:11, fontWeight:"700", color:"#16a34a" },
  cardId:          { fontSize:11, color:"#94a3b8", fontWeight:"600" },
  infoGrid:        { flexDirection:"row", backgroundColor:"#f8fafc", paddingVertical:12, paddingHorizontal:8, borderBottomWidth:1, borderBottomColor:"#f0f4f8" },
  infoCell:        { flex:1, alignItems:"center", paddingHorizontal:4 },
  infoDivider:     { width:1, backgroundColor:"#e2e8f0", marginVertical:4 },
  infoCellIcon:    { fontSize:16, marginBottom:2 },
  infoCellLabel:   { fontSize:9, fontWeight:"700", color:"#94a3b8", letterSpacing:0.5, marginBottom:3 },
  infoCellVal:     { fontSize:11, fontWeight:"700", color:"#1e3a5f", textAlign:"center" },
  typeRow:         { paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#f0f4f8" },
  typeLabel:       { fontSize:13, fontWeight:"600", color:"#475569" },
  noteSnippet:     { marginHorizontal:16, marginTop:10, backgroundColor:"#f8fafc", borderRadius:8, padding:10, borderLeftWidth:3, borderLeftColor:"#1e3a5f" },
  noteLabel:       { fontSize:10, fontWeight:"700", color:"#94a3b8", letterSpacing:0.5, marginBottom:4 },
  noteText:        { fontSize:13, color:"#475569", lineHeight:18 },
  noNotes:         { fontSize:12, color:"#94a3b8", marginHorizontal:16, marginTop:10 },
  tapHint:         { fontSize:11, color:"#94a3b8", textAlign:"right", paddingHorizontal:16, paddingBottom:12, paddingTop:8 },
  empty:           { alignItems:"center", paddingTop:60, paddingHorizontal:32 },
  emptyTitle:      { fontSize:18, fontWeight:"700", color:"#1e3a5f", marginBottom:6 },
  emptySub:        { fontSize:13, color:"#64748b", textAlign:"center", lineHeight:20 },
  modalOverlay:    { flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" },
  modalSheet:      { backgroundColor:"#fff", borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, maxHeight:"90%" },
  modalHandle:     { width:40, height:4, borderRadius:2, backgroundColor:"#e2e8f0", alignSelf:"center", marginBottom:20 },
  modalTitle:      { fontSize:18, fontWeight:"800", color:"#1e3a5f" },
  modalInfoGrid:   { flexDirection:"row", backgroundColor:"#f8fafc", borderRadius:14, padding:16, marginBottom:16, borderWidth:1, borderColor:"#e2e8f0" },
  modalInfoCell:   { flex:1, alignItems:"center" },
  modalInfoIcon:   { fontSize:22, marginBottom:4 },
  modalInfoLabel:  { fontSize:10, fontWeight:"700", color:"#94a3b8", letterSpacing:0.5, marginBottom:4 },
  modalInfoVal:    { fontSize:12, fontWeight:"700", color:"#1e3a5f", textAlign:"center" },
  detailRow:       { flexDirection:"row", justifyContent:"space-between", paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  detailLabel:     { fontSize:13, color:"#64748b", fontWeight:"600" },
  detailVal:       { fontSize:13, color:"#1e293b", fontWeight:"500", textAlign:"right", flex:1, marginLeft:16 },
  noteBox:         { backgroundColor:"#f8fafc", borderRadius:10, padding:14, borderWidth:1, borderColor:"#e2e8f0" },
  noteBoxLabel:    { fontSize:10, fontWeight:"700", color:"#94a3b8", letterSpacing:0.5, marginBottom:6 },
  noteBoxText:     { fontSize:14, color:"#475569", lineHeight:22 },
});