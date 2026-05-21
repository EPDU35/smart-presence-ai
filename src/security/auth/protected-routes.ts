/**
 * protected-routes.ts
 * Utilitaires pour la protection des routes par rôle.
 *
 * AVOCAT DU DIABLE :
 * La protection de route côté React Router est UX, pas sécurité.
 * N'importe qui peut modifier le store Zustand dans la console et
 * "débloquer" une route. La vraie sécurité est dans :
 * 1. RLS Supabase (les données ne sont pas accessibles sans le bon rôle)
 * 2. Edge Functions (les actions ne s'exécutent pas sans le bon rôle)
 *
 * Ce fichier protège l'UX — pas les données.
 * Les données sont protégées par RLS. Toujours.
 */

import type { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppRole = "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";

export interface RouteGuardConfig {
  requiredRole?: AppRole | AppRole[];
  requireCompany?: boolean;   // L'user doit avoir un company_id
  requireAuth?: boolean;      // Défaut : true
  fallbackPath?: string;
}

// ─── Hiérarchie des rôles ────────────────────────────────────────────────────

/**
 * Hiérarchie : SUPER_ADMIN > ADMIN > EMPLOYEE
 * Un ADMIN peut accéder aux routes EMPLOYEE.
 * Un SUPER_ADMIN peut accéder à tout.
 */
const ROLE_HIERARCHY: Record<AppRole, number> = {
  EMPLOYEE: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/**
 * Vérifie si un rôle satisfait le niveau requis.
 */
export function hasRequiredRole(
  userRole: AppRole | null | undefined,
  required: AppRole | AppRole[]
): boolean {
  if (!userRole) return false;

  const requiredRoles = Array.isArray(required) ? required : [required];
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;

  // L'user satisfait si son niveau >= au niveau minimum requis parmi les rôles acceptés
  return requiredRoles.some(
    (role) => userLevel >= (ROLE_HIERARCHY[role] ?? Infinity)
  );
}

// ─── Hook de guard ────────────────────────────────────────────────────────────

export interface GuardResult {
  allowed: boolean;
  reason:
    | "OK"
    | "NOT_AUTHENTICATED"
    | "INSUFFICIENT_ROLE"
    | "MISSING_COMPANY"
    | "LOADING";
  redirectTo: string;
}

/**
 * Hook React — vérifie si l'user courant a accès à une route.
 * À utiliser dans ProtectedRoute component.
 */
export function useRouteGuard(config: RouteGuardConfig): GuardResult {
  const { user, isLoading, isAuthenticated } = useAuthStore((s) => ({
    user: s.user,
    isLoading: s.isLoading,
    isAuthenticated: s.isAuthenticated,
  }));

  const {
    requiredRole,
    requireCompany = false,
    requireAuth = true,
    fallbackPath = "/login",
  } = config;

  // Encore en chargement
  if (isLoading) {
    return { allowed: false, reason: "LOADING", redirectTo: "" };
  }

  // Auth requise
  if (requireAuth && !isAuthenticated) {
    return { allowed: false, reason: "NOT_AUTHENTICATED", redirectTo: fallbackPath };
  }

  // Rôle requis
  if (requiredRole) {
    const userRole = user?.role as AppRole | undefined;
    if (!hasRequiredRole(userRole, requiredRole)) {
      return {
        allowed: false,
        reason: "INSUFFICIENT_ROLE",
        redirectTo: "/dashboard",
      };
    }
  }

  // Company requise (multi-tenant : l'user doit appartenir à une company)
  if (requireCompany && !user?.company_id) {
    return {
      allowed: false,
      reason: "MISSING_COMPANY",
      redirectTo: "/onboarding",
    };
  }

  return { allowed: true, reason: "OK", redirectTo: "" };
}

// ─── Helpers de permission ────────────────────────────────────────────────────

/**
 * Vérifie si l'user courant peut effectuer une action spécifique.
 * Utiliser pour afficher/masquer des éléments UI selon le rôle.
 */
export function usePermission(requiredRole: AppRole | AppRole[]): boolean {
  const userRole = useAuthStore((s) => s.user?.role as AppRole | undefined);
  return hasRequiredRole(userRole, requiredRole);
}

/**
 * Toutes les permissions disponibles dans l'app.
 * Source de vérité des permissions par rôle.
 *
 * IMPORTANT : Synchroniser avec les politiques RLS.
 * Si tu ajoutes une permission ici, la RLS doit la refléter.
 */
export const PERMISSIONS = {
  // Checkins
  VIEW_OWN_CHECKINS: ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"] as AppRole[],
  VIEW_ALL_CHECKINS: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  EXPORT_CHECKINS: ["ADMIN", "SUPER_ADMIN"] as AppRole[],

  // Employés
  VIEW_EMPLOYEES: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  MANAGE_EMPLOYEES: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  DELETE_EMPLOYEES: ["SUPER_ADMIN"] as AppRole[],

  // QR
  GENERATE_QR: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  SCAN_QR: ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"] as AppRole[],

  // Entreprise
  VIEW_COMPANY_SETTINGS: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  EDIT_COMPANY_SETTINGS: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  DELETE_COMPANY: ["SUPER_ADMIN"] as AppRole[],

  // Analytics
  VIEW_ANALYTICS: ["ADMIN", "SUPER_ADMIN"] as AppRole[],

  // Sécurité
  VIEW_SUSPICIOUS_LOGS: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  MANAGE_DEVICES: ["ADMIN", "SUPER_ADMIN"] as AppRole[],
  TRUST_DEVICE: ["ADMIN", "SUPER_ADMIN"] as AppRole[],

  // 2FA
  MANAGE_2FA: ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"] as AppRole[],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Vérifie une permission nommée pour l'user courant.
 */
export function useHasPermission(permission: PermissionKey): boolean {
  const userRole = useAuthStore((s) => s.user?.role as AppRole | undefined);
  return hasRequiredRole(userRole, PERMISSIONS[permission]);
}

// ─── Guard sans hook (pour usage hors React) ─────────────────────────────────

/**
 * Vérification de rôle pure, sans hooks.
 * Utile dans les services, callbacks, utils.
 */
export function checkRolePermission(
  userRole: string | null | undefined,
  required: AppRole | AppRole[]
): boolean {
  return hasRequiredRole(userRole as AppRole | null, required);
}

/**
 * Rendu conditionnel par rôle — wrapper React simple.
 * Usage : <RoleGate role="ADMIN"><AdminButton /></RoleGate>
 */
export function RoleGate({
  role,
  children,
  fallback = null,
}: {
  role: AppRole | AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}): ReactNode {
  const allowed = usePermission(role);
  return allowed ? children : fallback;
}