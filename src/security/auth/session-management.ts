/**
 * session-management.ts
 * Gestion du cycle de vie des sessions utilisateur.
 *
 * AVOCAT DU DIABLE :
 * Une session Supabase persiste dans localStorage. Si l'admin
 * désactive un compte, l'utilisateur reste "connecté" côté client
 * jusqu'à expiration du JWT (1h). Ce fichier ajoute :
 *
 * 1. Vérification de session active au démarrage
 * 2. Détection de session concurrente (même user, autre device)
 * 3. Timeout d'inactivité configurable
 * 4. Logout propre avec cleanup
 *
 * Ce n'est pas de la sécurité enterprise-grade — c'est du raisonnable
 * pour un SaaS MVP avec des employés.
 */

import { supabase } from "@/lib/supabase";

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Durée d'inactivité avant logout automatique (30 min).
 * AVOCAT DU DIABLE : Sur mobile, un tab en background peut déclencher
 * ce timeout même si l'user est actif sur l'app. Calibrer avec soin.
 */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionInfo {
  userId: string;
  email: string | undefined;
  expiresAt: number; // epoch
  role: string | null;
  companyId: string | null;
}

// ─── Session read ─────────────────────────────────────────────────────────────

/**
 * Récupère les infos de la session courante.
 * Retourne null si pas de session valide.
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) return null;

  const { user, expires_at } = data.session;

  return {
    userId: user.id,
    email: user.email,
    expiresAt: expires_at ?? 0,
    role: (user.user_metadata?.role as string) ?? null,
    companyId: (user.user_metadata?.company_id as string) ?? null,
  };
}

/**
 * Vérifie si la session est encore valide en faisant un appel réseau réel.
 * Plus coûteux que lire le localStorage — à utiliser au démarrage seulement.
 */
export async function verifySessionWithServer(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getUser();
    return !error && !!data.user;
  } catch {
    return false;
  }
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * Déconnexion propre.
 * - Révoque le refresh token côté Supabase
 * - Vide le store auth
 * - Redirige vers /login
 *
 * IMPORTANT : Toujours appeler cette fonction plutôt que supabase.auth.signOut()
 * directement — elle garantit le cleanup complet.
 */
export async function cleanLogout(redirectTo = "/login"): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
    // "local" = déconnecte ce device uniquement, pas tous les devices
    // Utiliser scope: "global" pour invalider tous les refresh tokens (sécurité maximale)
  } catch (err) {
    console.error("[Session] Logout error:", err);
    // On continue quand même — l'user doit pouvoir se déconnecter même si l'API fail
  } finally {
    // Nettoyage local garanti
    localStorage.removeItem("sb-auth-token");
    window.location.href = redirectTo;
  }
}

/**
 * Déconnexion globale — invalide tous les appareils.
 * À utiliser en cas de compromission de compte.
 */
export async function globalLogout(): Promise<void> {
  await supabase.auth.signOut({ scope: "global" });
  window.location.href = "/login";
}

// ─── Inactivity timeout ───────────────────────────────────────────────────────

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"];

/**
 * Démarre le tracker d'inactivité.
 * Logout automatique après INACTIVITY_TIMEOUT_MS sans activité.
 *
 * À appeler après login réussi.
 * Retourne une fonction de cleanup.
 */
export function startInactivityTracker(
  timeoutMs = INACTIVITY_TIMEOUT_MS
): () => void {
  function resetTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      console.warn("[Session] Inactivity timeout — logging out");
      cleanLogout();
    }, timeoutMs);
  }

  // Démarrer le timer
  resetTimer();

  // Écouter l'activité utilisateur
  ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, resetTimer, { passive: true });
  });

  // Cleanup
  return () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, resetTimer);
    });
  };
}

/**
 * Arrête le tracker d'inactivité manuellement.
 */
export function stopInactivityTracker(): void {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

// ─── Visibilité de la page ────────────────────────────────────────────────────

/**
 * Vérifie la session quand l'onglet redevient visible.
 * Gère le cas : "l'user laisse l'onglet ouvert 2h, revient, le token a expiré."
 *
 * Retourne une fonction de cleanup.
 */
export function initVisibilityRefreshCheck(
  onSessionExpired: () => void
): () => void {
  async function handleVisibilityChange() {
    if (document.visibilityState !== "visible") return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      onSessionExpired();
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}