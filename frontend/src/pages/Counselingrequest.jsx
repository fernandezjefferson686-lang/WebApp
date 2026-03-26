import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/student.css";

const EMPTY     = { date: "", time: "", type: "Academic Counseling", mode: "Face-to-Face", reason: "" };
const COUNSELOR = " Julie Torreon Maestrado";
const API       = "http://127.0.0.1:8000/api";

function CounselingRequest() {
  const navigate = useNavigate();
  const [form, setForm]         = useState(EMPTY);
  const [requests, setRequests] = useState([]);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError]       = useState("");

  const [resubmitFrom, setResubmitFrom] = useState(null);
  // resubmitFrom = the rejected request being resubmitted

  // ── Ref to scroll to form when re-submitting ──
  const formRef = React.useRef(null);

  const getToken = () => JSON.parse(localStorage.getItem("user"))?.token;

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    axios.get(`${API}/user/counseling-requests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setRequests(res.data?.requests || res.data || []))
      .catch(() => setRequests([]))
      .finally(() => setFetching(false));
  }, []);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Pre-fill form from a rejected request and scroll up ──
  const handleResubmit = (r) => {
    setForm({
      date:   "",
      time:   "",
      type:   r.session_type || r.type || "Academic Stress",
      mode:   r.mode || "Face-to-Face",
      reason: r.reason || "",
    });
    setResubmitFrom(r);
    setError("");
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.date || !form.time || !form.reason) {
      setError("Please fill in all required fields."); return;
    }
    const token = getToken();
    if (!token) { setError("Session expired. Please log in again."); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/user/counseling-requests`, {
        counselor:    COUNSELOR,
        session_date: form.date,
        session_time: form.time,
        session_type: form.type,
        mode:         form.mode,
        reason:       form.reason,
      }, { headers: { Authorization: `Bearer ${token}` } });

      setRequests(prev => [res.data?.request || res.data, ...prev]);
      setForm(EMPTY);
      setResubmitFrom(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      if (err.response?.status === 422) {
        const errs = err.response.data?.errors;
        setError(errs ? Object.values(errs)[0][0] : "Validation error.");
      } else {
        setError("Failed to submit. Please try again.");
      }
    } finally { setLoading(false); }
  };

  const cancelRequest = async id => {
    const token = getToken();
    try {
      await axios.patch(`${API}/user/counseling-requests/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* optimistic */ }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Cancelled" } : r));
  };

  const formatDate = raw => {
    if (!raw) return "—";
    const d = new Date(raw);
    return isNaN(d) ? raw : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const formatTime = raw => {
    if (!raw) return "—";
    if (raw.includes("AM") || raw.includes("PM")) return raw;
    const [h, m] = raw.split(":");
    return `${+h % 12 || 12}:${m} ${+h >= 12 ? "PM" : "AM"}`;
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // ── Split: active (shown here) vs completed (moved to History) ──
  const activeRequests = requests.filter(r => {
    if (r.status !== "Approved") return true; // always show non-approved
    const d = new Date(r.session_date || r.date);
    return isNaN(d) || d >= today; // only show upcoming approved
  });
  const completedCount = requests.filter(r => {
    if (r.status !== "Approved") return false;
    const d = new Date(r.session_date || r.date);
    return !isNaN(d) && d < today;
  }).length;

  const counts = {
    total:    requests.length,
    pending:  requests.filter(r => r.status === "Pending").length,
    approved: requests.filter(r => r.status === "Approved").length,
  };

  return (
    <div>
      <div className="s-page-header">
        <h1>Counseling Request</h1>
        <p>Submit a counseling session request to your school counselor</p>
      </div>

      <div className="s-stats">
        {[
          { label: "Total Requests", value: counts.total,    icon: "📋" },
          { label: "Pending",        value: counts.pending,  icon: "⏳" },
          { label: "Approved",       value: counts.approved, icon: "✅" },
        ].map((s, i) => (
          <div className="s-stat" key={i}>
            <span className="s-stat-icon">{s.icon}</span>
            <div className="s-stat-val">{s.value}</div>
            <div className="s-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Counselor banner */}
      <div className="s-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>JM</div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: "#1e3a5f", fontWeight: 700 }}>
              {COUNSELOR}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>School Counselor · Guidance Office</div>
            <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, marginTop: 2 }}>● Available for sessions</div>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="s-card" ref={formRef}>
        <h3 className="s-card-title">New Session Request</h3>

        {/* Re-submit notice banner */}
        {resubmitFrom && (
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderLeft: "4px solid #f59e0b",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            color: "#78350f",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}>
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>🔄</span>
            <div>
              <strong>Re-submitting a rejected request.</strong> Your session type, mode, and reason
              have been pre-filled. Please choose a <strong>new date and time</strong> before submitting.
              {resubmitFrom.rejection_note && (
                <div style={{ marginTop: 4, color: "#92400e" }}>
                  💬 Counselor's note: <em>"{resubmitFrom.rejection_note}"</em>
                </div>
              )}
            </div>
            <button
              onClick={() => { setForm(EMPTY); setResubmitFrom(null); }}
              style={{
                marginLeft: "auto", background: "none", border: "none",
                cursor: "pointer", color: "#92400e", fontSize: "1rem", flexShrink: 0,
              }}
              title="Cancel re-submit"
            >✕</button>
          </div>
        )}

        {error && (
          <div style={{
            background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8,
            padding: "10px 14px", color: "#991b1b", fontSize: 13, marginBottom: 16,
          }}>⚠️ {error}</div>
        )}

        <form className="s-form" onSubmit={handleSubmit}>
          <div className="s-form-group">
            <label>Counselor</label>
            <input type="text" value={COUNSELOR} readOnly
              style={{ background: "#f8fafc", color: "#1e3a5f", fontWeight: 600, cursor: "not-allowed" }} />
          </div>
          <div className="s-form-group">
            <label>Session Type</label>
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="Academic Counseling">📘 Academic Counseling</option>
              <option value="Personal / Emotional Counseling">💬 Personal / Emotional Counseling</option>
              <option value="Family Counseling">👨‍👩‍👧 Family Counseling</option>
              <option value="Career Counseling">💼 Career Counseling</option>
              <option value="Crisis Intervention">⚠️ Crisis Intervention</option>
            </select>
          </div>
          <div className="s-form-group">
            <label>Preferred Date *</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} required />
          </div>
          <div className="s-form-group">
            <label>Preferred Time *</label>
            <input type="time" name="time" value={form.time} onChange={handleChange} required />
          </div>
          <div className="s-form-group">
            <label>Mode of Session</label>
            <select name="mode" value={form.mode} onChange={handleChange}>
              
              <option>Face-to-Face</option>
              <option>Online</option>
              
            </select>
          </div>
          <div className="s-form-group full">
            <label>Reason / Concern *</label>
            <textarea name="reason" value={form.reason} onChange={handleChange}
              placeholder="Briefly describe what you'd like to discuss..." required />
          </div>
          <div className="s-form-footer">
            <button type="submit" className="s-btn-primary" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </button>
            <button type="button" className="s-btn-outline"
              onClick={() => { setForm(EMPTY); setError(""); setResubmitFrom(null); }}>Clear</button>
          </div>
        </form>
      </div>

      {/* ── My Requests table ── */}
      <div className="s-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <h3 className="s-card-title" style={{ margin: 0 }}>My Requests</h3>

          {/* History nudge — shows when there are completed sessions */}
          {completedCount > 0 && (
            <button
              onClick={() => navigate("/counseling-history")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#f0fdf4", border: "1px solid #86efac",
                borderRadius: 8, padding: "6px 12px",
                fontSize: "0.8rem", fontWeight: 600,
                color: "#16a34a", cursor: "pointer",
              }}
            >
              📚 {completedCount} completed session{completedCount !== 1 ? "s" : ""} → View History
            </button>
          )}
        </div>

        {fetching ? (
          <div className="s-empty"><p style={{ color: "#94a3b8" }}>Loading your requests...</p></div>
        ) : activeRequests.length === 0 ? (
          <div className="s-empty"><div className="s-empty-icon">📭</div><p>No active requests.</p></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="s-table">
              <thead>
                <tr>
                  <th>Counselor</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeRequests.map(r => (
                  <React.Fragment key={r.id}>
                    <tr>
                      <td><strong>{COUNSELOR}</strong></td>
                      <td>{formatDate(r.session_date || r.date)} · {formatTime(r.session_time || r.time)}</td>
                      <td>{r.session_type || r.type}</td>
                      <td>{r.mode}</td>
                      <td>
                        <span className={`s-pill ${(r.status || "pending").toLowerCase()}`}>
                          {r.status === "Rejected" ? "❌ Rejected" :
                           r.status === "Approved" ? "✅ Approved" :
                           r.status === "Cancelled" ? "🚫 Cancelled" :
                           "⏳ " + r.status}
                        </span>
                      </td>
                      <td>
                        {r.status === "Pending" && (
                          <button className="s-btn-sm danger" onClick={() => cancelRequest(r.id)}>
                            Cancel
                          </button>
                        )}
                        {/* ── Re-submit button for Rejected requests ── */}
                        {r.status === "Rejected" && (
                          <button
                            className="s-btn-sm"
                            onClick={() => handleResubmit(r)}
                            style={{
                              background: "#eff6ff",
                              color: "#2563eb",
                              border: "1px solid #bfdbfe",
                              borderRadius: "6px",
                              padding: "5px 10px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🔄 Re-submit
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* ── Approved: confirmed session banner + optional counselor note ── */}
                    {r.status === "Approved" && (
                      <tr>
                        <td colSpan={6} style={{ padding: "0 12px 12px 12px", border: "none" }}>

                          {/* Always show confirmed schedule */}
                          <div style={{
                            background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                            border: "1px solid #86efac",
                            borderLeft: "4px solid #16a34a",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            marginBottom: r.approval_note ? "6px" : 0,
                          }}>
                            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#14532d", marginBottom: 6 }}>
                              🗓️ Your Session is Confirmed!
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "0.83rem", color: "#166534" }}>
                              <span>📅 <strong>Date:</strong> {formatDate(r.session_date || r.date)}</span>
                              <span>🕐 <strong>Time:</strong> {formatTime(r.session_time || r.time)}</span>
                              <span>📍 <strong>Mode:</strong> {r.mode}</span>
                            </div>
                          </div>

                          {/* Only show note if counselor wrote one */}
                          {r.approval_note && (
                            <div style={{
                              background: "#fffbeb",
                              border: "1px solid #fde68a",
                              borderLeft: "4px solid #f59e0b",
                              borderRadius: "6px",
                              padding: "8px 12px",
                              fontSize: "0.82rem",
                              color: "#78350f",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                            }}>
                              <span style={{ fontSize: "1rem", flexShrink: 0 }}>💬</span>
                              <div><strong>Counselor's Note: </strong>{r.approval_note}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* ── Rejection note row ── */}
                    {r.status === "Rejected" && r.rejection_note && (
                      <tr>
                        <td colSpan={6} style={{ padding: "0 12px 12px 12px", border: "none" }}>
                          <div style={{
                            background: "#fff5f5",
                            border: "1px solid #fecaca",
                            borderLeft: "4px solid #ef4444",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            fontSize: "0.82rem",
                            color: "#7f1d1d",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                          }}>
                            <span style={{ fontSize: "1rem", flexShrink: 0 }}>💬</span>
                            <div>
                              <strong>Counselor's Note: </strong>
                              {r.rejection_note}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`s-toast ${saved ? "show" : ""}`}>✅ Request submitted successfully!</div>
    </div>
  );
}

export default CounselingRequest;