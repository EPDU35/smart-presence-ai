/**
 * jwt.config.ts
 * Configuration JWT pour Smart Presence.
 *
 * AVOCAT DU DIABLE :
 * Supabase gère JWT en interne — tu ne signes pas tes propres tokens.
 * Ce fichier centralise les constantes et helpers pour LIRE et VALIDER
 * les tokens Supabase côté client, pas pour en créer.
 *
 * Ne JAMAIS stocker le JWT_SECRET côté client. Jamais.
 * Ne JAMAIS utiliser le service_role key côté frontend. Jamais.
 * Si tu te poses la question "est-ce que je peux mettre ça dans le .env frontend ?"
 * la réponse est non.
 */

import { supabase } from "@/lib/supabase";

// ─── Constantes ─────────────────────────────────────────────────────────────

/**
 * Durée de vie du JWT Supabase par défaut : 1 heure.
 * Configurable dans le dashboard Supabase → Auth → JWT expiry.
 */
export const JWT_EXPIRY_SECONDS = 3600;

/**
 * Seuil de renouvellement automatique : si le token expire dans moins de
 * REFRESH_THRESHOLD_SECONDS, on force un refresh.
 * Supabase le fait aussi automatiquement (autoRefreshToken: true),
 * mais on vérifie explicitement avant les actions sensibles.
 */
export const REFRESH_THRESHOLD_SECONDS = 300; // 5 minutes

/**
 * Algorithme attendu dans le header JWT Supabase.
 * Supabase utilise HS256. Si jamais ça change → breaking change à détecter.
 */
export const EXPECTED_JWT_ALGORITHM = "HS256";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;           // user_id (UUID)
  email: string;
  role: string;          // "authenticated" ou "anon"
  iat: number;           // issued at (epoch)
  exp: number;           // expires at (epoch)
  app_metadata: {
    provider: string;
    providers: string[];
  };
  user_metadata: {
    role?: "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";
    company_id?: string;
    [key: string]: unknown;
  };
}

export interface TokenStatus {
  valid: boolean;
  expired: boolean;
  expiresInSeconds: number;
  needsRefresh: boolean;
  userId?: string;
  userRole?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Décode le payload d'un JWT sans vérification de signature.
 * SÉCURITÉ : Ne pas faire confiance à ces données pour les décisions critiques —
 * elles viennent du localStorage et peuvent être forgées côté client.
 * La vraie validation est faite par Supabase / RLS côté serveur.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Base64URL → Base64 standard
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Analyse le statut d'un JWT (expiration, besoin de refresh).
 */
export function analyzeTokenStatus(token: string): TokenStatus {
  const payload = decodeJwtPayload(token);

  if (!payload) {
    return {
      valid: false,
      expired: true,
      expiresInSeconds: 0,
      needsRefresh: true,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = payload.exp - now;
  const expired = expiresInSeconds <= 0;
  const needsRefresh = expiresInSeconds < REFRESH_THRESHOLD_SECONDS;

  return {
    valid: !expired,
    expired,
    expiresInSeconds: Math.max(0, expiresInSeconds),
    needsRefresh,
    userId: payload.sub,
    userRole: payload.user_metadata?.role,
  };
}

/**
 * Récupère le token JWT actuel depuis la session Supabase.
 * Retourne null si pas de session.
 */
export async function getCurrentJwt(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Vérifie et rafraîchit le token si nécessaire avant une action sensible.
 * À appeler avant tout appel Edge Function critique.
 */
export async function ensureFreshToken(): Promise<{
  token: string | null;
  refreshed: boolean;
}> {
  const token = await getCurrentJwt();

  if (!token) return { token: null, refreshed: false };

  const status = analyzeTokenStatus(token);

  if (status.needsRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      return { token: null, refreshed: false };
    }
    return { token: data.session.access_token, refreshed: true };
  }

  return { token, refreshed: false };
}