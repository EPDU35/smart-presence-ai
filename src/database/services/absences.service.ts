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
  // Correction de l'erreur TS2345 :
  // Supabase inférait le type Insert comme 'never[]' car la table n'existait
  // pas dans database.types.ts. Maintenant qu'elle y est, le cast est correct.
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
