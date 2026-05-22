/**
 * routes/index.tsx
 * Router principal — toutes les routes avec protections correctement câblées.
 *
 * ARCHITECTURE :
 * /                     → Landing (public)
 * /pricing              → Pricing (public)
 * /login                → Login (public only — redirige si déjà connecté)
 * /register             → Register (public only)
 *
 * /dashboard            → Dashboard (auth required — admin ou employee selon rôle)
 * /employees            → Employees (ADMIN, SUPER_ADMIN, MANAGER)
 * /attendance           → Attendance (ADMIN, SUPER_ADMIN, MANAGER)
 * /live                 → Live (ADMIN, SUPER_ADMIN, MANAGER)
 * /analytics            → Analytics (ADMIN, SUPER_ADMIN)
 * /settings             → Settings (ADMIN, SUPER_ADMIN)
 * /admin                → Admin (SUPER_ADMIN uniquement)
 *
 * /checkin              → CheckIn (EMPLOYEE uniquement)
 * /history              → History (EMPLOYEE uniquement)
 *
 * *                     → 404
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ProtectedRoute,
  RoleRoute,
  EmployeeRoute,
  PublicOnlyRoute,
} from "@/security/auth/protected-routes";

// Layouts
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PublicLayout }    from "@/components/layouts/PublicLayout";

// Pages publiques
import { LandingPage }  from "@/pages/Landing/LandingPage";
import { PricingPage }  from "@/pages/Pricing/PricingPage";
import { LoginPage }    from "@/pages/Auth/LoginPage";
import { RegisterPage } from "@/pages/Auth/RegisterPage";

// Pages authentifiées — Admin
import { DashboardPage }  from "@/pages/Dashboard/DashboardPage";
import { EmployeesPage }  from "@/pages/Employees/EmployeesPage";
import { AttendancePage } from "@/pages/Attendance/AttendancePage";
import { LivePage }       from "@/pages/Live/LivePage";
import { AnalyticsPage }  from "@/pages/Analytics/AnalyticsPage";
import { SettingsPage }   from "@/pages/Settings/SettingsPage";
import { AdminPage }      from "@/pages/Admin/AdminPage";

// Pages authentifiées — Employee
import { CheckinPage } from "@/pages/Checkin/CheckinPage";
import { HistoryPage } from "@/pages/History/HistoryPage";

// 404
import { NotFoundPage } from "@/pages/NotFound/NotFoundPage";

// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>

          {/* ── PAGES PUBLIQUES ─────────────────────────────────────────── */}
          <Route element={<PublicLayout />}>
            <Route path="/"        element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
          </Route>

          {/* ── AUTH — public only (redirige si déjà connecté) ──────────── */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* ── PAGES AUTHENTIFIÉES ─────────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>

              {/* Dashboard — tous les rôles authentifiés */}
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Admin, Manager, Super Admin */}
              <Route element={<RoleRoute roles={["ADMIN","MANAGER","SUPER_ADMIN"]} />}>
                <Route path="/employees"  element={<EmployeesPage />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/live"       element={<LivePage />} />
              </Route>

              {/* Admin, Super Admin seulement */}
              <Route element={<RoleRoute roles={["ADMIN","SUPER_ADMIN"]} />}>
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings"  element={<SettingsPage />} />
              </Route>

              {/* Super Admin seulement */}
              <Route element={<RoleRoute roles={["SUPER_ADMIN"]} />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>

            </Route>
          </Route>

          {/* ── PAGES EMPLOYEE ──────────────────────────────────────────── */}
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
