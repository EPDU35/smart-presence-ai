-- ============================================================
-- RLS POLICIES — qr_sessions
-- ============================================================
-- AVOCAT DU DIABLE :
-- La table qr_sessions est le cœur du système de pointage.
-- Deux attaques à bloquer absolument :
--
-- 1. Un employé qui lit les tokens actifs = peut se pointer lui-même
--    sans scanner physiquement le QR. "Why bother going to the office?"
--
-- 2. Un employé qui INSERT un faux token = peut créer son propre QR
--    et se pointer depuis n'importe où.
--
-- RÈGLE : les employés ne voient JAMAIS les tokens. Jamais.
-- Les tokens ne sont accessibles qu'aux ADMIN (pour affichage QR)
-- et à la Edge Function validate-checkin (service_role).
-- ============================================================

ALTER TABLE qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_sessions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- SELECT : ADMIN voit les sessions de sa company, EMPLOYEE : rien
-- ============================================================
-- AVOCAT DU DIABLE : Si tu donnes SELECT aux employés sur cette table,
-- ils peuvent extraire le token actif via l'API Supabase REST directement.
-- Pas de SELECT pour EMPLOYEE. Zéro. Nada. Rien.
CREATE POLICY "qr_sessions_select_admin_only"
ON qr_sessions
FOR SELECT
TO authenticated
USING (
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
  AND company_id IS NOT NULL
);

-- ============================================================
-- INSERT : ADMIN peut créer des sessions QR
-- ============================================================
-- Appelé depuis token-generation.ts → createQrSession()
-- Seul un ADMIN de la company peut générer un QR pour celle-ci.
CREATE POLICY "qr_sessions_insert_admin"
ON qr_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  -- L'admin ne peut créer des QR que pour sa propre company
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
  AND company_id IS NOT NULL
);

-- ============================================================
-- UPDATE : ADMIN peut désactiver des sessions, Edge Function marque used_at
-- ============================================================
-- L'admin peut passer active = false (invalider manuellement un QR).
-- La Edge Function (service_role) peut mettre used_at et active = false
-- après un scan réussi — service_role bypasse RLS, donc pas de policy
-- nécessaire pour ce cas.
CREATE POLICY "qr_sessions_update_admin"
ON qr_sessions
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
  -- L'admin ne peut pas changer le company_id d'une session
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
);

-- ============================================================
-- DELETE : SUPER_ADMIN peut purger les vieilles sessions
-- ============================================================
-- Action de maintenance. Rare. SUPER_ADMIN seulement.
-- En pratique, utiliser une Edge Function de cleanup cron plutôt.
CREATE POLICY "qr_sessions_delete_super_admin"
ON qr_sessions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND company_id = qr_sessions.company_id
    AND role = 'SUPER_ADMIN'
  )
);

-- ============================================================
-- GRANT
-- ============================================================
-- SELECT limité aux admins via policy — mais on ne grant qu'aux authenticated
GRANT SELECT, INSERT, UPDATE ON qr_sessions TO authenticated;
REVOKE DELETE ON qr_sessions FROM authenticated;
-- Note : la Edge Function validate-checkin utilise service_role,
-- elle bypasse RLS et peut faire tout ce dont elle a besoin.
-- C'est intentionnel et documenté.

-- ============================================================
-- INDEX de sécurité (à mettre dans la migration DB, rappel ici)
-- ============================================================
-- Ces index sont critiques pour les performances ET la sécurité
-- (sans index, un scan full table expose les tokens à des timing attacks)
--
-- CREATE INDEX CONCURRENTLY idx_qr_sessions_token ON qr_sessions(token);
-- CREATE INDEX CONCURRENTLY idx_qr_sessions_active ON qr_sessions(company_id, active) WHERE active = true;
-- CREATE INDEX CONCURRENTLY idx_qr_sessions_expires ON qr_sessions(expires_at) WHERE active = true;
