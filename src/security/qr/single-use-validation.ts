/**
 * single-use-validation.ts
 * Garantit qu'un token QR ne peut être utilisé qu'une seule fois.
 *
 * AVOCAT DU DIABLE :
 * La validation en base SEULE n'est pas suffisante — une race condition
 * permet deux requêtes simultanées de passer si l'UPDATE n'est pas atomique.
 * La vraie protection est dans la Edge Function (UPDATE + RETURNING atomique).
 * Ce fichier est le guard côté client.
 */

import { supabase } from "@/lib/supabase";
import { isWellFormedToken } from "./token-generation";
import { isTokenInValidWindow } from "./expiration-logic";

export interface TokenValidationResult {
  valid: boolean;
  reason?: string;
  session?: {
    id: string;
    company_id: string;
    expires_at: string;
  };
}

/**
 * Pré-validation côté client avant d'appeler la Edge Function.
 * Économise un round-trip réseau sur les tokens évidemment invalides.
 */
export async function prevalidateToken(token: string): Promise<TokenValidationResult> {
  // 1. Format structurel
  if (!isWellFormedToken(token)) {
    return { valid: false, reason: "TOKEN_MALFORMED" };
  }

  // 2. Vérifie en base que le token existe, est actif et non utilisé
  const { data, error } = await supabase
    .from("qr_sessions")
    .select("id, company_id, expires_at, active, used_at")
    .eq("token", token)
    .single();

  if (error || !data) {
    return { valid: false, reason: "TOKEN_NOT_FOUND" };
  }

  if (!data.active) {
    return { valid: false, reason: "TOKEN_INACTIVE" };
  }

  if (data.used_at) {
    return { valid: false, reason: "TOKEN_ALREADY_USED" };
  }

  if (!isTokenInValidWindow(data.expires_at)) {
    return { valid: false, reason: "TOKEN_EXPIRED" };
  }

  return {
    valid: true,
    session: {
      id: data.id,
      company_id: data.company_id,
      expires_at: data.expires_at,
    },
  };
}

/**
 * Marque un token comme utilisé côté client (optimistic).
 * La vraie marque atomique est faite par la Edge Function.
 * Utilisé pour bloquer un double-scan rapide dans le même client.
 */
export async function markTokenAsUsedOptimistic(token: string): Promise<void> {
  await supabase
    .from("qr_sessions")
    .update({ active: false, used_at: new Date().toISOString() })
    .eq("token", token);
}