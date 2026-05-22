// ===== database/services/suspicious.service.ts =====
// Rôle : Logging et consultation des événements de sécurité suspects
// Dépend de : suspicious_logs

import { supabase } from '@/lib/supabase';
import type { SuspiciousLog } from '@/types';

/**
 * Type pour les statistiques des événements suspects.
 */
interface SuspiciousStats {
  total: number;
  unresolved: number;
  // Record<reason, count> — par exemple { "GPS_FALSIFIED": 3, "DOUBLE_SCAN": 7 }
  byReason: Record<string, number>;
}

/**
 * Récupère les logs suspects d'une company, avec filtre optionnel sur resolved.
 *
 * Filtre company_id en tête (SEC-01) pour l'isolation multi-tenant.
 *
 * @param companyId - UUID de la company
 * @param resolved - Si fourni, filtre sur le statut de résolution.
 *   undefined = tous les logs, true = résolus, false = non résolus
 * @returns Tableau de SuspiciousLog triés du plus récent au plus ancien
 */
export async function getSuspiciousLogs(
  companyId: string,
  resolved?: boolean,
): Promise<SuspiciousLog[]> {
  let query = supabase
    .from('suspicious_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  // On ajoute le filtre resolved seulement si la valeur est explicitement fournie.
  // undefined signifie "pas de filtre" — on ne veut pas traiter undefined comme false.
  if (resolved !== undefined) {
    query = query.eq('resolved', resolved);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SuspiciousLog[];
}

/**
 * Enregistre un événement suspect dans les logs de sécurité.
 *
 * ⚠️  ROBUSTESSE CRITIQUE : cette fonction est appelée depuis createCheckin()
 * en cas de détection d'anomalie. Si elle échoue, elle NE DOIT PAS propager
 * l'erreur vers createCheckin() — le checkin (SUSPICIOUS ou INVALID) doit
 * quand même être créé. On log l'erreur en console mais on ne throw pas.
 *
 * @param log - Données du log sans id ni created_at (générés par Supabase)
 */
export async function logSuspiciousEvent(
  log: Omit<SuspiciousLog, 'id' | 'created_at'>,
): Promise<void> {
  const { error } = await supabase
    .from('suspicious_logs')
    .insert({
      user_id: log.user_id,
      company_id: log.company_id,
      reason: log.reason,
      device: log.device,
      ip: log.ip,
      metadata: log.metadata,
      resolved: log.resolved ?? false,
    });

  // On log sans throw — voir JSDoc ci-dessus pour la raison
  if (error) {
    console.error('[suspicious.service] Échec du logging d\'événement suspect:', error.message);
  }
}

/**
 * Marque un log suspect comme résolu (après investigation admin).
 *
 * @param logId - UUID du log à marquer comme résolu
 */
export async function markResolved(logId: string): Promise<void> {
  const { error } = await supabase
    .from('suspicious_logs')
    .update({ resolved: true })
    .eq('id', logId);

  if (error) throw new Error(error.message);
}

/**
 * Calcule les statistiques des événements suspects pour le dashboard sécurité.
 * Agrégation côté JS pour rester testable sans mock SQL.
 *
 * @param companyId - UUID de la company
 * @returns Stats avec total, non-résolus et répartition par raison
 */
export async function getSuspiciousStats(companyId: string): Promise<SuspiciousStats> {
  const { data, error } = await supabase
    .from('suspicious_logs')
    .select('reason, resolved')
    .eq('company_id', companyId);

  if (error) throw new Error(error.message);
  const logs = data ?? [];

  // Construction du compteur par raison via reduce
  // Ex: [{ reason: 'GPS_FALSIFIED' }, { reason: 'GPS_FALSIFIED' }, { reason: 'DOUBLE_SCAN' }]
  // → { GPS_FALSIFIED: 2, DOUBLE_SCAN: 1 }
  const byReason = logs.reduce<Record<string, number>>((acc, log) => {
    const reason = log.reason as string;
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: logs.length,
    unresolved: logs.filter((l) => l.resolved === false).length,
    byReason,
  };
}