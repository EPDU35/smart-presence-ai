import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import { getFullDeviceFingerprint, getDeviceName } from "./fingerprint-generation";
import type { DeviceTrustResult } from "./device-trust-logic";

export interface NewDeviceAlertPayload {
  userId: string;
  companyId: string;
  deviceName: string;
  deviceFingerprint: string;
  detectedAt: string;
  [key: string]: Json | undefined; // Index signature requis pour compatibilité Json
}

export interface DeviceCheckResult {
  isNew: boolean;
  alerted: boolean;
  error?: string;
}

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
    metadata:   payload as Json,
    resolved:   false,
  });

  if (error) {
    console.error("[DeviceAlert] Insert failed:", error.message);
  }
}

export async function handleDeviceCheckOnLogin(
  userId: string,
  companyId: string | null,
  trustResult: DeviceTrustResult
): Promise<DeviceCheckResult> {
  if (!trustResult.isNew || !companyId) {
    return { isNew: trustResult.isNew, alerted: false };
  }

  try {
    const fingerprint = await getFullDeviceFingerprint();
    const deviceName  = getDeviceName();
    await insertNewDeviceAlert(userId, companyId, fingerprint, deviceName);
    return { isNew: true, alerted: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[DeviceAlert] handleDeviceCheckOnLogin failed:", error);
    return { isNew: true, alerted: false, error };
  }
}

export async function isNewDevice(userId: string): Promise<boolean> {
  const fingerprint = await getFullDeviceFingerprint();
  const { count } = await supabase
    .from("devices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint);
  return (count ?? 0) === 0;
}

export async function alertNewDevice(
  userId: string,
  companyId: string
): Promise<void> {
  const fingerprint = await getFullDeviceFingerprint();
  const deviceName  = getDeviceName();
  await insertNewDeviceAlert(userId, companyId, fingerprint, deviceName);
}
