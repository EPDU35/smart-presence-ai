import { useState, useCallback } from "react";
import { createCheckin } from "@/services/checkin.service";
import { isWithinRadius, haversineDistance } from "@/utils/geo";
import type { Checkin } from "@/types";

interface UseCheckinOptions {
  companyId: string;
  userId: string;
  companyLat: number;
  companyLon: number;
  radius: number;
  openingTime?: string | null;
  lateTolerance?: number | null;
}

interface UseCheckinReturn {
  checkin: (qrToken: string) => Promise<Checkin>;
  autoCheckin: () => Promise<Checkin>;
  isCheckingIn: boolean;
  error: string | null;
}

export function useCheckin({ companyId, userId, companyLat, companyLon, radius, openingTime, lateTolerance }: UseCheckinOptions): UseCheckinReturn {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkin = useCallback(
    async (qrToken: string): Promise<Checkin> => {
      setIsCheckingIn(true);
      setError(null);

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });

        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        const actualDistance = haversineDistance(userLat, userLon, companyLat, companyLon);

        if (actualDistance > radius) {
          throw new Error("Hors zone autorisée");
        }

        let checkinStatus: "VALID" | "SUSPICIOUS" = "VALID";
        if (openingTime) {
          const now = new Date();
          const [hours, minutes] = openingTime.split(":").map(Number);
          const openingDate = new Date();
          openingDate.setHours(hours, minutes, 0, 0);
          
          const toleranceMs = (lateTolerance ?? 0) * 60000;
          const limitTime = new Date(openingDate.getTime() + toleranceMs);
          
          if (now > limitTime) {
            checkinStatus = "SUSPICIOUS";
          }
        }

        const result = await createCheckin({
          user_id: userId,
          company_id: companyId,
          qr_token: qrToken,
          latitude: userLat,
          longitude: userLon,
          distance: actualDistance,
          status: checkinStatus,
        });

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur de pointage";
        setError(msg);
        throw err;
      } finally {
        setIsCheckingIn(false);
      }
    },
    [companyId, userId, companyLat, companyLon, radius, openingTime, lateTolerance]
  );

  const autoCheckin = useCallback(
    async (): Promise<Checkin> => {
      setIsCheckingIn(true);
      setError(null);

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });

        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        const actualDistance = haversineDistance(userLat, userLon, companyLat, companyLon);
        const positionSimilarity = radius > 0 ? Math.max(0, (1 - actualDistance / radius) * 100) : 0;

        if (positionSimilarity < 92) {
          throw new Error(`Position insuffisante pour le pointage automatique (${Math.round(positionSimilarity)}% de similarité, 92% requis)`);
        }

        let checkinStatus: "VALID" | "SUSPICIOUS" = "VALID";
        if (openingTime) {
          const now = new Date();
          const [hours, minutes] = openingTime.split(":").map(Number);
          const openingDate = new Date();
          openingDate.setHours(hours, minutes, 0, 0);
          
          const toleranceMs = (lateTolerance ?? 0) * 60000;
          const limitTime = new Date(openingDate.getTime() + toleranceMs);
          
          if (now > limitTime) {
            checkinStatus = "SUSPICIOUS";
          }
        }

        const result = await createCheckin({
          user_id: userId,
          company_id: companyId,
          qr_token: "AUTO_GPS",
          latitude: userLat,
          longitude: userLon,
          distance: actualDistance,
          status: checkinStatus,
        });

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur de pointage";
        setError(msg);
        throw err;
      } finally {
        setIsCheckingIn(false);
      }
    },
    [companyId, userId, companyLat, companyLon, radius, openingTime, lateTolerance]
  );

  return { checkin, autoCheckin, isCheckingIn, error };
}
