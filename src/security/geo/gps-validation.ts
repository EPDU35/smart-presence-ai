/**
 * gps-validation.ts
 * Validation et qualité du signal GPS.
 *
 * AVOCAT DU DIABLE :
 * navigator.geolocation peut retourner des coordonnées en cache,
 * des coordonnées IP-based (très imprécises), ou des données mockées.
 * Ce fichier détecte les cas évidents — pas les attaques sophistiquées.
 */

export interface GpsValidationResult {
  valid: boolean;
  reason?: string;
  accuracy?: number;
  latitude?: number;
  longitude?: number;
}

// Précision minimale requise en mètres pour accepter une position GPS
const MAX_ACCEPTABLE_ACCURACY_M = 200;

// Timeout pour obtenir une position GPS précise
const GPS_TIMEOUT_MS = 12_000;

/**
 * Obtient la position GPS avec validation de précision.
 * Utilise maximumAge: 0 pour forcer une position fraîche.
 */
export async function getValidatedPosition(): Promise<GpsValidationResult> {
  if (!navigator.geolocation) {
    return { valid: false, reason: "GPS_NOT_SUPPORTED" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        // Position doit avoir une précision raisonnable
        if (accuracy > MAX_ACCEPTABLE_ACCURACY_M) {
          resolve({
            valid: false,
            reason: "GPS_ACCURACY_TOO_LOW",
            accuracy,
          });
          return;
        }

        // Coordonnées doivent être dans des plages valides
        if (!isValidCoordinates(latitude, longitude)) {
          resolve({ valid: false, reason: "GPS_INVALID_COORDINATES" });
          return;
        }

        resolve({ valid: true, latitude, longitude, accuracy });
      },
      (err) => {
        const reason =
          err.code === 1
            ? "GPS_PERMISSION_DENIED"
            : err.code === 2
              ? "GPS_POSITION_UNAVAILABLE"
              : "GPS_TIMEOUT";
        resolve({ valid: false, reason });
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT_MS,
        maximumAge: 0, // CRITIQUE : jamais de position en cache
      }
    );
  });
}

/**
 * Vérifie que les coordonnées sont dans des plages géographiques légitimes.
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    // Rejette les coordonnées exactement à 0,0 (souvent un défaut)
    !(lat === 0 && lon === 0)
  );
}