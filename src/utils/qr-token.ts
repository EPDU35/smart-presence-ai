export function normalizeQrToken(raw: string): string {
  const trimmed = raw.trim();
  const withDashes = trimmed.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (withDashes) return withDashes[0].toLowerCase();

  const hex32 = trimmed.match(/[0-9a-f]{32}/i);
  if (hex32) {
    const h = hex32[0].toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return trimmed.toLowerCase();
}

export function qrTokenLookupVariants(raw: string): string[] {
  const normalized = normalizeQrToken(raw);
  const noDashes = normalized.replace(/-/g, "");
  return normalized === noDashes ? [normalized] : [normalized, noDashes];
}
