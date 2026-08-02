import { AdminPanel } from "../features/timesheet/components/admin-panel";
import { EmployeePanel } from "../features/timesheet/components/employee-panel";
import { useAuth } from "../context/AuthContext";

export default function TimeSheetPage(): JSX.Element {
  const { user } = useAuth();
  return (
    <div className="timesheet-scope">
      {user?.is_admin ? <AdminPanel /> : <EmployeePanel />}
    </div>
  );
}
