// ===== database/services/checkin.service.ts =====
// Rôle : Création et consultation des checkins de présence
// Dépend de : checkins, qr_sessions, companies
// ⚠️  Ce service contient createCheckin() — chemin critique de sécurité

import { supabase } from '@/lib/supabase';
import type { Checkin, CheckinStatus } from '@/types';

// Importée depuis les utils du projet — calcule la distance haversine en mètres
// entre deux points GPS. NE PAS recalculer ici : cette fonction est la source
// de vérité pour les distances dans tout le projet (cf. Erreur critique 6).
import { haversineDistance } from '@/utils/geo';
import { qrTokenLookupVariants } from '@/utils/qr-token';
import { computeCheckinStatus, isOutsideOpeningHours } from '@/utils/attendance-hours';

// Début de la journée courante — factory function (pas une constante statique)
// car si le service reste en mémoire après minuit, une constante statique
// pointerait vers le jour précédent. La factory recalcule à chaque appel.
const TODAY_START = (): string =>
  new Date().toISOString().split('T')[0] + 'T00:00:00';

/**
 * Type pour la création d'un checkin — ce que le frontend envoie.
 * Le status N'EST PAS inclus : il est calculé côté service (SEC-05).
 */
interface CreateCheckinInput {
  qrToken: string;
  latitude: number;
  longitude: number;
  deviceInfo?: string;
  ipAddress?: string;
}

interface QrSessionRow {
  id: string;
  company_id: string;
  expires_at: string;
  active: boolean;
  used_at: string | null;
}

async function resolveQrSession(
  rawToken: string,
  companyId?: string,
): Promise<QrSessionRow> {
  for (const token of qrTokenLookupVariants(rawToken)) {
    let query = supabase
      .from('qr_sessions')
      .select('id, company_id, expires_at, active, used_at')
      .eq('token', token);

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query.maybeSingle();
    if (error || !data) continue;

    const row = data as QrSessionRow;
    if (row.used_at) {
      throw new Error('Ce QR code a déjà été utilisé — scannez le QR actuel à l\'écran admin');
    }
    if (!row.active) {
      throw new Error('QR code remplacé — scannez le nouveau code affiché à l\'écran');
    }
    if (new Date(row.expires_at) < new Date()) {
      throw new Error('QR code expiré — demandez un nouveau code à l\'admin');
    }
    return row;
  }

  throw new Error('QR code inconnu — scannez le code affiché actuellement sur l\'écran admin');
}

/**
 * Type retourné par getCheckinStats — agrégation côté JS depuis les données brutes.
 */
interface CheckinStats {
  validCount: number;
  invalidCount: number;
  suspiciousCount: number;
  uniqueEmployees: number;
  totalCheckins: number;
  avgDistance: number;
}

/**
 * Type pour les checkins enrichis avec les infos utilisateur (JOIN implicite).
 */
interface CheckinWithUser extends Checkin {
  users: {
    firstname: string;
    lastname: string;
    email: string;
  } | null;
}

/**
 * Crée un checkin après validation complète côté service.
 *
 * ⚠️  SÉCURITÉ (SEC-03, SEC-04, SEC-05) :
 * Cette fonction est le gardien final de l'intégrité des présences.
 * Elle effectue dans l'ordre :
 *   1. Validation du token QR (existe, non expiré, non consommé)
 *   2. Récupération des coordonnées de référence (company)
 *   3. Calcul de la distance haversine réelle
 *   4. Détermination du status (jamais accepté depuis le client)
 *   5. Marquage du token comme consommé (anti-replay)
 *   6. Insertion du checkin avec toutes les métadonnées
 *
 * @param userId - UUID de l'employé qui pointe
 * @param input - Token QR + coordonnées GPS + infos device
 * @returns Checkin créé avec son status calculé
 */
