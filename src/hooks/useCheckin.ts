/**
 * useCheckin.ts — pointage QR ou automatique (GPS dans la zone)
 */

import { useState, useCallback } from "react";
import { createCheckin, createAutoCheckinGps } from "@/database/services/checkin.service";
import { getValidatedPosition, isValidCoordinates } from "@/security/geo/gps-validation";
import { getFullDeviceFingerprint, getDeviceName } from "@/security/device/fingerprint-generation";
import { normalizeQrToken } from "@/utils/qr-token";
import { isOutsideOpeningHours } from "@/utils/attendance-hours";
import { haversineDistance } from "@/utils/geo";
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

export interface KnownPosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export interface UseCheckinParams {
  companyId: string;
  userId?: string;
  companyLat?: number;
  companyLon?: number;
  companyRadius?: number;
  openingTime?: string | null;
  closingTime?: string | null;
}

export interface UseCheckinReturn {
  checkin: (qrToken: string) => Promise<CheckinResult>;
  autoCheckin: (knownPosition?: KnownPosition) => Promise<CheckinResult>;
  isCheckingIn: boolean;
  error: string | null;
  lastResult: CheckinResult | null;
  reset: () => void;
}

function mapGpsError(reason?: string): string {
  const msgs: Record<string, string> = {
    GPS_NOT_SUPPORTED: "GPS non supporté sur cet appareil",
    GPS_PERMISSION_DENIED: "Permission GPS refusée — activez la localisation",
    GPS_ACCURACY_TOO_LOW: "Signal GPS trop faible — rapprochez-vous d'une fenêtre",
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
  else if (message.includes("limite") || message.includes("rapprochez")) code = "OUT_OF_RANGE";
  return { success: false, distance: 0, code, message };
}

async function resolveGps(
  known?: KnownPosition,
  companyLat?: number,
  companyLon?: number,
  companyRadius?: number,
): Promise<
  | { ok: true; latitude: number; longitude: number; distance: number }
  | { ok: false; result: CheckinResult }
> {
  if (known && isValidCoordinates(known.latitude, known.longitude)) {
    const distance =
      companyLat != null && companyLon != null
        ? Math.round(haversineDistance(known.latitude, known.longitude, companyLat, companyLon))
        : 0;

    if (companyRadius != null && distance > companyRadius * 1.5) {
      return {
        ok: false,
        result: {
          success: false,
          distance,
          code: "OUT_OF_RANGE",
          message: `Vous êtes à ${distance}m (limite ${companyRadius}m)`,
        },
      };
    }

    return { ok: true, latitude: known.latitude, longitude: known.longitude, distance };
  }

  const gpsResult = await getValidatedPosition();
  if (!gpsResult.valid) {
    return {
      ok: false,
      result: {
        success: false,
        distance: 0,
        code: gpsResult.reason,
        message: mapGpsError(gpsResult.reason),
      },
    };
  }

  const { latitude, longitude } = gpsResult;
  if (latitude == null || longitude == null) {
    return {
      ok: false,
      result: { success: false, distance: 0, code: "GPS_INVALID", message: "Coordonnées GPS invalides" },
    };
  }

  const distance =
    companyLat != null && companyLon != null
      ? Math.round(haversineDistance(latitude, longitude, companyLat, companyLon))
      : 0;

  return { ok: true, latitude, longitude, distance };
}

export function useCheckin(params?: UseCheckinParams): UseCheckinReturn {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null);

  const buildSuccessMessage = useCallback(
    (status: CheckinStatus, outsideHours: boolean) => {
      if (status === "VALID") {
        return outsideHours
          ? "Présence enregistrée automatiquement (hors heures d'ouverture)"
          : "Présence enregistrée avec succès";
      }
      if (status === "SUSPICIOUS") {
        return "Présence enregistrée — position à vérifier";
      }
      return "Pointage refusé — hors zone autorisée";
    },
    [],
  );

  const performCheckin = useCallback(
    async (qrToken: string, known?: KnownPosition): Promise<CheckinResult> => {
      const userId = params?.userId;
      if (!userId) {
        return { success: false, distance: 0, code: "NOT_AUTHENTICATED", message: "Session expirée" };
      }

      const gps = await resolveGps(
        known,
        params?.companyLat,
        params?.companyLon,
        params?.companyRadius,
      );
      if (!gps.ok) return gps.result;

      const deviceInfo = JSON.stringify({
        name: getDeviceName(),
        fingerprint: (await getFullDeviceFingerprint().catch(() => "unknown")).slice(0, 16),
        mode: known ? "auto" : "qr",
      });

      try {
        const inserted = await createCheckin(
          userId,
          {
            qrToken: normalizeQrToken(qrToken),
            latitude: gps.latitude,
            longitude: gps.longitude,
            deviceInfo,
          },
          { companyId: params?.companyId },
        );

        const outsideHours = isOutsideOpeningHours(new Date(), params?.openingTime, params?.closingTime);

        return {
          success: inserted.status === "VALID",
          status: inserted.status,
          checkinId: inserted.id,
          distance: inserted.distance,
          message: buildSuccessMessage(inserted.status, outsideHours),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du pointage";
        console.error("[useCheckin]", message);
        return mapCheckinError(message);
      }
    },
    [params, buildSuccessMessage],
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

  const autoCheckin = useCallback(
    async (known?: KnownPosition): Promise<CheckinResult> => {
      setIsCheckingIn(true);
      setError(null);
      try {
        const userId = params?.userId;
        const companyId = params?.companyId;
        if (!userId || !companyId) {
          return { success: false, distance: 0, message: "Compte ou entreprise manquant" };
        }

        const gps = await resolveGps(
          known,
          params?.companyLat,
          params?.companyLon,
          params?.companyRadius,
        );
        if (!gps.ok) return gps.result;

        const deviceInfo = JSON.stringify({
          name: getDeviceName(),
          fingerprint: (await getFullDeviceFingerprint().catch(() => "unknown")).slice(0, 16),
          mode: "auto-gps",
        });

        const inZone =
          params?.companyRadius != null && gps.distance <= params.companyRadius;

        // 1) GPS seul si dans la zone (validation automatique sans QR admin)
        if (inZone && known) {
          try {
            const inserted = await createAutoCheckinGps(
              userId,
              companyId,
              gps.latitude,
              gps.longitude,
              deviceInfo,
            );
            const outsideHours = isOutsideOpeningHours(new Date(), params?.openingTime, params?.closingTime);
            return {
              success: true,
              status: inserted.status,
              checkinId: inserted.id,
              distance: inserted.distance,
              message: buildSuccessMessage(inserted.status, outsideHours),
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (!msg.includes("déjà pointé")) {
              console.warn("[useCheckin] auto GPS:", msg);
            } else {
              return mapCheckinError(msg);
            }
          }
        }

        // 2) Sinon QR actif sur l'écran admin
        const { data: activeQr } = await supabase
          .from("qr_sessions")
          .select("token")
          .eq("company_id", companyId)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeQr?.token) {
          return performCheckin(activeQr.token, known);
        }

        if (inZone) {
          return {
            success: false,
            distance: gps.distance,
            message: "Pointage automatique impossible — réessayez",
          };
        }

        return {
          success: false,
          distance: gps.distance,
          code: "NO_ACTIVE_QR",
          message:
            "Aucun QR actif. Rapprochez-vous du site (similarité ≥ 92%) ou demandez à l'admin d'ouvrir le QR.",
        };
      } finally {
        setIsCheckingIn(false);
      }
    },
    [params, performCheckin, buildSuccessMessage],
  );

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return { checkin, autoCheckin, isCheckingIn, error, lastResult, reset };
}
