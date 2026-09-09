import { useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { AdminPanel } from "@/features/timesheet/components/admin-panel";
import { EmployeePanel } from "@/features/timesheet/components/employee-panel";

export default function TimeSheetPage(): JSX.Element {
  const { user } = useAuth();
  const [view, setView] = useState<"self" | "admin">(
    user?.is_admin ? "admin" : "self",
  );

  return (
    <div className="timesheet-scope theme-surfaces">
      {user?.is_admin && view === "admin" ? (
        <AdminPanel onOpenSelf={() => setView("self")} />
      ) : (
        <EmployeePanel
          onOpenAdmin={user?.is_admin ? () => setView("admin") : undefined}
        />
      )}
    </div>
  );
}
