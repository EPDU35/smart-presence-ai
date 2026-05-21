// @ts-nocheck
import { supabase } from "@/lib/supabase";
import type { Checkin } from "@/types";

export async function fetchCheckins(companyId: string): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Checkin[];
}

export async function fetchCheckinsByUser(userId: string): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Checkin[];
}

export async function createCheckin(
  checkin: Omit<Checkin, "id" | "created_at" | "device_info" | "ip_address"> & {
    device_info?: string | null;
    ip_address?: string | null;
  }
) {
  const { data, error } = await supabase.from("checkins").insert(checkin).select().single();
  if (error) throw error;
  return data as Checkin;
}

export async function fetchTodayCheckins(companyId: string): Promise<Checkin[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("company_id", companyId)
    .gte("created_at", `${today}T00:00:00`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Checkin[];
}

export async function fetchWeekCheckins(companyId: string): Promise<Checkin[]> {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("company_id", companyId)
    .gte("created_at", monday.toISOString())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Checkin[];
}
