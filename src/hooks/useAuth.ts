/**
 * useAuth.ts
 * Hooks d'authentification — version complète.
 *
 * PROBLÈMES CORRIGÉS vs l'ancienne version :
 *
 * 1. onAuthStateChange manquait → session expirée restait "active" dans le store.
 *    Un admin désactivant un compte n'avait aucun effet immédiat.
 *
 * 2. Pas de tracker d'inactivité → une session pouvait rester ouverte indéfiniment.
 *
 * 3. Pas de vérification device au login → un appareil inconnu passait sans alerte.
 *
 * 4. useAuthInit et useAuth séparés mais useAuthInit n'était jamais cleanup properly.
 *
 * ARCHITECTURE :
 * - useAuthInit : monté UNE FOIS dans App.tsx — bootstrap + listeners
 * - useAuth : hook léger pour tous les composants — lit le store
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { getCurrentUser, getSession } from "@/services/auth.service";
import { fetchCompany } from "@/services/company.service";
import { initAuthStateListener } from "@/security/auth/refresh-tokens";
import { startInactivityTracker, initVisibilityRefreshCheck } from "@/security/auth/session-management";
import { checkAndRegisterDevice } from "@/security/device/device-trust-logic";
import { supabase } from "@/lib/supabase";

// ─── useAuthInit ─────────────────────────────────────────────────────────────
// À monter UNE SEULE FOIS dans App.tsx
// Gère : bootstrap session, onAuthStateChange, inactivité, visibility refresh

export function useAuthInit() {
  const { setUser, setCompany, setLoading, logout } = useAuthStore();
  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(userId: string) {
      try {
        const profile = await getCurrentUser();
        if (cancelled || !profile) return;

        setUser(profile);

        if (profile.company_id) {
          const company = await fetchCompany(profile.company_id);
          if (!cancelled) setCompany(company);
        }

        // Vérifier et enregistrer le device — CRITIQUE : await correct ici
        try {
          const trustResult = await checkAndRegisterDevice(userId);

          // Nouveau device → log suspicious + alerte (non bloquant)
          if (trustResult.isNew) {
            await supabase.from("suspicious_logs").insert({
              user_id: userId,
              company_id: profile.company_id,
              reason: "NEW_DEVICE_LOGIN",
              device: null,
              metadata: {
                deviceId: trustResult.deviceId,
                status: trustResult.status,
              },
            });
          }
        } catch {
          // Device check ne bloque jamais le login
        }

      } catch (err) {
        console.error("[useAuthInit] loadProfile error:", err);
      }
    }

    async function bootstrap() {
      setLoading(true);
      try {
        const { data } = await getSession();

        if (!data.session) {
          setLoading(false);
          return;
        }

        await loadProfile(data.session.user.id);
      } catch {
        // Pas de session valide
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    // ── onAuthStateChange ──────────────────────────────────────────────────
    // CRITIQUE : sans ce listener, une session expirée reste active dans le store
    const unsubscribeAuth = initAuthStateListener(
      // onSignIn
      async (userId) => {
        await loadProfile(userId);
        setLoading(false);

        // Démarrer le tracker d'inactivité à chaque sign-in
        const stopInactivity = startInactivityTracker();
        cleanupRef.current.push(stopInactivity);
      },
      // onSignOut
      () => {
        logout();
        // Nettoyer tous les listeners
        cleanupRef.current.forEach((fn) => fn());
        cleanupRef.current = [];
      },
    );

    cleanupRef.current.push(unsubscribeAuth);

    // ── Visibility refresh check ───────────────────────────────────────────
    // Gère : onglet laissé ouvert longtemps, token expiré au retour
    const unsubscribeVisibility = initVisibilityRefreshCheck(() => {
      logout();
    });

    cleanupRef.current.push(unsubscribeVisibility);

    return () => {
      cancelled = true;
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    };
  }, []);
}

// ─── useAuth ─────────────────────────────────────────────────────────────────
// Hook léger — lecture seule du store. Pour tous les composants.

export function useAuth() {
  const user            = useAuthStore((s) => s.user);
  const company         = useAuthStore((s) => s.company);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout          = useAuthStore((s) => s.logout);

  return { user, company, isLoading, isAuthenticated, logout };
}

// ─── useRequireAuth ───────────────────────────────────────────────────────────
// Redirige vers /login si pas authentifié. Pour les pages protégées.

export function useRequireAuth(redirectTo = "/login") {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  return { isAuthenticated, isLoading };
}

// ─── useRequireRole ───────────────────────────────────────────────────────────
// Redirige si l'user n'a pas le rôle requis. Pour les pages admin.

export function useRequireRole(
  allowedRoles: string[],
  redirectTo = "/dashboard"
) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, allowedRoles, navigate, redirectTo]);

  const hasAccess = !!user && allowedRoles.includes(user.role);
  return { hasAccess, isLoading };
}
