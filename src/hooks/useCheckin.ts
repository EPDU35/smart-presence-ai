/**
 * useCheckin.ts
 * Hook de check-in — utilise createCheckin() aligné sur le schéma Supabase
 * (qr_token, latitude, longitude, distance, status VALID/INVALID/SUSPICIOUS).
 */

import { useState, useCallback } from "react";
import { createCheckin } from "@/database/services/checkin.service";
import { getValidatedPosition } from "@/security/geo/gps-validation";
import { getFullDeviceFingerprint, getDeviceName } from "@/security/device/fingerprint-generation";
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
  companyLat?: number;
  companyLon?: number;
  radius?: number;
  openingTime?: string | null;
  closingTime?: string | null;
  lateTolerance?: number | null;
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
    GPS_ACCURACY_TOO_LOW: "Signal GPS trop faible — déplacez-vous vers une fenêtre",
    GPS_INVALID_COORDINATES: "Coordonnées GPS invalides",
    GPS_POSITION_UNAVAILABLE: "Position GPS indisponible",
    GPS_TIMEOUT: "Timeout GPS — réessayez en extérieur",
  };
  return msgs[reason ?? ""] ?? "Erreur GPS inconnue";
}

function mapCheckinError(message: string): CheckinResult {
  let code = "CHECKIN_FAILED";
  if (message.includes("Token QR") || message.includes("QR")) code = "INVALID_TOKEN";
  else if (message.includes("expir")) code = "TOKEN_EXPIRED";
  else if (message.includes("déjà")) code = "ALREADY_CHECKED_IN";
  else if (message.includes("consommer") || message.includes("double")) code = "TOKEN_USED";
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
        return {
          success: false,
          distance: 0,
          code: "NOT_AUTHENTICATED",
          message: "Session expirée — reconnectez-vous",
        };
      }

      const gpsResult = await getValidatedPosition();
      if (!gpsResult.valid) {
        const message = mapGpsError(gpsResult.reason);
        return { success: false, distance: 0, code: gpsResult.reason, message };
      }
      const { latitude, longitude } = gpsResult;
      if (latitude == null || longitude == null) {
        return {
          success: false,
          distance: 0,
          code: "GPS_INVALID_COORDINATES",
          message: "Coordonnées GPS invalides",
        };
      }

      const fingerprint = await getFullDeviceFingerprint().catch(() => "unknown");
      const deviceName = getDeviceName();
      const deviceInfo = JSON.stringify({
        name: deviceName,
        fingerprint: fingerprint.slice(0, 16),
        ua: navigator.userAgent.slice(0, 120),
      });

      try {
        const inserted = await createCheckin(userId, {
          qrToken,
          latitude,
          longitude,
          deviceInfo,
        });

        const message =
          inserted.status === "VALID"
            ? "Présence enregistrée avec succès"
            : inserted.status === "SUSPICIOUS"
              ? "Présence enregistrée — position à vérifier"
              : "Pointage enregistré hors zone";

        return {
          success: inserted.status === "VALID" || inserted.status === "SUSPICIOUS",
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
    [params?.userId],
  );

  const checkin = useCallback(
    async (qrToken: string): Promise<CheckinResult> => {
      setIsCheckingIn(true);
      setError(null);
      try {
        const result = await performCheckin(qrToken);
        setLastResult(result);
        if (!result.success) setError(result.message ?? "Pointage refusé");
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inattendue";
        const result: CheckinResult = { success: false, distance: 0, code: "UNEXPECTED_ERROR", message };
        setError(message);
        setLastResult(result);
        return result;
      } finally {
        setIsCheckingIn(false);
      }
    },
    [performCheckin],
  );

  const autoCheckin = useCallback(async (): Promise<CheckinResult> => {
    const result: CheckinResult = {
      success: false,
      distance: 0,
      code: "QR_REQUIRED",
      message: "Le pointage automatique nécessite un QR Code — scannez le code affiché par l'admin",
    };
    setError(result.message ?? "QR Code requis");
    setLastResult(result);
    return result;
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return { checkin, autoCheckin, isCheckingIn, error, lastResult, reset };
}
