// @ts-nocheck
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
}

export async function createProfile(userId: string, profile: { fullname: string; email: string; role: string; company_id?: string }) {
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: userId, ...profile })
    .select()
    .single();
  return { data: data as User | null, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { data, error };
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as User;
}

export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  return { data, error };
}
