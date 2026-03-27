import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, AppState,
} from "react-native";
import api from "../services/api";
// ✅ correct import matching your actual auth.js exports
import { getUser } from "../storage/auth";

const POLL_MS    = 3000;  // 3s foreground
const POLL_BG_MS = 30000; // 30s background

// ─── Helpers ──────────────────────────────────────────────────
const getInitials = n =>
  (n || "?").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

const fmtTime = iso => {
  if (!iso) return "";
  if (iso.includes("•")) return iso.split("•")[1]?.trim() || "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const fmtDay = iso => {
  if (!iso) return "";
  const d   = new Date(iso);
  const now = new Date();
  if (isNaN(d)) return "";
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ─── Build conversation threads ────────────────────────────────
const buildConversations = (msgs = []) => {
  const map = {};
  msgs.forEach(m => {
    const otherId   = m.sender_type === "user" ? m.receiver_id : m.sender_id;
    const otherName =
      m.sender_type !== "user" && m.from && m.from !== "You"
        ? m.from : "Counselor";
    if (!map[otherId]) {
      map[otherId] = {
        id: otherId, name: otherName,
        initials: getInitials(otherName),
        thread: [], unread: 0,
      };
    }
    if (m.sender_type !== "user" && m.from && m.from !== "You") {
      map[otherId].name     = m.from;
      map[otherId].initials = getInitials(m.from);
    }
    map[otherId].thread.push(m);
    if (!m.is_read && m.sender_type !== "user") map[otherId].unread++;
  });
  return Object.values(map)
    .map(c => ({
      ...c,
      thread: [...c.thread].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    }))
    .sort((a, b) => {
      const at = a.thread[a.thread.length - 1]?.created_at || 0;
      const bt = b.thread[b.thread.length - 1]?.created_at || 0;
      return new Date(bt) - new Date(at);
    });
};

// ─── Date separator ───────────────────────────────────────────
const DateSep = ({ label }) => (
  <View style={S.dateSep}>
    <View style={S.dateSepLine}/>
    <Text style={S.dateSepText}>{label}</Text>
    <View style={S.dateSepLine}/>
  </View>
);

// ─── Single bubble ────────────────────────────────────────────
const Bubble = ({ msg, prevMsg, initials }) => {
  const mine    = msg.sender_type === "user";
  const showDay = !prevMsg || fmtDay(msg.created_at) !== fmtDay(prevMsg?.created_at);
  return (
    <>
      {showDay && <DateSep label={fmtDay(msg.created_at || msg.time)}/>}
      <View style={[S.bubbleRow, mine && S.bubbleRowMine]}>
        {!mine && (
          <View style={S.miniAvatar}>
            <Text style={S.miniAvatarText}>{initials}</Text>
          </View>
        )}
        <View style={{ maxWidth: "72%" }}>
          <View style={[
            S.bubble,
            mine ? S.bubbleMine : S.bubbleOther,
            msg._pending && { opacity: 0.55 },
          ]}>
            <Text style={[S.bubbleText, mine && { color: "#fff" }]}>{msg.body}</Text>
          </View>
          <Text style={[S.msgTime, { textAlign: mine ? "right" : "left" }]}>
            {fmtTime(msg.created_at || msg.time)}
            {mine && (msg._pending ? "  ⏳" : "  ✓")}
          </Text>
        </View>
      </View>
    </>
  );
};

// ─── Main Screen ──────────────────────────────────────────────
export default function MessagesScreen() {
  const [conversations, setConversations] = useState([]);
  const [counselors,    setCounselors]    = useState([]);
  const [activeConvo,   setActiveConvo]   = useState(null);
  const [view,          setView]          = useState("list");
  const [text,          setText]          = useState("");
  const [sending,       setSending]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [newRecvId,     setNewRecvId]     = useState("");
  const [newBody,       setNewBody]       = useState("");

  const flatListRef    = useRef(null);
  const pollRef        = useRef(null);
  const activeConvoRef = useRef(null);
  const lastMsgIdRef   = useRef(null);
  const appStateRef    = useRef(AppState.currentState);

  // keep ref in sync with state
  useEffect(() => { activeConvoRef.current = activeConvo; }, [activeConvo]);

  // ── Fetch all messages ──────────────────────────────────────
  const fetchMessages = async (silent = true) => {
    try {
      const res  = await api.get("/user/messages");
      const msgs = res.data?.messages || res.data || [];
      const convos = buildConversations(msgs);
      setConversations(convos);

      // If a chat is open, silently refresh its thread
      const cur = activeConvoRef.current;
      if (cur) {
        const fresh = convos.find(c => c.id === cur.id);
        if (fresh) {
          const lastId = fresh.thread[fresh.thread.length - 1]?.id;
          if (lastId && lastId !== lastMsgIdRef.current) {
            lastMsgIdRef.current = lastId;
            setActiveConvo(fresh);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        }
      }
    } catch {
      // silent — don't show error on background poll
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ── Start polling ───────────────────────────────────────────
  const startPoll = (fast = true) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(
      () => fetchMessages(true),
      fast ? POLL_MS : POLL_BG_MS
    );
  };

  useEffect(() => {
    fetchMessages(false);
    startPoll(true);

    // fetch counselor list once
    api.get("/user/counselors")
      .then(r => setCounselors(r.data?.counselors || []))
      .catch(() => {});

    // slow poll when backgrounded
    const sub = AppState.addEventListener("change", next => {
      appStateRef.current = next;
      if (next === "active") { fetchMessages(true); startPoll(true); }
      else startPoll(false);
    });

    return () => { clearInterval(pollRef.current); sub.remove(); };
  }, []);

  // ── Open conversation ───────────────────────────────────────
  const openConvo = async convo => {
    setActiveConvo(convo);
    setView("chat");
    setText("");
    lastMsgIdRef.current = convo.thread[convo.thread.length - 1]?.id || null;

    // mark as read
    for (const m of convo.thread.filter(x => !x.is_read && x.sender_type !== "user")) {
      api.get(`/user/messages/${m.id}`).catch(() => {});
    }
    setConversations(prev =>
      prev.map(c => c.id === convo.id
        ? { ...c, unread: 0, thread: c.thread.map(m => ({ ...m, is_read: true })) }
        : c
      )
    );
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
  };

  // ── Send reply ──────────────────────────────────────────────
  const sendReply = async () => {
    if (!text.trim() || !activeConvo || sending) return;
    setSending(true);
    const body = text.trim();
    setText("");

    // optimistic bubble
    const tempId = `temp_${Date.now()}`;
    const temp   = {
      id: tempId, sender_type: "user", from: "You", body,
      is_read: true, created_at: new Date().toISOString(), _pending: true,
    };
    const addTemp = c => ({ ...c, thread: [...c.thread, temp] });
    setConversations(prev => prev.map(c => c.id === activeConvo.id ? addTemp(c) : c));
    setActiveConvo(prev => addTemp(prev));
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      await api.post("/user/messages", {
        receiver_id: activeConvo.id, subject: "Message", body,
      });
      await fetchMessages(true);
    } catch {
      setText(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  // ── Send new message ────────────────────────────────────────
  const sendNew = async () => {
    if (!newRecvId || !newBody.trim() || sending) return;
    setSending(true);
    try {
      await api.post("/user/messages", {
        receiver_id: newRecvId, subject: "Message", body: newBody,
      });
      setNewBody(""); setNewRecvId("");
      await fetchMessages(true);
      setView("list");
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // ────────────────────────────────────────────────────────────
  // VIEW: LIST
  // ────────────────────────────────────────────────────────────
  if (view === "list") return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={S.header}>
        <Text style={S.headerTitle}>
          💬 Messages{totalUnread > 0 ? `  (${totalUnread})` : ""}
        </Text>
        <TouchableOpacity style={S.composeBtn} onPress={() => setView("compose")}>
          <Text style={{ color: "#fff", fontSize: 20 }}>✏️</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#1e3a5f" size="large"/>
          <Text style={{ color: "#94a3b8", marginTop: 10 }}>Loading messages…</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={S.empty}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>💬</Text>
          <Text style={S.emptyTitle}>No conversations yet</Text>
          <Text style={S.emptySub}>Start a conversation with your counselor</Text>
          <TouchableOpacity style={S.emptyBtn} onPress={() => setView("compose")}>
            <Text style={S.emptyBtnText}>✏️ New Message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => String(c.id)}
          renderItem={({ item: c }) => {
            const last    = c.thread[c.thread.length - 1];
            const preview = last
              ? `${last.sender_type === "user" ? "You: " : ""}${last.body?.slice(0, 50) || ""}`
              : "";
            return (
              <TouchableOpacity
                style={[S.convoRow, c.unread > 0 && S.convoRowUnread]}
                onPress={() => openConvo(c)}
                activeOpacity={0.75}
              >
                <View style={S.convoAvatarWrap}>
                  <View style={S.convoAvatar}>
                    <Text style={S.convoAvatarText}>{c.initials}</Text>
                  </View>
                  {c.unread > 0 && (
                    <View style={S.unreadBadge}>
                      <Text style={S.unreadBadgeText}>{c.unread}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                    <Text style={[S.convoName, c.unread > 0 && { fontWeight: "800" }]}>{c.name}</Text>
                    <Text style={S.convoTime}>{fmtTime(last?.created_at || last?.time)}</Text>
                  </View>
                  <Text
                    style={[S.convoPreview, c.unread > 0 && S.convoPreviewUnread]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  // ────────────────────────────────────────────────────────────
  // VIEW: COMPOSE
  // ────────────────────────────────────────────────────────────
  if (view === "compose") return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={S.header}>
        <TouchableOpacity onPress={() => setView("list")} style={{ marginRight: 14 }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>New Message</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={S.label}>To (Counselor)</Text>
        <View style={{ gap: 8, marginBottom: 20 }}>
          {counselors.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[S.counselorOption, newRecvId === String(c.id) && S.counselorOptionActive]}
              onPress={() => setNewRecvId(String(c.id))}
            >
              <Text style={[S.counselorOptionText, newRecvId === String(c.id) && { color: "#fff" }]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
          {counselors.length === 0 && (
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>No counselors available.</Text>
          )}
        </View>

        <Text style={S.label}>Message</Text>
        <TextInput
          style={[S.input, { height: 140, textAlignVertical: "top" }]}
          placeholder="Write your message…"
          placeholderTextColor="#94a3b8"
          value={newBody}
          onChangeText={setNewBody}
          multiline
        />

        <TouchableOpacity
          style={[S.btn, (!newRecvId || !newBody.trim()) && { opacity: 0.5 }]}
          onPress={sendNew}
          disabled={sending || !newRecvId || !newBody.trim()}
        >
          {sending
            ? <ActivityIndicator color="#fff"/>
            : <Text style={S.btnText}>Send Message  →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ────────────────────────────────────────────────────────────
  // VIEW: CHAT
  // ────────────────────────────────────────────────────────────
  const thread = conversations.find(c => c.id === activeConvo?.id)?.thread
    || activeConvo?.thread
    || [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Chat header */}
      <View style={S.chatHeader}>
        <TouchableOpacity
          onPress={() => { setView("list"); setActiveConvo(null); }}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>←</Text>
        </TouchableOpacity>
        <View style={S.chatAvatar}>
          <Text style={S.chatAvatarText}>{activeConvo?.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.chatName}>{activeConvo?.name}</Text>
          <Text style={S.chatRole}>Counselor</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={thread}
        keyExtractor={m => String(m.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: msg, index }) => (
          <Bubble
            msg={msg}
            prevMsg={thread[index - 1] || null}
            initials={activeConvo?.initials}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>👋</Text>
            <Text style={{ color: "#94a3b8", fontSize: 14 }}>Say hello to your counselor!</Text>
          </View>
        }
      />

      {/* Input bar */}
      <View style={S.inputBar}>
        <TextInput
          style={S.chatInput}
          placeholder={`Message ${activeConvo?.name || ""}…`}
          placeholderTextColor="#94a3b8"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[S.sendBtn, (!text.trim() || sending) && S.sendBtnDisabled]}
          onPress={sendReply}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={{ color: "#fff", fontSize: 20 }}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const S = StyleSheet.create({
  header:             { backgroundColor:"#1e3a5f", flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingBottom:14, paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24)+12:54 },
  headerTitle:        { fontSize:18, fontWeight:"800", color:"#fff", flex:1 },
  composeBtn:         { width:38, height:38, borderRadius:19, backgroundColor:"#2563eb", alignItems:"center", justifyContent:"center" },

  // Conversation list
  convoRow:           { flexDirection:"row", alignItems:"center", padding:16, borderBottomWidth:1, borderBottomColor:"#f0f4f8", backgroundColor:"#fff", gap:12 },
  convoRowUnread:     { backgroundColor:"#eff6ff" },
  convoAvatarWrap:    { position:"relative" },
  convoAvatar:        { width:48, height:48, borderRadius:24, backgroundColor:"#1e3a5f", alignItems:"center", justifyContent:"center" },
  convoAvatarText:    { color:"#fff", fontWeight:"800", fontSize:15 },
  unreadBadge:        { position:"absolute", top:-2, right:-2, width:18, height:18, borderRadius:9, backgroundColor:"#2563eb", alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"#fff" },
  unreadBadgeText:    { color:"#fff", fontSize:9, fontWeight:"800" },
  convoName:          { fontSize:14, fontWeight:"600", color:"#1e293b" },
  convoTime:          { fontSize:11, color:"#94a3b8" },
  convoPreview:       { fontSize:13, color:"#94a3b8" },
  convoPreviewUnread: { color:"#1e3a5f", fontWeight:"600" },

  // Empty
  empty:              { flex:1, alignItems:"center", justifyContent:"center", padding:40 },
  emptyTitle:         { fontSize:18, fontWeight:"700", color:"#1e3a5f", marginBottom:6 },
  emptySub:           { fontSize:13, color:"#94a3b8", marginBottom:20, textAlign:"center" },
  emptyBtn:           { backgroundColor:"#1e3a5f", borderRadius:10, paddingHorizontal:24, paddingVertical:12 },
  emptyBtnText:       { color:"#fff", fontWeight:"700" },

  // Compose
  label:              { fontSize:11, fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 },
  input:              { borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, padding:12, fontSize:14, color:"#1e293b", backgroundColor:"#f8fafc", marginBottom:14 },
  counselorOption:    { borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:12, padding:14, backgroundColor:"#f8fafc" },
  counselorOptionActive:{ backgroundColor:"#1e3a5f", borderColor:"#1e3a5f" },
  counselorOptionText:{ fontSize:14, color:"#1e293b", fontWeight:"600" },
  btn:                { backgroundColor:"#1e3a5f", borderRadius:12, paddingVertical:14, alignItems:"center" },
  btnText:            { color:"#fff", fontWeight:"700", fontSize:15 },

  // Chat header
  chatHeader:         { backgroundColor:"#1e3a5f", flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingBottom:14, paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24)+12:54 },
  chatAvatar:         { width:38, height:38, borderRadius:19, backgroundColor:"#2563eb", alignItems:"center", justifyContent:"center", marginRight:10 },
  chatAvatarText:     { color:"#fff", fontWeight:"800", fontSize:13 },
  chatName:           { fontSize:15, fontWeight:"700", color:"#fff" },
  chatRole:           { fontSize:11, color:"rgba(255,255,255,0.6)" },

  // Bubbles
  bubbleRow:          { flexDirection:"row", alignItems:"flex-end", marginBottom:4, gap:8 },
  bubbleRowMine:      { flexDirection:"row-reverse" },
  miniAvatar:         { width:26, height:26, borderRadius:13, backgroundColor:"#1e3a5f", alignItems:"center", justifyContent:"center" },
  miniAvatarText:     { color:"#fff", fontSize:8, fontWeight:"800" },
  bubble:             { padding:12, borderRadius:18 },
  bubbleMine:         { backgroundColor:"#1e3a5f", borderBottomRightRadius:4 },
  bubbleOther:        { backgroundColor:"#f1f5f9", borderBottomLeftRadius:4 },
  bubbleText:         { fontSize:14, color:"#1e293b", lineHeight:20 },
  msgTime:            { fontSize:10, color:"#94a3b8", marginTop:3 },

  // Date separator
  dateSep:            { flexDirection:"row", alignItems:"center", marginVertical:12, gap:8 },
  dateSepLine:        { flex:1, height:1, backgroundColor:"#e2e8f0" },
  dateSepText:        { fontSize:11, color:"#94a3b8", fontWeight:"600" },

  // Input bar
  inputBar:           { flexDirection:"row", alignItems:"flex-end", padding:12, borderTopWidth:1, borderTopColor:"#e2e8f0", backgroundColor:"#fff", gap:8 },
  chatInput:          { flex:1, borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:20, paddingHorizontal:14, paddingVertical:10, fontSize:14, color:"#1e293b", maxHeight:100 },
  sendBtn:            { width:44, height:44, borderRadius:22, backgroundColor:"#1e3a5f", alignItems:"center", justifyContent:"center" },
  sendBtnDisabled:    { backgroundColor:"#e2e8f0" },
});