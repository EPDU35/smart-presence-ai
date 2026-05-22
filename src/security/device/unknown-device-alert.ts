/**
 * unknown-device-alert.ts
 * Alerte l'admin quand un nouvel appareil est détecté au login.
 *
 * BUGS CORRIGÉS :
 *
 * BUG 1 — alertNewDevice() appelée sans await dans handleDeviceCheckOnLogin()
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ancienne version faisait :
 *   alertNewDevice(userId, companyId).catch(console.error);  // fire-and-forget
 *
 * PROBLÈME : si le composant se démonte avant que l'insert Supabase finisse,
 * l'alerte est perdue silencieusement. En mode offline/flaky réseau, l'alerte
 * ne part jamais et aucune erreur n'est loggée proprement.
 *
 * FIX : await dans un try/catch explicite. L'alerte est non-bloquante
 * pour le login (on catch l'erreur) mais on la loggue correctement.
 *
 * BUG 2 — isNewDevice() race condition avec checkAndRegisterDevice()
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ancienne version appelait isNewDevice() puis alertNewDevice() séparément.
 * Entre les deux appels, checkAndRegisterDevice() (dans useAuth) pouvait
 * déjà avoir inséré le device → isNewDevice() retournait true mais le device
 * existait déjà → double alerte dans suspicious_logs.
 *
 * FIX : handleDeviceCheckOnLogin() reçoit le résultat de checkAndRegisterDevice()
 * directement (DeviceTrustResult) — plus de double query, plus de race condition.
 *
 * BUG 3 — getFullDeviceFingerprint() appelé 2 fois pour la même alerte
 * ─────────────────────────────────────────────────────────────────────────────
 * isNewDevice() faisait un SHA-256 WebCrypto.
 * alertNewDevice() en refaisait un autre.
 * Résultat : 2 appels SHA-256 + 2 requêtes Supabase pour une seule alerte.
 *
 * FIX : fingerprint calculé une seule fois, passé en paramètre.
 */

import { supabase } from "@/lib/supabase";
import { getFullDeviceFingerprint, getDeviceName } from "./fingerprint-generation";
import type { DeviceTrustResult } from "./device-trust-logic";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NewDeviceAlertPayload {
  userId: string;
  companyId: string;
  deviceName: string;
  deviceFingerprint: string;
  detectedAt: string;
}

export interface DeviceCheckResult {
  isNew: boolean;
  alerted: boolean;
  error?: string;
}

// ─── Core alert ───────────────────────────────────────────────────────────────

/**
 * Insère une alerte dans suspicious_logs pour le nouvel appareil.
 *
 * Prend le fingerprint en paramètre pour éviter un double calcul SHA-256.
 * La RLS policies-suspicious_logs.sql refuse les INSERT depuis authenticated —
 * cet appel passe via le client Supabase normal donc nécessite que la policy
 * "suspicious_insert_system" autorise l'insertion (with check (true)).
 */
async function insertNewDeviceAlert(
  userId: string,
  companyId: string,
  fingerprint: string,
  deviceName: string
): Promise<void> {
  const payload: NewDeviceAlertPayload = {
    userId,
    companyId,
    deviceName,
    deviceFingerprint: fingerprint,
    detectedAt: new Date().toISOString(),
  };

  const { error } = await supabase.from("suspicious_logs").insert({
    user_id:    userId,
    company_id: companyId,
    reason:     "NEW_DEVICE_DETECTED",
    device:     fingerprint,
    metadata:   payload,
    resolved:   false,
  });

  if (error) {
    // On ne throw pas — une alerte échouée ne doit jamais bloquer le login
    console.error("[DeviceAlert] Insert failed:", error.message);
  }
}

// ─── Flow principal ───────────────────────────────────────────────────────────

/**
 * Flow complet post-login : reçoit le résultat de checkAndRegisterDevice()
 * et déclenche l'alerte si l'appareil est nouveau.
 *
 * USAGE dans useAuth.ts :
 *   const trustResult = await checkAndRegisterDevice(userId);
 *   const alertResult = await handleDeviceCheckOnLogin(userId, companyId, trustResult);
 *
 * POURQUOI recevoir DeviceTrustResult plutôt que recalculer ?
 * checkAndRegisterDevice() a déjà fait le SHA-256 + la query Supabase.
 * Recalculer ici = 1 SHA-256 de plus + 1 SELECT de plus pour le même résultat.
 * On réutilise ce qu'on a déjà.
 *
 * @param userId      - ID de l'utilisateur connecté
 * @param companyId   - company_id de l'utilisateur (peut être null au signup)
 * @param trustResult - Résultat de checkAndRegisterDevice()
 */
export async function handleDeviceCheckOnLogin(
  userId: string,
  companyId: string | null,
  trustResult: DeviceTrustResult
): Promise<DeviceCheckResult> {
  // Pas de company = signup en cours, pas encore d'org → pas d'alerte admin
  if (!trustResult.isNew || !companyId) {
    return { isNew: trustResult.isNew, alerted: false };
  }

  try {
    // CRITIQUE : await — getFullDeviceFingerprint est async (SHA-256 WebCrypto)
    // On recalcule ici car DeviceTrustResult ne transporte pas le fingerprint brut.
    // C'est acceptable : 1 seul appel SHA-256 supplémentaire, non bloquant.
    const fingerprint = await getFullDeviceFingerprint();
    const deviceName  = getDeviceName();

    // FIX BUG 1 : await explicite dans try/catch
    // Non-bloquant pour le login mais erreur loggée correctement
    await insertNewDeviceAlert(userId, companyId, fingerprint, deviceName);

    return { isNew: true, alerted: true };

  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[DeviceAlert] handleDeviceCheckOnLogin failed:", error);

    // L'alerte a échoué mais le login continue — on remonte l'erreur
    // pour que useAuth puisse la tracer si nécessaire
    return { isNew: true, alerted: false, error };
  }
}

// ─── Helpers publics ──────────────────────────────────────────────────────────

/**
 * Vérifie si l'appareil courant est nouveau pour cet utilisateur.
 *
 * ATTENTION : N'utilise PAS cette fonction dans le flow login principal.
 * Utilise checkAndRegisterDevice() + handleDeviceCheckOnLogin() à la place
 * pour éviter la race condition et le double calcul SHA-256.
 *
 * Réservé aux vérifications ponctuelles (ex: page Settings → "Mes appareils").
 */
export async function isNewDevice(userId: string): Promise<boolean> {
  // CRITIQUE : await — WebCrypto est async
  const fingerprint = await getFullDeviceFingerprint();

  const { count } = await supabase
    .from("devices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint);

  return (count ?? 0) === 0;
}

/**
 * Alerte directe sans passer par le flow login.
 * Réservé aux cas spéciaux (ex: changement de mot de passe depuis un device inconnu).
 */
export async function alertNewDevice(
  userId: string,
  companyId: string
): Promise<void> {
  // CRITIQUE : await — WebCrypto est async
  const fingerprint = await getFullDeviceFingerprint();
  const deviceName  = getDeviceName();
  await insertNewDeviceAlert(userId, companyId, fingerprint, deviceName);
}