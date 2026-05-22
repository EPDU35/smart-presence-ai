/**
 * anti-fraude-checks.ts
 * Détection de fraude multi-couches côté client — version corrigée.
 *
 * BUG CORRIGÉ :
 * L'ancienne version appelait getDeviceFingerprint() (version synchrone de utils/device.ts).
 * Ce fichier utilise maintenant getFullDeviceFingerprint() depuis security/device/
 * qui est async (WebCrypto SHA-256) — donc await requis partout.
 *
 * AVOCAT DU DIABLE :
 * Tout ce qui est côté client PEUT être contourné par un attaquant motivé.
 * Ces checks sont une friction supplémentaire, pas une garantie absolue.
 * La sécurité réelle est dans validate-checkin Edge Function + RLS.
 */

import { getFullDeviceFingerprint } from "@/security/device/fingerprint-generation";
import { supabase } from "@/lib/supabase";

export interface FraudCheckResult {
  suspicious: boolean;
  reasons: string[];
  riskScore: number; // 0-100
}

/**
 * Vérifie si un employé a déjà pointé aujourd'hui.
 */
export async function checkDuplicateCheckinToday(
  userId: string,
  companyId: string
): Promise<{ isDuplicate: boolean; lastCheckin?: string }> {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("checkins")
    .select("created_at")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .in("status", ["PRESENT", "LATE"])
    .gte("created_at", `${today}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    return { isDuplicate: true, lastCheckin: data[0].created_at };
  }
  return { isDuplicate: false };
}

/**
 * Vélocité : max 3 tentatives en 60 secondes.
 */
export async function checkCheckinVelocity(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("checkins")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return (count ?? 0) >= 3;
}

/**
 * Vérifie si le device courant est connu et de confiance.
 * CORRIGÉ : getFullDeviceFingerprint est async — await obligatoire.
 */
export async function isKnownDevice(userId: string): Promise<boolean> {
  // CRITIQUE : await — WebCrypto est async
  const fingerprint = await getFullDeviceFingerprint();

  const { data } = await supabase
    .from("devices")
    .select("trusted")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .single();

  return data?.trusted === true;
}

/**
 * Score de risque global. > 50 = suspect, > 70 = alerte admin.
 */
export async function computeFraudScore(
  userId: string,
  companyId: string,
  gpsAccuracy: number
): Promise<FraudCheckResult> {
  const reasons: string[] = [];
  let riskScore = 0;

  const { isDuplicate } = await checkDuplicateCheckinToday(userId, companyId);
  if (isDuplicate) { reasons.push("DUPLICATE_CHECKIN_TODAY"); riskScore += 40; }

  const tooFast = await checkCheckinVelocity(userId);
  if (tooFast) { reasons.push("VELOCITY_EXCEEDED"); riskScore += 35; }

  if (gpsAccuracy > 100) { reasons.push("GPS_LOW_ACCURACY"); riskScore += 20; }
  if (gpsAccuracy > 500) { reasons.push("GPS_SUSPICIOUSLY_INACCURATE"); riskScore += 30; }

  const knownDevice = await isKnownDevice(userId);
  if (!knownDevice) { reasons.push("UNKNOWN_DEVICE"); riskScore += 15; }

  return {
    suspicious: riskScore >= 50,
    reasons,
    riskScore: Math.min(100, riskScore),
  };
}

/**
 * Log un événement suspect.
 * CORRIGÉ : await getFullDeviceFingerprint().
 */
export async function logSuspiciousEvent(
  userId: string,
  companyId: string,
  reasons: string[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  // CRITIQUE : await — WebCrypto est async
  const fingerprint = await getFullDeviceFingerprint();

  await supabase.from("suspicious_logs").insert({
    user_id: userId,
    company_id: companyId,
    reason: reasons.join(" | "),
    device: fingerprint,
    metadata: { reasons, ...metadata },
    resolved: false,
  });
}
