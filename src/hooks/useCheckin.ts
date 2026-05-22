/**
 * useCheckin.ts
 * Hook de check-in — INSERT direct Supabase (sans Edge Function).
 *
 * Adapté au schéma réel de checkins :
 *   id, user_id, company_id, status, device_info (jsonb), qr_session_id, created_at
 *
 * Validations effectuées côté client :
 *  - Token QR → lookup dans qr_sessions
 *  - GPS → distance haversine vs company.radius
 *  - Statut → PRESENT / LATE / FLAGGED
 *  - Anti-doublon → pas deux pointages valides le même jour
 */

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getValidatedPosition } from "@/security/geo/gps-validation";
import { getFullDeviceFingerprint, getDeviceName } from "@/security/device/fingerprint-generation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckinStatus = "PRESENT" | "LATE" | "FLAGGED";

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

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeStatus(
  distance: number,
  radius: number,
  lateTolerance: number | null | undefined,
): CheckinStatus {
  if (distance > radius) return "FLAGGED";
  const now = new Date();
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const tolerance = lateTolerance ?? 15;
  const lateThreshold = 9 * 60 + tolerance;
  if (minutesSinceMidnight > lateThreshold) return "LATE";
  return "PRESENT";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckin(params?: UseCheckinParams): UseCheckinReturn {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastResult, setLastResult]     = useState<CheckinResult | null>(null);

  const doInsert = useCallback(async (
    qrToken: string | null,
    latitude: number,
    longitude: number,
  ): Promise<CheckinResult> => {

    // 1. User connecté
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return { success: false, distance: 0, code: "NOT_AUTHENTICATED", message: "Session expirée — reconnectez-vous" };
    }

    // 2. Profil → company_id
    const { data: profile } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!profile?.company_id) {
      return { success: false, distance: 0, code: "NO_COMPANY", message: "Aucune entreprise associée à votre compte" };
    }
    const companyId = profile.company_id as string;

    // 3. Company → coords + radius
    const { data: company } = await supabase
      .from("companies")
      .select("latitude,longitude,radius,late_tolerance")
      .eq("id", companyId)
      .single();
    if (!company) {
      return { success: false, distance: 0, code: "COMPANY_NOT_FOUND", message: "Entreprise introuvable" };
    }

    // 4. Validation token QR
    let qrSessionId: string | null = null;
    if (qrToken) {
      const { data: session } = await supabase
        .from("qr_sessions")
        .select("id,active,expires_at,used_at")
        .eq("token", qrToken)
        .eq("company_id", companyId)
        .single();

      if (!session) return { success: false, distance: 0, code: "INVALID_TOKEN", message: "QR Code invalide" };
      if (!session.active || session.used_at) return { success: false, distance: 0, code: "TOKEN_USED", message: "Ce QR Code a déjà été utilisé" };
      if (new Date(session.expires_at) < new Date()) return { success: false, distance: 0, code: "TOKEN_EXPIRED", message: "QR Code expiré — demandez-en un nouveau" };
      qrSessionId = session.id as string;
    }

    // 5. Distance GPS
    const distance = Math.round(haversine(latitude, longitude, company.latitude, company.longitude));
    const radius   = params?.radius ?? (company.radius as number) ?? 200;

    if (distance > radius * 2) {
      return {
        success: false, distance,
        code: "OUT_OF_RANGE",
        message: `Vous êtes à ${distance}m de l'entreprise (limite : ${radius}m)`,
      };
    }

    // 6. Anti-doublon
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("checkins")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .in("status", ["PRESENT", "LATE"])
      .gte("created_at", `${today}T00:00:00`)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, distance, code: "ALREADY_CHECKED_IN", message: "Vous avez déjà pointé aujourd'hui" };
    }

    // 7. Statut
    const status = computeStatus(distance, radius, params?.lateTolerance ?? (company.late_tolerance as number | null));

    // 8. Device info
    const fingerprint = await getFullDeviceFingerprint().catch(() => "unknown");
    const deviceName  = getDeviceName();
    const deviceInfo  = { name: deviceName, fingerprint: fingerprint.slice(0, 16), ua: navigator.userAgent.slice(0, 120) };

    // 9. INSERT
    const { data: inserted, error: insertErr } = await supabase
      .from("checkins")
      .insert({
        user_id:      user.id,
        company_id:   companyId,
        status,
        device_info:  deviceInfo,
        qr_session_id: qrSessionId,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[useCheckin] INSERT error:", insertErr);
      return { success: false, distance, code: "INSERT_FAILED", message: "Erreur lors de l'enregistrement — réessayez" };
    }

    // 10. Marquer la session QR utilisée
    if (qrSessionId) {
      await supabase
        .from("qr_sessions")
        .update({ used_at: new Date().toISOString(), active: false })
        .eq("id", qrSessionId);
    }

    return { success: true, distance, status, checkinId: inserted.id as string };
  }, [params?.radius, params?.lateTolerance]);

  // ── QR scan ───────────────────────────────────────────────────────────────
  const checkin = useCallback(async (qrToken: string): Promise<CheckinResult> => {
    setIsCheckingIn(true);
    setError(null);
    try {
      const gpsResult = await getValidatedPosition();
      if (!gpsResult.valid) {
        const msgs: Record<string, string> = {
          GPS_NOT_SUPPORTED:        "GPS non supporté sur cet appareil",
          GPS_PERMISSION_DENIED:    "Permission GPS refusée — activez la localisation",
          GPS_ACCURACY_TOO_LOW:     "Signal GPS trop faible — déplacez-vous vers une fenêtre",
          GPS_INVALID_COORDINATES:  "Coordonnées GPS invalides",
          GPS_POSITION_UNAVAILABLE: "Position GPS indisponible",
          GPS_TIMEOUT:              "Timeout GPS — réessayez en extérieur",
        };
        const message = msgs[gpsResult.reason ?? ""] ?? "Erreur GPS inconnue";
        const result: CheckinResult = { success: false, distance: 0, code: gpsResult.reason, message };
        setError(message);
        setLastResult(result);
        return result;
      }
      const result = await doInsert(qrToken, gpsResult.latitude, gpsResult.longitude);
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
  }, [doInsert]);

  // ── Auto (GPS seul) ───────────────────────────────────────────────────────
  const autoCheckin = useCallback(async (): Promise<CheckinResult> => {
    setIsCheckingIn(true);
    setError(null);
    try {
      const gpsResult = await getValidatedPosition();
      if (!gpsResult.valid) {
        const message = "Position GPS invalide pour le pointage automatique";
        const result: CheckinResult = { success: false, distance: 0, code: gpsResult.reason, message };
        setError(message);
        setLastResult(result);
        return result;
      }
      const result = await doInsert(null, gpsResult.latitude, gpsResult.longitude);
      setLastResult(result);
      if (!result.success) setError(result.message ?? "Pointage automatique refusé");
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
  }, [doInsert]);

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return { checkin, autoCheckin, isCheckingIn, error, lastResult, reset };
}
