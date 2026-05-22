import { supabase } from "@/lib/supabase";
import type { QrSession } from "@/types";

// Correction erreur TS2307 : Cannot find module 'uuid'
// uuid n'est pas installé — on utilise crypto.randomUUID() natif (ES2022)
// disponible dans tous les navigateurs modernes et Vite.
function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

const QR_TTL_SECONDS = Number(import.meta.env.VITE_QR_EXPIRY_SECONDS ?? 15);

export async function generateQrToken(companyId: string): Promise<QrSession> {
  const token     = generateToken();
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000).toISOString();

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

  if (error) throw new Error(`QR generation failed: ${error.message}`);
  return data as QrSession;
}

export async function deactivateOldSessions(companyId: string): Promise<void> {
  await supabase
    .from("qr_sessions")
    .update({ active: false })
    .eq("company_id", companyId)
    .eq("active", true);
}

export async function validateQrToken(
  token: string,
  companyId: string
): Promise<{ valid: boolean; sessionId?: string }> {
  const { data, error } = await supabase
    .from("qr_sessions")
    .select("id, expires_at, active, used_at")
    .eq("token", token)
    .eq("company_id", companyId)
    .single();

  if (error || !data) return { valid: false };
  if (!data.active)    return { valid: false };
  if (data.used_at)    return { valid: false };
  if (new Date(data.expires_at) < new Date()) return { valid: false };

  return { valid: true, sessionId: data.id };
}

export async function fetchActiveSession(
  companyId: string
): Promise<QrSession | null> {
  const { data } = await supabase
    .from("qr_sessions")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data as QrSession | null;
}
