import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

/* ─────────────────────────────────────────
   SIGN UP
   Cree un compte Supabase Auth
   Le trigger handle_new_user cree le profil automatiquement
───────────────────────────────────────── */
export async function signUp(
  email: string,
  password: string,
  meta?: { firstname?: string; lastname?: string }
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        firstname: meta?.firstname ?? "",
        lastname:  meta?.lastname  ?? "",
      },
    },
  });
  return { data, error };
}

/* ─────────────────────────────────────────
   UPDATE PROFILE
   Met a jour le profil apres inscription
   (company_id, role, firstname, lastname)
───────────────────────────────────────── */
export async function updateProfile(
  userId: string,
  updates: {
    firstname?:  string;
    lastname?:   string;
    role?:       string;
    company_id?: string;
  }
) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  return { data: data as User | null, error };
}

/* ─────────────────────────────────────────
   SIGN IN
───────────────────────────────────────── */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/* ─────────────────────────────────────────
   SIGN OUT
───────────────────────────────────────── */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/* ─────────────────────────────────────────
   GET SESSION
───────────────────────────────────────── */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { data, error };
}

/* ─────────────────────────────────────────
   GET CURRENT USER (profil complet)
───────────────────────────────────────── */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as User;
}

/* ─────────────────────────────────────────
   REFRESH SESSION
───────────────────────────────────────── */
export async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  return { data, error };
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD
───────────────────────────────────────── */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
}