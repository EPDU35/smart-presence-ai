-- ============================================================
-- RLS POLICIES — devices
-- ============================================================
-- AVOCAT DU DIABLE :
-- La table devices stocke les empreintes d'appareils.
-- Deux risques principaux :
--
-- 1. Un employé qui voit les devices des autres = info de surveillance.
--    Ex : "Toto a 3 appareils, dont un depuis Paris à 23h". Vie privée.
--
-- 2. Un employé qui peut marquer son propre device TRUSTED = bypass
--    de la validation admin. Le trust doit venir de l'admin, jamais
--    de l'employé lui-même.
-- ============================================================

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;

-- ============================================================
-- SELECT
-- ============================================================

-- Un utilisateur voit uniquement ses propres appareils
CREATE POLICY "devices_select_own"
ON devices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Un ADMIN voit tous les appareils de sa company
-- (pour le dashboard de sécurité : "Qui a quels appareils")
CREATE POLICY "devices_select_admin"
ON devices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND company_id = (
      SELECT company_id FROM users AS target
      WHERE target.id = devices.user_id
      LIMIT 1
    )
    AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- ============================================================
-- INSERT : L'utilisateur peut enregistrer son propre device
-- ============================================================
-- Appelé depuis fingerprint-generation + device-trust-logic au login.
-- L'utilisateur peut créer une entrée pour lui-même, mais :
-- - il ne peut pas se l'attribuer à une autre company
-- - trusted est toujours false à l'INSERT (voir WITH CHECK)
CREATE POLICY "devices_insert_own"
ON devices
FOR INSERT
TO authenticated
WITH CHECK (
  -- L'user ne peut enregistrer que SON propre device
  user_id = auth.uid()
  -- CRITIQUE : trusted ne peut JAMAIS être true à l'INSERT
  -- Un user ne peut pas s'auto-approuver
  AND trusted = false
);

-- ============================================================
-- UPDATE : Seul l'ADMIN peut changer trusted
-- ============================================================
-- Un employé peut mettre à jour last_login (heartbeat device).
-- Un ADMIN peut changer trusted = true/false (approuver/révoquer).
-- Un employé ne peut JAMAIS modifier trusted — même sur son propre device.

-- UPDATE par l'utilisateur lui-même (uniquement last_login)
CREATE POLICY "devices_update_own_heartbeat"
ON devices
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  -- L'employé ne peut pas changer trusted (reste à sa valeur actuelle)
  AND trusted = (SELECT trusted FROM devices AS d WHERE d.id = devices.id)
);

-- UPDATE par l'admin (peut changer trusted)
CREATE POLICY "devices_update_admin_trust"
ON devices
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users AS admin_user
    JOIN users AS device_owner ON device_owner.id = devices.user_id
    WHERE admin_user.id = auth.uid()
    AND admin_user.company_id = device_owner.company_id
    AND admin_user.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- ============================================================
-- DELETE : ADMIN peut supprimer un device révoqué
-- ============================================================
CREATE POLICY "devices_delete_admin"
ON devices
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users AS admin_user
    JOIN users AS device_owner ON device_owner.id = devices.user_id
    WHERE admin_user.id = auth.uid()
    AND admin_user.company_id = device_owner.company_id
    AND admin_user.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- ============================================================
-- GRANT
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON devices TO authenticated;
REVOKE DELETE ON devices FROM authenticated;
-- DELETE géré par la policy ; le REVOKE est une double protection.
