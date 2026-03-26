import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../css/login.css';

const FIELDS      = ["email", "password"];
const EMPTY_FLAGS = Object.fromEntries(FIELDS.map(f => [f, false]));

function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [message,  setMessage]  = useState('');
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

    setTimeout(() => {
      setJiggle(prev => ({ ...prev, ...Object.fromEntries(fields.map(f => [f, false])) }));
    }, 600);

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
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!email.trim()) {
      triggerJiggle(["email"]);
      setMessage('Email address is required.');
      return;
    }
    if (!password) {
      triggerJiggle(["password"]);
      setMessage('Password is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/admin/login', { email, password });
      localStorage.setItem('admin_token', res.data.token);
      navigate('/appointment-approval', { replace: true });
    } catch (err) {
      // On wrong credentials — jiggle both fields
      triggerJiggle(["email", "password"]);
      setMessage(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Class helpers ──────────────────────────────────────────
  const wrapClass = (field) => {
    let cls = "input-wrap";
    if (jiggle[field])                cls += " field-jiggle";
    else if (red[field] === "active") cls += " field-error";
    else if (red[field] === "fading") cls += " field-fading";
    return cls;
  };

  const iconClass = (field) => {
    let cls = "input-icon";
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
    <div className="login-page">

      {/* ── Left panel ── */}
      <div className="login-left">
        <div className="brand-logo">
          <div className="brand-logo-icon">🧠</div>
          <span className="brand-logo-text">GuidanceSCS</span>
        </div>
        <h1 className="login-left-headline">
          Student Counseling<br /><em>System</em>
        </h1>
        <p className="login-left-sub">A dedicated platform for school counselors.</p>
        <div className="login-left-features">
          {["Manage appointments", "Schedule sessions", "Case notes"].map((f, i) => (
            <div className="login-feature-item" key={i}>
              <span className="feature-dot" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-box">

          <div className="login-box-header">
            <h2>Admin Sign In</h2>
            <p>Enter credentials to access the dashboard</p>
          </div>

          {/* ── Error banner — ON TOP of fields ── */}
          {message && <div className="login-error">⚠️ {message}</div>}

          <form onSubmit={handleLogin} noValidate>

            {/* Email */}
            <div className="login-field">
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
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
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
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-btn"
              onClick={handleButtonClick}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="login-footer-note" style={{ marginTop: 16 }}>
              <Link to="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </p>

          </form>

        </div>
      </div>
    </div>
  );
}

export default Login;