/**
 * unknown-device-alert.ts
 * Alerte l'admin et l'utilisateur quand un nouvel appareil est détecté.
 *
 * AVOCAT DU DIABLE :
 * BUG CORRIGÉ — getFullDeviceFingerprint() est async (Web Crypto SHA-256).
 * L'ancienne version l'appelait sans await → fingerprint = "[object Promise]"
 * stocké en base. Résultat : tous les devices apparaissaient comme "nouveaux"
 * à chaque login, et les alertes ne matchaient jamais les entrées existantes.
 * Ce bug silencieux cassait device-trust-logic.ts en entier.
 */

import { supabase } from "@/lib/supabase";
import { getFullDeviceFingerprint, getDeviceName } from "./fingerprint-generation";

export interface NewDeviceAlertPayload {
  userId: string;
  companyId: string;
  deviceName: string;
  deviceFingerprint: string;
  detectedAt: string;
}

/**
 * Crée une alerte dans suspicious_logs pour le nouvel appareil.
 * L'admin verra ça dans son dashboard (unresolved suspicious events).
 */
export async function alertNewDevice(
  userId: string,
  companyId: string
): Promise<void> {
  const deviceName = getDeviceName();
  // CRITIQUE : await obligatoire — getFullDeviceFingerprint est async (SHA-256 WebCrypto)
  const fingerprint = await getFullDeviceFingerprint();

  const payload: NewDeviceAlertPayload = {
    userId,
    companyId,
    deviceName,
    deviceFingerprint: fingerprint,
    detectedAt: new Date().toISOString(),
  };

  await supabase.from("suspicious_logs").insert({
    user_id: userId,
    company_id: companyId,
    reason: "NEW_DEVICE_DETECTED",
    device: fingerprint,
    metadata: payload,
    resolved: false,
  });
}

/**
 * Vérifie si un device est nouveau pour cet utilisateur.
 * Retourne true si aucun device avec cette empreinte n'existe en base.
 */
export async function isNewDevice(userId: string): Promise<boolean> {
  // CRITIQUE : await obligatoire ici aussi
  const fingerprint = await getFullDeviceFingerprint();

  const { count } = await supabase
    .from("devices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint);

  return (count ?? 0) === 0;
}

/**
 * Flow complet : si nouveau device → alerte + enregistrement.
 * À appeler après le login réussi.
 */
export async function handleDeviceCheckOnLogin(
  userId: string,
  companyId: string | null
): Promise<{ isNew: boolean }> {
  const newDevice = await isNewDevice(userId);

  if (newDevice && companyId) {
    // Alerte async — ne bloque pas le login
    alertNewDevice(userId, companyId).catch(console.error);
  }

  return { isNew: newDevice };
}
