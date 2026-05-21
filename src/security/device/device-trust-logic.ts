/**
 * device-trust-logic.ts
 * Gestion de la confiance des appareils (known/unknown device).
 */

import { supabase } from "@/lib/supabase";
import { getFullDeviceFingerprint } from "./fingerprint-generation";
import { getDeviceName } from "@/utils/device";

export type DeviceTrustStatus = "TRUSTED" | "KNOWN_UNTRUSTED" | "NEW_DEVICE";

export interface DeviceTrustResult {
  status: DeviceTrustStatus;
  deviceId?: string;
  isNew: boolean;
}

/**
 * Vérifie si l'appareil courant est connu et de confiance pour cet utilisateur.
 * Si l'appareil est nouveau, il est enregistré automatiquement (trusted = false).
 */
export async function checkAndRegisterDevice(userId: string): Promise<DeviceTrustResult> {
  const fingerprint = getFullDeviceFingerprint();
  const deviceName = getDeviceName();

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
 * Marque un appareil comme de confiance (action admin ou confirmation utilisateur).
 */
export async function trustDevice(deviceId: string): Promise<void> {
  await supabase.from("devices").update({ trusted: true }).eq("id", deviceId);
}

/**
 * Révoque la confiance d'un appareil (vol, perte, sécurité compromise).
 */
export async function revokeDeviceTrust(deviceId: string): Promise<void> {
  await supabase.from("devices").update({ trusted: false }).eq("id", deviceId);
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