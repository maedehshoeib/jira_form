import { AdminPanel } from "../features/timesheet/components/admin-panel";
import { EmployeePanel } from "../features/timesheet/components/employee-panel";
import { useAuth } from "../context/AuthContext";

export default function TimeSheetPage(): JSX.Element {
  const { user } = useAuth();
  const isTimesheetAdmin =
    user?.is_admin && user.username.toLocaleLowerCase() === "vosouq.admin";

  return (
    <div className="timesheet-scope">
      {isTimesheetAdmin ? <AdminPanel /> : <EmployeePanel />}
    </div>
  );
}
