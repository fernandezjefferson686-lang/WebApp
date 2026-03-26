import React, { useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../css/login.css";

const FIELDS      = ["email", "password"];
const EMPTY_FLAGS = Object.fromEntries(FIELDS.map(f => [f, false]));

function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // red: false | "active" | "fading"
  const [jiggle, setJiggle] = useState({ ...EMPTY_FLAGS });
  const [red,    setRed]    = useState({ ...EMPTY_FLAGS });

  const fadeTimers = useRef({});
  const navigate   = useNavigate();

  // ── Jiggle + red + auto-fade after 400ms ──────────────────
  const triggerJiggle = (fields) => {
    fields.forEach(f => {
      if (fadeTimers.current[f]) {
        clearTimeout(fadeTimers.current[f]);
        fadeTimers.current[f] = null;
      }
    });

    setRed(prev    => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, "active"])) }));
    setJiggle(prev => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, true])) }));

    // Stop animation after 600ms
    setTimeout(() => {
      setJiggle(prev => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, false])) }));
    }, 600);

    // AUTO-FADE at 400ms → CSS 0.2s transition → gone at 600ms
    fields.forEach(f => {
      fadeTimers.current[f] = setTimeout(() => {
        setRed(prev => ({ ...prev, [f]: "fading" }));
        setTimeout(() => {
          setRed(prev => ({ ...prev, [f]: false }));
        }, 200);
      }, 400);
    });
  };

  // ── Clear red when user types ─────────────────────────────
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

  // ── Button click: jiggle ALL empty fields at once ─────────
  const handleButtonClick = () => {
    const emptyFields = [];
    if (!email.trim()) emptyFields.push("email");
    if (!password)     emptyFields.push("password");
    if (emptyFields.length > 0) triggerJiggle(emptyFields);
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

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

    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/user/login", { email, password });
      if (res.data.status === "success") {
        localStorage.setItem("user", JSON.stringify({
          ...res.data.user,
          token:             res.data.token,
          profile_completed: res.data.profile_completed,
        }));
        navigate(res.data.profile_completed ? "/dashboard" : "/setup-profile");
      }
    } catch (err) {
      // On wrong credentials — jiggle both fields
      triggerJiggle(["email", "password"]);
      const msg = err.response?.data?.message;
      setError(msg === "Invalid Password"
        ? "Wrong password. Please try again."
        : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  // ── Class helpers ──────────────────────────────────────────
  const wrapClass = (field) => {
    let cls = "auth-input-wrap";
    if (jiggle[field])                cls += " field-jiggle";
    else if (red[field] === "active") cls += " field-error";
    else if (red[field] === "fading") cls += " field-fading";
    return cls;
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
          Your Counseling<br /><em>Journey Starts Here</em>
        </h1>
        <p className="auth-sub">
          Connect with school counselors, request sessions, and manage
          your counseling records — all in one place.
        </p>
        <div className="auth-features">
          {[
            "Request counseling sessions online",
            "Track your appointment status",
            "Access your counseling history",
            "Manage your personal profile",
          ].map((f, i) => (
            <div className="auth-feature" key={i}>
              <span className="auth-dot" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div className="auth-box">

          <div className="auth-box-header">
            <h2>Student Sign In</h2>
            <p>Enter your credentials to access your account</p>
          </div>

          {/* ── Error banner — ON TOP of fields ── */}
          {error && <div className="auth-error">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} autoComplete="off" noValidate>
            {/* Honeypot */}
            <input type="text"     style={{ display: "none" }} aria-hidden="true" readOnly />
            <input type="password" style={{ display: "none" }} aria-hidden="true" readOnly />

            {/* Email */}
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

            {/* Password */}
            <div className="auth-field">
              <label className={labelClass("password")}>Password</label>
              <div className={wrapClass("password")}>
                <span className={iconClass("password")}>🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (e.target.value) clearRed("password");
                  }}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {/* Links row */}
            <div className="auth-extras">
              <span style={{ fontSize: 13, color: "#64748b" }}>
                Don't have an account?{" "}
                <Link to="/signup" className="auth-link">Sign up</Link>
              </span>
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="auth-btn"
              onClick={handleButtonClick}
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="auth-footer">
            For enrolled students of the school only.
          </p>

        </div>
      </div>
    </div>
  );
}

export default Login;