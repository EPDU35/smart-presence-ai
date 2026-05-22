import { supabase } from "@/lib/supabase";
import type { Company } from "@/types";

/** Colonnes qu'on ne met jamais à jour via l'API client */
const READONLY_COMPANY_KEYS = new Set([
  "id",
  "code",
  "created_at",
  "updated_at",
  "owner_id",
  "plan",
  "is_active",
  "logo_url",
]);

export async function createCompany(
  name: string,
  location: string,
  lat: number,
  lng: number,
  ownerId: string
): Promise<Company> {
  const code = generateCompanyCode();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      location,
      latitude: lat,
      longitude: lng,
      owner_id: ownerId,
      code,
      radius: 100,
      plan: "starter",
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

/** Clés réellement renvoyées par Supabase pour cette ligne (schéma déployé) */
export function getUpdatableCompanyKeys(company: Company | null): (keyof Company)[] {
  if (!company) return ["name", "latitude", "longitude", "radius"];
  return (Object.keys(company) as (keyof Company)[]).filter(
    (key) => !READONLY_COMPANY_KEYS.has(key)
  );
}

export function companyHasScheduleColumns(company: Company | null): boolean {
  if (!company) return false;
  return (
    Object.prototype.hasOwnProperty.call(company, "opening_time") &&
    Object.prototype.hasOwnProperty.call(company, "closing_time")
  );
}

function buildPayloadFromExisting(
  updates: Partial<Company>,
  existing: Company | null
): Record<string, unknown> {
  const allowed = new Set(getUpdatableCompanyKeys(existing));
  const payload: Record<string, unknown> = {};

  for (const key of Object.keys(updates) as (keyof Company)[]) {
    if (!allowed.has(key)) continue;
    const value = updates[key];
    if (value !== undefined) payload[key] = value;
  }

  return payload;
}

function extractMissingColumn(message: string): string | null {
  const schemaCache = message.match(/Could not find the '([^']+)' column of 'companies'/i);
  if (schemaCache) return schemaCache[1];
  const pg = message.match(/column "([^"]+)" of relation "companies"/i);
  if (pg) return pg[1];
  return null;
}

export async function updateCompany(
  id: string,
  updates: Partial<Company>,
  existingCompany?: Company | null
): Promise<Company> {
  let payload = buildPayloadFromExisting(updates, existingCompany ?? null);

  if (Object.keys(payload).length === 0) {
    throw new Error("Aucun champ modifiable à enregistrer");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch = (body: Record<string, unknown>) =>
    supabase.from("companies").update(body as any).eq("id", id).select().single();

  let result = await patch(payload);

  // Retire colonne par colonne si le schéma Supabase n'est pas à jour
  let guard = 0;
  while (result.error && guard < 12) {
    const missing = extractMissingColumn(result.error.message);
    if (!missing || !(missing in payload)) {
      throw new Error(result.error.message);
    }
    const next = { ...payload };
    delete next[missing];
    payload = next;
    if (Object.keys(payload).length === 0) {
      throw new Error(
        "Schéma Supabase incomplet — exécutez supabase-schema-additions.sql dans le SQL Editor"
      );
    }
    result = await patch(payload);
    guard++;
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
