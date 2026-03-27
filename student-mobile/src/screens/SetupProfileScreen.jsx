import { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, StatusBar, Keyboard,
  Modal, FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { getUser, saveUser } from "../storage/auth";
import { STORAGE_URL } from "../config";

// ── Constants ────────────────────────────────────────────────
const COURSES = [
  "BA Political Science","BA Communication","BEED","BSED",
  "BSIT","BSOA","BSCrim",
];
const YEAR_LEVELS = [
  { label:"1st Year", value:"1" },
  { label:"2nd Year", value:"2" },
  { label:"3rd Year", value:"3" },
  { label:"4th Year", value:"4" },
];
const SEX_OPTIONS = ["Male","Female"];

// Birthdate pickers
const MONTHS = [
  { label:"January",   value:"01" }, { label:"February",  value:"02" },
  { label:"March",     value:"03" }, { label:"April",     value:"04" },
  { label:"May",       value:"05" }, { label:"June",      value:"06" },
  { label:"July",      value:"07" }, { label:"August",    value:"08" },
  { label:"September", value:"09" }, { label:"October",   value:"10" },
  { label:"November",  value:"11" }, { label:"December",  value:"12" },
];
const DAYS  = Array.from({ length:31 }, (_, i) => ({ label: String(i+1).padStart(2,"0"), value: String(i+1).padStart(2,"0") }));
const CY    = new Date().getFullYear();
const YEARS = Array.from({ length:60 }, (_, i) => ({ label: String(CY - i), value: String(CY - i) }));

// ── Picker Modal ─────────────────────────────────────────────
function PickerModal({ visible, title, options, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={PM.overlay} activeOpacity={1} onPress={onClose}>
        <View style={PM.sheet}>
          <View style={PM.handle}/>
          <Text style={PM.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item, i) => String(i)}
            renderItem={({ item }) => (
              <TouchableOpacity style={PM.item} onPress={() => { onSelect(item.value || item); onClose(); }}>
                <Text style={PM.itemText}>{item.label || item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Select Field ─────────────────────────────────────────────
function SelectField({ label, value, placeholder, onPress }) {
  return (
    <View style={S.fieldWrap}>
      <Text style={S.label}>{label}</Text>
      <TouchableOpacity style={S.selectBtn} onPress={onPress} activeOpacity={0.7}>
        <Text style={[S.selectText, !value && { color:"#94a3b8" }]}>
          {value || placeholder}
        </Text>
        <Text style={S.selectArrow}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Text Field ───────────────────────────────────────────────
function TextField({ label, value, onChange, keyboard="default", multiline=false, placeholder="", maxLength }) {
  return (
    <View style={S.fieldWrap}>
      <Text style={S.label}>{label}</Text>
      <TextInput
        style={[S.input, multiline && { height:72, textAlignVertical:"top" }]}
        value={value || ""}
        onChangeText={onChange}
        keyboardType={keyboard}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        blurOnSubmit={false}
        maxLength={maxLength}
      />
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function SetupProfileScreen({ navigation }) {
  const [form, setForm] = useState({
    full_name:"", student_id:"", sex:"", birthdate:"",
    birth_month:"", birth_day:"", birth_year:"",
    department:"",
    year_level:"", section:"", phone:"",
    province:"", city:"", barangay:"", street:"",
    emergency_name:"", emergency_phone:"",
  });
  const [preview,   setPreview]   = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Picker states
  const [showSex,    setShowSex]    = useState(false);
  const [showCourse, setShowCourse] = useState(false);
  const [showYear,   setShowYear]   = useState(false);
  const [showMonth,  setShowMonth]  = useState(false);
  const [showDay,    setShowDay]    = useState(false);
  const [showBYear,  setShowBYear]  = useState(false);

  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  // Auto-scroll on keyboard show
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (activeRef.current && scrollRef.current) {
        activeRef.current.measureLayout(
          scrollRef.current,
          (_x, y) => scrollRef.current.scrollTo({ y: Math.max(0, y - 100), animated: true }),
          () => {}
        );
      }
    });
    return () => sub.remove();
  }, []);

  const set = useCallback((field, val) => setForm(p => ({ ...p, [field]: val })), []);
  const onFocus = (ref) => { activeRef.current = ref?.current || ref; };

  // Auto-fill full name from stored user
  useEffect(() => {
    getUser().then(u => {
      if (u?.name && !form.full_name) {
        set("full_name", u.name);
      }
    });
  }, []);

  // ── Image picker ──
  const pickImage = async () => {
    Alert.alert("Add Photo", "Choose how to add your photo", [
      {
        text: "📷 Take a Photo",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Please allow camera access."); return; }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect:[1,1], quality:0.8,
          });
          if (!result.canceled) { setPreview(result.assets[0].uri); setImageFile(result.assets[0]); }
        },
      },
      {
        text: "🖼️ Choose from Gallery",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Please allow photo library access."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect:[1,1], quality:0.8,
          });
          if (!result.canceled) { setPreview(result.assets[0].uri); setImageFile(result.assets[0]); }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ── Phone validation (PH: 11 digits, starts with 09) ──
  const handlePhone = (field, val) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    set(field, digits);
  };

  const phoneValid = (v) => v?.length === 11 && v.startsWith("09");

  // ── Save ──
  const handleSave = async () => {
    setSubmitted(true);
    // ── Validate all required fields ──
    if (!preview) {
      Alert.alert("⚠️ Required", "Please add a profile photo before continuing.");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.full_name.trim()) {
      Alert.alert("⚠️ Required", "Please enter your Full Name."); return;
    }
    if (!form.student_id || form.student_id.length !== 9) {
      Alert.alert("⚠️ Required", "Please enter a valid Student ID in the format XX-XXXXXX (e.g. 23-016229)."); return;
    }
    if (!form.birth_month || !form.birth_day || !form.birth_year) {
      Alert.alert("⚠️ Required", "Please select your complete Birthdate (Month, Day, and Year)."); return;
    }
    if (!form.sex) {
      Alert.alert("⚠️ Required", "Please select your Sex."); return;
    }
    if (!form.phone || !phoneValid(form.phone)) {
      Alert.alert("⚠️ Required", "Please enter a valid Phone Number (11 digits starting with 09)."); return;
    }
    if (!form.department) {
      Alert.alert("⚠️ Required", "Please select your Course / Program."); return;
    }
    if (!form.year_level) {
      Alert.alert("⚠️ Required", "Please select your Year Level."); return;
    }
    if (!form.section.trim()) {
      Alert.alert("⚠️ Required", "Please enter your Section / Block."); return;
    }
    if (!form.province.trim()) {
      Alert.alert("⚠️ Required", "Please enter your Province."); return;
    }
    if (!form.city.trim()) {
      Alert.alert("⚠️ Required", "Please enter your City / Municipality."); return;
    }
    if (!form.barangay.trim()) {
      Alert.alert("⚠️ Required", "Please enter your Barangay."); return;
    }
    if (!form.street.trim()) {
      Alert.alert("⚠️ Required", "Please enter your House No. / Street / Purok."); return;
    }
    if (!form.emergency_name.trim()) {
      Alert.alert("⚠️ Required", "Please enter your Parent / Guardian Name."); return;
    }
    if (!form.emergency_phone || !phoneValid(form.emergency_phone)) {
      Alert.alert("⚠️ Required", "Please enter a valid Guardian's Contact Number (11 digits starting with 09)."); return;
    }

    setLoading(true);
    try {
      const address = [form.street, form.barangay, form.city, form.province].filter(Boolean).join(", ");
      const birthdate = form.birth_year && form.birth_month && form.birth_day
        ? `${form.birth_year}-${form.birth_month}-${form.birth_day}` : "";
      const formData = new FormData();
      const fields = { ...form, address, birthdate };
      Object.entries(fields).forEach(([k,v]) => formData.append(k, v || ""));
      if (imageFile) {
        formData.append("profile_pic", { uri:imageFile.uri, name:"photo.jpg", type:"image/jpeg" });
      }
      const res = await api.post("/user/profile/setup", formData, {
        headers: { "Content-Type":"multipart/form-data" },
      });
      if (res.data.status === "success") {
        const u = await getUser();
        await saveUser({ ...u, name: form.full_name, profile_completed: true });
        navigation.replace("Main");
      }
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to save profile.");
    } finally { setLoading(false); }
  };

  const getInitials = name => name?.split(" ").map(p=>p[0]).join("").toUpperCase().slice(0,2) || "?";

  return (
    <View style={{ flex:1, backgroundColor:"#f8fafc" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc"/>
      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={S.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={S.header}>
            <Text style={S.headerTitle}>Complete Your Profile</Text>
            <Text style={S.headerSub}>Fill in your details to get started</Text>
          </View>

          {/* Avatar */}
          <TouchableOpacity style={S.avatarWrap} onPress={pickImage} activeOpacity={0.8}>
            {preview
              ? <Image source={{ uri:preview }} style={S.avatar}/>
              : <View style={[S.avatar, S.avatarPlaceholder, submitted && !preview && { borderWidth:3, borderColor:"#dc2626" }]}>
                  <Text style={{ fontSize:32 }}>📷</Text>
                </View>}
            <View style={[S.cameraBtn, submitted && !preview && { backgroundColor:"#dc2626" }]}>
              <Text style={{ fontSize:16 }}>📷</Text>
            </View>
            <Text style={[S.avatarHint, submitted && !preview && { color:"#dc2626", fontWeight:"700" }]}>
              {submitted && !preview ? "⚠️ Profile photo is required — tap to add" : "Tap to add photo *"}
            </Text>
          </TouchableOpacity>

          {/* ── Personal Info ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>👤 Personal Information</Text>

            <TextField label="Full Name *" value={form.full_name} onChange={v=>set("full_name",v)} placeholder="e.g. Juan Dela Cruz"/>
            {submitted && !form.full_name.trim() && (
              <Text style={S.errText}>⚠️ Full Name is required.</Text>
            )}
            {/* Student ID — auto-format XX-XXXXXX */}
            <View style={S.fieldWrap}>
              <Text style={S.label}>STUDENT ID</Text>
              <View style={[S.inputRow,
                form.student_id.length > 0 && form.student_id.length < 9 && { borderColor:"#fbbf24" },
                form.student_id.length === 9 && { borderColor:"#16a34a" },
              ]}>
                <Text style={S.prefix}>🎓</Text>
                <TextInput
                  style={[S.inputInner, { fontSize:17, fontWeight:"700", letterSpacing:2, color:"#1e3a5f" }]}
                  value={form.student_id || ""}
                  placeholder="23-016229"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={9}
                  blurOnSubmit={false}
                  onChangeText={v => {
                    const digits = v.replace(/[^0-9]/g, "");
                    let formatted = digits;
                    if (digits.length > 2) {
                      formatted = digits.slice(0,2) + "-" + digits.slice(2,8);
                    }
                    set("student_id", formatted);
                  }}
                />
                {form.student_id.length === 9 && (
                  <Text style={{ fontSize:18, paddingRight:10 }}>✅</Text>
                )}
              </View>
              {form.student_id.length === 0 && (
                <Text style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Format: XX-XXXXXX (e.g. 23-016229)</Text>
              )}
              {form.student_id.length > 0 && form.student_id.length < 9 && (
                <Text style={{ fontSize:11, color:"#f59e0b", marginTop:4 }}>
                  ⏳ Keep typing… {9 - form.student_id.length} more character{9 - form.student_id.length !== 1 ? "s" : ""}
                </Text>
              )}
              {form.student_id.length === 9 && (
                <Text style={{ fontSize:11, color:"#16a34a", marginTop:4 }}>✅ Valid Student ID: {form.student_id}</Text>
              )}
              {submitted && form.student_id.length !== 9 && (
                <Text style={S.errText}>⚠️ Student ID is required (format: XX-XXXXXX).</Text>
              )}
            </View>

            {/* Birthdate */}
            <View style={S.fieldWrap}>
              <Text style={S.label}>Birthdate</Text>
              <View style={{ flexDirection:"row", gap:8 }}>
                <TouchableOpacity style={[S.selectBtn, { flex:1.4 }]} onPress={() => setShowMonth(true)} activeOpacity={0.7}>
                  <Text style={[S.selectText, !form.birth_month && { color:"#94a3b8" }]} numberOfLines={1}>
                    {MONTHS.find(m => m.value === form.birth_month)?.label || "Month"}
                  </Text>
                  <Text style={S.selectArrow}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.selectBtn, { flex:0.8 }]} onPress={() => setShowDay(true)} activeOpacity={0.7}>
                  <Text style={[S.selectText, !form.birth_day && { color:"#94a3b8" }]}>
                    {form.birth_day || "Day"}
                  </Text>
                  <Text style={S.selectArrow}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.selectBtn, { flex:1 }]} onPress={() => setShowBYear(true)} activeOpacity={0.7}>
                  <Text style={[S.selectText, !form.birth_year && { color:"#94a3b8" }]}>
                    {form.birth_year || "Year"}
                  </Text>
                  <Text style={S.selectArrow}>▼</Text>
                </TouchableOpacity>
              </View>
              {form.birth_month && form.birth_day && form.birth_year && (
                <Text style={{ fontSize:11, color:"#16a34a", marginTop:4 }}>
                  ✅ {MONTHS.find(m=>m.value===form.birth_month)?.label} {form.birth_day}, {form.birth_year}
                </Text>
              )}
              {submitted && (!form.birth_month || !form.birth_day || !form.birth_year) && (
                <Text style={S.errText}>⚠️ Please select your complete Birthdate.</Text>
              )}
            </View>

            {/* Sex — dropdown */}
            <SelectField label="Sex *" value={form.sex} placeholder="Select sex" onPress={() => setShowSex(true)}/>
            {submitted && !form.sex && (
              <Text style={[S.errText, { marginTop:-8 }]}>⚠️ Please select your Sex.</Text>
            )}

            {/* Phone */}
            <View style={S.fieldWrap}>
              <Text style={S.label}>Phone Number</Text>
              <View style={[S.inputRow, form.phone && !phoneValid(form.phone) && { borderColor:"#fca5a5" }]}>
                <Text style={S.prefix}>🇵🇭 +63</Text>
                <TextInput
                  style={S.inputInner}
                  value={form.phone || ""}
                  onChangeText={v => handlePhone("phone", v)}
                  keyboardType="phone-pad"
                  placeholder="09XXXXXXXXX"
                  placeholderTextColor="#94a3b8"
                  maxLength={11}
                  blurOnSubmit={false}
                />
              </View>
              {form.phone.length > 0 && (
                <Text style={{ fontSize:11, marginTop:3, color: phoneValid(form.phone) ? "#16a34a" : "#f97316" }}>
                  {phoneValid(form.phone) ? "✅ Valid Philippine number" : `${11 - form.phone.length} more digit${11 - form.phone.length !== 1 ? "s" : ""} needed`}
                </Text>
              )}
              {submitted && !phoneValid(form.phone) && (
                <Text style={S.errText}>⚠️ Phone number is required (11 digits, starts with 09).</Text>
              )}
            </View>
          </View>

          {/* ── Academic Info ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🎓 Academic Information</Text>

            {/* Course — dropdown */}
            <SelectField label="Course / Program *" value={form.department} placeholder="Select course" onPress={() => setShowCourse(true)}/>
            {submitted && !form.department && (
              <Text style={[S.errText, { marginTop:-8 }]}>⚠️ Please select your Course / Program.</Text>
            )}

            {/* Year Level — dropdown */}
            <SelectField
              label="Year Level *"
              value={YEAR_LEVELS.find(y => y.value === form.year_level)?.label || ""}
              placeholder="Select year level"
              onPress={() => setShowYear(true)}
            />
            {submitted && !form.year_level && (
              <Text style={[S.errText, { marginTop:-8 }]}>⚠️ Please select your Year Level.</Text>
            )}

            <TextField label="Section / Block *" value={form.section} onChange={v=>set("section",v)} placeholder="e.g. Block 5 / Section A"/>
            {submitted && !form.section.trim() && (
              <Text style={S.errText}>⚠️ Section / Block is required.</Text>
            )}
          </View>

          {/* ── Home Address ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🏠 Home Address</Text>
            <Text style={S.sectionHint}>Fill in step by step: Province → City → Barangay → Street</Text>

            <TextField label="Province *"              value={form.province}  onChange={v=>set("province",v)}  placeholder="e.g. Cebu"/>
            {submitted && !form.province.trim() && (
              <Text style={S.errText}>⚠️ Province is required.</Text>
            )}
            <TextField label="City / Municipality *"   value={form.city}      onChange={v=>set("city",v)}      placeholder="e.g. Mandaue City"/>
            {submitted && !form.city.trim() && (
              <Text style={S.errText}>⚠️ City / Municipality is required.</Text>
            )}
            <TextField label="Barangay *"              value={form.barangay}  onChange={v=>set("barangay",v)}  placeholder="e.g. Barangay Looc"/>
            {submitted && !form.barangay.trim() && (
              <Text style={S.errText}>⚠️ Barangay is required.</Text>
            )}
            <TextField label="House No. / Street / Purok *" value={form.street} onChange={v=>set("street",v)} placeholder="e.g. 123 Rizal St., Purok 2" multiline/>
            {submitted && !form.street.trim() && (
              <Text style={S.errText}>⚠️ House No. / Street is required.</Text>
            )}

            {/* Address preview */}
            {(form.street || form.barangay || form.city || form.province) && (
              <View style={S.addressPreview}>
                <Text style={S.addressPreviewLabel}>📌 Full Address Preview</Text>
                <Text style={S.addressPreviewText}>
                  {[form.street, form.barangay, form.city, form.province].filter(Boolean).join(", ")}
                </Text>
              </View>
            )}
          </View>

          {/* ── Emergency Contact ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🆘 Emergency Contact</Text>

            <TextField label="Parent / Guardian Name *" value={form.emergency_name} onChange={v=>set("emergency_name",v)} placeholder="Guardian's full name"/>
            {submitted && !form.emergency_name.trim() && (
              <Text style={S.errText}>⚠️ Guardian Name is required.</Text>
            )}

            <View style={S.fieldWrap}>
              <Text style={S.label}>Guardian's Contact</Text>
              <View style={[S.inputRow, form.emergency_phone && !phoneValid(form.emergency_phone) && { borderColor:"#fca5a5" }]}>
                <Text style={S.prefix}>🇵🇭 +63</Text>
                <TextInput
                  style={S.inputInner}
                  value={form.emergency_phone || ""}
                  onChangeText={v => handlePhone("emergency_phone", v)}
                  keyboardType="phone-pad"
                  placeholder="09XXXXXXXXX"
                  placeholderTextColor="#94a3b8"
                  maxLength={11}
                  blurOnSubmit={false}
                />
              </View>
              {form.emergency_phone.length > 0 && (
                <Text style={{ fontSize:11, marginTop:3, color: phoneValid(form.emergency_phone) ? "#16a34a" : "#f97316" }}>
                  {phoneValid(form.emergency_phone) ? "✅ Valid Philippine number" : `${11 - form.emergency_phone.length} more digit${11 - form.emergency_phone.length !== 1 ? "s" : ""} needed`}
                </Text>
              )}
              {submitted && !phoneValid(form.emergency_phone) && (
                <Text style={S.errText}>⚠️ Guardian's contact is required (11 digits, starts with 09).</Text>
              )}
            </View>
          </View>

          {/* Buttons */}
          <TouchableOpacity style={S.btn} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff"/> : <Text style={S.btnText}>Save & Continue →</Text>}
          </TouchableOpacity>



          <View style={{ height:40 }}/>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Picker Modals ── */}
      <PickerModal
        visible={showMonth}
        title="Select Month"
        options={MONTHS}
        onSelect={v => set("birth_month", v)}
        onClose={() => setShowMonth(false)}
      />
      <PickerModal
        visible={showDay}
        title="Select Day"
        options={DAYS}
        onSelect={v => set("birth_day", v)}
        onClose={() => setShowDay(false)}
      />
      <PickerModal
        visible={showBYear}
        title="Select Year"
        options={YEARS}
        onSelect={v => set("birth_year", v)}
        onClose={() => setShowBYear(false)}
      />
      <PickerModal
        visible={showSex}
        title="Select Sex"
        options={SEX_OPTIONS}
        onSelect={v => set("sex", v)}
        onClose={() => setShowSex(false)}
      />
      <PickerModal
        visible={showCourse}
        title="Select Course / Program"
        options={COURSES}
        onSelect={v => set("department", v)}
        onClose={() => setShowCourse(false)}
      />
      <PickerModal
        visible={showYear}
        title="Select Year Level"
        options={YEAR_LEVELS}
        onSelect={v => set("year_level", v)}
        onClose={() => setShowYear(false)}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const S = StyleSheet.create({
  container:        { flexGrow:1, padding:20, paddingTop:50 },
  header:           { alignItems:"center", marginBottom:20 },
  headerTitle:      { fontSize:24, fontWeight:"800", color:"#1e3a5f" },
  headerSub:        { fontSize:13, color:"#64748b", marginTop:4 },
  avatarWrap:       { alignItems:"center", marginBottom:24 },
  avatar:           { width:96, height:96, borderRadius:48 },
  avatarPlaceholder:{ backgroundColor:"#1e3a5f", alignItems:"center", justifyContent:"center" },
  avatarText:       { color:"#fff", fontWeight:"800", fontSize:30 },
  cameraBtn:        { position:"absolute", bottom:22, right:"33%", backgroundColor:"#2563eb", borderRadius:18, width:36, height:36, alignItems:"center", justifyContent:"center", elevation:4 },
  avatarHint:       { color:"#64748b", fontSize:12, marginTop:8 },
  section:          { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:14, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:2 },
  sectionTitle:     { fontSize:13, fontWeight:"700", color:"#1e3a5f", marginBottom:4, paddingBottom:10, borderBottomWidth:1, borderBottomColor:"#f0f4f8" },
  sectionHint:      { fontSize:11, color:"#94a3b8", marginBottom:12 },
  fieldWrap:        { marginBottom:12 },
  label:            { fontSize:11, fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 },
  input:            { borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, padding:12, fontSize:14, color:"#1e293b", backgroundColor:"#f8fafc" },
  selectBtn:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, padding:12, backgroundColor:"#f8fafc" },
  selectText:       { fontSize:14, color:"#1e293b", flex:1 },
  selectArrow:      { fontSize:10, color:"#94a3b8", marginLeft:8 },
  inputRow:         { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, backgroundColor:"#f8fafc", overflow:"hidden" },
  prefix:           { paddingHorizontal:12, paddingVertical:12, backgroundColor:"#eff6ff", fontSize:13, color:"#1e3a5f", fontWeight:"700", borderRightWidth:1, borderRightColor:"#e2e8f0" },
  inputInner:       { flex:1, padding:12, fontSize:14, color:"#1e293b" },
  addressPreview:   { backgroundColor:"#eff6ff", borderRadius:10, padding:12, marginTop:8, borderWidth:1, borderColor:"#bfdbfe" },
  addressPreviewLabel:{ fontSize:11, fontWeight:"700", color:"#1d4ed8", marginBottom:4 },
  addressPreviewText: { fontSize:13, color:"#1e3a5f", lineHeight:18 },
  btn:              { backgroundColor:"#1e3a5f", borderRadius:14, paddingVertical:16, alignItems:"center", elevation:4 },
  btnText:          { color:"#fff", fontWeight:"700", fontSize:16 },
  errText:          { fontSize:11, color:"#dc2626", marginTop:3, marginBottom:2 },
});

const PM = StyleSheet.create({
  overlay:  { flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" },
  sheet:    { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, paddingBottom:30, maxHeight:"70%" },
  handle:   { width:40, height:4, borderRadius:2, backgroundColor:"#e2e8f0", alignSelf:"center", marginVertical:12 },
  title:    { fontSize:16, fontWeight:"800", color:"#1e3a5f", paddingHorizontal:20, marginBottom:8 },
  item:     { paddingVertical:14, paddingHorizontal:20, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  itemText: { fontSize:15, color:"#1e293b" },
});