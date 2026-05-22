// ===== database/services/auth.service.ts =====
// Rôle : Authentification et gestion des profils utilisateurs
// Dépend de : auth.users (Supabase Auth), public.users

import { supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/types';

/**
 * Récupère tous les utilisateurs appartenant à une company.
 * Utilisé par l'admin pour lister les membres de son organisation.
 *
 * Filtre sur company_id pour respecter l'isolation multi-tenant (SEC-01).
 * Trie par nom pour un affichage cohérent.
 *
 * @param companyId - UUID de la company
 * @returns Tableau d'utilisateurs, vide si aucun membre
 */
export async function getUsersByCompany(companyId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('company_id', companyId)
    .order('lastname', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as User[];
}

/**
 * Met à jour le timestamp last_seen de l'utilisateur connecté.
 * Appelé à chaque chargement de page ou action significative.
 *
 * Utilise auth.uid() implicitement via la policy RLS — seul l'utilisateur
 * peut mettre à jour son propre last_seen.
 *
 * @param userId - UUID de l'utilisateur à mettre à jour
 */
export async function updateLastSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

/**
 * Récupère le rôle d'un utilisateur depuis public.users.
 *
 * ⚠️  SÉCURITÉ (SEC-02) : Le rôle est toujours lu depuis la table `users`,
 * jamais depuis auth.jwt() ou user_metadata. Les métadonnées JWT peuvent
 * être manipulées côté client — la table users est protégée par RLS.
 *
 * @param userId - UUID de l'utilisateur
 * @returns UserRole si l'utilisateur existe, null sinon
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  // Cast explicite : Supabase retourne { role: string } mais on sait
  // que la contrainte CHECK en base garantit une valeur UserRole valide.
  return data.role as UserRole;
}

/**
 * Récupère le profil complet de l'utilisateur actuellement connecté.
 * Utilise auth.uid() pour identifier l'utilisateur sans paramètre externe.
 *
 * @returns User complet ou null si non authentifié
 */
export async function getCurrentUserProfile(): Promise<User | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error || !data) return null;
  return data as User;
}