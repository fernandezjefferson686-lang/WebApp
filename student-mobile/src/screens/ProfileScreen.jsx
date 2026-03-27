import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, StatusBar, Modal,
  FlatList, Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { getUser, saveUser } from "../storage/auth";
import { STORAGE_URL } from "../config";

const { width: SW } = Dimensions.get("window");

const COURSES    = ["BA Political Science","BA Communication","BEED","BSED","BSIT","BSOA","BSCrim"];
const YEAR_LEVELS = [
  { label:"1st Year", value:"1" }, { label:"2nd Year", value:"2" },
  { label:"3rd Year", value:"3" }, { label:"4th Year", value:"4" },
];
const SEX_OPTIONS = ["Male","Female"];
const MONTHS = [
  { label:"January",value:"01"},{ label:"February",value:"02"},{ label:"March",value:"03"},
  { label:"April",value:"04"},{ label:"May",value:"05"},{ label:"June",value:"06"},
  { label:"July",value:"07"},{ label:"August",value:"08"},{ label:"September",value:"09"},
  { label:"October",value:"10"},{ label:"November",value:"11"},{ label:"December",value:"12"},
];
const DAYS  = Array.from({length:31},(_,i)=>({ label:String(i+1).padStart(2,"0"), value:String(i+1).padStart(2,"0") }));
const CY    = new Date().getFullYear();
const YEARS = Array.from({length:60},(_,i)=>({ label:String(CY-i), value:String(CY-i) }));

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
            keyExtractor={(_,i)=>String(i)}
            renderItem={({item})=>(
              <TouchableOpacity style={PM.item} onPress={()=>{ onSelect(item.value||item); onClose(); }}>
                <Text style={PM.itemText}>{item.label||item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Photo Viewer ──────────────────────────────────────────────
function PhotoViewer({ uri, onClose }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={PV.overlay} activeOpacity={1} onPress={onClose}>
        <Image source={{ uri }} style={PV.image} resizeMode="contain"/>
        <TouchableOpacity style={PV.closeBtn} onPress={onClose}>
          <Text style={PV.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── View Row (read-only) ──────────────────────────────────────
function ViewRow({ label, value }) {
  return (
    <View style={S.field}>
      <Text style={S.fieldLabel}>{label}</Text>
      <Text style={[S.fieldValue, !value && { color:"#cbd5e1" }]}>{value || "Not provided"}</Text>
    </View>
  );
}

// ── Main ProfileScreen ────────────────────────────────────────
export default function ProfileScreen() {
  const [profile,   setProfile]   = useState({});
  const [editData,  setEditData]  = useState({});
  const [preview,   setPreview]   = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(true);
  const [saved,     setSaved]     = useState(false);
  const [photoView, setPhotoView] = useState(null);

  const [showSex,    setShowSex]    = useState(false);
  const [showCourse, setShowCourse] = useState(false);
  const [showYear,   setShowYear]   = useState(false);
  const [showMonth,  setShowMonth]  = useState(false);
  const [showDay,    setShowDay]    = useState(false);
  const [showBYear,  setShowBYear]  = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const [res, storedUser] = await Promise.all([api.get("/user/profile"), getUser()]);
      const p = res.data?.profile || {};
      const email = storedUser?.email || p.email || "";
      const merged = { ...p, email };
      setProfile(merged);
      const [by, bm, bd] = (merged.birthdate||"").split("-");
      setEditData({ ...merged, birth_year:by||"", birth_month:bm||"", birth_day:bd||"" });
      if (merged.profile_pic) {
        const base = Platform.OS === "web" ? "http://127.0.0.1:8000/storage" : `http://10.44.227.240:8000/storage`;
        const cleanPath = merged.profile_pic.replace(/^\/+/, "").replace(/^storage\//, "");
        setPreview(`${base}/${cleanPath}?t=${Date.now()}`);
      }
    } catch (err) {
      console.log("Profile load error:", err.response?.data || err.message);
    } finally { setFetching(false); }
  };

  const set = useCallback((field, val) => setEditData(p => ({ ...p, [field]: val })), []);

  const phoneValid = (v) => v?.length === 11 && v.startsWith("09");
  const handlePhone = (field, val) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    set(field, digits);
  };

  const pickImage = async () => {
    Alert.alert("Change Photo", "Choose how to update your photo", [
      { text:"📷 Take a Photo", onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission needed", "Please allow camera access."); return; }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing:true, aspect:[1,1], quality:0.8 });
        if (!result.canceled) { setPreview(result.assets[0].uri); setImageFile(result.assets[0]); }
      }},
      { text:"🖼️ Choose from Gallery", onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission needed", "Please allow photo library access."); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.8 });
        if (!result.canceled) { setPreview(result.assets[0].uri); setImageFile(result.assets[0]); }
      }},
      { text:"Cancel", style:"cancel" },
    ]);
  };

  const handleSave = async () => {
    // Validate
    if (!editData.full_name?.trim())      { Alert.alert("⚠️ Required", "Full Name is required."); return; }
    if (editData.student_id?.length !== 9){ Alert.alert("⚠️ Required", "Student ID must be in format XX-XXXXXX."); return; }
    if (editData.phone && !phoneValid(editData.phone)) { Alert.alert("⚠️ Invalid", "Phone must be 11 digits starting with 09."); return; }
    if (editData.emergency_phone && !phoneValid(editData.emergency_phone)) { Alert.alert("⚠️ Invalid", "Guardian's contact must be 11 digits starting with 09."); return; }

    setLoading(true);
    try {
      const birthdate = editData.birth_year && editData.birth_month && editData.birth_day
        ? `${editData.birth_year}-${editData.birth_month}-${editData.birth_day}` : "";
      const formData = new FormData();
      ["full_name","student_id","sex","department","year_level",
       "section","address","emergency_name","phone","emergency_phone"]
        .forEach(k => formData.append(k, editData[k]||""));
      formData.append("birthdate", birthdate);
      if (imageFile) formData.append("profile_pic", { uri:imageFile.uri, name:"photo.jpg", type:"image/jpeg" });
      const res = await api.post("/user/profile/setup", formData, { headers:{ "Content-Type":"multipart/form-data" } });
      if (res.data.status === "success") {
        // ✅ FIX: preserve email from current state since server may not return it
        const savedEmail = profile.email || editData.email || "";
        const p = { ...res.data.profile, email: savedEmail };

        setProfile({...p});
        const [by,bm,bd] = (p.birthdate||"").split("-");
        setEditData({...p, birth_year:by||"", birth_month:bm||"", birth_day:bd||""});
        if (p.profile_pic) {
          const base2 = Platform.OS === "web" ? "http://127.0.0.1:8000/storage" : "http://10.44.227.240:8000/storage";
          const cleanPath2 = p.profile_pic.replace(/^\/+/, "").replace(/^storage\//, "");
          setPreview(`${base2}/${cleanPath2}?t=${Date.now()}`);
        }
        const u = await getUser();
        await saveUser({...u, name:p.full_name});
        setIsEditing(false); setImageFile(null);
        setSaved(true); setTimeout(()=>setSaved(false), 2500);
      }
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to save profile.");
    } finally { setLoading(false); }
  };

  const getInitials = name => name?.split(" ").map(p=>p[0]).join("").toUpperCase().slice(0,2) || "?";
  const formatDisplayName = name => {
    if (!name) return "Student Profile";
    const parts = name.trim().split(" ");
    return parts.length < 2 ? name : `${parts[parts.length-1]}, ${parts.slice(0,-1).join(" ")}`;
  };
  const formatBirthdate = () => {
    if (!profile.birthdate) return null;
    const [y,m,d] = profile.birthdate.split("-");
    const mon = MONTHS.find(mo=>mo.value===m)?.label;
    return mon ? `${mon} ${d}, ${y}` : profile.birthdate;
  };

  if (fetching) return (
    <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#f8fafc"}}>
      <ActivityIndicator size="large" color="#1e3a5f"/>
      <Text style={{marginTop:12,color:"#64748b"}}>Loading profile…</Text>
    </View>
  );

  // ✅ FIX: single source of truth for email display
  const displayEmail = profile.email || editData.email || "";

  return (
    <View style={{flex:1,backgroundColor:"#f8fafc"}}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc"/>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"} keyboardVerticalOffset={20}>
        <ScrollView contentContainerStyle={{padding:16,paddingTop:50}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Hero Card ── */}
          <View style={S.heroCard}>
            <TouchableOpacity onPress={()=>preview&&setPhotoView(preview)} activeOpacity={0.85}>
              {preview
                ? <Image source={{ uri:preview }} style={S.avatar} onError={()=>setPreview(null)}/>
                : <View style={[S.avatar,S.avatarPlaceholder]}>
                    <Text style={S.avatarText}>{getInitials(profile.full_name)}</Text>
                  </View>}
              {isEditing && <View style={S.editAvatarBadge}><Text style={{color:"#fff",fontSize:11}}>📷</Text></View>}
            </TouchableOpacity>
            <View style={{flex:1,marginLeft:14}}>
              <Text style={S.heroName}>{formatDisplayName(profile.full_name)}</Text>
              {profile.student_id && <Text style={S.heroMeta}>🎓 {profile.student_id}</Text>}
              {/* ✅ FIX: use displayEmail so it never disappears */}
              {displayEmail ? <Text style={S.heroMeta}>✉️ {displayEmail}</Text> : null}
              {profile.department && (
                <View style={S.deptPill}>
                  <Text style={S.deptPillText}>{profile.department}{profile.year_level?` · Year ${profile.year_level}`:""}</Text>
                </View>
              )}
            </View>
            {!isEditing && (
              <TouchableOpacity style={S.editBtn} onPress={()=>setIsEditing(true)}>
                <Text style={{color:"#fff",fontWeight:"700",fontSize:12}}>✏️ Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {saved && (
            <View style={S.savedBanner}>
              <Text style={S.savedText}>✅ Profile saved successfully!</Text>
            </View>
          )}

          {/* ═══════════════ VIEW MODE ═══════════════ */}
          {!isEditing ? (
            <>
              <View style={S.section}>
                <Text style={S.sectionTitle}>👤 Personal Information</Text>
                <ViewRow label="Full Name"     value={profile.full_name}/>
                <View style={S.field}>
                  <Text style={S.fieldLabel}>Email Address</Text>
                  <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
                    {/* ✅ FIX: use displayEmail */}
                    <Text style={S.fieldValue}>{displayEmail || "Not provided"}</Text>
                    {displayEmail ? (
                      <View style={S.emailBadge}><Text style={S.emailBadgeText}>Registered</Text></View>
                    ) : null}
                  </View>
                </View>
                <ViewRow label="Student ID"    value={profile.student_id}/>
                <ViewRow label="Birthdate"     value={formatBirthdate()}/>
                <ViewRow label="Sex"           value={profile.sex}/>
                <ViewRow label="Phone Number"  value={profile.phone}/>
              </View>
              <View style={S.section}>
                <Text style={S.sectionTitle}>🎓 Academic Information</Text>
                <ViewRow label="Course / Program" value={profile.department}/>
                <ViewRow label="Year Level"        value={YEAR_LEVELS.find(y=>y.value===profile.year_level)?.label||profile.year_level}/>
                <ViewRow label="Section / Block"   value={profile.section}/>
              </View>
              <View style={S.section}>
                <Text style={S.sectionTitle}>🏠 Home Address</Text>
                <ViewRow label="Full Address" value={profile.address}/>
              </View>
              <View style={S.section}>
                <Text style={S.sectionTitle}>🆘 Emergency Contact</Text>
                <ViewRow label="Parent / Guardian" value={profile.emergency_name}/>
                <ViewRow label="Guardian Contact"  value={profile.emergency_phone}/>
              </View>
            </>
          ) : (
            /* ═══════════════ EDIT MODE ═══════════════ */
            <>
              {/* Change Photo */}
              <TouchableOpacity style={S.changePhotoBtn} onPress={pickImage} activeOpacity={0.8}>
                <Text style={S.changePhotoText}>📷 Change Profile Photo</Text>
              </TouchableOpacity>

              {/* ── Personal Info ── */}
              <View style={S.section}>
                <Text style={S.sectionTitle}>👤 Personal Information</Text>

                {/* Full Name */}
                <View style={S.fieldWrap}>
                  <Text style={S.label}>FULL NAME *</Text>
                  <TextInput
                    style={S.input}
                    value={editData.full_name||""}
                    onChangeText={v=>set("full_name",v)}
                    placeholder="e.g. Juan Dela Cruz"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                  />
                </View>

                {/* Email — read only */}
                <View style={S.fieldWrap}>
                  <Text style={S.label}>EMAIL ADDRESS</Text>
                  <View style={[S.input,{backgroundColor:"#f1f5f9",justifyContent:"center"}]}>
                    {/* ✅ FIX: use displayEmail so it never disappears in edit mode */}
                    <Text style={{color:"#94a3b8",fontSize:14}}>{displayEmail || "—"}</Text>
                  </View>
                </View>

                {/* Student ID */}
                <View style={S.fieldWrap}>
                  <Text style={S.label}>STUDENT ID *</Text>
                  <View style={[S.inputRow,
                    editData.student_id?.length > 0 && editData.student_id?.length < 9 && { borderColor:"#fbbf24" },
                    editData.student_id?.length === 9 && { borderColor:"#16a34a" },
                  ]}>
                    <Text style={S.prefix}>🎓</Text>
                    <TextInput
                      style={[S.inputInner,{fontSize:17,fontWeight:"700",letterSpacing:2,color:"#1e3a5f"}]}
                      value={editData.student_id||""}
                      placeholder="23-016229"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={9}
                      onChangeText={v => {
                        const digits = v.replace(/[^0-9]/g,"");
                        set("student_id", digits.length > 2 ? digits.slice(0,2)+"-"+digits.slice(2,8) : digits);
                      }}
                    />
                    {editData.student_id?.length === 9 && <Text style={{fontSize:16,paddingRight:10}}>✅</Text>}
                  </View>
                  <Text style={{fontSize:11,color: editData.student_id?.length===9?"#16a34a":"#94a3b8",marginTop:4}}>
                    {editData.student_id?.length===9 ? `✅ Valid: ${editData.student_id}` : "Format: XX-XXXXXX (e.g. 23-016229)"}
                  </Text>
                </View>

                {/* Birthdate */}
                <View style={S.fieldWrap}>
                  <Text style={S.label}>BIRTHDATE</Text>
                  <View style={{flexDirection:"row",gap:8}}>
                    <TouchableOpacity style={[S.selectBtn,{flex:1.4}]} onPress={()=>setShowMonth(true)}>
                      <Text style={[S.selectText,!editData.birth_month&&{color:"#94a3b8"}]} numberOfLines={1}>
                        {MONTHS.find(m=>m.value===editData.birth_month)?.label||"Month"}
                      </Text>
                      <Text style={{color:"#94a3b8",fontSize:10}}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[S.selectBtn,{flex:0.8}]} onPress={()=>setShowDay(true)}>
                      <Text style={[S.selectText,!editData.birth_day&&{color:"#94a3b8"}]}>{editData.birth_day||"Day"}</Text>
                      <Text style={{color:"#94a3b8",fontSize:10}}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[S.selectBtn,{flex:1}]} onPress={()=>setShowBYear(true)}>
                      <Text style={[S.selectText,!editData.birth_year&&{color:"#94a3b8"}]}>{editData.birth_year||"Year"}</Text>
                      <Text style={{color:"#94a3b8",fontSize:10}}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  {editData.birth_month&&editData.birth_day&&editData.birth_year&&(
                    <Text style={{fontSize:11,color:"#16a34a",marginTop:4}}>
                      ✅ {MONTHS.find(m=>m.value===editData.birth_month)?.label} {editData.birth_day}, {editData.birth_year}
                    </Text>
                  )}
                </View>

                {/* Sex */}
                <View style={S.fieldWrap}>
                  <Text style={S.label}>SEX</Text>
                  <TouchableOpacity style={S.selectBtn} onPress={()=>setShowSex(true)}>
                    <Text style={[S.selectText,!editData.sex&&{color:"#94a3b8"}]}>{editData.sex||"Select sex"}</Text>
                    <Text style={{color:"#94a3b8",fontSize:10}}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Phone */}
                <View style={S.fieldWrap}>
                  <Text style={S.label}>PHONE NUMBER *</Text>
                  <View style={[S.inputRow, editData.phone&&!phoneValid(editData.phone)&&{borderColor:"#fca5a5"}]}>
                    <Text style={S.prefix}>🇵🇭 +63</Text>
                    <TextInput
                      style={S.inputInner}
                      value={editData.phone||""}
                      onChangeText={v=>handlePhone("phone",v)}
                      keyboardType="phone-pad"
                      placeholder="09XXXXXXXXX"
                      placeholderTextColor="#94a3b8"
                      maxLength={11}
                    />
                  </View>
                  {(editData.phone?.length||0) > 0 && (
                    <Text style={{fontSize:11,marginTop:3,color:phoneValid(editData.phone)?"#16a34a":"#f97316"}}>
                      {phoneValid(editData.phone) ? "✅ Valid Philippine number" : `${11-(editData.phone?.length||0)} more digit(s) needed`}
                    </Text>
                  )}
                </View>
              </View>

              {/* ── Academic Info ── */}
              <View style={S.section}>
                <Text style={S.sectionTitle}>🎓 Academic Information</Text>

                <View style={S.fieldWrap}>
                  <Text style={S.label}>COURSE / PROGRAM</Text>
                  <TouchableOpacity style={S.selectBtn} onPress={()=>setShowCourse(true)}>
                    <Text style={[S.selectText,!editData.department&&{color:"#94a3b8"}]}>{editData.department||"Select course"}</Text>
                    <Text style={{color:"#94a3b8",fontSize:10}}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={S.fieldWrap}>
                  <Text style={S.label}>YEAR LEVEL</Text>
                  <TouchableOpacity style={S.selectBtn} onPress={()=>setShowYear(true)}>
                    <Text style={[S.selectText,!editData.year_level&&{color:"#94a3b8"}]}>
                      {YEAR_LEVELS.find(y=>y.value===editData.year_level)?.label||"Select year level"}
                    </Text>
                    <Text style={{color:"#94a3b8",fontSize:10}}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={S.fieldWrap}>
                  <Text style={S.label}>SECTION / BLOCK</Text>
                  <TextInput
                    style={S.input}
                    value={editData.section||""}
                    onChangeText={v=>set("section",v)}
                    placeholder="e.g. Block 5 / Section A"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* ── Home Address ── */}
              <View style={S.section}>
                <Text style={S.sectionTitle}>🏠 Home Address</Text>
                <View style={S.fieldWrap}>
                  <Text style={S.label}>FULL ADDRESS</Text>
                  <TextInput
                    style={[S.input,{height:80,textAlignVertical:"top"}]}
                    value={editData.address||""}
                    onChangeText={v=>set("address",v)}
                    placeholder="House No., Street, Barangay, City, Province"
                    placeholderTextColor="#94a3b8"
                    multiline
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* ── Emergency Contact ── */}
              <View style={S.section}>
                <Text style={S.sectionTitle}>🆘 Emergency Contact</Text>

                <View style={S.fieldWrap}>
                  <Text style={S.label}>PARENT / GUARDIAN NAME</Text>
                  <TextInput
                    style={S.input}
                    value={editData.emergency_name||""}
                    onChangeText={v=>set("emergency_name",v)}
                    placeholder="Guardian's full name"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                  />
                </View>

                <View style={S.fieldWrap}>
                  <Text style={S.label}>GUARDIAN'S CONTACT *</Text>
                  <View style={[S.inputRow, editData.emergency_phone&&!phoneValid(editData.emergency_phone)&&{borderColor:"#fca5a5"}]}>
                    <Text style={S.prefix}>🇵🇭 +63</Text>
                    <TextInput
                      style={S.inputInner}
                      value={editData.emergency_phone||""}
                      onChangeText={v=>handlePhone("emergency_phone",v)}
                      keyboardType="phone-pad"
                      placeholder="09XXXXXXXXX"
                      placeholderTextColor="#94a3b8"
                      maxLength={11}
                    />
                  </View>
                  {(editData.emergency_phone?.length||0) > 0 && (
                    <Text style={{fontSize:11,marginTop:3,color:phoneValid(editData.emergency_phone)?"#16a34a":"#f97316"}}>
                      {phoneValid(editData.emergency_phone) ? "✅ Valid Philippine number" : `${11-(editData.emergency_phone?.length||0)} more digit(s) needed`}
                    </Text>
                  )}
                </View>
              </View>

              {/* ── Action Buttons ── */}
              <View style={S.actionRow}>
                <TouchableOpacity style={S.cancelBtn} onPress={()=>{
                  // ✅ FIX: preserve email when cancelling edit
                  setEditData({...profile, email: profile.email || editData.email || ""});
                  setIsEditing(false);
                  setImageFile(null);
                }}>
                  <Text style={S.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.saveBtn} onPress={handleSave} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff"/> : <Text style={S.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={{height:40}}/>
        </ScrollView>
      </KeyboardAvoidingView>

      {photoView && <PhotoViewer uri={photoView} onClose={()=>setPhotoView(null)}/>}

      <PickerModal visible={showSex}    title="Select Sex"          options={SEX_OPTIONS}  onSelect={v=>set("sex",v)}          onClose={()=>setShowSex(false)}/>
      <PickerModal visible={showCourse} title="Select Course"       options={COURSES}      onSelect={v=>set("department",v)}   onClose={()=>setShowCourse(false)}/>
      <PickerModal visible={showYear}   title="Select Year Level"   options={YEAR_LEVELS}  onSelect={v=>set("year_level",v)}   onClose={()=>setShowYear(false)}/>
      <PickerModal visible={showMonth}  title="Select Month"        options={MONTHS}       onSelect={v=>set("birth_month",v)}  onClose={()=>setShowMonth(false)}/>
      <PickerModal visible={showDay}    title="Select Day"          options={DAYS}         onSelect={v=>set("birth_day",v)}    onClose={()=>setShowDay(false)}/>
      <PickerModal visible={showBYear}  title="Select Birth Year"   options={YEARS}        onSelect={v=>set("birth_year",v)}   onClose={()=>setShowBYear(false)}/>
    </View>
  );
}

