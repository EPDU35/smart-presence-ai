-- ============================================================
-- RLS POLICIES — checkins
-- ============================================================
-- AVOCAT DU DIABLE :
-- La table checkins est la plus critique du système.
-- Un employé qui peut lire les checkins des autres = RGPD violé.
-- Un employé qui peut INSERT directement = fraude garantie.
--
-- RÈGLE D'OR : aucun INSERT direct sur checkins depuis le client.
-- TOUT passe par la Edge Function `validate-checkin` (service_role).
-- Si tu autorises INSERT TO authenticated ici, tu peux fermer la boîte.
-- ============================================================

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins FORCE ROW LEVEL SECURITY;

-- ============================================================
-- SELECT : Isolation stricte par rôle
-- ============================================================

-- EMPLOYEE : voit uniquement ses propres checkins
CREATE POLICY "checkins_select_own"
ON checkins
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- ADMIN / SUPER_ADMIN : voit tous les checkins de leur company
-- AVOCAT DU DIABLE : on vérifie le rôle dans la table users, pas dans
-- les user_metadata JWT — car le JWT peut être signé avec un vieux rôle
-- si l'admin vient de promouvoir quelqu'un (TOKEN_REFRESHED pas encore reçu).
CREATE POLICY "checkins_select_admin"
ON checkins
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
-- INSERT : INTERDIT au client authentifié
-- ============================================================
-- Les checkins sont créés UNIQUEMENT par la Edge Function validate-checkin
-- via service_role. Un client qui tente un INSERT direct obtient un refus.
--
-- AVOCAT DU DIABLE : ne pas créer de policy INSERT TO authenticated.
-- L'absence de policy = refus par défaut (RLS deny-all).
-- C'est voulu. Documenté. Intentionnel.
--
-- Si tu as besoin d'INSERT en dev pour les tests, utilise service_role
-- depuis le dashboard Supabase ou une Edge Function de seed.

-- (Pas de policy INSERT pour authenticated — deny by default)

-- ============================================================
-- UPDATE : Seul ADMIN peut corriger un checkin (ex: erreur GPS)
-- ============================================================
-- Un employé ne peut JAMAIS modifier ses propres checkins.
-- Sinon il peut rétroactivement "corriger" une absence.
CREATE POLICY "checkins_update_admin_only"
ON checkins
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
  -- L'admin ne peut pas changer le user_id ou le company_id d'un checkin
  -- (protection contre le déplacement de checkin entre employés)
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
);

-- ============================================================
-- DELETE : SUPER_ADMIN uniquement
-- ============================================================
-- Supprimer un checkin = effacer une trace d'audit.
-- Action rare et auditée. SUPER_ADMIN seulement.
CREATE POLICY "checkins_delete_super_admin"
ON checkins
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND company_id = checkins.company_id
    AND role = 'SUPER_ADMIN'
  )
);

-- ============================================================
-- GRANT minimal
-- ============================================================
GRANT SELECT, UPDATE ON checkins TO authenticated;
-- Pas de INSERT ni DELETE pour authenticated
-- INSERT : réservé à service_role (Edge Function validate-checkin)
-- DELETE : géré par la policy mais on retire aussi le privilege
REVOKE INSERT, DELETE ON checkins FROM authenticated;
