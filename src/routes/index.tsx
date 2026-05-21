import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Spinner";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import logoImage from "@/img/smart_presence_logo.png";

import { LandingPage } from "@/pages/Landing/LandingPage";
import { PricingPage } from "@/pages/Pricing/PricingPage";
import { LoginPage } from "@/pages/Auth/LoginPage";
import { RegisterPage } from "@/pages/Auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/Auth/ForgotPasswordPage";
import { JoinCompanyPage } from "@/pages/Auth/JoinCompanyPage";
import { NotFoundPage } from "@/pages/NotFound/NotFoundPage";
import { DashboardPage } from "@/pages/Dashboard/DashboardPage";
import { EmployeesPage } from "@/pages/Employees/EmployeesPage";
import { CheckinPage } from "@/pages/Checkin/CheckinPage";
import { SettingsPage } from "@/pages/Settings/SettingsPage";
import { AnalyticsPage } from "@/pages/Analytics/AnalyticsPage";
import { AdminPage } from "@/pages/Admin/AdminPage";
import { AttendancePage } from "@/pages/Attendance/AttendancePage";
import { LivePage } from "@/pages/Live/LivePage";
import { HistoryPage } from "@/pages/History/HistoryPage";
import { EmployeeDashboardPage } from "@/pages/Employee/EmployeeDashboardPage";

import { QrKioskPage } from "@/pages/Kiosk/QrKioskPage";

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <img src={logoImage} alt="Smart Presence Logo" className="h-12 w-auto object-contain animate-pulse" />
        <Spinner size="md" />
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Si l'utilisateur n'a pas de company_id, il doit d'abord rejoindre une entreprise
  if (!user?.company_id) return <Navigate to="/join-company" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SmartDashboard() {
  const { user } = useAuthStore();
  if (user?.role === "EMPLOYEE") return <EmployeeDashboardPage />;
  return <DashboardPage />;
}

/**
 * Route spéciale pour /join-company :
 * - Si pas authentifié → /login
 * - Si authentifié + déjà une company → /dashboard
 * - Sinon → affiche la page
 */
function JoinCompanyRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.company_id) return <Navigate to="/dashboard" replace />;
  return <JoinCompanyPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

      {/* Rejoindre une entreprise (authentifié mais sans company) */}
      <Route path="/join-company" element={<JoinCompanyRoute />} />

      {/* App */}
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<ProtectedRoute><SmartDashboard /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
        <Route path="/live" element={<ProtectedRoute><LivePage /></ProtectedRoute>} />
        <Route path="/checkin" element={<ProtectedRoute><CheckinPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/qr-display" element={<ProtectedRoute><QrKioskPage /></ProtectedRoute>} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}