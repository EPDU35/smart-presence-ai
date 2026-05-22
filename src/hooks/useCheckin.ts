/**
 * useCheckin.ts
 * Hook React pour le flow de check-in sécurisé.
 *
 * ARCHITECTURE CORRIGÉE :
 * ──────────────────────
 * AVANT (dangereux) :
 *   client → createCheckin() → INSERT direct sur checkins → aucune validation serveur
 *
 * APRÈS (sécurisé) :
 *   client → validate-checkin Edge Function → validation complète → INSERT serveur
 *
 * Le client envoie : token QR + coordonnées GPS + infos device.
 * La Edge Function fait : validation token + GPS + radius + anti-fraude + INSERT.
 * Le client ne fait JAMAIS d'INSERT direct sur checkins.
 *
 * AVOCAT DU DIABLE :
 * L'ancienne version avec INSERT direct permettait à n'importe quel user de :
 * 1. Envoyer status = 'PRESENT' sans QR réel
 * 2. Injecter des coordonnées GPS fictives
 * 3. Réutiliser un token expiré
 * Tout ça en 3 requêtes curl. C'est maintenant impossible.
 */

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getValidatedPosition } from "@/security/geo/gps-validation";
import { getFullDeviceFingerprint, getDeviceName } from "@/security/device/fingerprint-generation";
import { computeFraudScore, logSuspiciousEvent } from "@/security/qr/anti-fraude-checks";
import { refreshIfNeeded } from "@/security/auth/refresh-tokens";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckinStatus = "PRESENT" | "LATE" | "FLAGGED";

export interface CheckinResult {
  success: boolean;
  status?: CheckinStatus;
  checkinId?: string;
  distanceMeters?: number;
  message?: string;
  code?: string;
}

export interface UseCheckinReturn {
  checkin: (qrToken: string) => Promise<CheckinResult>;
  isCheckingIn: boolean;
  error: string | null;
  lastResult: CheckinResult | null;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckin(): UseCheckinReturn {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastResult, setLastResult]     = useState<CheckinResult | null>(null);

  const checkin = useCallback(async (qrToken: string): Promise<CheckinResult> => {
    setIsCheckingIn(true);
    setError(null);

    try {
      // ── 1. S'assurer que le token JWT est frais ──────────────────────────
      const { token: freshJwt } = await refreshIfNeeded();
      if (!freshJwt) {
        const result: CheckinResult = {
          success: false,
          code: "NOT_AUTHENTICATED",
          message: "Session expirée — reconnectez-vous",
        };
        setError(result.message!);
        setLastResult(result);
        return result;
      }

      // ── 2. Obtenir la position GPS validée ───────────────────────────────
      // maximumAge: 0 (forcé dans getValidatedPosition) — jamais de cache GPS
      const gpsResult = await getValidatedPosition();

      if (!gpsResult.valid) {
        const messages: Record<string, string> = {
          GPS_NOT_SUPPORTED:        "GPS non supporté sur cet appareil",
          GPS_PERMISSION_DENIED:    "Permission GPS refusée — activez la localisation",
          GPS_ACCURACY_TOO_LOW:     "Signal GPS trop faible — déplacez-vous vers une fenêtre",
          GPS_INVALID_COORDINATES:  "Coordonnées GPS invalides",
          GPS_POSITION_UNAVAILABLE: "Position GPS indisponible",
          GPS_TIMEOUT:              "Timeout GPS — réessayez en extérieur",
        };
        const message = messages[gpsResult.reason ?? ""] ?? "Erreur GPS inconnue";
        const result: CheckinResult = { success: false, code: gpsResult.reason, message };
        setError(message);
        setLastResult(result);
        return result;
      }

      const { latitude, longitude, accuracy } = gpsResult;

      // ── 3. Collecter les infos device ────────────────────────────────────
      // CRITIQUE : await obligatoire — WebCrypto SHA-256 est async
      const fingerprint = await getFullDeviceFingerprint();
      const deviceName  = getDeviceName();

      // ── 4. Appel Edge Function validate-checkin ──────────────────────────
      // Tout se passe côté serveur : validation QR, GPS, radius, INSERT
      const { data, error: fnError } = await supabase.functions.invoke(
        "validate-checkin",
        {
          body: {
            token: qrToken,
            latitude,
            longitude,
            accuracy,
            deviceInfo: {
              fingerprint,
              deviceName,
              userAgent: navigator.userAgent,
            },
          },
          headers: {
            Authorization: `Bearer ${freshJwt}`,
          },
        }
      );

      if (fnError) {
        // Supabase Functions met l'erreur HTTP dans fnError.message
        let parsed: CheckinResult = {
          success: false,
          code: "FUNCTION_ERROR",
          message: "Erreur de connexion — réessayez",
        };

        try {
          parsed = JSON.parse(fnError.message) as CheckinResult;
        } catch {
          // Message non JSON — garder le message par défaut
        }

        setError(parsed.message ?? "Erreur inconnue");
        setLastResult(parsed);
        return parsed;
      }

      const result = data as CheckinResult;
      setLastResult(result);

      if (!result.success) {
        setError(result.message ?? "Pointage refusé");
      }

      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      const result: CheckinResult = { success: false, code: "UNEXPECTED_ERROR", message };
      setError(message);
      setLastResult(result);
      return result;
    } finally {
      setIsCheckingIn(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return { checkin, isCheckingIn, error, lastResult, reset };
}
