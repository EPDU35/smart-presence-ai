import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import type { SuspiciousLog } from "@/types";

export async function fetchSuspiciousLogs(
  companyId: string,
  onlyUnresolved = false
): Promise<SuspiciousLog[]> {
  let query = supabase
    .from("suspicious_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (onlyUnresolved) {
    query = query.eq("resolved", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SuspiciousLog[];
}

export async function resolveLog(id: string): Promise<void> {
  const { error } = await supabase
    .from("suspicious_logs")
    .update({ resolved: true })
    .eq("id", id);
  if (error) throw error;
}

export async function insertSuspiciousLog(
  userId: string | null,
  companyId: string,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("suspicious_logs").insert({
    user_id:    userId,
    company_id: companyId,
    reason,
    // Cast explicite : Record<string,unknown> → Json
    // Json accepte { [key: string]: Json | undefined }
    // On s'assure que les valeurs sont sérialisables
    metadata:   metadata as Json,
    resolved:   false,
  });
  if (error) throw error;
}
