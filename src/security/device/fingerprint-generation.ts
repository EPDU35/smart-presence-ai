/**
 * fingerprint-generation.ts
 * Génération d'empreinte d'appareil pour le tracking des devices.
 *
 * AVOCAT DU DIABLE :
 * Aucune empreinte navigateur n'est parfaite. Changement de navigateur,
 * mode incognito, mise à jour OS = empreinte différente pour le même appareil.
 * On combine plusieurs signaux pour maximiser la stabilité — mais ne pas
 * traiter ça comme une identité certaine. C'est une probabilité forte, pas
 * une certitude cryptographique.
 *
 * Ce qu'on NE fait pas : canvas fingerprint, AudioContext, WebGL avancé.
 * Raison : RGPD / vie privée. Ce qui est fait ici reste dans le raisonnable.
 */

export interface DeviceFingerprint {
  raw: string;        // Données brutes concaténées
  hash: string;       // SHA-256 hex (async)
  components: FingerprintComponents;
}

export interface FingerprintComponents {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  colorDepth: number;
  touchSupport: boolean;
  cookiesEnabled: boolean;
}

/**
 * Collecte tous les signaux disponibles.
 */
export function collectFingerprintComponents(): FingerprintComponents {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { platform: string };
  };

  return {
    userAgent: nav.userAgent,
    language: nav.language,
    // userAgentData plus stable que navigator.platform (deprecated)
    platform: nav.userAgentData?.platform ?? nav.platform ?? "unknown",
    screenResolution: `${screen.width}x${screen.height}x${screen.availWidth}x${screen.availHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: nav.hardwareConcurrency ?? 0,
    deviceMemory: nav.deviceMemory ?? null,
    colorDepth: screen.colorDepth,
    touchSupport: "ontouchstart" in window || nav.maxTouchPoints > 0,
    cookiesEnabled: nav.cookieEnabled,
  };
}

/**
 * Construit la string brute à hasher.
 */
function buildRawString(components: FingerprintComponents): string {
  return [
    components.userAgent,
    components.language,
    components.platform,
    components.screenResolution,
    components.timezone,
    components.hardwareConcurrency,
    components.deviceMemory ?? "null",
    components.colorDepth,
    components.touchSupport,
    components.cookiesEnabled,
  ].join("|");
}

/**
 * Hash SHA-256 d'une string via Web Crypto API.
 * Non-dépendant de Node.js — fonctionne dans le navigateur ET les Edge Functions.
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Génère l'empreinte complète avec hash async.
 * À utiliser quand on a le temps (login, background).
 */
export async function getFullDeviceFingerprint(): Promise<string> {
  const components = collectFingerprintComponents();
  const raw = buildRawString(components);
  return await sha256(raw);
}

/**
 * Version synchrone — hash non cryptographique (djb2).
 * Utilisé pour les checks rapides où l'async n'est pas possible.
 * MOINS SÉCURISÉ — réserver aux comparaisons non critiques.
 */
export function getDeviceFingerprintSync(): string {
  const components = collectFingerprintComponents();
  const raw = buildRawString(components);
  return djb2Hash(raw);
}

/**
 * Hash djb2 — rapide, synchrone, 32 bits.
 * Non cryptographique : uniquement pour la rapidité côté UX.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Retourne un nom lisible pour l'appareil.
 * Utilisé pour l'affichage dans le dashboard ("iPhone 14 - Safari").
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;

  // Mobile detection
  if (/iPhone/.test(ua)) return `iPhone - ${getBrowserName()}`;
  if (/iPad/.test(ua)) return `iPad - ${getBrowserName()}`;
  if (/Android/.test(ua)) return `Android - ${getBrowserName()}`;

  // Desktop
  if (/Macintosh/.test(ua)) return `Mac - ${getBrowserName()}`;
  if (/Windows/.test(ua)) return `Windows - ${getBrowserName()}`;
  if (/Linux/.test(ua)) return `Linux - ${getBrowserName()}`;

  return `Unknown - ${getBrowserName()}`;
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}