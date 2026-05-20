import { supabase } from "@/lib/supabase";
import type { Company } from "@/types";

export async function createCompany(
  name: string,
  location: string,
  lat: number,
  lng: number,
  ownerId: string
): Promise<Company | null> {
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

  if (error) throw error;
  return data as Company;
}

export async function fetchCompanyByCode(code: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("code", code)
    .single();

  if (error) return null;
  return data as Company;
}

export async function fetchCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase.from("companies").select("*").eq("id", id).single();
  if (error) return null;
  return data as Company;
}

export async function updateCompany(id: string, updates: Partial<Company>) {
  const { data, error } = await supabase.from("companies").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as Company;
}

function generateCompanyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SP-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
