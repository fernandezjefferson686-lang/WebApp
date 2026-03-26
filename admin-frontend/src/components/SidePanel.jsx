import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../css/sidepanel.css";

const navItems = [
  { path: "/dashboard",            icon: "🏠", label: "Dashboard" },
  { path: "/appointment-approval", icon: "✅", label: "Appt. Approval" },
  { path: "/schedulesession",      icon: "📅", label: "Schedule Session" },
  { path: "/case-notes",           icon: "📝", label: "Case Notes" },
  { path: "/follow-up-status",     icon: "🔄", label: "Follow-up Status" },
  { path: "/notifications",        icon: "🔔", label: "Messages" },
];

function SidePanel({ onLogout }) {
  // ✅ Default is FALSE = expanded, not collapsed
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={`sidepanel ${collapsed ? "collapsed" : ""}`}>
      {/* Brand */}
      <div className="sidepanel-brand">
        {!collapsed && (
          <div className="brand-text">
            <span className="brand-name">SCS</span>
            <span className="brand-sub">Admin Portal</span>
          </div>
        )}
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title="Toggle menu"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Nav Links */}
      <nav className="sidepanel-nav">
        {navItems.map(({ path, icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`nav-item ${location.pathname === path ? "active" : ""}`}
            title={collapsed ? label : ""}
          >
            <span className="nav-icon">{icon}</span>
            {!collapsed && <span className="nav-label">{label}</span>}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="sidepanel-footer">
        <button
          className="logout-btn"
          onClick={onLogout}
          title={collapsed ? "Logout" : ""}
        >
          <span className="nav-icon">🚪</span>
          {!collapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export default SidePanel;