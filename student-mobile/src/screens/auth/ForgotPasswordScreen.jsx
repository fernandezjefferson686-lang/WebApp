import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, StatusBar, Keyboard,
} from "react-native";
import axios from "axios";

// ── Direct axios call — NO token attached, works even when logged out ──
const BASE_URL = Platform.OS === "web"
  ? "http://127.0.0.1:8000/api"
  : "http://10.44.227.240:8000/api";

const RULES = [
  { id: "length",    label: "8–20 characters",                               test: v => v.length >= 8 && v.length <= 20 },
  { id: "upper",     label: "At least one capital letter (A–Z)",             test: v => /[A-Z]/.test(v) },
  { id: "lower",     label: "At least one lowercase letter (a–z)",           test: v => /[a-z]/.test(v) },
  { id: "number",    label: "At least one number (0–9)",                     test: v => /[0-9]/.test(v) },
  { id: "noInvalid", label: 'No spaces or special characters ( : ; " / \\ )', test: v => v.length > 0 && !/[:;"'\/\\ ]/.test(v) },
];

const STRENGTH = [
  { label: "Too Weak",    color: "#ef4444", bg: "#fef2f2" },
  { label: "Too Weak",    color: "#ef4444", bg: "#fef2f2" },
  { label: "Weak",        color: "#f97316", bg: "#fff7ed" },
  { label: "Fair",        color: "#eab308", bg: "#fefce8" },
  { label: "Strong",      color: "#22c55e", bg: "#f0fdf4" },
  { label: "Very Strong", color: "#16a34a", bg: "#dcfce7" },
];

export default function ForgotPasswordScreen({ navigation }) {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [showCfm,   setShowCfm]   = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const scrollRef = useRef(null);
  const pwRef     = useRef(null);
  const cfmRef    = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (activeRef.current && scrollRef.current) {
        activeRef.current.measureLayout(
          scrollRef.current,
          (_x, y) => scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: true }),
          () => {}
        );
      }
    });
    return () => sub.remove();
  }, []);

  const onFocus = (ref) => { activeRef.current = ref.current; };

  const checks = {
    length:    password.length >= 8 && password.length <= 20,
    upper:     /[A-Z]/.test(password),
    lower:     /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    noInvalid: password.length > 0 && !/[:;"'\/\\ ]/.test(password),
  };
  const allPass       = Object.values(checks).every(Boolean);
  const strengthScore = RULES.filter(r => r.test(password)).length;
  const strength      = STRENGTH[strengthScore] || STRENGTH[0];

  const handleReset = async () => {
    if (!email.trim()) { Alert.alert("Required", "Please enter your email."); return; }
    if (!allPass) {
      setPwTouched(true);
      Alert.alert("Weak Password", "Please meet all password requirements.");
      return;
    }
    if (password !== confirm) { Alert.alert("Mismatch", "Passwords do not match."); return; }

    setLoading(true);
    try {
      // Direct axios — bypasses any token interceptor entirely
      const res = await axios.post(
        `${BASE_URL}/user/reset-password`,
        {
          email:                 email.trim(),
          password:              password,
          password_confirmation: confirm,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept:         "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("Reset response:", JSON.stringify(res.data));
      if (res.data.status === "success" || res.data.message?.toLowerCase().includes("success") || res.status === 200) {
        Alert.alert(
          "Password Reset ✅",
          "Your password has been updated. Please sign in with your new password.",
          [{ text: "Sign In", onPress: () => navigation.replace("Login") }]
        );
      } else {
        Alert.alert("Failed", res.data.message || "Could not reset password.");
      }
    } catch (err) {
      const status = err.response?.status;
      const data   = err.response?.data;
      console.log("Reset status:", status);
      console.log("Reset data:",   JSON.stringify(data));

      let msg = "Reset failed.";
      if (!err.response)      msg = "Cannot reach server. Is Laravel running on port 8000?";
      else if (status === 404) msg = "Email not found. Use the email you registered with.";
      else if (status === 422) msg = data?.errors
        ? Object.values(data.errors).flat().join("\n")
        : (data?.message || "Validation error.");
      else if (status === 401) msg = "Unauthorized. Token is being sent — contact support.";
      else if (status === 500) msg = "Server error. Check Laravel logs.";
      else if (data?.message)  msg = data.message;

      Alert.alert("Reset Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        style={S.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={S.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={S.brand}>
            <Text style={S.brandIcon}>🧠</Text>
            <Text style={S.brandName}>GuidanceSCS</Text>
            <Text style={S.brandSub}>STUDENT COUNSELING SYSTEM</Text>
          </View>

          <View style={S.card}>
            <Text style={S.title}>Reset Password</Text>
            <Text style={S.subtitle}>Enter your email and set a new password</Text>

            {/* Email */}
            <Text style={S.label}>EMAIL ADDRESS</Text>
            <View style={S.inputWrap}>
              <Text style={S.icon}>✉️</Text>
              <TextInput
                style={S.input}
                placeholder="student@gmail.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => pwRef.current?.focus()}
              />
            </View>

            {/* New Password */}
            <Text style={S.label}>NEW PASSWORD</Text>
            <View ref={pwRef} style={S.inputWrap}>
              <Text style={S.icon}>🔒</Text>
              <TextInput
                style={S.input}
                placeholder="Create a strong password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={v => { setPassword(v); setPwTouched(true); }}
                secureTextEntry={!showPw}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => cfmRef.current?.focus()}
                onFocus={() => { setPwTouched(true); onFocus(pwRef); }}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={S.eyeBtn}>
                <Text style={S.eyeLabel}>{showPw ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>

            {/* Strength + Requirements */}
            {pwTouched && (
              <View style={{ marginBottom: 12 }}>
                <View style={S.strengthRow}>
                  {[0,1,2,3,4].map(i => (
                    <View key={i} style={[S.strengthSeg, {
                      backgroundColor: password.length > 0 && i < strengthScore ? strength.color : "#e2e8f0"
                    }]}/>
                  ))}
                </View>
                {password.length > 0 && (
                  <View style={[S.strengthPill, { backgroundColor: strength.bg, borderColor: strength.color }]}>
                    <View style={[S.strengthDot, { backgroundColor: strength.color }]}/>
                    <Text style={[S.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                  </View>
                )}
                <View style={S.reqBox}>
                  <Text style={S.reqTitle}>PASSWORD REQUIREMENTS</Text>
                  {RULES.map(r => {
                    const ok = r.test(password);
                    return (
                      <View key={r.id} style={S.reqRow}>
                        <View style={[S.reqIcon, {
                          backgroundColor: ok ? "#16a34a" : "#fee2e2",
                          borderColor:     ok ? "#16a34a" : "#fca5a5",
                        }]}>
                          <Text style={{ fontSize: 9, fontWeight: "900", color: ok ? "#fff" : "#dc2626" }}>
                            {ok ? "✓" : "✗"}
                          </Text>
                        </View>
                        <Text style={[S.reqText, { color: ok ? "#16a34a" : "#dc2626", fontWeight: ok ? "600" : "400" }]}>
                          {r.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Confirm Password */}
            <Text style={S.label}>CONFIRM NEW PASSWORD</Text>
            <View ref={cfmRef} style={S.inputWrap}>
              <Text style={S.icon}>🔑</Text>
              <TextInput
                style={S.input}
                placeholder="Re-enter your new password"
                placeholderTextColor="#94a3b8"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showCfm}
                returnKeyType="done"
                onSubmitEditing={handleReset}
                onFocus={() => onFocus(cfmRef)}
              />
              <TouchableOpacity onPress={() => setShowCfm(v => !v)} style={S.eyeBtn}>
                <Text style={S.eyeLabel}>{showCfm ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>

            {confirm.length > 0 && (
              <View style={[S.matchBox, {
                backgroundColor: password === confirm ? "#f0fdf4" : "#fef2f2",
                borderColor:     password === confirm ? "#86efac" : "#fca5a5",
              }]}>
                <View style={[S.matchDot, { backgroundColor: password === confirm ? "#16a34a" : "#dc2626" }]}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>
                    {password === confirm ? "✓" : "✗"}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: password === confirm ? "#16a34a" : "#dc2626" }}>
                  {password === confirm ? "Passwords match" : "Passwords do not match"}
                </Text>
              </View>
            )}

            <TouchableOpacity style={S.btn} onPress={handleReset} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff"/> : <Text style={S.btnText}>Reset Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")}
              style={{ marginTop: 16, alignItems: "center", paddingVertical: 8 }}>
              <Text style={S.link}>← Back to Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={S.footer}>For enrolled students of the school only.</Text>
          <View style={{ height: 40 }}/>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const S = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#0f172a" },
  kav:          { flex: 1 },
  container:    { flexGrow: 1, padding: 24, paddingTop: 60 },
  brand:        { alignItems: "center", marginBottom: 28 },
  brandIcon:    { fontSize: 44, marginBottom: 8 },
  brandName:    { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  brandSub:     { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: 2 },
  card:         { width: "100%", backgroundColor: "#fff", borderRadius: 20, padding: 24, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, elevation: 10 },
  title:        { fontSize: 24, fontWeight: "800", color: "#1e3a5f", marginBottom: 4 },
  subtitle:     { fontSize: 13, color: "#64748b", marginBottom: 24 },
  label:        { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  inputWrap:    { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, marginBottom: 14, paddingHorizontal: 14, backgroundColor: "#f8fafc", height: 52 },
  icon:         { fontSize: 16, marginRight: 10 },
  input:        { flex: 1, fontSize: 15, color: "#1e293b", height: 52 },
  eyeBtn:       { paddingHorizontal: 6, paddingVertical: 4 },
  eyeLabel:     { fontSize: 13, fontWeight: "700", color: "#2563eb" },
  strengthRow:  { flexDirection: "row", gap: 4, marginBottom: 8 },
  strengthSeg:  { flex: 1, height: 5, borderRadius: 4 },
  strengthPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  strengthDot:  { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  strengthLabel:{ fontSize: 12, fontWeight: "700" },
  reqBox:       { backgroundColor: "#f8fafc", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  reqTitle:     { fontSize: 10, fontWeight: "800", color: "#94a3b8", letterSpacing: 1, marginBottom: 12 },
  reqRow:       { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  reqIcon:      { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 10, borderWidth: 1.5, flexShrink: 0 },
  reqText:      { fontSize: 13, flex: 1 },
  matchBox:     { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, marginTop: 4 },
  matchDot:     { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  btn:          { backgroundColor: "#1e3a5f", borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 6, elevation: 5 },
  btnText:      { color: "#fff", fontWeight: "700", fontSize: 16 },
  link:         { fontSize: 13, color: "#2563eb", fontWeight: "700" },
  footer:       { color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 24, textAlign: "center" },
});