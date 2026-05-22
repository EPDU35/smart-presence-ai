/**
 * device-trust-logic.ts
 * Gestion de la confiance des appareils.
 *
 * BUG CORRIGÉ (version Yao) :
 * ───────────────────────────
 * Ligne 20 originale :
 *   const fingerprint = getFullDeviceFingerprint();  // MANQUE await
 *
 * getFullDeviceFingerprint() est async (SHA-256 WebCrypto).
 * Sans await → fingerprint = Promise { <pending> }.toString() = "[object Promise]"
 * Stocké en base comme device_fingerprint → tous les devices matchaient "[object Promise]"
 * → le premier device enregistré était marqué "trusted" pour TOUS les utilisateurs.
 * Bug de sécurité critique : n'importe quel device passait comme "connu".
 *
 * Import corrigé :
 * ─────────────────
 * L'ancienne version importait getDeviceName depuis "@/utils/device" (version sync).
 * On importe maintenant depuis "./fingerprint-generation" pour cohérence du module.
 */

import { supabase } from "@/lib/supabase";
import {
  getFullDeviceFingerprint,
  getDeviceName,
} from "./fingerprint-generation";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DeviceTrustStatus = "TRUSTED" | "KNOWN_UNTRUSTED" | "NEW_DEVICE";

export interface DeviceTrustResult {
  status:    DeviceTrustStatus;
  deviceId?: string;
  isNew:     boolean;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Vérifie si l'appareil courant est connu et de confiance pour cet utilisateur.
 * Si l'appareil est nouveau, il est enregistré automatiquement (trusted = false).
 *
 * À appeler après login réussi dans useAuth.ts.
 */
export async function checkAndRegisterDevice(
  userId: string
): Promise<DeviceTrustResult> {
  // CRITIQUE : await obligatoire — SHA-256 WebCrypto est async
  // Sans await → fingerprint = "[object Promise]" → bug de sécurité critique
  const fingerprint = await getFullDeviceFingerprint();
  const deviceName  = getDeviceName();

  // 1. Cherche si le device existe déjà
  const { data: existing } = await supabase
    .from("devices")
    .select("id, trusted")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle(); // maybeSingle au lieu de single — pas d'erreur si absent

  if (existing) {
    // Device connu — mettre à jour last_login
    await supabase
      .from("devices")
      .update({ last_login: new Date().toISOString() })
      .eq("id", existing.id);

    return {
      status:   existing.trusted ? "TRUSTED" : "KNOWN_UNTRUSTED",
      deviceId: existing.id,
      isNew:    false,
    };
  }

  // 2. Nouvel appareil — enregistrer avec trusted = false
  // SÉCURITÉ : trusted = false TOUJOURS à l'INSERT
  const { data: newDevice, error } = await supabase
    .from("devices")
    .insert({
      user_id:            userId,
      device_name:        deviceName,
      device_fingerprint: fingerprint,
      trusted:            false,
      last_login:         new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[DeviceTrust] Insert failed:", error.message);
  }

  return {
    status:   "NEW_DEVICE",
    deviceId: newDevice?.id,
    isNew:    true,
  };
}

/**
 * Vérifie le trust sans enregistrer.
 * Pour les vérifications légères (ex: avant scan QR).
 */
export async function getDeviceTrustStatus(
  userId: string
): Promise<DeviceTrustStatus> {
  // CRITIQUE : await obligatoire
  const fingerprint = await getFullDeviceFingerprint();

  const { data } = await supabase
    .from("devices")
    .select("trusted")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();

  if (!data)        return "NEW_DEVICE";
  if (data.trusted) return "TRUSTED";
  return "KNOWN_UNTRUSTED";
}

/**
 * Marque un appareil comme de confiance.
 * Action admin uniquement — RLS vérifie le rôle côté DB.
 */
export async function trustDevice(deviceId: string): Promise<void> {
  await supabase
    .from("devices")
    .update({ trusted: true })
    .eq("id", deviceId);
}

/**
 * Révoque la confiance (vol, perte, compromission).
 * Action admin uniquement.
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