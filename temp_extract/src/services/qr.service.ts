// @ts-nocheck
import { supabase } from "@/lib/supabase";
import type { QrSession } from "@/types";

export async function fetchActiveQrSession(companyId: string): Promise<QrSession | null> {
  const { data, error } = await supabase
    .from("qr_sessions")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("expires_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as QrSession;
}

export async function generateQrToken(companyId: string): Promise<QrSession> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 1000).toISOString();

  const { data, error } = await supabase
    .from("qr_sessions")
    .insert({ company_id: companyId, token, expires_at: expiresAt, active: true })
    .select()
    .single();

  if (error) throw error;
  return data as QrSession;
}

export async function deactivateOldSessions(companyId: string) {
  const { error } = await supabase
    .from("qr_sessions")
    .update({ active: false })
    .eq("company_id", companyId)
    .eq("active", true);

  if (error) throw error;
}
