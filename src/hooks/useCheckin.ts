/**
 * useCheckin.ts
 * Hook React aligné avec CheckinPage.tsx.
 *
 * CORRECTIONS :
 * 1. CheckinPage appelle autoCheckin() qui n'existait pas → ajouté
 * 2. CheckinPage lit res.distance → ajouté dans CheckinResult
 * 3. CheckinPage passe des options (companyId, radius...) → useCheckin accepte ces options
 * 4. checkin() n'acceptait qu'1 argument (token) → OK déjà correct
 */

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getValidatedPosition } from "@/security/geo/gps-validation";
import { getFullDeviceFingerprint, getDeviceName } from "@/security/device/fingerprint-generation";
import { refreshIfNeeded } from "@/security/auth/refresh-tokens";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseCheckinOptions {
  companyId: string;
  userId: string;
  companyLat: number;
  companyLon: number;
  radius: number;
  openingTime?: string | null;
  closingTime?: string | null;
  lateTolerance?: number | null;
}

export interface CheckinResult {
  success: boolean;
  status?: "PRESENT" | "LATE" | "FLAGGED";
  checkinId?: string;
  distance: number;   // Toujours présent (0 si erreur)
  message?: string;
  code?: string;
}

export interface UseCheckinReturn {
  checkin:      (qrToken: string) => Promise<CheckinResult>;
  autoCheckin:  () => Promise<CheckinResult>;
  isCheckingIn: boolean;
  error:        string | null;
  lastResult:   CheckinResult | null;
  reset:        () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckin(options: UseCheckinOptions): UseCheckinReturn {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastResult, setLastResult]     = useState<CheckinResult | null>(null);

  // ── Core : appel Edge Function ────────────────────────────────────────────

  async function callEdgeFunction(
    token: string,
    latitude: number,
    longitude: number,
    accuracy: number
  ): Promise<CheckinResult> {
    const { token: freshJwt } = await refreshIfNeeded();
    if (!freshJwt) {
      return { success: false, code: "NOT_AUTHENTICATED", message: "Session expirée", distance: 0 };
    }

    const fingerprint = await getFullDeviceFingerprint();
    const deviceName  = getDeviceName();

    const { data, error: fnError } = await supabase.functions.invoke(
      "validate-checkin",
      {
        body: {
          token,
          latitude,
          longitude,
          accuracy,
          deviceInfo: { fingerprint, deviceName, userAgent: navigator.userAgent },
        },
        headers: { Authorization: `Bearer ${freshJwt}` },
      }
    );

    if (fnError) {
      let parsed: Partial<CheckinResult> = { code: "FUNCTION_ERROR", message: "Erreur de connexion" };
      try { parsed = JSON.parse(fnError.message); } catch { /* keep default */ }
      return { success: false, distance: 0, ...parsed };
    }

    return {
      success:    data.success,
      status:     data.status,
      checkinId:  data.checkinId,
      distance:   data.distanceMeters ?? 0,
      message:    data.message,
      code:       data.code,
    };
  }

  // ── checkin : scan manuel QR ──────────────────────────────────────────────

  const checkin = useCallback(async (qrToken: string): Promise<CheckinResult> => {
    setIsCheckingIn(true);
    setError(null);

    try {
      const gpsResult = await getValidatedPosition();
      if (!gpsResult.valid) {
        const msg = getGpsErrorMessage(gpsResult.reason);
        const result: CheckinResult = { success: false, code: gpsResult.reason, message: msg, distance: 0 };
        setError(msg); setLastResult(result); return result;
      }

      const result = await callEdgeFunction(
        qrToken,
        gpsResult.latitude!,
        gpsResult.longitude!,
        gpsResult.accuracy ?? 999
      );

      setLastResult(result);
      if (!result.success) setError(result.message ?? "Pointage refusé");
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      const result: CheckinResult = { success: false, code: "UNEXPECTED_ERROR", message, distance: 0 };
      setError(message); setLastResult(result); return result;
    } finally {
      setIsCheckingIn(false);
    }
  }, []);

  // ── autoCheckin : validation automatique (sans scan QR) ──────────────────
  // Génère un token via l'active session de la company

  const autoCheckin = useCallback(async (): Promise<CheckinResult> => {
    setIsCheckingIn(true);
    setError(null);

    try {
      const gpsResult = await getValidatedPosition();
      if (!gpsResult.valid) {
        const msg = getGpsErrorMessage(gpsResult.reason);
        const result: CheckinResult = { success: false, code: gpsResult.reason, message: msg, distance: 0 };
        setError(msg); setLastResult(result); return result;
      }

      // Récupérer le token QR actif de la company
      const { data: session } = await supabase
        .from("qr_sessions")
        .select("token")
        .eq("company_id", options.companyId)
        .eq("active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!session?.token) {
        const result: CheckinResult = {
          success: false,
          code: "NO_ACTIVE_QR",
          message: "Aucun QR Code actif — demandez à l'admin de l'afficher",
          distance: 0,
        };
        setError(result.message!); setLastResult(result); return result;
      }

      const result = await callEdgeFunction(
        session.token,
        gpsResult.latitude!,
        gpsResult.longitude!,
        gpsResult.accuracy ?? 999
      );

      setLastResult(result);
      if (!result.success) setError(result.message ?? "Pointage refusé");
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      const result: CheckinResult = { success: false, code: "UNEXPECTED_ERROR", message, distance: 0 };
      setError(message); setLastResult(result); return result;
    } finally {
      setIsCheckingIn(false);
    }
  }, [options.companyId]);

  const reset = useCallback(() => { setError(null); setLastResult(null); }, []);

  return { checkin, autoCheckin, isCheckingIn, error, lastResult, reset };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGpsErrorMessage(reason?: string): string {
  const messages: Record<string, string> = {
    GPS_NOT_SUPPORTED:        "GPS non supporté sur cet appareil",
    GPS_PERMISSION_DENIED:    "Permission GPS refusée — activez la localisation",
    GPS_ACCURACY_TOO_LOW:     "Signal GPS trop faible — rapprochez-vous d'une fenêtre",
    GPS_INVALID_COORDINATES:  "Coordonnées GPS invalides",
    GPS_POSITION_UNAVAILABLE: "Position GPS indisponible",
    GPS_TIMEOUT:              "Timeout GPS — réessayez en extérieur",
  };
  return messages[reason ?? ""] ?? "Erreur GPS inconnue";
}
