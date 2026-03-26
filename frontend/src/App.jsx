import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Registration/Login.jsx';
import SignUp from './Registration/SignUp.jsx';
import ForgotPassword from './Registration/ForgotPassword.jsx';
import SetupProfile from './pages/SetupProfile.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CounselingRequest from './pages/Counselingrequest.jsx';
import CounselingRecords from './pages/CounselingRecords.jsx';
import CounselingHistory from './pages/Counselinghistory.jsx';
import Messages from './pages/Messages.jsx';
import Profile from './pages/Profile.jsx';

// Pages without sidepanel (auth pages)
import WithoutSidepanel from './components/WithoutSidepanel.jsx';
// Pages with sidepanel
import LayoutWithSidepanel from './components/Layoutwithsidepanel.jsx';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth routes — no sidepanel */}
        <Route element={<WithoutSidepanel />}>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/setup-profile" element={<SetupProfile />} />
        </Route>

        {/* App routes — with sidepanel */}
        <Route element={<LayoutWithSidepanel />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/counseling-request" element={<CounselingRequest />} />
          <Route path="/counseling-records" element={<CounselingRecords />} />
          <Route path="/counseling-history" element={<CounselingHistory />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;