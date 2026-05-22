import type { CheckinStatus } from "@/types";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isOutsideOpeningHours(
  now: Date,
  openingTime: string | null | undefined,
  closingTime: string | null | undefined,
): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (openingTime && nowMinutes < timeToMinutes(openingTime)) return true;
  if (closingTime && nowMinutes > timeToMinutes(closingTime)) return true;
  return false;
}

export function computeCheckinStatus(
  distance: number,
  radius: number,
  outsideHours: boolean,
): CheckinStatus {
  if (distance > radius * 3) return "INVALID";
  if (outsideHours) return "VALID";
  if (distance <= radius) return "VALID";
  return "SUSPICIOUS";
}
