import React, { useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../css/signup.css";

// ── Password rules ─────────────────────────────────────────
const RULES = [
  {
    id: "length",
    label: "8–20 characters",
    test: v => v.length >= 8 && v.length <= 20,
  },
  {
    id: "upper",
    label: "At least one capital letter (A–Z)",
    test: v => /[A-Z]/.test(v),
  },
  {
    id: "lower",
    label: "At least one lowercase letter (a–z)",
    test: v => /[a-z]/.test(v),
  },
  {
    id: "digit",
    label: "At least one number (0–9)",
    test: v => /[0-9]/.test(v),
  },
  {
    id: "noInvalid",
    label: 'No invalid characters ( : ; , " \' / \\ or spaces )',
    test: v => v.length > 0 && !/[:;,"'/\\ ]/.test(v),
  },
];

const passwordStrength = (v) => {
  const passed = RULES.filter(r => r.test(v)).length;
  if (passed <= 1) return { level: 0, label: "Too Weak",   color: "#ef4444" };
  if (passed === 2) return { level: 1, label: "Weak",      color: "#f97316" };
  if (passed === 3) return { level: 2, label: "Fair",      color: "#eab308" };
  if (passed === 4) return { level: 3, label: "Strong",    color: "#22c55e" };
  return               { level: 4, label: "Very Strong", color: "#16a34a" };
};

const FIELDS = ["firstName", "lastName", "email", "password", "confirm"];
const EMPTY_FLAGS = Object.fromEntries(FIELDS.map(f => [f, false]));

function SignUp() {
  const [firstName,       setFirstName]       = useState("");
  const [middleName,      setMiddleName]      = useState("");
  const [lastName,        setLastName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched,  setConfirmTouched]  = useState(false);
  const [shakeRules,      setShakeRules]      = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  // red: false | "active" | "fading"
  const [jiggle, setJiggle] = useState({ ...EMPTY_FLAGS });
  const [red,    setRed]    = useState({ ...EMPTY_FLAGS });

  const fadeTimers = useRef({});

  const navigate = useNavigate();

  const allRulesPassed = RULES.every(r => r.test(password));
  const strength       = passwordStrength(password);
  const passwordsMatch = password === confirmPassword;

  // ── Jiggle + red, then AUTO-FADE after 1s ─────────────────
  // Timeline:
  //   0ms    → jiggle starts + red appears instantly
  //   600ms  → jiggle stops, red stays "active"
  //   1000ms → red switches to "fading" (CSS 0.4s transition begins)
  //   1400ms → fully gone
  const triggerJiggle = (fields) => {
    // Cancel any in-progress fade timers for these fields
    fields.forEach(f => {
      if (fadeTimers.current[f]) {
        clearTimeout(fadeTimers.current[f]);
        fadeTimers.current[f] = null;
      }
    });

    // Instantly apply red + jiggle
    setRed(prev    => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, "active"])) }));
    setJiggle(prev => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, true])) }));

    // Stop jiggle animation after 600ms
    setTimeout(() => {
      setJiggle(prev => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, false])) }));
    }, 600);

    // AUTO-FADE: at 400ms switch to "fading" (triggers CSS transition)
    fields.forEach(f => {
      fadeTimers.current[f] = setTimeout(() => {
        setRed(prev => ({ ...prev, [f]: "fading" }));
        // Fully remove after CSS transition (0.4s)
        setTimeout(() => {
          setRed(prev => ({ ...prev, [f]: false }));
        }, 400);
      }, 1000);
    });
  };

  // ── Manual clear when user types (skip wait, fade immediately) ─
  const clearRed = (field) => {
    if (fadeTimers.current[field]) {
      clearTimeout(fadeTimers.current[field]);
      fadeTimers.current[field] = null;
    }
    setRed(prev => ({ ...prev, [field]: "fading" }));
    setTimeout(() => {
      setRed(prev => ({ ...prev, [field]: false }));
    }, 400);
  };

  const triggerShake = () => {
    setShakeRules(true);
    setTimeout(() => setShakeRules(false), 600);
  };

  // ── Button click ───────────────────────────────────────────
  const handleButtonClick = () => {
    const emptyFields = [];
    if (!firstName.trim()) emptyFields.push("firstName");
    if (!lastName.trim())  emptyFields.push("lastName");
    if (!email.trim())     emptyFields.push("email");
    if (!password)         emptyFields.push("password");
    if (!confirmPassword)  emptyFields.push("confirm");

    if (emptyFields.length > 0) {
      triggerJiggle(emptyFields);
      return;
    }

    if (!allRulesPassed || !passwordsMatch) {
      setPasswordTouched(true);
      triggerShake();
      if (!allRulesPassed) triggerJiggle(["password"]);
      if (!passwordsMatch) triggerJiggle(["confirm"]);
    }
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      const empty = [];
      if (!firstName.trim()) empty.push("firstName");
      if (!lastName.trim())  empty.push("lastName");
      triggerJiggle(empty);
      setError("First name and last name are required.");
      return;
    }
    if (!email.trim()) {
      triggerJiggle(["email"]);
      setError("Email address is required.");
      return;
    }
    if (!password) {
      triggerJiggle(["password"]);
      setError("Password is required.");
      return;
    }
    if (!allRulesPassed) {
      setPasswordTouched(true);
      triggerShake();
      triggerJiggle(["password"]);
      setError("Please make sure your password meets all requirements.");
      return;
    }
    if (!confirmPassword) {
      triggerJiggle(["confirm"]);
      setError("Please confirm your password.");
      return;
    }
    if (!passwordsMatch) {
      triggerShake();
      triggerJiggle(["confirm"]);
      setError("Passwords do not match.");
      return;
    }

    const fullName = [firstName.trim(), middleName.trim(), lastName.trim()]
      .filter(Boolean)
      .join(" ");

    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/user/register", {
        name:                  fullName,
        first_name:            firstName.trim(),
        middle_name:           middleName.trim() || null,
        last_name:             lastName.trim(),
        email,
        password,
        password_confirmation: confirmPassword,
      });
      if (res.data.status === "success") navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Class helpers ──────────────────────────────────────────
  const wrapClass = (field, extra = "") => {
    let cls = "auth-input-wrap";
    if (jiggle[field])                cls += " field-jiggle";
    else if (red[field] === "active") cls += " field-error";
    else if (red[field] === "fading") cls += " field-fading";
    return cls + extra;
  };

  const iconClass = (field) => {
    let cls = "auth-input-icon";
    if (jiggle[field] || red[field] === "active") cls += " icon-error";
    else if (red[field] === "fading")              cls += " icon-fading";
    return cls;
  };

  const labelClass = (field) => {
    if (jiggle[field] || red[field] === "active") return "label-error";
    if (red[field] === "fading")                  return "label-fading";
    return "";
  };

  return (
    <div className="auth-page">

      {/* ── Left panel ── */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon">🧠</div>
          <span className="auth-brand-name">GuidanceSCS</span>
        </div>
        <h1 className="auth-headline">
          Join the<br /><em>Counseling System</em>
        </h1>
        <p className="auth-sub">
          Create your student account to start requesting counseling sessions
          and tracking your mental wellness journey.
        </p>
        <div className="auth-features">
          {[
            "Free counseling sessions",
            "Confidential & secure",
            "Easy appointment booking",
            "Progress tracking",
          ].map((f, i) => (
            <div className="auth-feature" key={i}>
              <span className="auth-dot" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right" style={{ overflowY: "auto", padding: "24px 0" }}>
        <div className="auth-box" style={{ maxWidth: 520, width: "100%" }}>
          <div className="auth-box-header">
            <h2>Create Account</h2>
            <p>Fill in your details to get started</p>
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} noValidate autoComplete="off">
            {/* Honeypot */}
            <input type="text"     style={{ display: "none" }} aria-hidden="true" readOnly />
            <input type="password" style={{ display: "none" }} aria-hidden="true" readOnly />

            {/* ── Name row ── */}
            <div style={{ marginBottom: "0.2rem" }}>
              <label className="name-section-label">Name</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: "1rem" }}>

              {/* First Name */}
              <div>
                <div className={wrapClass("firstName")}>
                  <span className={iconClass("firstName")}>👤</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => {
                      setFirstName(e.target.value);
                      if (e.target.value.trim()) clearRed("firstName");
                    }}
                    placeholder="First name"
                    autoComplete="off"
                    required
                    style={{ paddingLeft: 36 }}
                  />
                </div>
                <span className={`field-sub-label ${labelClass("firstName")}`}>First Name *</span>
              </div>

              {/* Middle Name — optional */}
              <div>
                <div className="auth-input-wrap">
                  <input
                    type="text"
                    value={middleName}
                    onChange={e => setMiddleName(e.target.value)}
                    placeholder="Middle name"
                    autoComplete="off"
                    style={{ paddingLeft: 12 }}
                  />
                </div>
                <span className="field-sub-label">Middle Name</span>
              </div>

              {/* Last Name */}
              <div>
                <div className={wrapClass("lastName")}>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => {
                      setLastName(e.target.value);
                      if (e.target.value.trim()) clearRed("lastName");
                    }}
                    placeholder="Last name"
                    autoComplete="off"
                    required
                    style={{ paddingLeft: 12 }}
                  />
                </div>
                <span className={`field-sub-label ${labelClass("lastName")}`}>Last Name *</span>
              </div>
            </div>

            {/* ── Email ── */}
            <div className="auth-field">
              <label className={labelClass("email")}>Email Address</label>
              <div className={wrapClass("email")}>
                <span className={iconClass("email")}>✉️</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (e.target.value.trim()) clearRed("email");
                  }}
                  placeholder="student@gmail.com"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* ── Password ── */}
            <div className="auth-field">
              <label className={labelClass("password")}>Password</label>
              <div className={wrapClass("password", shakeRules && !allRulesPassed ? " shake-error" : "")}>
                <span className={iconClass("password")}>🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setPasswordTouched(true);
                    if (e.target.value) clearRed("password");
                  }}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {/* Strength bar */}
              {passwordTouched && password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="pw-strength-bar">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="pw-strength-segment"
                        style={{ background: i <= strength.level ? strength.color : "#e2e8f0" }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                </div>
              )}

              {/* Rules checklist */}
              <div className="pw-rules-box">
                <div className="pw-rules-title">PASSWORD REQUIREMENTS</div>
                {RULES.map(rule => {
                  const state =
                    !passwordTouched || password.length === 0
                      ? "neutral"
                      : rule.test(password) ? "pass" : "fail";
                  return (
                    <div key={rule.id} className="pw-rule-row">
                      <div className={`pw-rule-icon ${state}`}>
                        {state === "neutral" ? "○" : state === "pass" ? "✓" : "✗"}
                      </div>
                      <span className={`pw-rule-label ${state}`}>{rule.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Confirm Password ── */}
            <div className="auth-field">
              <label className={labelClass("confirm")}>Confirm Password</label>
              <div className={wrapClass("confirm", shakeRules && !passwordsMatch ? " shake-error" : "")}>
                <span className={iconClass("confirm")}>🔑</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    setConfirmTouched(true);
                    if (e.target.value) clearRed("confirm");
                  }}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {/* Match indicator */}
              {confirmTouched && confirmPassword.length > 0 && (
                <div className={`pw-match-box ${passwordsMatch ? "match" : "mismatch"}`}>
                  <div className={`pw-match-icon ${passwordsMatch ? "match" : "mismatch"}`}>
                    {passwordsMatch ? "✓" : "✗"}
                  </div>
                  <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
                </div>
              )}
            </div>

            <div className="auth-extras">
              <span style={{ fontSize: 13, color: "#64748b" }}>
                Already have an account?{" "}
                <Link to="/" className="auth-link">Sign in</Link>
              </span>
            </div>

            <button
              type="submit"
              className="auth-btn"
              onClick={handleButtonClick}
              style={{
                opacity: loading ? 0.7 : 1,
                cursor:  loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignUp;