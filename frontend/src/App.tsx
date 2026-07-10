import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import HomePage from "./pages/HomePage";
import DepartmentPage from "./pages/DepartmentPage";
import FormPage from "./pages/FormPage";
import LoginPage from "./pages/LoginPage";

import ReportsHome from "./pages/reports/ReportsHome";
import PerformanceReports from "./pages/reports/PerformanceReports";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/departments/:departmentId"
        element={
          <ProtectedRoute>
            <DepartmentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/forms/:formId"
        element={
          <ProtectedRoute>
            <FormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/performance"
        element={
          <ProtectedRoute>
            <PerformanceReports />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
