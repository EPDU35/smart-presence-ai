/**
 * useCheckin.ts — pointage via createCheckin() + validation QR/GPS
 */

import { useState, useCallback } from "react";
import { createCheckin } from "@/database/services/checkin.service";
import { getValidatedPosition } from "@/security/geo/gps-validation";
import { getFullDeviceFingerprint, getDeviceName } from "@/security/device/fingerprint-generation";
import { normalizeQrToken } from "@/utils/qr-token";
import { isOutsideOpeningHours } from "@/utils/attendance-hours";
import { supabase } from "@/lib/supabase";
import type { CheckinStatus } from "@/types";

export interface CheckinResult {
  success: boolean;
  status?: CheckinStatus;
  checkinId?: string;
  distance: number;
  message?: string;
  code?: string;
}

export interface UseCheckinParams {
  companyId: string;
  userId?: string;
  openingTime?: string | null;
  closingTime?: string | null;
}

export interface UseCheckinReturn {
  checkin: (qrToken: string) => Promise<CheckinResult>;
  autoCheckin: () => Promise<CheckinResult>;
  isCheckingIn: boolean;
  error: string | null;
  lastResult: CheckinResult | null;
  reset: () => void;
}

function mapGpsError(reason?: string): string {
  const msgs: Record<string, string> = {
    GPS_NOT_SUPPORTED: "GPS non supporté sur cet appareil",
    GPS_PERMISSION_DENIED: "Permission GPS refusée — activez la localisation",
    GPS_ACCURACY_TOO_LOW: "Signal GPS trop faible",
    GPS_INVALID_COORDINATES: "Coordonnées GPS invalides",
    GPS_POSITION_UNAVAILABLE: "Position GPS indisponible",
    GPS_TIMEOUT: "Timeout GPS — réessayez",
  };
  return msgs[reason ?? ""] ?? "Erreur GPS inconnue";
}

function mapCheckinError(message: string): CheckinResult {
  let code = "CHECKIN_FAILED";
  if (message.includes("expir") || message.includes("remplacé")) code = "TOKEN_EXPIRED";
  else if (message.includes("déjà")) code = "ALREADY_CHECKED_IN";
  else if (message.includes("QR") || message.includes("inconnu")) code = "INVALID_TOKEN";
  return { success: false, distance: 0, code, message };
}

export function useCheckin(params?: UseCheckinParams): UseCheckinReturn {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);

  const performCheckin = useCallback(
    async (qrToken: string): Promise<CheckinResult> => {
      const userId = params?.userId;
      if (!userId) {
        return { success: false, distance: 0, code: "NOT_AUTHENTICATED", message: "Session expirée" };
      }

      const gpsResult = await getValidatedPosition();
      if (!gpsResult.valid) {
        return { success: false, distance: 0, code: gpsResult.reason, message: mapGpsError(gpsResult.reason) };
      }
      const { latitude, longitude } = gpsResult;
      if (latitude == null || longitude == null) {
        return { success: false, distance: 0, code: "GPS_INVALID", message: "Coordonnées GPS invalides" };
      }

      const deviceInfo = JSON.stringify({
        name: getDeviceName(),
        fingerprint: (await getFullDeviceFingerprint().catch(() => "unknown")).slice(0, 16),
      });

      try {
        const inserted = await createCheckin(
          userId,
          {
            qrToken: normalizeQrToken(qrToken),
            latitude,
            longitude,
            deviceInfo,
          },
          { companyId: params?.companyId },
        );

        const outsideHours = isOutsideOpeningHours(new Date(), params?.openingTime, params?.closingTime);
        const message =
          inserted.status === "VALID"
            ? outsideHours
              ? "Présence enregistrée (hors heures d'ouverture)"
              : "Présence enregistrée avec succès"
            : inserted.status === "SUSPICIOUS"
              ? "Présence enregistrée — position à vérifier"
              : "Pointage refusé — hors zone autorisée";

        return {
          success: inserted.status === "VALID",
          status: inserted.status,
          checkinId: inserted.id,
          distance: inserted.distance,
          message,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du pointage";
        console.error("[useCheckin]", message);
        return mapCheckinError(message);
      }
    },
    [params?.userId, params?.companyId, params?.openingTime, params?.closingTime],
  );

  const checkin = useCallback(
    async (qrToken: string) => {
      setIsCheckingIn(true);
      setError(null);
      try {
        const result = await performCheckin(qrToken);
        setLastResult(result);
        if (!result.success) setError(result.message ?? "Pointage refusé");
        return result;
      } finally {
        setIsCheckingIn(false);
      }
    },
    [performCheckin],
  );

  const autoCheckin = useCallback(async () => {
    setIsCheckingIn(true);
    setError(null);
    try {
      const companyId = params?.companyId;
      if (!companyId) {
        return { success: false, distance: 0, message: "Aucune entreprise associée" };
      }

      const { data: activeQr } = await supabase
        .from("qr_sessions")
        .select("token")
        .eq("company_id", companyId)
        .eq("active", true)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeQr?.token) {
        const r = { success: false, distance: 0, message: "Aucun QR actif — affichez l'écran QR admin" };
        setLastResult(r);
        setError(r.message);
        return r;
      }

      const result = await performCheckin(activeQr.token);
      setLastResult(result);
      if (!result.success) setError(result.message ?? "Échec");
      return result;
    } finally {
      setIsCheckingIn(false);
    }
  }, [params?.companyId, performCheckin]);

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return { checkin, autoCheckin, isCheckingIn, error, lastResult, reset };
}