export async function createCheckin(
  userId: string,
  input: CreateCheckinInput,
  options?: { companyId?: string },
): Promise<Checkin> {
  const session = await resolveQrSession(input.qrToken, options?.companyId);

  const { data: existingToday } = await supabase
    .from('checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('company_id', session.company_id)
    .eq('status', 'VALID')
    .gte('created_at', TODAY_START())
    .limit(1);

  if (existingToday?.length) {
    throw new Error('Vous avez déjà pointé aujourd\'hui');
  }

  // ── Étape 2 : Récupération des coordonnées de référence ───────────────
  // La position de référence et le rayon autorisé viennent de la company,
  // pas du client. C'est la source de vérité pour la validation GPS (SEC-04).
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('latitude, longitude, radius, opening_time, closing_time')
    .eq('id', session.company_id)
    .single();

  if (companyError || !company) {
    throw new Error('Company introuvable pour ce token QR');
  }

  // ── Étape 3 : Calcul de la distance réelle ────────────────────────────
  // haversineDistance retourne la distance en mètres entre deux coordonnées.
  // Cette valeur est authoritative — le client ne peut pas l'influencer.
  const distance = haversineDistance(
    input.latitude,
    input.longitude,
    company.latitude,
    company.longitude,
  );

  // ── Étape 4 : Détermination du status ─────────────────────────────────
  // Le status est calculé en comparant la distance au rayon autorisé.
  // Le client envoie des coordonnées brutes — jamais le status (SEC-05).
  //
  // Logique :
  // - distance <= radius → VALID (dans la zone)
  // - distance > radius mais < radius*3 → SUSPICIOUS (probablement GPS imprécis
  //   ou légèrement hors zone — on log mais on n'invalide pas brutalement)
  // - distance > radius*3 → INVALID (clairement hors zone ou GPS falsifié)
  const status = computeCheckinStatus(
    distance,
    company.radius,
    isOutsideOpeningHours(
      new Date(),
      company.opening_time as string | null,
      company.closing_time as string | null,
    ),
  );

  // ── Étape 5 : Marquage du token comme consommé ────────────────────────
  // On marque AVANT d'insérer le checkin pour éviter la race condition :
  // si deux requêtes arrivent simultanément avec le même token, la deuxième
  // trouvera used_at renseigné et sera rejetée à l'étape 1.
  const { data: consumed, error: updateError } = await supabase
    .from('qr_sessions')
    .update({ used_at: new Date().toISOString(), active: false })
    .eq('id', session.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();

  if (updateError) {
    throw new Error('Impossible de valider le QR — exécutez supabase/fix-qr-consume-rls.sql');
  }
  if (!consumed) {
    throw new Error('Ce QR a déjà été scanné — utilisez le code actuel à l\'écran');
  }

  // ── Étape 6 : Insertion du checkin ────────────────────────────────────
  const { data: checkin, error: checkinError } = await supabase
    .from('checkins')
    .insert({
      user_id: userId,
      company_id: session.company_id,
      qr_token: qrTokenLookupVariants(input.qrToken)[0],
      latitude: input.latitude,
      longitude: input.longitude,
      distance,           // Distance calculée côté service, pas côté client
      status,             // Status calculé côté service, pas côté client
      device_info: input.deviceInfo ?? null,
      ip_address: input.ipAddress ?? null,
    })
    .select()
    .single();

  if (checkinError || !checkin) {
    throw new Error(checkinError?.message ?? 'Création du checkin échouée');
  }

  return checkin as Checkin;
}

/**
 * Récupère les checkins d'aujourd'hui pour une company, avec les infos
 * de l'employé dénormalisées via la syntaxe JOIN de Supabase.
 *
 * @param companyId - UUID de la company
 * @returns Checkins du jour avec firstname, lastname, email de l'employé
 */
export async function getTodayCheckins(companyId: string): Promise<CheckinWithUser[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('*, users(firstname, lastname, email)')
    .eq('company_id', companyId)
    .gte('created_at', TODAY_START())
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []) as CheckinWithUser[];
}

/**
 * Récupère les checkins d'une company sur une période donnée.
 * Utilisé par la page Analytics pour les graphiques temporels.
 *
 * @param companyId - UUID de la company
 * @param from - Début de période (ISO string)
 * @param to - Fin de période (ISO string)
 * @returns Checkins triés du plus récent au plus ancien
 */
export async function getCheckinsByPeriod(
  companyId: string,
  from: string,
  to: string,
): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('company_id', companyId)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Checkin[];
}

/**
 * Récupère l'historique de checkins personnel d'un employé sur une période.
 * Utilisé par la page History de l'employé.
 *
 * Filtre user_id en tête pour utiliser l'index composite (user_id, created_at DESC).
 *
 * @param userId - UUID de l'employé
 * @param from - Début de période (ISO string)
 * @param to - Fin de période (ISO string)
 * @returns Checkins de l'employé sur la période
 */
export async function getUserHistory(
  userId: string,
  from: string,
  to: string,
): Promise<Checkin[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Checkin[];
}

/**
 * Calcule les statistiques agrégées des checkins d'une company sur une période.
 * Agrégation côté JS depuis les données brutes — plus testable qu'une RPC SQL.
 *
 * @param companyId - UUID de la company
 * @param from - Début de période (ISO string)
 * @param to - Fin de période (ISO string)
 * @returns Objet stats avec compteurs et moyennes
 */
export async function getCheckinStats(
  companyId: string,
  from: string,
  to: string,
): Promise<CheckinStats> {
  // On charge uniquement les colonnes nécessaires à l'agrégation
  // pour minimiser le volume de données transférées
  const { data, error } = await supabase
    .from('checkins')
    .select('user_id, status, distance')
    .eq('company_id', companyId)
    .gte('created_at', from)
    .lt('created_at', to);

  if (error) throw new Error(error.message);
  const checkins = data ?? [];

  const uniqueEmployees = new Set(checkins.map((c) => c.user_id)).size;
  const distances = checkins
    .map((c) => c.distance as number)
    .filter((d) => d !== null && !isNaN(d));

  return {
    validCount: checkins.filter((c) => c.status === 'VALID').length,
    invalidCount: checkins.filter((c) => c.status === 'INVALID').length,
    suspiciousCount: checkins.filter((c) => c.status === 'SUSPICIOUS').length,
    uniqueEmployees,
    totalCheckins: checkins.length,
    avgDistance:
      distances.length > 0
        ? Math.round(distances.reduce((sum, d) => sum + d, 0) / distances.length)
        : 0,
  };
}