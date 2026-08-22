import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";
import HomePage from "./pages/HomePage";
import DepartmentPage from "./pages/DepartmentPage";
import FormPage from "./pages/FormPage";
import LoginPage from "./pages/LoginPage";
import MyRequestsPage from "./pages/MyRequestsPage";
import MyTasksPage from "./pages/MyTasksPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ProfilePage from "./pages/ProfilePage";
import TimeSheetPage from "./pages/TimeSheetPage";
import InternalChatPage from "./pages/InternalChatPage";
import PdfFormsPage from "./pages/PdfFormsPage";
import PdfLibraryPage from "./pages/PdfLibraryPage";
import MyCalendarPage from "./pages/MyCalendarPage";

import ReportsHome from "./pages/reports/ReportsHome";
import PerformanceReports from "./pages/reports/PerformanceReports";
import ContractsArchiveHome from "./pages/contracts/ContractsArchiveHome";
import ContractReportForm from "./pages/contracts/ContractReportForm";
import ContractList from "./pages/contracts/ContractList";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminDutiesPage from "./pages/admin/AdminDutiesPage";
import AdminSessionsPage from "./pages/admin/AdminSessionsPage";
import AdminBannerPage from "./pages/admin/AdminBannerPage";
import ManagementWorkflowHome from "./pages/management/ManagementWorkflowHome";
import SendLetterPage from "./pages/management/SendLetterPage";
import LetterReportPage from "./pages/management/LetterReportPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

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
        path="/my-requests"
        element={
          <ProtectedRoute>
            <MyRequestsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-tasks"
        element={
          <ProtectedRoute>
            <MyTasksPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/timesheet"
        element={
          <ProtectedRoute>
            <TimeSheetPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-calendar"
        element={
          <ProtectedRoute>
            <MyCalendarPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/internal-chat"
        element={
          <ProtectedRoute>
            <InternalChatPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pdf-forms"
        element={
          <ProtectedRoute>
            <PdfFormsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/training"
        element={
          <ProtectedRoute>
            <PdfLibraryPage category="training" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/guidelines"
        element={
          <ProtectedRoute>
            <PdfLibraryPage category="guidelines" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <PdfLibraryPage category="documents" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/management-workflow"
        element={<Navigate to="/management-workflow/external" replace />}
      />

      <Route
        path="/management-workflow/send"
        element={<Navigate to="/management-workflow/external/send" replace />}
      />

      <Route
        path="/management-workflow/report"
        element={<Navigate to="/management-workflow/external/report" replace />}
      />

      <Route
        path="/management-workflow/external"
        element={
          <ProtectedRoute>
            <ManagementWorkflowHome letterType="external" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/management-workflow/external/send"
        element={
          <ProtectedRoute>
            <SendLetterPage letterType="external" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/management-workflow/external/report"
        element={
          <ProtectedRoute>
            <LetterReportPage letterType="external" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/management-workflow/internal"
        element={
          <ProtectedRoute>
            <ManagementWorkflowHome letterType="internal" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/management-workflow/internal/send"
        element={
          <ProtectedRoute>
            <SendLetterPage letterType="internal" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/management-workflow/internal/report"
        element={
          <ProtectedRoute>
            <LetterReportPage letterType="internal" />
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

      <Route
        path="/contracts-archive"
        element={
          <ProtectedRoute>
            <ContractsArchiveHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/contracts-archive/submit"
        element={
          <ProtectedRoute>
            <ContractReportForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/contracts-archive/list"
        element={
          <ProtectedRoute>
            <ContractList />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <AdminRoute><AdminDashboardPage /></AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/banner"
        element={
          <ProtectedRoute>
            <AdminRoute><AdminBannerPage /></AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminRoute><AdminUsersPage /></AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/duties"
        element={
          <ProtectedRoute>
            <AdminRoute><AdminDutiesPage /></AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/sessions"
        element={
          <ProtectedRoute>
            <AdminRoute><AdminSessionsPage /></AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
