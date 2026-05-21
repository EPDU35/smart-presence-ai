/**
 * otp-validation.ts
 * Validation des codes OTP soumis par l'utilisateur.
 *
 * AVOCAT DU DIABLE :
 * La validation OTP est l'endroit le plus sensible du flow 2FA.
 * Trois attaques classiques :
 *
 * 1. BRUTE FORCE : tester les 1M combinaisons possibles.
 *    → Contre-mesure : rate-limit + verrouillage après N tentatives.
 *
 * 2. TIMING ATTACK : mesurer le temps de réponse pour deviner le code.
 *    → Contre-mesure : comparaison en temps constant (pas de short-circuit).
 *
 * 3. REPLAY ATTACK : réutiliser un code valide intercepté.
 *    → Contre-mesure : single-use (used = true après validation).
 *
 * Ce fichier gère les trois. La validation finale est dans la Edge Function
 * pour être atomique (UPDATE + validation dans la même transaction).
 */

import { supabase } from "@/lib/supabase";
import { hashOtpCode, OTP_MAX_ATTEMPTS } from "./otp-generation";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OtpValidationStatus =
  | "VALID"
  | "INVALID_CODE"
  | "EXPIRED"
  | "ALREADY_USED"
  | "MAX_ATTEMPTS_REACHED"
  | "NOT_FOUND";

export interface OtpValidationResult {
  success: boolean;
  status: OtpValidationStatus;
  attemptsRemaining?: number;
}

// ─── Comparaison en temps constant ───────────────────────────────────────────

/**
 * Comparaison de deux strings en temps constant.
 * Évite les timing attacks (un attaquant ne peut pas mesurer combien
 * de caractères sont corrects en fonction du temps de réponse).
 *
 * AVOCAT DU DIABLE : En JavaScript, cette garantie est approximative —
 * le JIT peut optimiser et casser la constance. La vraie protection
 * contre les timing attacks est dans la Edge Function (Deno/Rust level).
 * Ici, c'est une best practice côté client.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // On fait quand même une boucle pour masquer la longueur
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false; // Toujours false si longueurs différentes
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Valide un code OTP soumis par l'utilisateur.
 *
 * Flow :
 * 1. Récupère le dernier OTP actif en base
 * 2. Vérifie l'expiration
 * 3. Vérifie le nombre de tentatives
 * 4. Compare le hash en temps constant
 * 5. Marque comme utilisé si valide, incrémente les tentatives sinon
 */
export async function validateOtp(
  userId: string,
  submittedCode: string
): Promise<OtpValidationResult> {
  // 1. Récupère le dernier OTP non utilisé
  const { data: otpRecord, error } = await supabase
    .from("otp_codes")
    .select("id, code_hash, expires_at, attempts, used")
    .eq("user_id", userId)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !otpRecord) {
    return { success: false, status: "NOT_FOUND" };
  }

  // 2. Déjà utilisé (double-check, la query filtre déjà)
  if (otpRecord.used) {
    return { success: false, status: "ALREADY_USED" };
  }

  // 3. Expiré
  if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
    return { success: false, status: "EXPIRED" };
  }

  // 4. Trop de tentatives
  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    return { success: false, status: "MAX_ATTEMPTS_REACHED", attemptsRemaining: 0 };
  }

  // 5. Hash du code soumis
  const submittedHash = await hashOtpCode(submittedCode, userId);

  // 6. Comparaison en temps constant
  const isValid = timingSafeEqual(submittedHash, otpRecord.code_hash);

  if (isValid) {
    // Marquer comme utilisé — atomique via update single row
    await supabase
      .from("otp_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    return { success: true, status: "VALID" };
  } else {
    // Incrémenter les tentatives
    const newAttempts = otpRecord.attempts + 1;
    await supabase
      .from("otp_codes")
      .update({ attempts: newAttempts })
      .eq("id", otpRecord.id);

    const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - newAttempts);

    // Si dernière tentative, verrouiller en marquant comme utilisé
    if (attemptsRemaining === 0) {
      await supabase
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpRecord.id);
    }

    return {
      success: false,
      status: attemptsRemaining === 0 ? "MAX_ATTEMPTS_REACHED" : "INVALID_CODE",
      attemptsRemaining,
    };
  }
}

/**
 * Invalide tous les OTPs actifs d'un utilisateur.
 * À appeler après changement de mot de passe ou compromission suspectée.
 */
export async function invalidateAllOtps(userId: string): Promise<void> {
  await supabase
    .from("otp_codes")
    .update({ used: true })
    .eq("user_id", userId)
    .eq("used", false);
}

/**
 * Vérifie si la 2FA est activée pour un utilisateur.
 */
export async function is2faEnabled(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("two_fa_enabled, two_fa_channel")
    .eq("id", userId)
    .single();

  return data?.two_fa_enabled === true;
}

/**
 * Active ou désactive la 2FA pour un utilisateur.
 * L'activation nécessite une validation OTP préalable (déjà faite en amont).
 */
export async function set2faEnabled(
  userId: string,
  enabled: boolean,
  channel: "EMAIL" | "SMS"
): Promise<void> {
  await supabase
    .from("users")
    .update({
      two_fa_enabled: enabled,
      two_fa_channel: enabled ? channel : null,
    })
    .eq("id", userId);
}
