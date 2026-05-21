/**
 * haversine-distance.ts
 * Calcul de distance sphérique entre deux coordonnées GPS.
 *
 * Note : Ce fichier duplique intentionnellement utils/geo.ts pour que
 * le module security/ soit auto-suffisant et importable dans la Edge Function
 * sans dépendances externes. Ne pas supprimer l'un pour "éviter les doublons"
 * — ils ont des rôles différents (utils = UX, security = audit trail).
 */

const EARTH_RADIUS_M = 6_371_000; // mètres

/**
 * Formule de Haversine.
 * Retourne la distance en mètres entre deux points GPS.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}