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
  const cleaned = code?.toString().trim();
  if (!cleaned) return null;

  // Try exact match (normalized)
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("code", cleaned.toUpperCase())
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase error (exact): ${error.message}`);
    }
    if (data) return data as Company;

    // Fallback: case-insensitive match (in case the DB stores different casing)
    const { data: data2, error: error2 } = await supabase
      .from("companies")
      .select("*")
      .ilike("code", cleaned)
      .maybeSingle();

    if (error2) {
      throw new Error(`Supabase error (ilike): ${error2.message}`);
    }
    if (data2) return data2 as Company;
  } catch (err) {
    // Unexpected JS error — rethrow so callers can handle/display it
    console.error("fetchCompanyByCode unexpected error", err);
    throw err;
  }

}

/* ─────────────────────────────────────────
   UPDATE COMPANY
───────────────────────────────────────── */
export async function updateCompany(
  id:      string,
  updates: Partial<Company>
): Promise<Company> {
  const allowedFields = [
    "name",
    "email",
    "phone",
    "location",
    "latitude",
    "longitude",
    "radius",
    "opening_time",
    "closing_time",
    "late_tolerance",
    "plan",
    "logo_url",
    "is_active",
  ] as const;

  let sanitizedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
    if ((allowedFields as readonly string[]).includes(key)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (acc as any)[key] = value;
    }
    return acc;
  }, {} as Partial<Company>);

  const invalidColumnRegex = /Could not find the '(.+?)' column of 'companies' in the schema cache/i;
  let lastError: Error | null = null;

  while (Object.keys(sanitizedUpdates).length > 0) {
    const { data, error } = await supabase
      .from("companies")
      .update(sanitizedUpdates as any)
      .eq("id", id)
      .select()
      .single();

    if (!error) {
      return data as Company;
    }

    const match = invalidColumnRegex.exec(error.message);
    if (!match) {
      throw new Error(error.message);
    }

    const invalidColumn = match[1] as keyof Company;
    lastError = new Error(error.message);

    // Remove the offending column and retry without it.
    // This allows the update to proceed when the DB schema is not yet migrated.
    sanitizedUpdates = Object.entries(sanitizedUpdates).reduce((acc, [key, value]) => {
      if (key !== invalidColumn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc as any)[key] = value;
      }
      return acc;
    }, {} as Partial<Company>);
  }

  throw lastError ?? new Error("Aucune donnée à mettre à jour");
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