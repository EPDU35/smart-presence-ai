// ===== database/realtime/qr_sessions_channel.ts =====
import { supabase } from '@/lib/supabase';
import type { QrSession } from '@/types';

/**
 * Payload typé pour un événement UPDATE sur qr_sessions.
 *
 * Sur un UPDATE, Supabase remplit DEUX objets :
 * - `new` : l'état de la ligne APRÈS la mise à jour
 * - `old` : l'état de la ligne AVANT la mise à jour
 *
 * C'est cette dualité qui nous permet de détecter la transition
 * `used_at: null → string` et de ne déclencher le callback qu'une fois,
 * au moment exact où le QR passe de "disponible" à "consommé".
 *
 * ⚠️  PRÉREQUIS SUPABASE : pour que `old` soit peuplé, la table qr_sessions
 * doit avoir REPLICA IDENTITY FULL activé dans Supabase (Dashboard →
 * Database → Replication → Tables). Sans ça, `old` est toujours `{}`.
 * À vérifier avec Eliel si la détection de transition ne fonctionne pas.
 */
interface QrSessionUpdatePayload {
  eventType: 'UPDATE';
  new: QrSession;
  // `old` ne contient PAS forcément toutes les colonnes — uniquement celles
  // incluses dans REPLICA IDENTITY. On le type avec Partial pour être honnête.
  old: Partial<QrSession>;
  schema: string;
  table: string;
  commit_timestamp: string;
}

/**
 * Ouvre une subscription Realtime sur les UPDATE de `qr_sessions` pour une company.
 * Déclenche `onSessionUsed` UNIQUEMENT quand un QR token passe de disponible
 * à consommé (transition `used_at: null → timestamptz`).
 *
 * Ce pattern "détection de transition" est plus robuste qu'écouter tous les UPDATE,
 * car une session QR peut subir d'autres mises à jour (ex: `active` passe à false
 * après expiration) qui ne doivent pas déclencher la confirmation visuelle.
 *
 * @param companyId - UUID de la company. Sert de filtre server-side ET de
 *   discriminant dans le nom du channel.
 * @param onSessionUsed - Callback déclenché exactement une fois par QR consommé.
 *   Reçoit la QrSession dans son état final (avec `used_at` renseigné).
 * @returns Fonction de cleanup pour useEffect.
 *
 * @example
 * // Dans le composant QrGenerator — détection du scan en temps réel
 * useEffect(() => {
 *   if (!companyId) return;
 *
 *   const unsubscribe = subscribeToQrSession(companyId, (session) => {
 *     if (session.token === currentToken) {
 *       setStatus('scanned'); // Affiche la confirmation visuelle
 *     }
 *   });
 *
 *   return unsubscribe;
 * }, [companyId, currentToken]);
 */
export function subscribeToQrSession(
  companyId: string,
  onSessionUsed: (session: QrSession) => void,
): () => void {
  const channelName = `qr_sessions:company:${companyId}:${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'qr_sessions',
        // Filtre server-side sur company_id pour ne recevoir que les sessions
        // de cette company. Même raisonnement que pour checkins_channel :
        // sans ce filtre, les tokens de toutes les companies transitent en clair
        // sur la WebSocket de chaque client connecté — faille de confidentialité.
        filter: `company_id=eq.${companyId}`,
      },
      (payload) => {
        const typedPayload = payload as unknown as QrSessionUpdatePayload;

        // ─── Détection de la transition used_at: null → valeur ──────────────
        //
        // On vérifie deux conditions :
        // 1. `old.used_at === null` : avant la mise à jour, le QR était disponible.
        //    Si old.used_at était déjà une string, ce n'est pas une nouvelle consommation.
        // 2. `new.used_at !== null` : après la mise à jour, le QR est consommé.
        //
        // Cette double vérification élimine les faux positifs :
        // - Expiration du QR (active passe à false mais used_at reste null)
        // - Éventuelles mises à jour administratives sur d'autres colonnes
        //
        // Note : `old.used_at` peut être `undefined` si REPLICA IDENTITY n'est pas FULL.
        // On traite `undefined` comme `null` via `!= null` (double égal intentionnel ici
        // pour couvrir les deux cas avec une seule expression).
        const wasUnused = typedPayload.old.used_at == null; // null OU undefined
        const isNowUsed = typedPayload.new.used_at !== null;

        if (wasUnused && isNowUsed) {
          onSessionUsed(typedPayload.new);
        }
        // Si la condition n'est pas remplie, on ignore silencieusement l'événement —
        // c'est un UPDATE légitime mais pas une consommation de QR.
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(
          `[qr_sessions_channel] Erreur de connexion Realtime pour company ${companyId}`,
        );
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}