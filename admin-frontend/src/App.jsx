import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login/Login";
import ForgotPassword from "./Login/ForgotPassword";
import AdminHome from "./components/AdminHome";
import ApptApproval from "./components/ApptApproval";
import ScheduleSession from "./components/ScheduleSession";
import CaseNotes from "./components/CaseNotes";
import FollowUpStatus from "./components/FollowUpStatus";
import Messages from "./components/Messages";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><AdminHome /></ProtectedRoute>} />
        <Route path="/appointment-approval" element={<ProtectedRoute><ApptApproval /></ProtectedRoute>} />
        <Route path="/schedulesession" element={<ProtectedRoute><ScheduleSession /></ProtectedRoute>} />
        <Route path="/case-notes" element={<ProtectedRoute><CaseNotes /></ProtectedRoute>} />
        <Route path="/follow-up-status" element={<ProtectedRoute><FollowUpStatus /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;