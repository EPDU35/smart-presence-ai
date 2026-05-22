/**
 * device-trust-logic.ts
 * Gestion de la confiance des appareils (known/unknown device).
 *
 * BUG CORRIGÉ :
 * L'ancienne version appelait getFullDeviceFingerprint() sans await.
 * Résultat : fingerprint = "[object Promise]" stocké en base.
 * Tous les devices apparaissaient comme "nouveaux" à chaque login.
 * device-trust = 100% cassé silencieusement.
 *
 * CORRECTION : toutes les fonctions sont async et await correctement.
 */

import { supabase } from "@/lib/supabase";
import { getFullDeviceFingerprint, getDeviceName } from "./fingerprint-generation";

export type DeviceTrustStatus = "TRUSTED" | "KNOWN_UNTRUSTED" | "NEW_DEVICE";

export interface DeviceTrustResult {
  status: DeviceTrustStatus;
  deviceId?: string;
  isNew: boolean;
}

/**
 * Vérifie si l'appareil courant est connu et de confiance pour cet utilisateur.
 * Si l'appareil est nouveau, il est enregistré automatiquement (trusted = false).
 *
 * IMPORTANT : async car getFullDeviceFingerprint() utilise WebCrypto SHA-256.
 */
export async function checkAndRegisterDevice(userId: string): Promise<DeviceTrustResult> {
  // CRITIQUE : await obligatoire — WebCrypto SHA-256 est async
  const fingerprint = await getFullDeviceFingerprint();
  const deviceName  = getDeviceName();

  // 1. Cherche si le device existe déjà
  const { data: existing } = await supabase
    .from("devices")
    .select("id, trusted")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .single();

  if (existing) {
    // Device connu — mettre à jour last_login
    await supabase
      .from("devices")
      .update({ last_login: new Date().toISOString() })
      .eq("id", existing.id);

    return {
      status: existing.trusted ? "TRUSTED" : "KNOWN_UNTRUSTED",
      deviceId: existing.id,
      isNew: false,
    };
  }

  // 2. Nouvel appareil — enregistrer avec trusted = false
  // SÉCURITÉ : trusted = false TOUJOURS à l'INSERT
  // La RLS policies-devices.sql enforce ça côté DB aussi
  const { data: newDevice } = await supabase
    .from("devices")
    .insert({
      user_id: userId,
      device_name: deviceName,
      device_fingerprint: fingerprint,
      trusted: false,
      last_login: new Date().toISOString(),
    })
    .select("id")
    .single();

  return {
    status: "NEW_DEVICE",
    deviceId: newDevice?.id,
    isNew: true,
  };
}

/**
 * Vérifie le device sans l'enregistrer.
 * Utilisé pour les vérifications légères (ex: avant scan QR).
 */
export async function getDeviceTrustStatus(userId: string): Promise<DeviceTrustStatus> {
  // CRITIQUE : await obligatoire
  const fingerprint = await getFullDeviceFingerprint();

  const { data } = await supabase
    .from("devices")
    .select("id, trusted")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();

  if (!data)            return "NEW_DEVICE";
  if (data.trusted)     return "TRUSTED";
  return "KNOWN_UNTRUSTED";
}

/**
 * Marque un appareil comme de confiance.
 * Action réservée à l'ADMIN — vérifiée côté RLS.
 */
export async function trustDevice(deviceId: string): Promise<void> {
  await supabase
    .from("devices")
    .update({ trusted: true })
    .eq("id", deviceId);
}

/**
 * Révoque la confiance d'un appareil (vol, perte, sécurité compromise).
 * Action réservée à l'ADMIN — vérifiée côté RLS.
 */
export async function revokeDeviceTrust(deviceId: string): Promise<void> {
  await supabase
    .from("devices")
    .update({ trusted: false })
    .eq("id", deviceId);
}

/**
 * Liste tous les appareils d'un utilisateur.
 */
export async function getUserDevices(userId: string) {
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", userId)
    .order("last_login", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
