import { useState, useCallback } from "react";
import { createCheckin } from "@/services/checkin.service";
import { isWithinRadius } from "@/utils/geo";
import type { Checkin } from "@/types";

interface UseCheckinOptions {
  companyId: string;
  userId: string;
  companyLat: number;
  companyLon: number;
  radius: number;
}

interface UseCheckinReturn {
  checkin: (qrToken: string) => Promise<Checkin>;
  isCheckingIn: boolean;
  error: string | null;
}

export function useCheckin({ companyId, userId, companyLat, companyLon, radius }: UseCheckinOptions): UseCheckinReturn {
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
        const distance = isWithinRadius(userLat, userLon, companyLat, companyLon, radius)
          ? 0
          : Number.MAX_VALUE;

        if (distance > radius) {
          throw new Error("Hors zone autorisee");
        }

        const result = await createCheckin({
          user_id: userId,
          company_id: companyId,
          qr_token: qrToken,
          latitude: userLat,
          longitude: userLon,
          distance,
          status: distance <= radius ? "VALID" : "INVALID",
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
    [companyId, userId, companyLat, companyLon, radius]
  );

  return { checkin, isCheckingIn, error };
}
