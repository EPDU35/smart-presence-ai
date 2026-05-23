/**
 * Journée de présence (fuseau local navigateur).
 * Nouveau jour calendaire = compteurs remis à zéro (jour 2, 3…).
 */

/** Date locale YYYY-MM-DD */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Début du jour local en ISO (pour filtres Supabase created_at >=) */
export function getLocalDayStartISO(date = new Date()): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function timeToMinutes(time: string): number {
  const normalized = time.slice(0, 5);
  const [h, m] = normalized.split(":").map((v) => parseInt(v, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Après l'heure de fermeture → plus de pointage, clôture des absents */
export function isPastClosingTime(
  now: Date,
  closingTime: string | null | undefined,
): boolean {
  if (!closingTime) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > timeToMinutes(closingTime);
}

/** Fenêtre de pointage : entre ouverture et fermeture incluses */
export function isWithinCheckinWindow(
  now: Date,
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (openingTime && nowMinutes < timeToMinutes(openingTime)) return false;
  if (closingTime && nowMinutes > timeToMinutes(closingTime)) return false;
  return true;
}
