// @ts-nocheck
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

export async function fetchEmployees(companyId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as User[];
}

export async function fetchEmployeeById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as User;
}

export async function createEmployee(
  employee: Omit<User, "id" | "created_at" | "is_active" | "updated_at" | "last_seen"> & {
    is_active?: boolean;
    last_seen?: string | null;
    updated_at?: string;
  }
) {
  const { data, error } = await supabase.from("users").insert(employee).select().single();
  if (error) throw error;
  return data as User;
}

export async function updateEmployee(id: string, updates: Partial<User>) {
  const { data, error } = await supabase.from("users").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as User;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
}
