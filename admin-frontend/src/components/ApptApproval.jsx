import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SidePanel from "./SidePanel";
import "../css/apptApproval.css";

const API = "http://127.0.0.1:8000/api";
const STORAGE_URL = "http://127.0.0.1:8000/storage";

function toHHMM(raw) {
  if (!raw) return "";
  const t = raw.trim();
  if (t.includes("AM") || t.includes("PM")) {
    const [tp, mer] = t.split(" ");
    let [h, m] = tp.split(":");
    h = parseInt(h);
    if (mer === "AM" && h === 12) h = 0;
    if (mer === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  return t;
}

function ApptApproval() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState("All");
  const [fetching, setFetching] = useState(true);
  const [selected, setSelected] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getToken = () => localStorage.getItem("admin_token");

  const getAuthHeaders = () => ({
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    navigate("/", { replace: true });
  };

  useEffect(() => { fetchAppointments(); }, []);

  const fetchAppointments = () => {
    const token = getToken();
    if (!token) { navigate("/", { replace: true }); return; }
    setFetching(true);
    axios.get(`${API}/admin/counseling-requests`, getAuthHeaders())
      .then(res => setAppointments(res.data?.requests || res.data || []))
      .catch(err => { if (err.response?.status === 401) handleLogout(); })
      .finally(() => setFetching(false));
  };

  const openScheduleModal = (appt) => {
    let dateVal = "";
    const rawDate = appt.session_date || appt.date;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d)) dateVal = d.toISOString().split("T")[0];
    }
    const timeVal = toHHMM(appt.session_time || appt.time);
    const modeVal = appt.mode || "Face-to-Face";
    setScheduleModal({
      appt, date: dateVal, time: timeVal, mode: modeVal,
      note: "", origDate: dateVal, origTime: timeVal, origMode: modeVal,
    });
  };

  const scheduleChanged = scheduleModal
    ? scheduleModal.date !== scheduleModal.origDate ||
      scheduleModal.time !== scheduleModal.origTime ||
      scheduleModal.mode !== scheduleModal.origMode
    : false;

  const confirmApproval = async () => {
    if (!scheduleModal) return;
    const { appt, date, time, mode, note } = scheduleModal;
    try {
      await axios.patch(
        `${API}/admin/counseling-requests/${appt.id}/status`,
        { status: "Approved", session_date: date, session_time: time, mode, approval_note: note || null },
        getAuthHeaders()
      );
      setAppointments(prev =>
        prev.map(a =>
          a.id === appt.id
            ? { ...a, status: "Approved", session_date: date, session_time: time, mode, approval_note: note || null }
            : a
        )
      );
      setScheduleModal(null);
      navigate("/schedulesession");
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      else showToast("Failed to approve. Please try again.", "error");
    }
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    try {
      await axios.patch(
        `${API}/admin/counseling-requests/${rejectModal.id}/status`,
        { status: "Rejected", rejection_note: rejectModal.note },
        getAuthHeaders()
      );
      setAppointments(prev =>
        prev.map(a =>
          a.id === rejectModal.id
            ? { ...a, status: "Rejected", rejection_note: rejectModal.note }
            : a
        )
      );
      setRejectModal(null);
      showToast("Request rejected.");
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      else showToast("Failed to reject. Please try again.", "error");
    }
  };

  const deleteAppointment = async (id) => {
    try {
      await axios.delete(`${API}/admin/counseling-requests/${id}`, getAuthHeaders());
      setAppointments(prev => prev.filter(a => a.id !== id));
      setDeleteTarget(null);
      showToast("🗑️ Record deleted.");
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const viewStudentProfile = async (userId) => {
    if (!userId) return;
    setSelected({ _loading: true });
    try {
      const res = await axios.get(`${API}/admin/students/${userId}/profile`, getAuthHeaders());
      setSelected(res.data?.profile || res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      setSelected({ _error: true });
    }
  };

  const formatDate = raw => {
    const d = new Date(raw);
    return isNaN(d) ? raw : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = raw => {
    if (!raw || raw.includes("AM") || raw.includes("PM")) return raw;
    const [h, m] = raw.split(":");
    return `${+h % 12 || 12}:${m} ${+h >= 12 ? "PM" : "AM"}`;
  };

  const getInitials = name =>
    (name || "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  const filtered = filter === "All" ? appointments : appointments.filter(a => a.status === filter);

  const counts = {
    All:      appointments.length,
    Pending:  appointments.filter(a => a.status === "Pending").length,
    Approved: appointments.filter(a => a.status === "Approved").length,
    Rejected: appointments.filter(a => a.status === "Rejected").length,
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    border: "1px solid #dde3f0", fontSize: "0.95rem", boxSizing: "border-box",
  };

  return (
    <div className="admin-home">
      <SidePanel onLogout={handleLogout} />

      <main className="admin-main">
        <div className="page-header">
          <h1>Appointment Approval</h1>
          <p>Review and manage student counseling session requests</p>
        </div>

        <div className="stats-grid">
          {[
            { label: "Total Requests", value: counts.All,      icon: "📋" },
            { label: "Pending",        value: counts.Pending,  icon: "⏳" },
            { label: "Approved",       value: counts.Approved, icon: "✅" },
            { label: "Rejected",       value: counts.Rejected, icon: "❌" },
          ].map((s, i) => (
            <div className="stat-card" key={i}>
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="main-card">
          <div className="card-header-flex">
            <h3 className="card-title">Appointment Requests</h3>
            <div className="filter-tabs">
              {["All", "Pending", "Approved", "Rejected"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`filter-btn ${filter === f ? "active" : ""}`}>
                  {f}{f !== "All" ? ` (${counts[f]})` : ""}
                </button>
              ))}
            </div>
          </div>

          {fetching ? (
            <div className="empty-state"><p>Loading appointments...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No {filter.toLowerCase()} requests found.</p>
            </div>
          ) : (
            <div className="appointment-list">
              {filtered.map(appt => (
                <div key={appt.id} className={`appointment-item ${appt.status === "Pending" ? "highlight" : ""}`}>
                  <div className="item-row-header">
                    <div className="student-info">
                      <div className="avatar-circle">
                        {appt.profile_pic ? (
                          <img
                            src={`${STORAGE_URL}/${appt.profile_pic}`}
                            alt="Student" className="avatar-img"
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                            onError={e => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150"; }}
                          />
                        ) : (
                          <div className="initials-placeholder">{getInitials(appt.student_name || appt.name)}</div>
                        )}
                      </div>
                      <div>
                        <div className="student-name">{appt.student_name || appt.name || "Unknown Student"}</div>
                        <div className="student-meta">
                          ID: {appt.student_id || "—"}{appt.department ? ` · ${appt.department}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="action-meta">
                      <span className={`status-pill ${(appt.status || "pending").toLowerCase()}`}>
                        {appt.status}
                      </span>
                      <button className="view-profile-btn"
                        onClick={() => viewStudentProfile(appt.user_id || appt.student_user_id)}>
                        👤 View Profile
                      </button>
                      {(appt.status === "Cancelled" || appt.status === "Rejected") && (
                        <button
                          onClick={() => setDeleteTarget(appt)}
                          title="Delete this record"
                          style={{
                            background: "none", border: "1px solid #f0c0c0", borderRadius: "6px",
                            color: "#c0392b", padding: "5px 9px", cursor: "pointer", fontSize: "0.85rem",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fdecea"}
                          onMouseLeave={e => e.currentTarget.style.background = "none"}
                        >🗑️</button>
                      )}
                    </div>
                  </div>

                  <div className="session-details">
                    <span>📅 {formatDate(appt.session_date || appt.date)} · {formatTime(appt.session_time || appt.time)}</span>
                    <span>🏷️ {appt.session_type || appt.type}</span>
                    <span>📍 {appt.mode}</span>
                  </div>

                  <div className="reason-box">
                    <strong>Reason:</strong> {appt.reason}
                  </div>

                  {appt.status === "Approved" && appt.approval_note && (
                    <div style={{
                      background: "#f0fdf4", border: "1px solid #bbf7d0",
                      borderLeft: "4px solid #22c55e", borderRadius: "6px",
                      padding: "7px 12px", fontSize: "0.82rem", color: "#14532d", marginTop: 6,
                    }}>
                      💬 <strong>Note sent to student:</strong> {appt.approval_note}
                    </div>
                  )}

                  {appt.status === "Rejected" && appt.rejection_note && (
                    <div style={{
                      background: "#fff5f5", border: "1px solid #fecaca",
                      borderLeft: "4px solid #ef4444", borderRadius: "6px",
                      padding: "7px 12px", fontSize: "0.82rem", color: "#7f1d1d", marginTop: 6,
                    }}>
                      💬 <strong>Rejection note:</strong> {appt.rejection_note}
                    </div>
                  )}

                  {appt.status === "Pending" && (
                    <div className="button-group">
                      <button className="btn-table-confirm" onClick={() => openScheduleModal(appt)}>
                        ✅ Review & Approve
                      </button>
                      <button className="btn-danger" onClick={() => setRejectModal({ id: appt.id, note: "" })}>
                        ❌ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "error" ? "#fee2e2" : "#f0fdf4",
          border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#bbf7d0"}`,
          color: toast.type === "error" ? "#991b1b" : "#14532d",
          padding: "12px 20px", borderRadius: "10px", fontWeight: 600,
          fontSize: "0.9rem", boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Student Profile Modal ── */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {selected._loading ? (
              <div className="modal-state-msg">Loading student profile...</div>
            ) : selected._error ? (
              <div className="modal-state-msg">⚠️ Could not load student profile.</div>
            ) : (
              <>
                <div className="modal-header">
                  {selected.profile_pic ? (
                    <img src={`${STORAGE_URL}/${selected.profile_pic}`} alt="Profile" className="modal-avatar" />
                  ) : (
                    <div className="modal-avatar-placeholder">{getInitials(selected.full_name)}</div>
                  )}
                  <div>
                    <h2 className="modal-name">{selected.full_name || "—"}</h2>
                    <div className="modal-subtext">{selected.department} · Year {selected.year_level}</div>
                    <span className="modal-id-badge">ID: {selected.student_id}</span>
                  </div>
                </div>

                <div className="modal-grid">
                  {[
                    { label: "Email",          value: selected.email },
                    { label: "Phone",          value: selected.phone },
                    // ✅ sex || gender handles both old (gender) and new (sex) column names
                    { label: "Sex",            value: selected.sex || selected.gender },
                    { label: "Course",         value: selected.department },
                    { label: "Guardian",       value: selected.emergency_name },
                    { label: "Guardian Phone", value: selected.emergency_phone },
                  ].map(({ label, value }) => (
                    <div key={label} className="grid-item">
                      <div className="grid-label">{label}</div>
                      <div className="grid-value">{value || "Not provided"}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button className="modal-close-btn" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}

      {/* ── Schedule / Approve Modal ── */}
      {scheduleModal && (
        <div className="modal-overlay" onClick={() => setScheduleModal(null)}>
          <div className="modal-content schedule-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: "1rem" }}>
              {scheduleModal.appt.profile_pic ? (
                <img
                  src={`${STORAGE_URL}/${scheduleModal.appt.profile_pic}`}
                  alt="Student" className="modal-avatar"
                  onError={e => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150"; }}
                />
              ) : (
                <div className="modal-avatar-placeholder" style={{ background: "#1e3a5f" }}>
                  {getInitials(scheduleModal.appt.student_name || scheduleModal.appt.name)}
                </div>
              )}
              <div>
                <h2 className="modal-name">{scheduleModal.appt.student_name || scheduleModal.appt.name || "Student"}</h2>
                <div className="modal-subtext">
                  {scheduleModal.appt.session_type || scheduleModal.appt.type} · {scheduleModal.appt.mode}
                </div>
              </div>
            </div>

            <div style={{
              background: "#f0f4ff", borderLeft: "4px solid #4f6ef7", borderRadius: "6px",
              padding: "10px 14px", marginBottom: "1.2rem", fontSize: "0.85rem", color: "#333",
            }}>
              <strong>📌 Student's Preferred Schedule:</strong><br />
              📅 {formatDate(scheduleModal.appt.session_date || scheduleModal.appt.date)} &nbsp;
              🕐 {formatTime(scheduleModal.appt.session_time || scheduleModal.appt.time)} &nbsp;
              📍 {scheduleModal.appt.mode}
            </div>

            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
              You can keep the student's preferred schedule or change it below before approving.
            </p>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.85rem" }}>
                📅 Confirmed Date
              </label>
              <input type="date" value={scheduleModal.date}
                onChange={e => setScheduleModal(prev => ({ ...prev, date: e.target.value }))}
                style={inputStyle} />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.85rem" }}>
                🕐 Confirmed Time
              </label>
              <input type="time" value={scheduleModal.time}
                onChange={e => setScheduleModal(prev => ({ ...prev, time: e.target.value }))}
                style={inputStyle} />
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.85rem" }}>
                📍 Mode of Session
              </label>
              <select value={scheduleModal.mode}
                onChange={e => setScheduleModal(prev => ({ ...prev, mode: e.target.value }))}
                style={{ ...inputStyle, background: "#fff", cursor: "pointer" }}>
                <option value="Face-to-Face">🏫 Face-to-Face</option>
                <option value="Online">💻 Online</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.85rem" }}>
                💬 Note to Student{" "}
                <span style={{ fontWeight: 400, color: scheduleChanged ? "#d97706" : "#999" }}>
                  {scheduleChanged ? "⚠️ You changed the schedule — recommended" : "(optional)"}
                </span>
              </label>
              <textarea rows={2}
                placeholder="e.g. Your preferred time was unavailable. I've rescheduled to a new slot."
                value={scheduleModal.note}
                onChange={e => setScheduleModal(prev => ({ ...prev, note: e.target.value }))}
                style={{
                  ...inputStyle,
                  border: `1px solid ${scheduleChanged ? "#fcd34d" : "#dde3f0"}`,
                  background: scheduleChanged ? "#fffbeb" : "#fff",
                  resize: "vertical", fontFamily: "inherit", fontSize: "0.88rem",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn-table-confirm"
                style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
                onClick={confirmApproval}
                disabled={!scheduleModal.date || !scheduleModal.time}>
                ✅ Confirm & Approve
              </button>
              <button className="modal-close-btn"
                style={{ flex: 1, padding: "12px", fontSize: "0.95rem" }}
                onClick={() => setScheduleModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "0.5rem" }}>❌</div>
            <h2 className="modal-name" style={{ textAlign: "center", marginBottom: "0.3rem" }}>Reject Request</h2>
            <p style={{ color: "#555", fontSize: "0.85rem", textAlign: "center", marginBottom: "1.2rem" }}>
              Optionally add a note to let the student know why their request was rejected.
            </p>
            <div style={{ marginBottom: "1.4rem" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: 6 }}>
                💬 Reason for Rejection <span style={{ fontWeight: 400, color: "#999" }}>(optional)</span>
              </label>
              <textarea rows={3}
                placeholder='e.g. "Time slot unavailable, please choose another date."'
                value={rejectModal.note}
                onChange={e => setRejectModal(prev => ({ ...prev, note: e.target.value }))}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: "0.9rem" }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={confirmReject} style={{
                flex: 1, padding: "11px", background: "#dc2626", color: "#fff",
                border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "0.95rem",
              }}>❌ Confirm Reject</button>
              <button className="modal-close-btn"
                style={{ flex: 1, padding: "11px", fontSize: "0.95rem" }}
                onClick={() => setRejectModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}
            style={{ maxWidth: "420px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🗑️</div>
            <h2 className="modal-name" style={{ marginBottom: "0.4rem" }}>Delete Record?</h2>
            <p style={{ color: "#555", fontSize: "0.9rem", marginBottom: "0.3rem" }}>
              You are about to permanently delete this{" "}
              <strong style={{ color: "#c0392b" }}>{deleteTarget.status}</strong> request from:
            </p>
            <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1.2rem" }}>
              {deleteTarget.student_name || deleteTarget.name}
            </p>
            <p style={{ fontSize: "0.8rem", color: "#999", marginBottom: "1.5rem" }}>
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => deleteAppointment(deleteTarget.id)} style={{
                flex: 1, padding: "11px", background: "#c0392b", color: "#fff",
                border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "0.95rem",
              }}>Yes, Delete</button>
              <button className="modal-close-btn"
                style={{ flex: 1, padding: "11px", fontSize: "0.95rem" }}
                onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApptApproval;