import { supabase } from "@/lib/supabase";
import type { Company } from "@/types";

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

export async function fetchCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Company;
}

export async function fetchCompanyByCode(code: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data) return null;
  return data as Company;
}

const SCHEDULE_COLUMNS = ["opening_time", "closing_time", "late_tolerance"] as const;

function isMissingColumnError(message: string): boolean {
  return SCHEDULE_COLUMNS.some((col) => message.includes(col));
}

/** Colonnes toujours présentes dans le schéma companies de base */
function buildCoreCompanyPayload(updates: Partial<Company>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.radius !== undefined) payload.radius = updates.radius;
  if (updates.latitude !== undefined) payload.latitude = updates.latitude;
  if (updates.longitude !== undefined) payload.longitude = updates.longitude;
  return payload;
}

function buildSchedulePayload(updates: Partial<Company>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updates.opening_time !== undefined) payload.opening_time = updates.opening_time;
  if (updates.closing_time !== undefined) payload.closing_time = updates.closing_time;
  if (updates.late_tolerance !== undefined) payload.late_tolerance = updates.late_tolerance;
  return payload;
}

export function companyHasScheduleColumns(company: Company | null): boolean {
  if (!company) return false;
  return (
    Object.prototype.hasOwnProperty.call(company, "opening_time") ||
    Object.prototype.hasOwnProperty.call(company, "closing_time") ||
    Object.prototype.hasOwnProperty.call(company, "late_tolerance")
  );
}

export async function updateCompany(
  id: string,
  updates: Partial<Company>
): Promise<Company> {
  const core = buildCoreCompanyPayload(updates);
  const schedule = buildSchedulePayload(updates);
  const fullPayload = { ...core, ...schedule };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch = (payload: Record<string, unknown>) =>
    supabase.from("companies").update(payload as any).eq("id", id).select().single();

  let result = await patch(fullPayload);

  if (result.error && isMissingColumnError(result.error.message)) {
    result = await patch(core);
  }

  if (result.error) throw new Error(result.error.message);
  return result.data as Company;
}

function generateCompanyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SP-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
