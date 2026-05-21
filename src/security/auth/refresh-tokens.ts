/**
 * refresh-tokens.ts
 * Gestion du refresh automatique des tokens JWT.
 *
 * AVOCAT DU DIABLE :
 * Supabase fait déjà autoRefreshToken: true — pourquoi ce fichier ?
 * 1. autoRefreshToken est best-effort, pas garanti (tab dormante, offline).
 * 2. On veut contrôler le refresh AVANT les actions critiques.
 * 3. On veut détecter les sessions invalidées côté serveur (logout admin).
 * 4. On veut logger les refresh failures pour audit.
 *
 * Ce fichier n'est pas "doublon" de Supabase — c'est une couche de contrôle
 * explicite sur des cas edge que Supabase ne gère pas parfaitement.
 */

import { supabase } from "@/lib/supabase";
import { analyzeTokenStatus } from "./jwt.config";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RefreshResult {
  success: boolean;
  token: string | null;
  reason?: "NO_SESSION" | "REFRESH_FAILED" | "SESSION_REVOKED" | "OK";
}

// ─── Compteur de tentatives ──────────────────────────────────────────────────

// En mémoire — se reset à chaque reload.
// But : éviter la boucle infinie de refresh si Supabase est en panne.
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;
const ATTEMPT_RESET_MS = 60_000; // 1 minute

let attemptResetTimer: ReturnType<typeof setTimeout> | null = null;

function incrementAttempt() {
  refreshAttempts++;
  if (!attemptResetTimer) {
    attemptResetTimer = setTimeout(() => {
      refreshAttempts = 0;
      attemptResetTimer = null;
    }, ATTEMPT_RESET_MS);
  }
}

// ─── Core refresh ────────────────────────────────────────────────────────────

/**
 * Force un refresh du token JWT via Supabase.
 * Utilisé quand on détecte que le token est proche de l'expiration.
 */
export async function refreshToken(): Promise<RefreshResult> {
  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    console.warn("[Auth] Max refresh attempts reached — forcing logout");
    await supabase.auth.signOut();
    return { success: false, token: null, reason: "REFRESH_FAILED" };
  }

  const { data, error } = await supabase.auth.refreshSession();
  incrementAttempt();

  if (error) {
    // Supabase retourne une erreur spécifique si le refresh token est révoqué
    if (error.message?.includes("invalid") || error.message?.includes("expired")) {
      return { success: false, token: null, reason: "SESSION_REVOKED" };
    }
    return { success: false, token: null, reason: "REFRESH_FAILED" };
  }

  if (!data.session) {
    return { success: false, token: null, reason: "NO_SESSION" };
  }

  // Reset counter on success
  refreshAttempts = 0;

  return {
    success: true,
    token: data.session.access_token,
    reason: "OK",
  };
}

/**
 * Refresh conditionnel : ne refresh que si le token en a besoin.
 * À appeler au début des actions sensibles (scan QR, appel Edge Function).
 */
export async function refreshIfNeeded(): Promise<RefreshResult> {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    return { success: false, token: null, reason: "NO_SESSION" };
  }

  const status = analyzeTokenStatus(data.session.access_token);

  if (!status.needsRefresh && !status.expired) {
    // Token encore frais — rien à faire
    return { success: true, token: data.session.access_token, reason: "OK" };
  }

  return await refreshToken();
}

// ─── Listener global ─────────────────────────────────────────────────────────

/**
 * Initialise le listener Supabase pour les changements de session.
 * CRITIQUE : sans ça, une session expirée reste "active" dans useAuthStore.
 *
 * À appeler UNE SEULE FOIS dans useAuthInit() ou App.tsx.
 * Retourne une fonction de cleanup à appeler au unmount.
 */
export function initAuthStateListener(
  onSignIn: (userId: string) => void,
  onSignOut: () => void,
  onTokenRefreshed?: (token: string) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      switch (event) {
        case "SIGNED_IN":
          if (session?.user.id) {
            refreshAttempts = 0; // Reset counter on fresh sign-in
            onSignIn(session.user.id);
          }
          break;

        case "SIGNED_OUT":
          onSignOut();
          break;

        case "TOKEN_REFRESHED":
          if (session?.access_token && onTokenRefreshed) {
            onTokenRefreshed(session.access_token);
          }
          break;

        case "USER_UPDATED":
          // Rôle changé par admin — recharger le profil
          if (session?.user.id) {
            onSignIn(session.user.id);
          }
          break;

        default:
          break;
      }
    }
  );

  // Retourne le cleanup
  return () => subscription.unsubscribe();
}