/**
 * protected-routes.tsx
 * Composants de protection des routes par authentification et rôle.
 *
 * AVOCAT DU DIABLE :
 * Les ProtectedRoute côté client sont une UX improvement, pas une sécurité.
 * Un attaquant peut bypass le routing React et accéder à n'importe quelle URL.
 * La vraie sécurité est dans les RLS Supabase + les Edge Functions.
 * Ces composants empêchent les accès accidentels — pas les attaques intentionnelles.
 *
 * USAGE :
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/dashboard" element={<DashboardPage />} />
 * </Route>
 *
 * <Route element={<RoleRoute roles={["ADMIN","SUPER_ADMIN"]} />}>
 *   <Route path="/employees" element={<EmployeesPage />} />
 * </Route>
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Spinner";

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Redirige vers /login si pas authentifié.
// Préserve l'URL cible pour rediriger après login.

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const location        = useLocation();

  if (isLoading) {
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

  if (!isAuthenticated) {
    // Sauvegarder la destination pour rediriger après login
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <Outlet />;
}

// ─── RoleRoute ────────────────────────────────────────────────────────────────
// Redirige vers /dashboard si l'user n'a pas le rôle requis.

interface RoleRouteProps {
  roles: string[];
  redirectTo?: string;
}

export function RoleRoute({ roles, redirectTo = "/dashboard" }: RoleRouteProps) {
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size="md" />
      </div>
    );
  }

  // Pas authentifié du tout → /login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rôle insuffisant → redirectTo (par défaut dashboard)
  if (!roles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

// ─── EmployeeRoute ────────────────────────────────────────────────────────────
// Route réservée aux employés — redirige les admins vers /dashboard

export function EmployeeRoute() {
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size="md" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Les admins ne doivent pas accéder aux pages employés
  if (["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

// ─── PublicOnlyRoute ──────────────────────────────────────────────────────────
// Pour /login et /register — redirige vers /dashboard si déjà connecté.

export function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const user            = useAuthStore((s) => s.user);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size="md" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
