/**
 * radius-check.ts
 * Vérifie si un employé est dans le rayon autorisé de l'entreprise.
 */

import { haversineDistance } from "./haversine-distance";

export interface RadiusCheckResult {
  withinRadius: boolean;
  distanceMeters: number;
  allowedRadius: number;
  marginMeters: number; // positif = dans la zone, négatif = hors zone
}

/**
 * Vérifie si les coordonnées de l'employé sont dans le rayon
 * autorisé de l'entreprise.
 *
 * @param userLat - Latitude de l'employé
 * @param userLon - Longitude de l'employé
 * @param companyLat - Latitude de l'entreprise
 * @param companyLon - Longitude de l'entreprise
 * @param radiusMeters - Rayon autorisé en mètres
 * @param gpsAccuracyMeters - Précision GPS de l'employé
 */
export function checkRadius(
  userLat: number,
  userLon: number,
  companyLat: number,
  companyLon: number,
  radiusMeters: number,
  gpsAccuracyMeters = 0
): RadiusCheckResult {
  const distanceMeters = haversineDistance(userLat, userLon, companyLat, companyLon);

  // On accorde une tolérance basée sur la précision GPS déclarée.
  // Si le GPS dit "je suis précis à ±20m", on peut tolérer 20m de plus.
  // Plafonné à 50m pour éviter les abus (GPS imprécis = beaucoup de tolérance).
  const gpsTolerance = Math.min(gpsAccuracyMeters, 50);
  const effectiveRadius = radiusMeters + gpsTolerance;

  return {
    withinRadius: distanceMeters <= effectiveRadius,
    distanceMeters: Math.round(distanceMeters),
    allowedRadius: radiusMeters,
    marginMeters: Math.round(effectiveRadius - distanceMeters),
  };
}