// ===== database/realtime/checkins_channel.ts =====
import { supabase } from '@/lib/supabase';
import type { Checkin } from '@/types';

/**
 * Payload typé pour un événement INSERT sur la table checkins.
 *
 * On n'utilise pas le type générique RealtimePostgresInsertPayload<T>
 * de Supabase directement dans la signature publique pour deux raisons :
 * 1. Il importe un type lourd dont les consommateurs n'ont pas besoin
 * 2. Nous voulons garantir que `new` est un Checkin complet, pas Partial<Checkin>
 */
interface CheckinInsertPayload {
  eventType: 'INSERT';
  new: Checkin;
  old: Record<string, never>; // Toujours vide sur un INSERT — on le documente explicitement
  schema: string;
  table: string;
  commit_timestamp: string;
}

/**
 * Ouvre une subscription Supabase Realtime sur les INSERT de la table `checkins`,
 * filtrée par company_id pour respecter l'isolation multi-tenant (SEC-01).
 *
 * La fonction retourne un callback de cleanup pur `() => void`, conçu pour
 * être retourné directement depuis un `useEffect` React sans boilerplate.
 *
 * @param companyId - UUID de la company à surveiller. Utilisé à la fois
 *   comme filtre Realtime ET comme partie du nom du channel pour éviter
 *   les collisions entre composants abonnés simultanément.
 * @param onNewCheckin - Callback appelé à chaque nouveau checkin reçu.
 *   Reçoit un objet `Checkin` pleinement typé.
 * @returns Fonction de cleanup qui remove le channel et ferme la WebSocket.
 *
 * @example
 * // Dans un composant React — intégration useEffect minimale
 * useEffect(() => {
 *   const unsubscribe = subscribeToCheckins(companyId, (checkin) => {
 *     setCheckins(prev => [checkin, ...prev]);
 *   });
 *   return unsubscribe; // React appellera ceci au démontage ou si companyId change
 * }, [companyId]);
 */
export function subscribeToCheckins(
  companyId: string,
  onNewCheckin: (checkin: Checkin) => void,
): () => void {
  // Le nom inclut companyId + timestamp pour garantir l'unicité absolue,
  // même si deux instances du même composant sont montées simultanément
  // (ce qui peut arriver en React 18/19 StrictMode avec le double-mount).
  const channelName = `checkins:company:${companyId}:${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'checkins',
        // Le filtre server-side réduit le trafic WebSocket : Supabase n'envoie
        // que les lignes dont company_id correspond. Sans ce filtre, TOUS les
        // checkins de TOUTES les companies transitent par la WebSocket et sont
        // filtrés côté client — une faille de confidentialité ET un gaspillage.
        filter: `company_id=eq.${companyId}`,
      },
      (payload) => {
        // Le cast explicite est nécessaire car Supabase type le payload en
        // RealtimePostgresChangesPayload<Record<string, unknown>> par défaut.
        // On sait que sur un INSERT avec le bon filtre, `new` est bien un Checkin.
        const typedPayload = payload as unknown as CheckinInsertPayload;
        onNewCheckin(typedPayload.new);
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(
          `[checkins_channel] Erreur de connexion Realtime pour company ${companyId}`,
        );
      }
    });

  // On retourne une fonction pure, pas l'objet channel.
  // Cela découple les consommateurs de l'API Supabase interne et rend
  // le cleanup trivial à utiliser dans useEffect.
  return () => {
    supabase.removeChannel(channel);
  };
}