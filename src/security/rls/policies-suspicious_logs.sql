-- ============================================================
-- RLS POLICIES — suspicious_logs
-- ============================================================
-- AVOCAT DU DIABLE :
-- Cette table est un journal d'audit de sécurité.
-- Deux problèmes critiques à éviter :
--
-- 1. Un employé qui lit ses propres suspicious_logs sait exactement
--    quels comportements ont déclenché une alerte. Il peut alors
--    calibrer sa fraude pour ne plus déclencher les détecteurs.
--    → EMPLOYEE ne voit JAMAIS ses propres logs.
--
-- 2. Un employé qui peut INSERT → peut polluer la table avec
--    de faux logs, noyer les vraies alertes, créer du bruit.
--    → INSERT uniquement via service_role (Edge Functions).
--
-- RÈGLE : read = admin only. write = service_role only.
-- ============================================================

ALTER TABLE suspicious_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_logs FORCE ROW LEVEL SECURITY;

-- ============================================================
-- SELECT : ADMIN et SUPER_ADMIN uniquement
-- ============================================================
-- EMPLOYEE → zéro visibilité. Toujours.
-- ADMIN → voit les logs de sa company
-- SUPER_ADMIN → voit tous les logs (monitoring plateforme)

CREATE POLICY "suspicious_logs_select_admin"
ON suspicious_logs
FOR SELECT
TO authenticated
USING (
  -- ADMIN de la company concernée
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
  AND company_id IS NOT NULL
);

-- SUPER_ADMIN voit tout — nécessaire pour le monitoring cross-company
-- AVOCAT DU DIABLE : cette policy duplique partiellement la précédente
-- pour un SUPER_ADMIN qui serait dans une company différente de celle du log.
CREATE POLICY "suspicious_logs_select_superadmin"
ON suspicious_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);

-- ============================================================
-- INSERT : Service role uniquement (Edge Functions)
-- ============================================================
-- AVOCAT DU DIABLE : "with check (true)" permettait à n'importe
-- quel user authentifié d'insérer des logs. Fixé.
--
-- Les insertions légitimes proviennent de :
-- - validate-checkin (fraude GPS, outside radius, QR replay)
-- - send-otp (tentatives suspectes)
-- - login flow (new device alert)
-- Ces Edge Functions utilisent service_role → bypasse RLS.
-- Pas de policy INSERT pour authenticated — deny by default.
-- (pas de CREATE POLICY INSERT ici — intentionnel)

-- ============================================================
-- UPDATE : ADMIN peut marquer un log comme résolu
-- ============================================================
-- Résoudre un suspicious_log = l'admin a enquêté et fermé l'alerte.
-- Un EMPLOYEE ne peut jamais modifier ses propres logs.
CREATE POLICY "suspicious_logs_update_resolve_admin"
ON suspicious_logs
FOR UPDATE
TO authenticated
USING (
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
)
WITH CHECK (
  -- L'admin ne peut changer que le champ resolved (pas user_id, company_id, reason)
  -- Cette contrainte est applicative — à enforcer dans le service
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
);

-- ============================================================
-- DELETE : SUPER_ADMIN uniquement — purge des vieux logs
-- ============================================================
-- Supprimer un suspicious_log = effacer une trace d'audit.
-- Action rarissime. SUPER_ADMIN seulement, via dashboard admin.
-- En pratique : préférer archiver plutôt que supprimer.
CREATE POLICY "suspicious_logs_delete_superadmin"
ON suspicious_logs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);

-- ============================================================
-- GRANT minimal
-- ============================================================
GRANT SELECT, UPDATE ON suspicious_logs TO authenticated;
-- Pas d'INSERT ni DELETE pour les users authentifiés
-- INSERT : service_role uniquement (Edge Functions)
-- DELETE : géré par policy mais on retire aussi le privilege
REVOKE INSERT, DELETE ON suspicious_logs FROM authenticated;
