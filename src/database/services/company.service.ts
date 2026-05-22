// ===== database/services/company.service.ts =====
// Rôle : Lecture et statistiques des companies
// Dépend de : companies, users, checkins

import { supabase } from '@/lib/supabase';
import type { Company } from '@/types';

/** Constante réutilisable : début de la journée courante en ISO */
const getTodayStart = (): string =>
  new Date().toISOString().split('T')[0] + 'T00:00:00';

/**
 * Interface décrivant les statistiques agrégées d'une company pour le dashboard.
 * Pas dans src/types/index.ts car spécifique à ce service.
 */
interface CompanyStats {
  totalEmployees: number;
  todayPresent: number;
  todayAbsent: number;
  suspiciousCount: number;
}

/**
 * Calcule les statistiques temps réel d'une company pour le dashboard admin.
 *
 * Stratégie : on charge les données brutes depuis deux tables (users + checkins)
 * et on agrège côté JS pour rester testable sans mock SQL complexe.
 * Pour des volumes > 10K employés, envisager de migrer vers une RPC Supabase.
 *
 * @param companyId - UUID de la company
 * @returns Objet stats avec compteurs présents/absents/suspects
 */
export async function getCompanyStats(companyId: string): Promise<CompanyStats> {
  // Requête 1 : nombre total d'employés actifs dans la company
  const { count: totalEmployees, error: empError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (empError) throw new Error(empError.message);

  // Requête 2 : checkins d'aujourd'hui pour cette company
  // On récupère uniquement les colonnes nécessaires à l'agrégation
  const { data: todayCheckins, error: checkinError } = await supabase
    .from('checkins')
    .select('user_id, status')
    .eq('company_id', companyId)
    .gte('created_at', getTodayStart());

  if (checkinError) throw new Error(checkinError.message);

  const checkins = todayCheckins ?? [];

  // Employés distincts ayant au moins un checkin VALID aujourd'hui
  const presentUserIds = new Set(
    checkins
      .filter((c) => c.status === 'VALID')
      .map((c) => c.user_id),
  );

  const todayPresent = presentUserIds.size;
  const total = totalEmployees ?? 0;

  return {
    totalEmployees: total,
    todayPresent,
    // todayAbsent = employés actifs qui n'ont PAS de checkin VALID aujourd'hui
    todayAbsent: Math.max(0, total - todayPresent),
    suspiciousCount: checkins.filter((c) => c.status === 'SUSPICIOUS').length,
  };
}

/**
 * Récupère la company dont l'utilisateur donné est le propriétaire (owner_id).
 * Utilisé lors de l'onboarding pour retrouver la company d'un admin nouvellement créé.
 *
 * @param ownerId - UUID de l'utilisateur propriétaire
 * @returns Company ou null si cet utilisateur n'est pas owner d'une company
 */
export async function getCompanyByOwnerId(ownerId: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', ownerId)
    .single();

  if (error || !data) return null;
  return data as Company;
}

/**
 * Récupère une company par son ID.
 *
 * @param id - UUID de la company
 * @returns Company ou null si introuvable
 */
export async function fetchCompany(id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Company;
}

/**
 * Récupère une company par son code court unique.
 * Utilisé sur la page d'invitation/onboarding employé.
 *
 * @param code - Code alphanumérique de la company (ex: "ACME42")
 * @returns Company ou null si introuvable
 */
export async function fetchCompanyByCode(code: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('code', code)
    .single();

  if (error || !data) return null;
  return data as Company;
}