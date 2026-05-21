/**
 * expiration-logic.ts
 * Validation côté client de l'expiration QR.
 *
 * AVOCAT DU DIABLE :
 * L'heure du navigateur peut être manipulée. Cette vérification est
 * une UX guard — la vraie validation d'expiration se fait en Edge Function.
 * Ne jamais faire confiance à ce fichier seul pour la sécurité.
 */

import { QR_TOKEN_TTL_MS } from "./token-generation";

export interface ExpirationStatus {
  expired: boolean;
  remainingMs: number;
  remainingPercent: number; // 0-100, utile pour l'UI
}

/**
 * Vérifie si un token QR est expiré côté client.
 * @param expiresAt - ISO string de l'expiration (champ expires_at en base)
 */
export function checkTokenExpiration(expiresAt: string): ExpirationStatus {
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const remainingMs = Math.max(0, expiryTime - now);
  const expired = remainingMs === 0;

  return {
    expired,
    remainingMs,
    remainingPercent: Math.round((remainingMs / QR_TOKEN_TTL_MS) * 100),
  };
}

/**
 * Retourne le nombre de secondes restantes, arrondi.
 */
export function getRemainingSeconds(expiresAt: string): number {
  return Math.ceil(checkTokenExpiration(expiresAt).remainingMs / 1000);
}

/**
 * Calcule l'heure d'expiration d'un nouveau token à partir de maintenant.
 */
export function computeExpiresAt(ttlMs = QR_TOKEN_TTL_MS): string {
  return new Date(Date.now() + ttlMs).toISOString();
}

/**
 * Vérifie si un token est dans sa fenêtre valide (pas encore expiré,
 * pas émis dans le futur — protection contre horloge avancée).
 */
export function isTokenInValidWindow(expiresAt: string): boolean {
  const expiry = new Date(expiresAt).getTime();
  const created = expiry - QR_TOKEN_TTL_MS;
  const now = Date.now();

  // Token ne doit pas être du futur (tolérance 2s pour clock skew)
  if (created > now + 2_000) return false;
  // Token ne doit pas être expiré
  if (now >= expiry) return false;

  return true;
}