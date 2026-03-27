import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Image, Platform,
} from "react-native";
import api from "../services/api";
import { getUser, clearAll } from "../storage/auth";
import { COUNSELOR } from "../config";

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

const buildPicUrl = picPath => {
  if (!picPath) return null;
  if (picPath.startsWith("http")) return picPath;
  const cleanPath = picPath.replace(/^\/+/, "").replace(/^storage\//, "");
  const base = Platform.OS === "web"
    ? "http://localhost:8000/storage"
    : "http://10.44.227.240:8000/storage";
  return `${base}/${cleanPath}?t=${Date.now()}`;
};

// ── Days until a date ─────────────────────────────────────────
const daysUntil = raw => {
  if (!raw) return null;
  const d    = new Date(raw);
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
};

export default function DashboardScreen({ navigation }) {
  const [user,       setUser]       = useState(null);
  const [requests,   setRequests]   = useState([]);
  const [caseNotes,  setCaseNotes]  = useState([]);
  const [profile,    setProfile]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const loadData = async () => {
    try {
      const u = await getUser();
      setUser(u);
      const [reqRes, noteRes, profRes] = await Promise.all([
        api.get("/user/counseling-requests"),
        api.get("/user/case-notes"),
        api.get("/user/profile"),
      ]);
      setRequests(reqRes.data?.requests || reqRes.data || []);
      setCaseNotes(noteRes.data?.notes  || []);
      setProfile(profRes.data?.profile  || null);
    } catch (e) { console.log("Dashboard load error:", e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  const firstName  = profile?.full_name?.split(" ")[0] || user?.name?.split(" ")[0] || "Student";
  const profilePic = buildPicUrl(profile?.profile_pic);
  const initials   = (profile?.full_name || user?.name || "S").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

  const pending   = requests.filter(r => r.status === "Pending").length;
  const completed = requests.filter(r => {
    if (r.status !== "Approved") return false;
    const d  = new Date(r.session_date || r.date);
    const te = new Date(); te.setHours(23, 59, 59, 999);
    return !isNaN(d) && d <= te;
  }).length;

  // ── All upcoming approved sessions sorted soonest first ──────
  const upcomingSessions = requests
    .filter(r => {
      if (r.status !== "Approved") return false;
      const d = new Date(r.session_date || r.date);
      return !isNaN(d) && d >= new Date(new Date().setHours(0, 0, 0, 0));
    })
    .sort((a, b) => new Date(a.session_date || a.date) - new Date(b.session_date || b.date));

  const nextSession = upcomingSessions[0] || null;

  const followUp   = caseNotes.find(n => n.follow_up_needed && n.fu_status !== "Completed");
  const recentReqs = [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);

  const statusStyle = s => {
    if (s === "Approved") return { bg: "#f0fdf4", color: "#16a34a" };
    if (s === "Pending")  return { bg: "#fff7ed", color: "#d97706" };
    if (s === "Rejected") return { bg: "#fef2f2", color: "#dc2626" };
    return { bg: "#f8fafc", color: "#64748b" };
  };

  const quickActions = [
    { label: "Book Session", icon: "📋", screen: "CounselingRequest", bg: "#eff6ff", color: "#1d4ed8" },
    { label: "My Records",   icon: "📁", screen: "Records",           bg: "#f0fdf4", color: "#15803d" },
    { label: "History",      icon: "🕐", screen: "History",           bg: "#fdf4ff", color: "#7e22ce" },
    { label: "Messages",     icon: "💬", screen: "Messages",          bg: "#ecfdf5", color: "#065f46" },
  ];

  const handleLogout = async () => { await clearAll(); navigation.replace("Login"); };

  return (
    <ScrollView
      style={S.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <View style={S.hero}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          {profilePic
            ? <Image source={{ uri: profilePic }} style={S.avatar} />
            : <View style={[S.avatar, S.avatarPlaceholder]}>
                <Text style={S.avatarText}>{initials}</Text>
              </View>}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={S.heroTag}>Student Portal</Text>
            <Text style={S.heroTitle}>{greeting()}, {firstName} 👋</Text>
            <Text style={S.heroSub}>
              {profile?.department
                ? `${profile.department}${profile.year_level ? ` · Year ${profile.year_level}` : ""}`
                : "Welcome!"}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={S.logoutIcon}>🚪</Text>
          <Text style={S.logoutLabel}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════
          ★ UPCOMING SESSIONS — always visible section
          Shows a card for each approved future session,
          or an empty state prompting to book one.
      ══════════════════════════════════════════════════════ */}
      <View style={S.upcomingSection}>
        {/* Section header */}
        <View style={S.upcomingHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={S.upcomingHeading}>📅 Upcoming Sessions</Text>
            {upcomingSessions.length > 0 && (
              <View style={S.upcomingBadge}>
                <Text style={S.upcomingBadgeText}>{upcomingSessions.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("CounselingRequest")}>
            <Text style={S.seeAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={S.upcomingLoading}>
            <Text style={S.loadingText}>Loading sessions…</Text>
          </View>
        ) : upcomingSessions.length === 0 ? (
          /* ── Empty state ── */
          <View style={S.upcomingEmpty}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📆</Text>
            <Text style={S.upcomingEmptyTitle}>No Upcoming Sessions</Text>
            <Text style={S.upcomingEmptyDesc}>
              You have no approved sessions scheduled. Book one with your counselor.
            </Text>
            <TouchableOpacity
              style={S.bookBtn}
              onPress={() => navigation.navigate("CounselingRequest")}
              activeOpacity={0.85}
            >
              <Text style={S.bookBtnText}>📋 Book a Session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Session cards ── */
          upcomingSessions.map((r, idx) => {
            const days     = daysUntil(r.session_date || r.date);
            const isToday  = days === 0;
            const isTomorrow = days === 1;
            const dayLabel = isToday ? "TODAY" : isTomorrow ? "TOMORROW" : `IN ${days} DAY${days !== 1 ? "S" : ""}`;
            const cardBg   = isToday ? "#fff7ed" : idx === 0 ? "#eff6ff" : "#f8fafc";
            const accent   = isToday ? "#d97706" : "#2563eb";
            const border   = isToday ? "#fed7aa" : idx === 0 ? "#bfdbfe" : "#e2e8f0";

            return (
              <TouchableOpacity
                key={r.id}
                style={[S.sessionCard, { backgroundColor: cardBg, borderColor: border }]}
                onPress={() => navigation.navigate("CounselingRequest")}
                activeOpacity={0.85}
              >
                {/* Left accent bar */}
                <View style={[S.sessionAccentBar, { backgroundColor: accent }]} />

                <View style={{ flex: 1, paddingLeft: 14 }}>
                  {/* Top row: type + day pill */}
                  <View style={S.sessionTopRow}>
                    <Text style={S.sessionType}>
                      {r.session_type || r.type || "Counseling Session"}
                    </Text>
                    <View style={[S.dayPill, { backgroundColor: accent }]}>
                      <Text style={S.dayPillText}>{dayLabel}</Text>
                    </View>
                  </View>

                  {/* Date & time */}
                  <View style={S.sessionMetaRow}>
                    <View style={S.sessionMetaItem}>
                      <Text style={S.sessionMetaIcon}>📅</Text>
                      <Text style={[S.sessionMetaText, { color: accent, fontWeight: "700" }]}>
                        {fmtDate(r.session_date || r.date)}
                      </Text>
                    </View>
                    {(r.session_time || r.time) && (
                      <View style={S.sessionMetaItem}>
                        <Text style={S.sessionMetaIcon}>🕐</Text>
                        <Text style={S.sessionMetaText}>
                          {fmtTime(r.session_time || r.time)}
                        </Text>
                      </View>
                    )}
                    {r.mode && (
                      <View style={S.sessionMetaItem}>
                        <Text style={S.sessionMetaIcon}>
                          {r.mode === "Online" ? "💻" : "🏫"}
                        </Text>
                        <Text style={S.sessionMetaText}>{r.mode}</Text>
                      </View>
                    )}
                  </View>

                  {/* Counselor */}
                  <View style={S.sessionCounselorRow}>
                    <View style={S.sessionCounselorDot}>
                      <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800" }}>JM</Text>
                    </View>
                    <Text style={S.sessionCounselorText}>{COUNSELOR}</Text>
                  </View>
                </View>

                {/* Arrow */}
                <Text style={[S.sessionArrow, { color: accent }]}>›</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* ── Stats ── */}
      <View style={S.statsRow}>
        {[
          { label: "Total",     value: requests.length,         accent: "#2563eb" },
          { label: "Pending",   value: pending,                 accent: pending > 0            ? "#d97706" : "#94a3b8" },
          { label: "Upcoming",  value: upcomingSessions.length, accent: upcomingSessions.length > 0 ? "#059669" : "#94a3b8" },
          { label: "Completed", value: completed,               accent: "#16a34a" },
        ].map((s, i) => (
          <View key={i} style={[S.statCard, { borderTopColor: s.accent }]}>
            <Text style={[S.statVal, { color: s.accent }]}>{s.value}</Text>
            <Text style={S.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Follow-up Alert ── */}
      {followUp && (
        <TouchableOpacity style={S.followUpAlert} onPress={() => navigation.navigate("Records")} activeOpacity={0.8}>
          <Text style={{ fontSize: 20 }}>🔄</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={S.followUpTitle}>Follow-up Session Scheduled</Text>
            <Text style={S.followUpDesc}>Check your Counseling Records for details.</Text>
          </View>
          <Text style={S.followUpArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* ── Quick Actions ── */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>⚡ Quick Actions</Text>
        <View style={S.actionsGrid}>
          {quickActions.map(a => (
            <TouchableOpacity
              key={a.screen}
              style={[S.actionCard, { backgroundColor: a.bg }]}
              onPress={() => navigation.navigate(a.screen)}
              activeOpacity={0.8}
            >
              <Text style={S.actionIcon}>{a.icon}</Text>
              <Text style={[S.actionLabel, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Recent Requests ── */}
      <View style={S.section}>
        <View style={S.sectionHeader}>
          <Text style={S.sectionTitle}>📋 Recent Requests</Text>
          <TouchableOpacity onPress={() => navigation.navigate("CounselingRequest")}>
            <Text style={S.seeAll}>View all →</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <Text style={S.loadingText}>Loading…</Text>
        ) : recentReqs.length === 0 ? (
          <View style={S.empty}>
            <Text style={S.emptyIcon}>📭</Text>
            <Text style={S.emptyText}>No requests yet.</Text>
            <TouchableOpacity style={S.emptyBtn} onPress={() => navigation.navigate("CounselingRequest")}>
              <Text style={S.emptyBtnText}>Book Your First Session</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentReqs.map(r => {
            const sc = statusStyle(r.status);
            return (
              <View key={r.id} style={S.reqItem}>
                <View style={{ flex: 1 }}>
                  <Text style={S.reqType}>{r.session_type || r.type || "General"}</Text>
                  <Text style={S.reqMeta}>
                    📅 {fmtDate(r.session_date || r.date)}
                    {(r.session_time || r.time) ? `  🕐 ${fmtTime(r.session_time || r.time)}` : ""}
                  </Text>
                </View>
                <View style={[S.statusPill, { backgroundColor: sc.bg }]}>
                  <Text style={[S.statusText, { color: sc.color }]}>{r.status}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Counselor Card ── */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>🩺 Your Counselor</Text>
        <View style={S.counselorCard}>
          <View style={S.counselorAvatar}>
            <Text style={S.counselorAvatarText}>JM</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={S.counselorName}>{COUNSELOR}</Text>
            <Text style={S.counselorRole}>Guidance Counselor</Text>
            <Text style={S.counselorInfo}>📍 Guidance Office, Room 201</Text>
            <Text style={S.counselorInfo}>🕐 Mon–Fri, 8AM–5PM</Text>
          </View>
        </View>
        <TouchableOpacity style={S.btn} onPress={() => navigation.navigate("CounselingRequest")}>
          <Text style={S.btnText}>📋 Request Session</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container:           { flex: 1, backgroundColor: "#f8fafc" },

  // Hero
  hero:                { backgroundColor: "#1e3a5f", paddingTop: 54, paddingBottom: 22, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar:              { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder:   { backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  avatarText:          { color: "#fff", fontWeight: "800", fontSize: 18 },
  heroTag:             { fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle:           { fontSize: 20, fontWeight: "800", color: "#fff", marginVertical: 2 },
  heroSub:             { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  logoutBtn:           { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minWidth: 58 },
  logoutIcon:          { fontSize: 20 },
  logoutLabel:         { fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginTop: 2 },

  // ★ Upcoming section
  upcomingSection:     { margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  upcomingHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  upcomingHeading:     { fontSize: 15, fontWeight: "800", color: "#1e3a5f" },
  upcomingBadge:       { backgroundColor: "#2563eb", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: "center" },
  upcomingBadgeText:   { color: "#fff", fontSize: 11, fontWeight: "800" },
  seeAll:              { fontSize: 12, color: "#2563eb", fontWeight: "600" },

  // Empty upcoming
  upcomingEmpty:       { alignItems: "center", paddingVertical: 24 },
  upcomingEmptyTitle:  { fontSize: 15, fontWeight: "700", color: "#1e3a5f", marginBottom: 6 },
  upcomingEmptyDesc:   { fontSize: 12, color: "#94a3b8", textAlign: "center", marginBottom: 16, lineHeight: 18 },
  upcomingLoading:     { alignItems: "center", paddingVertical: 20 },

  // Book button
  bookBtn:             { backgroundColor: "#1e3a5f", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11 },
  bookBtnText:         { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Session card
  sessionCard:         { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, marginBottom: 10, overflow: "hidden", paddingVertical: 14, paddingRight: 14 },
  sessionAccentBar:    { width: 5, alignSelf: "stretch", borderRadius: 4, marginLeft: 2 },
  sessionTopRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sessionType:         { fontSize: 14, fontWeight: "800", color: "#1e293b", flex: 1, marginRight: 8 },
  dayPill:             { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  dayPillText:         { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  sessionMetaRow:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  sessionMetaItem:     { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionMetaIcon:     { fontSize: 13 },
  sessionMetaText:     { fontSize: 12, color: "#475569", fontWeight: "500" },
  sessionCounselorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sessionCounselorDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#1e3a5f", alignItems: "center", justifyContent: "center" },
  sessionCounselorText:{ fontSize: 11, color: "#64748b", fontWeight: "600" },
  sessionArrow:        { fontSize: 28, fontWeight: "300", marginLeft: 4 },

  // Stats
  statsRow:            { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  statCard:            { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderTopWidth: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statVal:             { fontSize: 22, fontWeight: "800" },
  statLabel:           { fontSize: 10, color: "#64748b", marginTop: 2, textAlign: "center" },

  // Follow-up
  followUpAlert:       { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#fffbeb", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", borderLeftWidth: 4, borderLeftColor: "#f59e0b", borderWidth: 1, borderColor: "#fde68a" },
  followUpTitle:       { fontWeight: "700", fontSize: 13, color: "#92400e" },
  followUpDesc:        { fontSize: 11, color: "#b45309", marginTop: 2 },
  followUpArrow:       { color: "#d97706", fontWeight: "700", fontSize: 16, marginLeft: 8 },

  // Sections
  section:             { marginHorizontal: 16, marginBottom: 16, backgroundColor: "#fff", borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  sectionHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:        { fontSize: 14, fontWeight: "700", color: "#1e3a5f", marginBottom: 12 },

  // Actions
  actionsGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard:          { width: "47%", borderRadius: 12, padding: 14, alignItems: "center" },
  actionIcon:          { fontSize: 24, marginBottom: 6 },
  actionLabel:         { fontSize: 12, fontWeight: "700", textAlign: "center" },

  // Recent requests
  reqItem:             { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f4f8" },
  reqType:             { fontWeight: "700", fontSize: 13, color: "#1e293b" },
  reqMeta:             { fontSize: 11, color: "#64748b", marginTop: 2 },
  statusPill:          { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:          { fontSize: 11, fontWeight: "700" },

  // Counselor
  counselorCard:       { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  counselorAvatar:     { width: 46, height: 46, borderRadius: 23, backgroundColor: "#1e3a5f", alignItems: "center", justifyContent: "center" },
  counselorAvatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  counselorName:       { fontWeight: "700", fontSize: 14, color: "#1e3a5f" },
  counselorRole:       { fontSize: 11, color: "#64748b", marginBottom: 4 },
  counselorInfo:       { fontSize: 11, color: "#475569" },
  btn:                 { backgroundColor: "#1e3a5f", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnText:             { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Misc
  loadingText:         { textAlign: "center", color: "#94a3b8", padding: 20, fontSize: 13 },
  empty:               { alignItems: "center", padding: 20 },
  emptyIcon:           { fontSize: 32, marginBottom: 8 },
  emptyText:           { fontSize: 13, color: "#94a3b8", marginBottom: 12 },
  emptyBtn:            { backgroundColor: "#1e3a5f", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText:        { color: "#fff", fontWeight: "700", fontSize: 13 },
});