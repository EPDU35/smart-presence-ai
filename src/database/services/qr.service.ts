// ===== database/services/qr.service.ts =====
// Rôle : Génération et gestion du cycle de vie des sessions QR
// Dépend de : qr_sessions

import { supabase } from '@/lib/supabase';
import type { QrSession } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Récupère la session QR active pour une company.
 * "Active" signifie : active=true ET used_at IS NULL ET expires_at dans le futur.
 *
 * Si plusieurs sessions actives existent (cas anormal), retourne la plus récente.
 *
 * @param companyId - UUID de la company
 * @returns QrSession active ou null si aucune session en cours
 */
export async function getActiveSession(companyId: string): Promise<QrSession | null> {
  const { data, error } = await supabase
    .from('qr_sessions')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // .single() retourne une erreur si aucune ligne — on retourne null (pas throw)
  if (error || !data) return null;
  return data as QrSession;
}

/**
 * Crée une nouvelle session QR pour une company.
 *
 * ⚠️  ORDRE DES OPÉRATIONS CRITIQUE :
 * On désactive les anciennes sessions AVANT de créer la nouvelle.
 * Inverser cet ordre créerait une fenêtre de quelques millisecondes où
 * deux sessions actives coexistent — un employé rapide pourrait scanner
 * l'ancien token pendant que le nouveau est affiché à l'admin.
 *
 * @param companyId - UUID de la company
 * @returns Nouvelle QrSession créée, avec token UUID et expiration à 15 secondes
 */
export async function createSession(companyId: string): Promise<QrSession> {
  // Étape 1 : désactivation de toutes les sessions actives existantes
  // On utilise .neq pour une condition de garde explicite — même si active=true
  // est déjà le filtre, on veut être certain de ne toucher que les sessions
  // actives et pas les sessions historiques déjà désactivées.
  const { error: deactivateError } = await supabase
    .from('qr_sessions')
    .update({ active: false })
    .eq('company_id', companyId)
    .eq('active', true);

  if (deactivateError) throw new Error(deactivateError.message);

  // Étape 2 : création de la nouvelle session
  // expires_at est calculé ici (15 secondes) — la valeur DEFAULT en base
  // fait la même chose, mais on la passe explicitement pour être explicite
  // sur le timing et pour que le retour contienne la bonne valeur sans
  // avoir à refaire un SELECT.
  const expiresAt = new Date(Date.now() + 15_000).toISOString();

  const { data, error } = await supabase
    .from('qr_sessions')
    .insert({
      company_id: companyId,
      token: uuidv4(),
      expires_at: expiresAt,
      active: true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Création de session QR échouée');
  }

  return data as QrSession;
}

/**
 * Invalide manuellement une session QR (ex: l'admin ferme la page QR).
 *
 * @param sessionId - UUID de la session à invalider
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('qr_sessions')
    .update({ active: false })
    .eq('id', sessionId);

  if (error) throw new Error(error.message);
}

/**
 * Récupère l'historique des sessions QR d'une company.
 * Utile pour l'audit et pour détecter des patterns d'usage anormaux.
 *
 * @param companyId - UUID de la company
 * @param limit - Nombre maximum de sessions à retourner (défaut: 50)
 * @returns Tableau de sessions triées de la plus récente à la plus ancienne
 */
export async function getSessionHistory(
  companyId: string,
  limit: number = 50,
): Promise<QrSession[]> {
  const { data, error } = await supabase
    .from('qr_sessions')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as QrSession[];
}