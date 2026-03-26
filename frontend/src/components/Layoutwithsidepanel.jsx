import { Outlet } from "react-router-dom";
import StudentSidePanel from "../components/Studentsidepanel.jsx";
import "../css/student.css";

export default function LayoutWithSidepanel() {
  return (
    <div className="s-layout">
      <StudentSidePanel />
      <main className="s-main">
        <Outlet />
      </main>
    </div>
  );
}