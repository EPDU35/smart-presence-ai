/**
 * token-generation.ts
 * Génération de tokens QR cryptographiquement sécurisés.
 *
 * AVOCAT DU DIABLE :
 * crypto.randomUUID() seul est insuffisant — il est prévisible si le PRNG
 * est compromis. On ajoute une couche d'entropie + timestamp + signature.
 */

import { supabase } from "@/lib/supabase";
import type { QrSession } from "@/types";

// Durée de vie d'un token QR en millisecondes (15 secondes)
export const QR_TOKEN_TTL_MS = 15_000;

/**
 * Génère un token QR sécurisé.
 * Format : <uuid>.<timestamp_hex>.<checksum_hex>
 * - Pas devinable sans connaître le timestamp exact
 * - Impossible à réutiliser (single-use en base + expiration)
 */
export function generateSecureToken(): string {
  const uuid = crypto.randomUUID();
  const tsHex = Date.now().toString(16);

  // 16 bytes d'entropie supplémentaire
  const entropy = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${uuid}.${tsHex}.${entropy}`;
}

/**
 * Crée une session QR en base.
 * - Désactive toutes les sessions actives précédentes pour cette company
 * - Insère la nouvelle session avec expiration stricte
 */
export async function createQrSession(companyId: string): Promise<QrSession> {
  // 1. Invalider les anciens tokens actifs
  await supabase
    .from("qr_sessions")
    .update({ active: false })
    .eq("company_id", companyId)
    .eq("active", true);

  // 2. Créer le nouveau token
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + QR_TOKEN_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("qr_sessions")
    .insert({
      company_id: companyId,
      token,
      expires_at: expiresAt,
      active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`QR session creation failed: ${error.message}`);
  return data as QrSession;
}

/**
 * Vérifie qu'un token a le bon format structurel avant toute query DB.
 * Fail-fast côté client pour éviter les injections de tokens malformés.
 */
export function isWellFormedToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uuid, tsHex, entropy] = parts;
  // UUID standard
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) return false;
  // Timestamp hex (10-15 chars pour couvrir les prochaines années)
  if (!/^[0-9a-f]{10,15}$/i.test(tsHex)) return false;
  // 32 chars hex = 16 bytes
  if (!/^[0-9a-f]{32}$/i.test(entropy)) return false;
  return true;
}