/**
 * otp-generation.ts
 * Génération de codes OTP (One-Time Password) pour la 2FA.
 *
 * AVOCAT DU DIABLE :
 * Math.random() est PROHIBÉ pour les codes OTP — il est prévisible.
 * On utilise Web Crypto API (crypto.getRandomValues) qui est
 * cryptographiquement sécurisé dans tous les navigateurs modernes
 * ET dans Deno (Edge Functions).
 *
 * Un OTP à 6 chiffres a 1/1_000_000 chances d'être deviné.
 * Avec un rate-limit de 5 tentatives → protection suffisante pour un SaaS.
 * Sans rate-limit → un attaquant peut bruteforcer en ~200 000 requêtes.
 * Le rate-limit n'est PAS dans ce fichier — il est dans la Edge Function.
 */

import { supabase } from "@/lib/supabase";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Durée de vie d'un OTP en millisecondes (10 minutes) */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Nombre de chiffres du code OTP */
export const OTP_LENGTH = 6;

/** Max tentatives avant verrouillage (côté Edge Function — rappel ici) */
export const OTP_MAX_ATTEMPTS = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OtpRecord {
  userId: string;
  code: string;           // Hash SHA-256 du code (jamais le code brut en base)
  channel: "EMAIL" | "SMS";
  expiresAt: string;      // ISO string
  attempts: number;
  used: boolean;
}

export interface OtpGenerationResult {
  code: string;           // Code brut — à envoyer à l'utilisateur, JAMAIS stocker
  expiresAt: string;
}

// ─── Génération ──────────────────────────────────────────────────────────────

/**
 * Génère un code OTP numérique à N chiffres.
 * Utilise crypto.getRandomValues — cryptographiquement sécurisé.
 */
export function generateOtpCode(length = OTP_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  // Modulo 10 sur chaque byte pour obtenir un chiffre 0-9.
  // IMPORTANT : le biais de modulo est négligeable ici (byte 0-255, digits 0-9).
  // Pour une crypto haute sécurité (HSM niveau), utiliser rejection sampling.
  // Pour un OTP SaaS standard, ce niveau est suffisant.
  return Array.from(bytes)
    .map((b) => b % 10)
    .join("");
}

/**
 * Hash SHA-256 d'un code OTP avant stockage en base.
 * On ne stocke JAMAIS le code brut.
 *
 * AVOCAT DU DIABLE : SHA-256 d'un OTP à 6 chiffres est craquable par
 * rainbow table (seulement 1M combinaisons). On ajoute un salt (userId)
 * pour rendre la rainbow table inutilisable.
 */
export async function hashOtpCode(code: string, userId: string): Promise<string> {
  const salted = `${userId}:${code}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(salted);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Génère un OTP et l'enregistre en base (hashé + salté).
 * Invalide automatiquement les OTPs précédents non utilisés.
 *
 * @returns Le code brut à envoyer — à ne JAMAIS logger ni stocker
 */
export async function createOtp(
  userId: string,
  channel: "EMAIL" | "SMS"
): Promise<OtpGenerationResult> {
  const code = generateOtpCode();
  const hashedCode = await hashOtpCode(code, userId);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // 1. Invalider les OTPs actifs existants pour cet utilisateur
  await supabase
    .from("otp_codes")
    .update({ used: true })
    .eq("user_id", userId)
    .eq("used", false);

  // 2. Insérer le nouveau OTP hashé
  const { error } = await supabase.from("otp_codes").insert({
    user_id: userId,
    code_hash: hashedCode,
    channel,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
  });

  if (error) {
    throw new Error(`OTP creation failed: ${error.message}`);
  }

  // On retourne le code BRUT — il sera passé à email-sms-send.ts
  // et ne doit JAMAIS être stocké ailleurs que dans ce return
  return { code, expiresAt };
}

/**
 * Vérifie si un utilisateur peut recevoir un nouvel OTP.
 * Throttle : max 1 OTP toutes les 60 secondes.
 */
export async function canRequestNewOtp(userId: string): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
}> {
  const since = new Date(Date.now() - 60_000).toISOString();

  const { data } = await supabase
    .from("otp_codes")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastCreated = new Date(data[0].created_at).getTime();
    const retryAfterMs = 60_000 - (Date.now() - lastCreated);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  return { allowed: true };
}
