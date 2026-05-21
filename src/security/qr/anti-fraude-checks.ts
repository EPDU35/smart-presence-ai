/**
 * anti-fraude-checks.ts
 * Détection de fraude multi-couches côté client.
 *
 * AVOCAT DU DIABLE :
 * Tout ce qui est côté client PEUT être contourné par un attaquant
 * déterminé. Ces checks sont une friction supplémentaire, pas une
 * garantie. La sécurité réelle est dans la Edge Function + RLS.
 * Un fraudeur casual sera bloqué. Un développeur motivé, non.
 */

import { getDeviceFingerprint } from "@/utils/device";
import { supabase } from "@/lib/supabase";

export interface FraudCheckResult {
  suspicious: boolean;
  reasons: string[];
  riskScore: number; // 0-100
}

/**
 * Vérifie si un employé a déjà pointé aujourd'hui avec ce même device.
 * Prévient le "pointage multiple" depuis le même appareil.
 */
export async function checkDuplicateCheckinToday(
  userId: string,
  companyId: string
): Promise<{ isDuplicate: boolean; lastCheckin?: string }> {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("checkins")
    .select("created_at, device_info")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "VALID")
    .gte("created_at", `${today}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    return { isDuplicate: true, lastCheckin: data[0].created_at };
  }

  return { isDuplicate: false };
}

/**
 * Analyse de vélocité : trop de tentatives en peu de temps = fraude.
 * Règle : max 3 tentatives en 60 secondes par user.
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
 * Vérifie si le device courant est dans la liste des devices de confiance.
 */
export async function isKnownDevice(userId: string): Promise<boolean> {
  const fingerprint = getDeviceFingerprint();

  const { data } = await supabase
    .from("devices")
    .select("trusted")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .single();

  return data?.trusted === true;
}

/**
 * Score de risque global.
 * Agrège tous les checks en un score 0-100.
 * > 70 = log suspicious + alerter admin
 */
export async function computeFraudScore(
  userId: string,
  companyId: string,
  gpsAccuracy: number
): Promise<FraudCheckResult> {
  const reasons: string[] = [];
  let riskScore = 0;

  // Check 1 : duplicate checkin today (+40 pts)
  const { isDuplicate } = await checkDuplicateCheckinToday(userId, companyId);
  if (isDuplicate) {
    reasons.push("DUPLICATE_CHECKIN_TODAY");
    riskScore += 40;
  }

  // Check 2 : trop de tentatives récentes (+35 pts)
  const tooFast = await checkCheckinVelocity(userId);
  if (tooFast) {
    reasons.push("VELOCITY_EXCEEDED");
    riskScore += 35;
  }

  // Check 3 : GPS trop imprécis > 100m (+20 pts)
  if (gpsAccuracy > 100) {
    reasons.push("GPS_LOW_ACCURACY");
    riskScore += 20;
  }

  // Check 4 : GPS très imprécis > 500m (signe de fake GPS ou VPN) (+30 pts)
  if (gpsAccuracy > 500) {
    reasons.push("GPS_SUSPICIOUSLY_INACCURATE");
    riskScore += 30;
  }

  return {
    suspicious: riskScore >= 50,
    reasons,
    riskScore: Math.min(100, riskScore),
  };
}

/**
 * Log un événement suspect en base.
 */
export async function logSuspiciousEvent(
  userId: string,
  companyId: string,
  reasons: string[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("suspicious_logs").insert({
    user_id: userId,
    company_id: companyId,
    reason: reasons.join(" | "),
    device: getDeviceFingerprint(),
    metadata: { reasons, ...metadata },
    resolved: false,
  });
}