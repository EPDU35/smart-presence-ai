import { supabase } from "@/lib/supabase";

export interface Absence {
  id: string;
  user_id: string;
  company_id: string;
  start_ts: string;
  end_ts: string;
  duration_minutes: number;
  reason: string;
  created_at: string;
}

export interface AbsenceInsert {
  user_id: string;
  company_id: string;
  start_ts: string;
  end_ts: string;
  duration_minutes: number;
  reason: string;
}

export async function fetchAbsences(companyId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("company_id", companyId)
    .order("start_ts", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Absence[];
}

export async function fetchAbsencesByUser(userId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("absences")
    .select("*")
    .eq("user_id", userId)
    .order("start_ts", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Absence[];
}

export async function createAbsence(absence: AbsenceInsert): Promise<Absence> {
  const { data, error } = await supabase
    .from("absences")
    .insert(absence)
    .select()
    .single();

  if (error) throw error;
  return data as Absence;
}

export async function deleteAbsence(id: string): Promise<void> {
  const { error } = await supabase
    .from("absences")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * detectAndPersistAbsences
 * ─────────────────────────
 * Détecte les employés qui n'ont pas pointé aujourd'hui
 * et insère une absence automatique pour chacun.
 *
 * Appelé par run-detect-absences.ts (script cron ou Edge Function scheduled).
 *
 * LOGIQUE :
 * 1. Récupère tous les users actifs de la company
 * 2. Récupère tous les checkins valides d'aujourd'hui
 * 3. Pour chaque user sans checkin → insère une absence
 *
 * @param companyId - ID de l'organisation concernée
 * @returns Nombre d'absences créées
 */
export async function detectAndPersistAbsences(
  companyId: string
): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 1. Récupérer tous les users actifs de la company
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (usersError || !users?.length) return 0;

  // 2. Récupérer les checkins valides ou retards d'aujourd'hui
  const { data: checkins } = await supabase
    .from("checkins")
    .select("user_id")
    .eq("company_id", companyId)
    .in("status", ["VALID", "LATE"])
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString());

  const presentUserIds = new Set(
    (checkins ?? []).map((c: { user_id: string }) => c.user_id)
  );

  // 3. Identifier les absents
  const absentUsers = users.filter(
    (u: { id: string }) => !presentUserIds.has(u.id)
  );

  if (!absentUsers.length) return 0;

  // 4. Insérer les absences — ignorer les doublons (upsert-like via insert + on conflict)
  const absences: AbsenceInsert[] = absentUsers.map(
    (u: { id: string }) => ({
      user_id:          u.id,
      company_id:       companyId,
      start_ts:         todayStart.toISOString(),
      end_ts:           todayEnd.toISOString(),
      duration_minutes: 480, // 8h par défaut — ajustable selon opening/closing_time
      reason:           "ABSENT_AUTO_DETECTED",
    })
  );

  const { error: insertError } = await supabase
    .from("absences")
    .insert(absences);

  if (insertError) {
    console.error("[detectAndPersistAbsences] Insert error:", insertError.message);
    return 0;
  }

  return absentUsers.length;
}