import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, StatusBar, Keyboard,
} from "react-native";
import api from "../../services/api";
import { saveToken, saveUser } from "../../storage/auth";

export default function LoginScreen({ navigation }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const scrollRef  = useRef(null);
  const emailRef   = useRef(null);
  const pwRef      = useRef(null);
  const activeRef  = useRef(null);

  // Auto-scroll focused field above keyboard when keyboard opens
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (activeRef.current && scrollRef.current) {
        activeRef.current.measureLayout(
          scrollRef.current,
          (_x, y) => {
            scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: true });
          },
          () => {}
        );
      }
    });
    return () => sub.remove();
  }, []);

  const onFocus = (ref) => { activeRef.current = ref.current; };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/user/login", { email: email.trim(), password });
      if (res.data.status === "success") {
        await saveToken(res.data.token);
        await saveUser({ ...res.data.user, token: res.data.token });
        navigation.replace(res.data.profile_completed ? "Main" : "SetupProfile");
      }
    } catch (err) {
      Alert.alert("Login Failed", err.response?.data?.message || "Invalid email or password.");
    } finally { setLoading(false); }
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a"/>
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
          {/* Brand */}
          <View style={S.brand}>
            <Text style={S.brandIcon}>🧠</Text>
            <Text style={S.brandName}>GuidanceSCS</Text>
            <Text style={S.brandSub}>STUDENT COUNSELING SYSTEM</Text>
          </View>

          {/* Card */}
          <View style={S.card}>
            <Text style={S.title}>Student Sign In</Text>
            <Text style={S.subtitle}>Enter your credentials to continue</Text>

            {/* Email */}
            <Text style={S.label}>EMAIL ADDRESS</Text>
            <View ref={emailRef} style={S.inputWrap}>
              <Text style={S.inputIcon}>✉️</Text>
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
                onFocus={() => onFocus(emailRef)}
              />
            </View>

            {/* Password */}
            <Text style={S.label}>PASSWORD</Text>
            <View ref={pwRef} style={S.inputWrap}>
              <Text style={S.inputIcon}>🔒</Text>
              <TextInput
                style={S.input}
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={() => onFocus(pwRef)}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={S.eyeBtn}>
                <Text style={S.eyeLabel}>{showPw ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In button */}
            <TouchableOpacity style={S.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff"/> : <Text style={S.btnText}>Sign In</Text>}
            </TouchableOpacity>

            {/* Sign up link */}
            <View style={S.row}>
              <Text style={S.mutedText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={S.link}>Sign up</Text>
              </TouchableOpacity>
            </View>

            {/* Forgot password */}
            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword")}
              style={{ marginTop: 12, alignItems: "center", paddingVertical: 6 }}
            >
              <Text style={S.link}>Forgot password?</Text>
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
  root:      { flex: 1, backgroundColor: "#0f172a" },
  kav:       { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 80, justifyContent: "center" },
  brand:     { alignItems: "center", marginBottom: 32 },
  brandIcon: { fontSize: 44, marginBottom: 8 },
  brandName: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  brandSub:  { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: 2 },
  card:      { width: "100%", backgroundColor: "#fff", borderRadius: 20, padding: 28, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, elevation: 10 },
  title:     { fontSize: 24, fontWeight: "800", color: "#1e3a5f", marginBottom: 4 },
  subtitle:  { fontSize: 13, color: "#64748b", marginBottom: 24 },
  label:     { fontSize: 11, fontWeight: "700", color: "#475569", letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, marginBottom: 16, paddingHorizontal: 14, backgroundColor: "#f8fafc", height: 52 },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input:     { flex: 1, fontSize: 15, color: "#1e293b", height: 52 },
  eyeBtn:    { paddingHorizontal: 6, paddingVertical: 4 },
  eyeLabel:  { fontSize: 13, fontWeight: "700", color: "#2563eb" },
  btn:       { backgroundColor: "#1e3a5f", borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8, elevation: 5 },
  btnText:   { color: "#fff", fontWeight: "700", fontSize: 16 },
  row:       { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  mutedText: { fontSize: 13, color: "#64748b" },
  link:      { fontSize: 13, color: "#2563eb", fontWeight: "700" },
  footer:    { color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 24, textAlign: "center" },
});