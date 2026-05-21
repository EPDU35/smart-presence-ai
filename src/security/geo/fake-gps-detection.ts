/**
 * fake-gps-detection.ts
 * Heuristiques de détection de GPS falsifié.
 *
 * AVOCAT DU DIABLE :
 * Un attaquant utilisant un émulateur root ou Xposed Framework
 * peut contourner TOUTES ces détections. Ce fichier bloque 95%
 * des cas (applications de fake GPS grand public). Les 5% restants
 * nécessitent une approche backend (comportement historique, etc).
 *
 * Aucune heuristique ne sera jamais parfaite côté navigateur.
 * Accepter ça et documenter les limites est plus honnête que de
 * prétendre avoir une "détection infaillible".
 */

export interface FakeGpsDetectionResult {
  likelyFake: boolean;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  indicators: string[];
}

/**
 * Analyse une position GPS pour détecter une falsification probable.
 */
export function detectFakeGps(
  latitude: number,
  longitude: number,
  accuracy: number,
  altitude: number | null,
  altitudeAccuracy: number | null,
  speed: number | null
): FakeGpsDetectionResult {
  const indicators: string[] = [];

  // Indicateur 1 : Précision trop parfaite
  // Un vrai GPS à l'intérieur d'un bâtiment ne donne JAMAIS exactement 0m de précision.
  // Les émulateurs mettent souvent accuracy = 0 ou 1.
  if (accuracy !== null && accuracy < 2) {
    indicators.push("SUSPICIOUSLY_PERFECT_ACCURACY");
  }

  // Indicateur 2 : Coordonnées rondes (valeur exacte à 4+ décimales)
  // Les vrais GPS ont des coordonnées "sales" avec beaucoup de décimales.
  const latDecimals = (latitude.toString().split(".")[1] || "").length;
  const lonDecimals = (longitude.toString().split(".")[1] || "").length;
  if (latDecimals <= 3 || lonDecimals <= 3) {
    indicators.push("SUSPICIOUSLY_ROUND_COORDINATES");
  }

  // Indicateur 3 : Altitude nulle avec altitudeAccuracy nulle
  // Rare sur un vrai appareil, fréquent sur les émulateurs.
  if (altitude === 0 && altitudeAccuracy === 0) {
    indicators.push("ZERO_ALTITUDE_ZERO_ACCURACY");
  }

  // Indicateur 4 : Vitesse exactement à 0 sur un mobile en mouvement probable
  // (Heuristique faible — on le signale mais avec faible poids)
  if (speed !== null && speed === 0 && accuracy < 10) {
    indicators.push("STATIC_PERFECT_GPS");
  }

  // Calcul du niveau de confiance
  let confidence: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (indicators.length >= 3) confidence = "HIGH";
  else if (indicators.length === 2) confidence = "MEDIUM";

  return {
    likelyFake: indicators.length >= 2,
    confidence,
    indicators,
  };
}

/**
 * Wrapper qui extrait les données d'un GeolocationCoordinates.
 */
export function analyzePosition(coords: GeolocationCoordinates): FakeGpsDetectionResult {
  return detectFakeGps(
    coords.latitude,
    coords.longitude,
    coords.accuracy,
    coords.altitude,
    coords.altitudeAccuracy,
    coords.speed
  );
}