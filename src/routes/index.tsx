/**
 * routes/index.tsx
 * Router principal — utilise useRouteGuard() de protected-routes.ts existant.
 */

import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useRouteGuard } from "@/security/auth/protected-routes";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Spinner";

// Layouts
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PublicLayout }    from "@/components/layouts/PublicLayout";

// Pages publiques
import { LandingPage }  from "@/pages/Landing/LandingPage";
import { PricingPage }  from "@/pages/Pricing/PricingPage";
import { LoginPage }    from "@/pages/Auth/LoginPage";
import { RegisterPage } from "@/pages/Auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/Auth/ForgotPasswordPage";

// Pages authentifiées — Admin
import { DashboardPage }  from "@/pages/Dashboard/DashboardPage";
import { EmployeesPage }  from "@/pages/Employees/EmployeesPage";
import { AttendancePage } from "@/pages/Attendance/AttendancePage";
import { LivePage }       from "@/pages/Live/LivePage";
import { AnalyticsPage }  from "@/pages/Analytics/AnalyticsPage";
import { SettingsPage }   from "@/pages/Settings/SettingsPage";
import { AdminPage }      from "@/pages/Admin/AdminPage";

// Pages Employee
import { CheckinPage } from "@/pages/Checkin/CheckinPage";
import { HistoryPage } from "@/pages/History/HistoryPage";

// 404
import { NotFoundPage } from "@/pages/NotFound/NotFoundPage";

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
          <span className="text-sm font-bold text-white">SP</span>
        </div>
        <Spinner size="md" />
        <p className="text-sm text-slate-500">Chargement...</p>
      </div>
    </div>
  );
}

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Auth requise — redirige vers /login si pas connecté

function ProtectedRoute() {
  const location = useLocation();
  const guard = useRouteGuard({ requireAuth: true });

  if (guard.reason === "LOADING") return <LoadingScreen />;
  if (!guard.allowed) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

// ─── RoleRoute ────────────────────────────────────────────────────────────────
// Rôle requis — redirige vers /dashboard si rôle insuffisant

function RoleRoute({ roles }: { roles: string[] }) {
  const guard = useRouteGuard({
    requireAuth: true,
    requiredRole: roles as ("EMPLOYEE" | "ADMIN" | "SUPER_ADMIN")[],
    fallbackPath: "/dashboard",
  });

  if (guard.reason === "LOADING") return <LoadingScreen />;
  if (!guard.allowed) return <Navigate to={guard.redirectTo} replace />;
  return <Outlet />;
}

// ─── EmployeeRoute ────────────────────────────────────────────────────────────
// Réservé aux EMPLOYEE — redirige les admins vers /dashboard

function EmployeeRoute() {
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return <LoadingScreen />;
  if (!user)     return <Navigate to="/login" replace />;

  if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

// ─── PublicOnlyRoute ──────────────────────────────────────────────────────────
// Login/Register — redirige vers /dashboard si déjà connecté

function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);

  if (isLoading)       return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function AppRouter() {
  return (
    <Routes>

          {/* ── PUBLIC + AUTH PUBLIC ─────────────────────────────────────── */}
          <Route element={<PublicLayout />}>
            <Route path="/"        element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />

            <Route element={<PublicOnlyRoute />}>
              <Route path="/login"             element={<LoginPage />} />
              <Route path="/register"          element={<RegisterPage />} />
              <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
            </Route>
          </Route>

          {/* ── AUTHENTIFIÉ ─────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>

              {/* Tous les rôles */}
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Admin + Manager + Super Admin */}
              <Route element={<RoleRoute roles={["ADMIN", "SUPER_ADMIN"]} />}>
                <Route path="/employees"  element={<EmployeesPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/live"       element={<LivePage />} />
                <Route path="/analytics"  element={<AnalyticsPage />} />
                <Route path="/settings"   element={<SettingsPage />} />
              </Route>

              {/* Super Admin uniquement */}
              <Route element={<RoleRoute roles={["SUPER_ADMIN"]} />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>

            </Route>
          </Route>

          {/* ── EMPLOYEE ────────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<EmployeeRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/checkin" element={<CheckinPage />} />
                <Route path="/history" element={<HistoryPage />} />
              </Route>
            </Route>
          </Route>

          {/* ── REDIRECTS ───────────────────────────────────────────────── */}
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />

          {/* ── 404 ─────────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
  );
}

export const AppRoutes = AppRouter;