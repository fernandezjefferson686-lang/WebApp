import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/student.css";

const navItems = [
  { path: "/dashboard",           icon: "🏠", label: "Dashboard" },
  { path: "/profile",             icon: "👤", label: "My Profile" },
  { path: "/counseling-request",  icon: "📋", label: "Counseling Request" },
  { path: "/counseling-history",  icon: "🕐", label: "Counseling History" },
  { path: "/counseling-records",  icon: "📁", label: "Counseling Records" },
  { path: "/messages",            icon: "💬", label: "Messages" },

];

function StudentSidePanel() {
  const [collapsed, setCollapsed]     = useState(false);
  const [profilePic, setProfilePic]   = useState(null);
  const [displayName, setDisplayName] = useState("");
  const location = useLocation();
  const navigate  = useNavigate();

  const user = JSON.parse(localStorage.getItem("user")) || {};

  const formatName = name => {
    if (!name) return "Student";
    const parts = name.trim().split(" ");
    if (parts.length < 2) return name;
    return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
  };

  const getInitials = name => {
    if (!name) return "?";
    return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  // Fetch profile from DB every time the active page changes
  // so the avatar updates immediately after saving a new photo
  useEffect(() => {
    const token = user?.token;
    if (!token) return;

    axios.get("http://127.0.0.1:8000/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        const profile = res.data?.profile;
        setProfilePic(profile?.profile_pic
          ? `http://127.0.0.1:8000/storage/${profile.profile_pic}`
          : null
        );
        setDisplayName(profile?.full_name || user?.name || "");
      })
      .catch(() => {
        setDisplayName(user?.name || "");
      });
  }, [location.pathname]); // re-fetch whenever user navigates

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  const Avatar = ({ size = 36, fontSize = 13 }) =>
    profilePic ? (
      <img
        src={profilePic}
        alt="Profile"
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "2px solid rgba(255,255,255,0.25)",
        }}
        onError={() => setProfilePic(null)}
      />
    ) : (
      <div className="s-avatar" style={{ width: size, height: size, fontSize }}>
        {getInitials(displayName || user.name)}
      </div>
    );

  return (
    <aside className={`s-sidepanel ${collapsed ? "collapsed" : ""}`}>

      {/* ── Brand ── */}
      <div className="s-brand">
        {!collapsed && (
          <div className="s-brand-text">
            <span className="s-brand-name">SCS</span>
            <span className="s-brand-sub">Student Portal</span>
          </div>
        )}
        <button className="s-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* ── User card (expanded) ── */}
      {!collapsed && (
        <div className="s-user-card">
          <Avatar size={38} fontSize={14} />
          <div className="s-user-info">
            <span className="s-user-name">{formatName(displayName || user.name)}</span>
            <span className="s-user-role">Student</span>
          </div>
        </div>
      )}

      {/* ── Mini avatar only (collapsed) ── */}
      {collapsed && (
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <Avatar size={34} fontSize={12} />
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="s-nav">
        {navItems.map(({ path, icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`s-nav-item ${location.pathname === path ? "active" : ""}`}
            title={collapsed ? label : ""}
          >
            <span className="s-nav-icon">{icon}</span>
            {!collapsed && <span className="s-nav-label">{label}</span>}
          </Link>
        ))}
      </nav>

      {/* ── Logout ── */}
      <div className="s-footer">
        <button className="s-logout-btn" onClick={handleLogout}>
          <span className="s-nav-icon">🚪</span>
          {!collapsed && <span className="s-nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export default StudentSidePanel;