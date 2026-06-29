import { Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./pages/HomePage";
import DepartmentPage from "./pages/DepartmentPage";
import FormPage from "./pages/FormPage";

import ReportsHome from "./pages/reports/ReportsHome";
import PerformanceReports from "./pages/reports/PerformanceReports";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/departments/:departmentId"
        element={<DepartmentPage />}
      />

      <Route
        path="/forms/:formId"
        element={<FormPage />}
      />

      <Route
        path="/reports"
        element={<ReportsHome />}
      />

      <Route
        path="/reports/performance"
        element={<PerformanceReports />}
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}