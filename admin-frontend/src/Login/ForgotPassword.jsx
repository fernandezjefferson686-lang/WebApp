import React, { useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../css/forgotpassword.css";

/* ── Password rules ── */
const RULES = [
  { id: "length",    label: "8–20 characters",                                     test: v => v.length >= 8 && v.length <= 20 },
  { id: "upper",     label: "At least one capital letter (A–Z)",                   test: v => /[A-Z]/.test(v) },
  { id: "lower",     label: "At least one lowercase letter (a–z)",                 test: v => /[a-z]/.test(v) },
  { id: "digit",     label: "At least one number (0–9)",                           test: v => /[0-9]/.test(v) },
  { id: "noInvalid", label: 'No invalid characters ( : ; , " \' / \\ or spaces )', test: v => v.length > 0 && !/[:;,"'/\\ ]/.test(v) },
];

const passwordStrength = v => {
  const n = RULES.filter(r => r.test(v)).length;
  if (n <= 1) return { level: 0, label: "Too Weak",    color: "#ef4444" };
  if (n === 2) return { level: 1, label: "Weak",       color: "#f97316" };
  if (n === 3) return { level: 2, label: "Fair",       color: "#eab308" };
  if (n === 4) return { level: 3, label: "Strong",     color: "#22c55e" };
  return              { level: 4, label: "Very Strong", color: "#16a34a" };
};

const FIELDS     = ["email", "password", "confirm"];
const EMPTY_FLAGS = Object.fromEntries(FIELDS.map(f => [f, false]));

function ForgotPassword() {
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwTouched,       setPwTouched]       = useState(false);
  const [cfmTouched,      setCfmTouched]      = useState(false);
  const [shakeRules,      setShakeRules]      = useState(false);
  const [errorMessage,    setErrorMessage]    = useState("");
  const [success,         setSuccess]         = useState(false);
  const [loading,         setLoading]         = useState(false);

  // red: false | "active" | "fading"
  const [jiggle, setJiggle] = useState({ ...EMPTY_FLAGS });
  const [red,    setRed]    = useState({ ...EMPTY_FLAGS });

  const fadeTimers = useRef({});
  const navigate   = useNavigate();

  const allRulesPassed = RULES.every(r => r.test(password));
  const strength       = passwordStrength(password);
  const passwordsMatch = password === confirmPassword;

  // ── Jiggle + red "active" + auto-fade after 400ms ─────────
  const triggerJiggle = (fields) => {
    fields.forEach(f => {
      if (fadeTimers.current[f]) {
        clearTimeout(fadeTimers.current[f]);
        fadeTimers.current[f] = null;
      }
    });

    setRed(prev    => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, "active"])) }));
    setJiggle(prev => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, true])) }));

    // Stop jiggle animation after 600ms
    setTimeout(() => {
      setJiggle(prev => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, false])) }));
    }, 600);

    // AUTO-FADE: at 400ms → CSS 0.2s transition → fully gone at 600ms
    fields.forEach(f => {
      fadeTimers.current[f] = setTimeout(() => {
        setRed(prev => ({ ...prev, [f]: "fading" }));
        setTimeout(() => {
          setRed(prev => ({ ...prev, [f]: false }));
        }, 200);
      }, 400);
    });
  };

  // ── Manual clear when user types ─────────────────────────
  const clearRed = (field) => {
    if (fadeTimers.current[field]) {
      clearTimeout(fadeTimers.current[field]);
      fadeTimers.current[field] = null;
    }
    setRed(prev => ({ ...prev, [field]: "fading" }));
    setTimeout(() => {
      setRed(prev => ({ ...prev, [field]: false }));
    }, 200);
  };

  const triggerShake = () => {
    setShakeRules(true);
    setTimeout(() => setShakeRules(false), 600);
  };

  // ── Button click: jiggle all empty fields ─────────────────
  const handleButtonClick = () => {
    const emptyFields = [];
    if (!email.trim())        emptyFields.push("email");
    if (!password)            emptyFields.push("password");
    if (!confirmPassword)     emptyFields.push("confirm");

    if (emptyFields.length > 0) {
      triggerJiggle(emptyFields);
      return;
    }

    if (!allRulesPassed || !passwordsMatch) {
      setPwTouched(true);
      triggerShake();
      if (!allRulesPassed) triggerJiggle(["password"]);
      if (!passwordsMatch) triggerJiggle(["confirm"]);
    }
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim()) {
      triggerJiggle(["email"]);
      setErrorMessage("Email address is required.");
      return;
    }
    if (!password) {
      triggerJiggle(["password"]);
      setErrorMessage("Password is required.");
      return;
    }
    if (!allRulesPassed) {
      setPwTouched(true);
      triggerShake();
      triggerJiggle(["password"]);
      setErrorMessage("Please make sure your password meets all requirements.");
      return;
    }
    if (!confirmPassword) {
      triggerJiggle(["confirm"]);
      setErrorMessage("Please confirm your password.");
      return;
    }
    if (!passwordsMatch) {
      triggerShake();
      triggerJiggle(["confirm"]);
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post("http://127.0.0.1:8000/api/admin/reset-password", {
        email, password, password_confirmation: confirmPassword,
      });
      setSuccess(true);
      setTimeout(() => navigate("/"), 3000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Class helpers ─────────────────────────────────────────
  const wrapClass = (field, extra = "") => {
    let cls = "fp-input-wrap";
    if (jiggle[field])                cls += " field-jiggle";
    else if (red[field] === "active") cls += " field-error";
    else if (red[field] === "fading") cls += " field-fading";
    return cls + extra;
  };

  const iconClass = (field) => {
    let cls = "fp-input-icon";
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
    <div className="fp-page">

      {/* ── Left panel ── */}
      <div className="fp-left">
        <div className="fp-brand">
          <div className="fp-brand-icon">🧠</div>
          <span className="fp-brand-name">GuidanceSCS</span>
        </div>
        <h1 className="fp-headline">Reset your<br /><em>Admin Password</em></h1>
        <p className="fp-sub">
          Enter your registered email address and choose a new secure password
          to regain access to the Student Counseling System.
        </p>
        <div className="fp-steps">
          {[
            { num: "01", text: "Enter your registered email"         },
            { num: "02", text: "Set a new secure password"           },
            { num: "03", text: "Sign in with your new credentials"   },
          ].map(s => (
            <div className="fp-step" key={s.num}>
              <span className="fp-step-num">{s.num}</span>
              <span className="fp-step-text">{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="fp-right">
        <div className="fp-box">

          {success ? (
            /* ── Success screen ── */
            <div className="fp-success">
              <div className="fp-success-icon">✅</div>
              <h2>Password Reset!</h2>
              <p>Your password has been updated successfully.</p>
              <p className="fp-redirect-note">Redirecting you to login in a moment…</p>
              <div className="fp-progress-bar">
                <div className="fp-progress-fill" />
              </div>
            </div>
          ) : (
            <>
              <div className="fp-box-header">
                <h2>Reset Password</h2>
                <p>Fill in the fields below to set a new password</p>
              </div>

              {errorMessage && (
                <div className="fp-error">⚠️ {errorMessage}</div>
              )}

              <form onSubmit={handleSubmit} autoComplete="off" noValidate>
                {/* Honeypot */}
                <input type="text"     style={{ display: "none" }} aria-hidden="true" readOnly />
                <input type="password" style={{ display: "none" }} aria-hidden="true" readOnly />

                {/* ── Email ── */}
                <div className="fp-field">
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
                      placeholder="admin@gmail.com"
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                {/* ── New Password ── */}
                <div className="fp-field">
                  <label className={labelClass("password")}>New Password</label>
                  <div className={wrapClass("password", shakeRules && !allRulesPassed ? " shake-error" : "")}>
                    <span className={iconClass("password")}>🔒</span>
                    <input
                      type="password"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        setPwTouched(true);
                        if (e.target.value) clearRed("password");
                      }}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  {/* Strength bar */}
                  {pwTouched && password.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="pw-strength-bar">
                        {[0,1,2,3].map(i => (
                          <div key={i} className="pw-strength-segment" style={{
                            background: i <= strength.level ? strength.color : "#e2e8f0",
                          }} />
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: strength.color }}>
                          {strength.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Requirements checklist */}
                  <div className="pw-rules-box">
                    <div className="pw-rules-title">PASSWORD REQUIREMENTS</div>
                    {RULES.map(rule => {
                      const state = !pwTouched || password.length === 0
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
                <div className="fp-field">
                  <label className={labelClass("confirm")}>Confirm Password</label>
                  <div className={wrapClass("confirm", shakeRules && !passwordsMatch ? " shake-error" : "")}>
                    <span className={iconClass("confirm")}>🔑</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value);
                        setCfmTouched(true);
                        if (e.target.value) clearRed("confirm");
                      }}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  {/* Match indicator */}
                  {cfmTouched && confirmPassword.length > 0 && (
                    <div className={`pw-match-box ${passwordsMatch ? "match" : "mismatch"}`}>
                      <div className={`pw-match-icon ${passwordsMatch ? "match" : "mismatch"}`}>
                        {passwordsMatch ? "✓" : "✗"}
                      </div>
                      <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
                    </div>
                  )}
                </div>

                {/* Sign in link */}
                <p className="fp-footer-note" style={{ marginBottom: 14 }}>
                  Remembered your password?{" "}
                  <Link to="/" className="fp-login-link">Sign in here</Link>
                </p>

                <button
                  type="submit"
                  className="fp-btn"
                  onClick={handleButtonClick}
                  style={{
                    opacity: loading ? 0.7 : 1,
                    cursor:  loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;