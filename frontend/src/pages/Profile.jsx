import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/student.css";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(false);
  const [profile, setProfile]     = useState({});
  const [editData, setEditData]   = useState({});
  const [preview, setPreview]     = useState(null);
  const [errors, setErrors]       = useState({});
  const [lightbox, setLightbox]   = useState(false);
  const [fetchError, setFetchError] = useState("");

  // ── Token: handles all possible key names ──────────────────────────────────
  const getToken = () => {
    try {
      // 1. Check common direct keys first
      const directToken =
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("bearerToken") ||
        localStorage.getItem("jwt");
      if (directToken) return directToken.replace(/^Bearer\s+/i, "");

      // 2. Check nested inside "user"
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const nested =
        user?.token        ||
        user?.access_token ||
        user?.data?.token  ||
        user?.data?.access_token ||
        null;
      if (nested) return nested.replace(/^Bearer\s+/i, "");

      // 3. Scan all localStorage keys as a last resort
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (val && val.length > 20 && !val.startsWith("{") && !val.startsWith("[")) {
          // Looks like a raw token string
          return val.replace(/^Bearer\s+/i, "");
        }
        try {
          const parsed = JSON.parse(val);
          if (parsed?.token)        return parsed.token.replace(/^Bearer\s+/i, "");
          if (parsed?.access_token) return parsed.access_token.replace(/^Bearer\s+/i, "");
        } catch { /* not JSON */ }
      }

      return null;
    } catch { return null; }
  };

  // ── Phone helpers ──────────────────────────────────────────────────────────
  const toDisplayPhone = (val) => {
    if (!val) return "";
    const digits = val.replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("9")) return "0" + digits;
    if (digits.length === 11 && digits.startsWith("09")) return digits;
    return val;
  };

  const toStoredPhone = (val) => {
    const digits = val.replace(/\D/g, "");
    if (digits.startsWith("09")) return digits.slice(1, 11);
    if (digits.startsWith("0"))  return digits.slice(1, 11);
    return digits.slice(0, 10);
  };

  // ── Build a consistent profile object from API or localStorage ─────────────
  const buildProfileData = (apiProfile, localUser = {}) => ({
    full_name:       apiProfile?.full_name       || localUser?.name  || "",
    email:           apiProfile?.email           || localUser?.email || "",
    phone:           apiProfile?.phone           || "",
    student_id:      apiProfile?.student_id      || "",
    sex:             apiProfile?.sex             || apiProfile?.gender || "",
    department:      apiProfile?.department      || "",
    year_level:      apiProfile?.year_level      || "",
    section:         apiProfile?.section         || "",
    address:         apiProfile?.address         || "",
    emergency_name:  apiProfile?.emergency_name  || "",
    emergency_phone: apiProfile?.emergency_phone || "",
    profile_pic:     apiProfile?.profile_pic     || null,
  });

  // ── Fetch profile on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const token     = getToken();
    const localUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();

    // Debug: log what we found (remove in production)
    console.log("[Profile] token found:", token ? `${token.slice(0, 20)}...` : "NONE");
    console.log("[Profile] localStorage keys:", Object.keys(localStorage));

    if (!token) {
      const data = buildProfileData(null, localUser);
      setProfile(data);
      setEditData(data);
      setFetchError("No auth token found. Please log in again.");
      return;
    }

    axios.get("http://127.0.0.1:8000/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(res => {
      const raw = res.data;
      const apiProfile =
        raw?.profile  ??
        raw?.data     ??
        (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null);

      const data = buildProfileData(apiProfile, localUser);
      setProfile(data);
      setEditData(data);
      setFetchError("");

      const pic = apiProfile?.profile_pic;
      if (pic) setPreview(`http://127.0.0.1:8000/storage/${pic}`);
    })
    .catch(err => {
      const status = err.response?.status;
      const data   = buildProfileData(null, localUser);
      setProfile(data);
      setEditData(data);

      if (status === 404) {
        // Profile not yet set up — show empty form
        setFetchError("");
      } else if (status === 401) {
        setFetchError("Session expired. Please log in again.");
      } else {
        setFetchError("Could not load profile. Please refresh.");
      }
    });
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (key, value) => {
    setEditData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: null }));
  };

  const handlePhoneChange = (key, value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    setEditData(prev => ({ ...prev, [key]: digits }));
    setErrors(prev => ({ ...prev, [key]: null }));
  };

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    setEditData(prev => ({ ...prev, profile_pic: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) { setFetchError("Session expired. Please log in again."); return; }
    setErrors({}); setLoading(true);
    try {
      const formData = new FormData();
      ["full_name", "student_id", "sex", "department", "year_level", "section", "address", "emergency_name"]
        .forEach(k => formData.append(k, editData[k] ?? ""));

      formData.append("phone",           toStoredPhone(editData.phone           || ""));
      formData.append("emergency_phone", toStoredPhone(editData.emergency_phone || ""));

      if (editData.profile_pic instanceof File) formData.append("profile_pic", editData.profile_pic);

      const res = await axios.post("http://127.0.0.1:8000/api/user/profile/setup", formData, {
        headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
      });

      if (res.data.status === "success") {
        const localUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
        const raw = res.data;
        const apiProfile = raw?.profile ?? raw?.data ?? null;
        const updated = buildProfileData(apiProfile, localUser);
        setProfile(updated);
        setEditData(updated);
        const pic = apiProfile?.profile_pic;
        if (pic) setPreview(`http://127.0.0.1:8000/storage/${pic}`);
        setIsEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      if (err.response?.status === 422 && err.response.data?.errors) {
        setErrors(err.response.data.errors);
      } else if (err.response?.status === 401) {
        setFetchError("Session expired. Please log in again.");
        setIsEditing(false);
      } else {
        alert("Something went wrong. Please try again.");
      }
    } finally { setLoading(false); }
  };

  const handleCancel = () => {
    setEditData(profile);
    setErrors({});
    setIsEditing(false);
    if (profile.profile_pic) setPreview(`http://127.0.0.1:8000/storage/${profile.profile_pic}`);
    else setPreview(null);
  };

  // ── Utilities ──────────────────────────────────────────────────────────────
  const getInitials = name => {
    if (!name) return "?";
    return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatName = name => {
    if (!name) return "Student Profile";
    const parts = name.trim().split(" ");
    if (parts.length < 2) return name;
    return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%", padding: "9px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 9, fontSize: 14,
    color: "#1e3a5f", fontFamily: "'DM Sans', sans-serif",
    outline: "none", background: "#fff",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const selectStyle = { ...inputStyle, appearance: "auto", cursor: "pointer" };

  // ── Field definitions ──────────────────────────────────────────────────────
  const sections = [
    {
      title: "Basic Information",
      icon: "👤",
      fields: [
        { key: "full_name",  label: "Full Name",     type: "text"  },
        { key: "email",      label: "Email Address", type: "email", readonly: true },
        { key: "student_id", label: "Student ID",    type: "text"  },
        { key: "sex",        label: "Sex",           type: "text",  isSelect: true },
        { key: "phone",      label: "Phone Number",  type: "tel",  isPhone: true },
      ],
    },
    {
      title: "Academic Information",
      icon: "🎓",
      fields: [
        { key: "department", label: "Course / Program", type: "text" },
        { key: "year_level", label: "Year Level",       type: "text" },
        { key: "section",    label: "Section",          type: "text" },
      ],
    },
    {
      title: "Contact & Emergency",
      icon: "📍",
      fields: [
        { key: "address",         label: "Home Address",      type: "text" },
        { key: "emergency_name",  label: "Parent / Guardian", type: "text" },
        { key: "emergency_phone", label: "Guardian Contact",  type: "tel", isPhone: true },
      ],
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="s-page-header">
        <h1>My Profile</h1>
        <p>View and manage your personal information</p>
      </div>

      {/* Auth / fetch error banner */}
      {fetchError && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5",
          borderRadius: 10, padding: "12px 16px",
          marginBottom: 20, color: "#991b1b", fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>⚠️ {fetchError}</span>
          {fetchError.includes("log in") && (
            <button
              onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
              style={{
                marginLeft: "auto", padding: "4px 14px",
                background: "#991b1b", color: "#fff",
                border: "none", borderRadius: 6,
                fontSize: 12, cursor: "pointer",
              }}
            >
              Go to Login
            </button>
          )}
        </div>
      )}

      {/* Profile hero card */}
      <div className="s-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>

          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            {preview ? (
              <img
                src={preview} alt="Profile"
                onClick={() => !isEditing && setLightbox(true)}
                style={{
                  width: 90, height: 90, borderRadius: "50%", objectFit: "cover",
                  border: "3px solid #e2e8f0",
                  cursor: isEditing ? "default" : "zoom-in",
                  transition: "transform 0.18s, box-shadow 0.18s",
                }}
                onMouseEnter={e => { if (!isEditing) { e.target.style.transform = "scale(1.06)"; e.target.style.boxShadow = "0 4px 18px rgba(37,99,235,0.25)"; } }}
                onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "none"; }}
              />
            ) : (
              <div
                onClick={() => !isEditing && setLightbox(true)}
                style={{
                  width: 90, height: 90, borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, fontWeight: 700, color: "#fff",
                  border: "3px solid #e2e8f0",
                  cursor: isEditing ? "default" : "zoom-in",
                  transition: "transform 0.18s",
                }}
                onMouseEnter={e => { if (!isEditing) e.currentTarget.style.transform = "scale(1.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {getInitials(profile.full_name)}
              </div>
            )}
            {isEditing && (
              <label style={{
                position: "absolute", bottom: 0, right: 0,
                background: "#2563eb", color: "#fff",
                borderRadius: "50%", width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 13,
                boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
              }} title="Change photo">
                📷
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              </label>
            )}
          </div>

          {/* Name / meta */}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1e3a5f", margin: "0 0 4px" }}>
              {formatName(profile.full_name)}
            </h2>
            {profile.student_id && (
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                🎓 ID: {profile.student_id}
              </div>
            )}
            {profile.email && (
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                ✉️ {profile.email}
              </div>
            )}
            {profile.department && (
              <span style={{
                background: "#eff6ff", color: "#1d4ed8",
                padding: "3px 12px", borderRadius: 20,
                fontSize: 12, fontWeight: 600, display: "inline-block",
              }}>
                {profile.department}
                {profile.year_level ? ` · Year ${profile.year_level}` : ""}
                {profile.section    ? ` · ${profile.section}`          : ""}
              </span>
            )}
          </div>

          {!isEditing && (
            <button className="s-btn-primary" onClick={() => setIsEditing(true)}>
              ✏️ Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Validation errors */}
      {Object.keys(errors).length > 0 && (
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: 10, padding: "12px 16px",
          marginBottom: 20, color: "#991b1b", fontSize: 13,
        }}>
          <strong>Please fix the following errors:</strong>
          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
            {Object.entries(errors).map(([field, messages]) => (
              <li key={field}>
                <strong>{field}:</strong> {Array.isArray(messages) ? messages[0] : messages}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info sections */}
      {sections.map(section => (
        <div className="s-card" key={section.title} style={{ marginBottom: 20 }}>
          <h3 className="s-card-title">{section.icon} {section.title}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {section.fields.map(({ key, label, type, readonly, isPhone, isSelect }) => (
              <div key={key} style={{
                padding: "14px 24px 14px 0",
                borderBottom: "1px solid #f0f4f8",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.5px",
                  color: "#94a3b8", textTransform: "uppercase", marginBottom: 6,
                }}>
                  {label}
                </div>

                {isEditing ? (
                  <div>
                    {isSelect ? (
                      <select
                        value={editData[key] || ""}
                        onChange={e => handleChange(key, e.target.value)}
                        style={{
                          ...selectStyle,
                          border: `1.5px solid ${errors[key] ? "#ef4444" : "#e2e8f0"}`,
                        }}
                        onFocus={e => { e.target.style.borderColor = "#2563eb"; e.target.style.boxShadow = "0 0 0 3px #eff6ff"; }}
                        onBlur={e => { e.target.style.borderColor = errors[key] ? "#ef4444" : "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                      >
                        <option value="">— Select Sex —</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    ) : (
                      <input
                        type={type}
                        value={isPhone ? toDisplayPhone(editData[key] || "") : (editData[key] || "")}
                        onChange={e =>
                          isPhone
                            ? handlePhoneChange(key, e.target.value)
                            : handleChange(key, e.target.value)
                        }
                        placeholder={isPhone ? "09XXXXXXXXX" : `Enter ${label.toLowerCase()}`}
                        disabled={readonly}
                        maxLength={isPhone ? 11 : undefined}
                        inputMode={isPhone ? "numeric" : undefined}
                        style={{
                          ...inputStyle,
                          border: `1.5px solid ${errors[key] ? "#ef4444" : "#e2e8f0"}`,
                          background: readonly ? "#f8fafc" : "#fff",
                          cursor: readonly ? "not-allowed" : "text",
                          opacity: readonly ? 0.7 : 1,
                        }}
                        onFocus={e => {
                          if (!readonly) {
                            e.target.style.borderColor = "#2563eb";
                            e.target.style.boxShadow = "0 0 0 3px #eff6ff";
                          }
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = errors[key] ? "#ef4444" : "#e2e8f0";
                          e.target.style.boxShadow = "none";
                        }}
                      />
                    )}
                    {errors[key] && (
                      <span style={{ color: "#ef4444", fontSize: 12, marginTop: 3, display: "block" }}>
                        {Array.isArray(errors[key]) ? errors[key][0] : errors[key]}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{
                    fontSize: 15,
                    color: profile[key] ? "#1e3a5f" : "#cbd5e1",
                    fontWeight: profile[key] ? 500 : 400,
                  }}>
                    {isPhone
                      ? (profile[key] ? toDisplayPhone(profile[key]) : "Not provided")
                      : (profile[key] || "Not provided")
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Action bar */}
      {isEditing && (
        <div className="s-card" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="s-btn-outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </button>
          <button className="s-btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Toast */}
      <div className={`s-toast ${saved ? "show" : ""}`}>
        ✅ Profile saved successfully
      </div>

      {/* Photo Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(10,20,40,0.82)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out", animation: "fadeIn 0.18s ease",
          }}
        >
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: "absolute", top: 20, right: 24,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff", borderRadius: "50%", width: 40, height: 40,
              fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >✕</button>

          {preview ? (
            <img
              src={preview} alt="Profile Photo"
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: "min(480px, 90vw)", maxHeight: "min(480px, 85vh)",
                width: "auto", height: "auto", borderRadius: 16,
                boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
                border: "3px solid rgba(255,255,255,0.15)",
                cursor: "default",
                animation: "popIn 0.22s cubic-bezier(.34,1.56,.64,1)",
              }}
            />
          ) : (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: 240, height: 240, borderRadius: "50%",
                background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 80, fontWeight: 700, color: "#fff",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                animation: "popIn 0.22s cubic-bezier(.34,1.56,.64,1)",
                cursor: "default",
              }}
            >
              {getInitials(profile.full_name)}
            </div>
          )}

          <div style={{
            position: "absolute", bottom: 32,
            color: "rgba(255,255,255,0.75)", fontSize: 15,
            fontWeight: 600, letterSpacing: "0.02em",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}>
            {profile.full_name || "Profile Photo"}
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes popIn  { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default Profile;