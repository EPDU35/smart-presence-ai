-- ============================================================
-- RLS POLICIES — users (profils)
-- ============================================================
-- AVOCAT DU DIABLE :
-- La table "users" est différente de auth.users (gérée par Supabase).
-- Cette table contient les profils applicatifs (rôle, company_id, etc).
-- Un employé ne doit jamais pouvoir lire le profil de collègues
-- d'une AUTRE company. Ni modifier son propre rôle.
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- ============================================================
-- SELECT : Voir son propre profil OU les collègues de sa company
-- ============================================================
-- EMPLOYEE : voit uniquement son propre profil
-- ADMIN / SUPER_ADMIN : voit tous les profils de leur company
CREATE POLICY "users_select_policy"
ON users
FOR SELECT
TO authenticated
USING (
  -- Cas 1 : l'user se voit lui-même
  id = auth.uid()
  OR
  -- Cas 2 : l'user est admin et le target est dans sa company
  (
    company_id = (
      SELECT company_id FROM users
      WHERE id = auth.uid()
      AND role IN ('ADMIN', 'SUPER_ADMIN')
      LIMIT 1
    )
    AND company_id IS NOT NULL
  )
);

-- ============================================================
-- INSERT : Seul le système (Edge Function) peut créer un profil
-- ============================================================
-- Pendant le register, la Edge Function utilise service_role
-- pour créer le profil — pas l'anon key.
-- Un user authentifié ne peut pas créer de profil pour quelqu'un d'autre.
CREATE POLICY "users_insert_own_profile"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  -- L'user ne peut créer que son propre profil
  id = auth.uid()
  -- Et ne peut pas se donner ADMIN ou SUPER_ADMIN lui-même
  AND role = 'EMPLOYEE'
);

-- ============================================================
-- UPDATE : Chacun peut modifier ses infos, pas son rôle
-- ============================================================
CREATE POLICY "users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  -- CRITIQUE : un user ne peut pas changer son propre rôle
  -- Le rôle est modifiable uniquement par un ADMIN via Edge Function (service_role)
  AND role = (SELECT role FROM users WHERE id = auth.uid())
  -- Un user ne peut pas changer son company_id non plus
  AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- UPDATE par l'admin de la company (change les rôles des employés)
CREATE POLICY "users_update_admin_manages_team"
ON users
FOR UPDATE
TO authenticated
USING (
  -- La cible doit être dans la même company que l'admin
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
  -- L'admin ne peut pas modifier son propre rôle via cette policy
  AND id != auth.uid()
)
WITH CHECK (
  company_id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
  -- Un ADMIN ne peut pas promouvoir quelqu'un SUPER_ADMIN
  AND role != 'SUPER_ADMIN'
);

-- ============================================================
-- DELETE : Seul SUPER_ADMIN peut supprimer un profil
-- ============================================================
CREATE POLICY "users_delete_super_admin"
ON users
FOR DELETE
TO authenticated
USING (
  -- L'auteur est SUPER_ADMIN dans la même company
  EXISTS (
    SELECT 1 FROM users AS me
    WHERE me.id = auth.uid()
    AND me.company_id = users.company_id
    AND me.role = 'SUPER_ADMIN'
  )
  -- Un SUPER_ADMIN ne peut pas se supprimer lui-même
  AND id != auth.uid()
);

-- ============================================================
-- GRANT
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
REVOKE DELETE ON users FROM authenticated;