const S = StyleSheet.create({
  heroCard:         { backgroundColor:"#fff", borderRadius:16, padding:18, flexDirection:"row", alignItems:"center", marginBottom:12, shadowColor:"#000", shadowOpacity:0.06, shadowRadius:10, elevation:3 },
  avatar:           { width:76, height:76, borderRadius:38 },
  avatarPlaceholder:{ backgroundColor:"#1e3a5f", alignItems:"center", justifyContent:"center" },
  avatarText:       { color:"#fff", fontWeight:"800", fontSize:26 },
  editAvatarBadge:  { position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:12, backgroundColor:"#2563eb", alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"#fff" },
  heroName:         { fontSize:15, fontWeight:"800", color:"#1e3a5f", marginBottom:3 },
  heroMeta:         { fontSize:12, color:"#64748b", marginBottom:2 },
  emailBadge:       { backgroundColor:"#eff6ff", borderRadius:10, paddingHorizontal:8, paddingVertical:2 },
  emailBadgeText:   { fontSize:10, color:"#2563eb", fontWeight:"700" },
  deptPill:         { backgroundColor:"#eff6ff", borderRadius:20, paddingHorizontal:10, paddingVertical:3, alignSelf:"flex-start", marginTop:4 },
  deptPillText:     { fontSize:11, color:"#1d4ed8", fontWeight:"600" },
  editBtn:          { backgroundColor:"#1e3a5f", borderRadius:8, paddingHorizontal:12, paddingVertical:7, alignSelf:"flex-start" },
  changePhotoBtn:   { backgroundColor:"#eff6ff", borderRadius:10, padding:12, alignItems:"center", marginBottom:12, borderWidth:1, borderColor:"#bfdbfe" },
  changePhotoText:  { fontSize:13, fontWeight:"700", color:"#2563eb" },
  savedBanner:      { backgroundColor:"#f0fdf4", borderRadius:10, padding:12, marginBottom:12, borderLeftWidth:3, borderLeftColor:"#16a34a" },
  savedText:        { fontSize:13, fontWeight:"600", color:"#16a34a" },
  section:          { backgroundColor:"#fff", borderRadius:14, padding:16, marginBottom:14, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:2 },
  sectionTitle:     { fontSize:13, fontWeight:"700", color:"#1e3a5f", marginBottom:12, paddingBottom:10, borderBottomWidth:1, borderBottomColor:"#f0f4f8" },
  // View mode
  field:            { paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#f0f4f8" },
  fieldLabel:       { fontSize:10, fontWeight:"700", color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.5, marginBottom:5 },
  fieldValue:       { fontSize:15, color:"#1e3a5f", fontWeight:"500" },
  // Edit mode
  fieldWrap:        { marginBottom:12 },
  label:            { fontSize:11, fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 },
  input:            { borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, padding:12, fontSize:14, color:"#1e293b", backgroundColor:"#f8fafc" },
  selectBtn:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, padding:12, backgroundColor:"#f8fafc" },
  selectText:       { fontSize:14, color:"#1e293b", flex:1 },
  inputRow:         { flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor:"#e2e8f0", borderRadius:10, backgroundColor:"#f8fafc", overflow:"hidden" },
  prefix:           { paddingHorizontal:12, paddingVertical:12, backgroundColor:"#eff6ff", fontSize:13, color:"#1e3a5f", fontWeight:"700", borderRightWidth:1, borderRightColor:"#e2e8f0" },
  inputInner:       { flex:1, padding:12, fontSize:14, color:"#1e293b" },
  // Action buttons
  actionRow:        { flexDirection:"row", gap:12, marginBottom:16 },
  cancelBtn:        { flex:1, backgroundColor:"#f1f5f9", borderRadius:12, paddingVertical:14, alignItems:"center" },
  cancelBtnText:    { color:"#64748b", fontWeight:"700", fontSize:14 },
  saveBtn:          { flex:2, backgroundColor:"#1e3a5f", borderRadius:12, paddingVertical:14, alignItems:"center" },
  saveBtnText:      { color:"#fff", fontWeight:"700", fontSize:14 },
});

const PM = StyleSheet.create({
  overlay:  { flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" },
  sheet:    { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, paddingBottom:30, maxHeight:"70%" },
  handle:   { width:40, height:4, borderRadius:2, backgroundColor:"#e2e8f0", alignSelf:"center", marginVertical:12 },
  title:    { fontSize:16, fontWeight:"800", color:"#1e3a5f", paddingHorizontal:20, marginBottom:8 },
  item:     { paddingVertical:14, paddingHorizontal:20, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  itemText: { fontSize:15, color:"#1e293b" },
});

const PV = StyleSheet.create({
  overlay:  { flex:1, backgroundColor:"rgba(0,0,0,0.92)", alignItems:"center", justifyContent:"center" },
  image:    { width:SW, height:SW },
  closeBtn: { position:"absolute", top:50, right:20, width:40, height:40, borderRadius:20, backgroundColor:"rgba(255,255,255,0.2)", alignItems:"center", justifyContent:"center" },
  closeText:{ color:"#fff", fontSize:18, fontWeight:"700" },
});