import { supabase } from "@/lib/supabase";
import type { Company } from "@/types";

/* ─────────────────────────────────────────
   CREATE COMPANY
───────────────────────────────────────── */
export async function createCompany(
  name:     string,
  location: string,
  lat:      number,
  lng:      number,
  ownerId:  string
): Promise<Company> {
  const code = generateCompanyCode();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      location,
      latitude:  lat,
      longitude: lng,
      owner_id:  ownerId,
      code,
      radius: 100,
      plan:   "starter",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Company;
}

/* ─────────────────────────────────────────
   FETCH COMPANY BY ID
───────────────────────────────────────── */
export async function fetchCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Company;
}

/* ─────────────────────────────────────────
   FETCH COMPANY BY CODE (pour rejoindre)
───────────────────────────────────────── */
export async function fetchCompanyByCode(code: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data) return null;
  return data as Company;
}

/* ─────────────────────────────────────────
   UPDATE COMPANY
───────────────────────────────────────── */
export async function updateCompany(
  id:      string,
  updates: Partial<Company>
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Company;
}

/* ─────────────────────────────────────────
   GENERATE COMPANY CODE — format SP-XXXXXX
───────────────────────────────────────── */
function generateCompanyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SP-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}