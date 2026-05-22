// ===== database/services/employee.service.ts =====
// Rôle : Gestion CRUD des employés et consultation de leur historique
// Dépend de : users, checkins

import { supabase } from '@/lib/supabase';
import type { User, Checkin } from '@/types';

/**
 * Type retourné par getEmployeeWithCheckins.
 * Pas dans src/types car c'est un type composite spécifique à ce cas d'usage.
 */
interface EmployeeWithCheckins {
  user: User;
  checkins: Checkin[];
}

/**
 * Récupère tous les employés actifs d'une company.
 * "Actif" signifie is_active = true — les comptes désactivés sont exclus.
 *
 * @param companyId - UUID de la company
 * @returns Tableau d'utilisateurs actifs, trié par nom
 */
export async function getActiveEmployees(companyId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('lastname', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as User[];
}

/**
 * Désactive un employé (soft delete) en passant is_active à false.
 *
 * On préfère un soft delete à un DELETE réel pour préserver l'intégrité
 * des checkins historiques — un DELETE en cascade effacerait l'historique
 * de présence de l'employé, ce qui est problématique pour les audits.
 *
 * @param userId - UUID de l'employé à désactiver
 */
export async function deactivateEmployee(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

/**
 * Récupère le profil d'un employé et son historique de checkins sur une période.
 *
 * Syntaxe Supabase : on fait deux requêtes séparées plutôt qu'un JOIN
 * pour garder les types propres. La syntaxe .select('*, checkins(*)')
 * retourne un type imbriqué difficile à typer strictement sans générique complexe.
 *
 * @param userId - UUID de l'employé
 * @param from - Début de période (ISO string)
 * @param to - Fin de période (ISO string)
 * @returns Objet { user, checkins } ou null si l'employé n'existe pas
 */
export async function getEmployeeWithCheckins(
  userId: string,
  from: string,
  to: string,
): Promise<EmployeeWithCheckins | null> {
  // Requête 1 : profil de l'employé
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !userData) return null;

  // Requête 2 : ses checkins sur la période
  // Filtre user_id en tête pour utiliser idx_checkins_user_date (SEC-01)
  const { data: checkinData, error: checkinError } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false });

  if (checkinError) throw new Error(checkinError.message);

  return {
    user: userData as User,
    checkins: (checkinData ?? []) as Checkin[],
  };
}

/**
 * Récupère un employé par son ID.
 *
 * @param userId - UUID de l'employé
 * @returns User ou null si introuvable
 */
export async function fetchEmployeeById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as User;
}

/**
 * Met à jour les informations d'un employé.
 *
 * @param userId - UUID de l'employé
 * @param updates - Champs à mettre à jour (subset partiel de User)
 * @returns User mis à jour
 */
export async function updateEmployee(
  userId: string,
  updates: Partial<Pick<User, 'firstname' | 'lastname' | 'email' | 'phone' | 'avatar' | 'role'>>,
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Mise à jour échouée');
  return data as User;
}