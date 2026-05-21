-- ============================================================
-- RLS POLICIES — companies
-- ============================================================
-- AVOCAT DU DIABLE :
-- Sans RLS, n'importe quel user authentifié peut lire TOUTES
-- les companies via l'API Supabase. Catastrophique pour un SaaS.
-- Ces policies imposent l'isolation multi-tenant stricte.
-- ============================================================

-- 1. Activer RLS sur la table (OBLIGATOIRE)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
-- FORCE s'applique aussi aux owners de la table (rôle postgres).
-- Sans FORCE : un service_role peut bypasser RLS. Dangereux si
-- ton backend utilise service_role pour des opérations de masse.

-- ============================================================
-- SELECT : Un user voit UNIQUEMENT sa propre company
-- ============================================================
CREATE POLICY "companies_select_own"
ON companies
FOR SELECT
TO authenticated
USING (
  id = (
    SELECT company_id
    FROM users
    WHERE id = auth.uid()
    LIMIT 1
  )
);
-- LIMIT 1 : évite les scans complets si la subquery retourne plusieurs lignes
-- (ne devrait pas arriver avec un schema propre, mais défense en profondeur)

-- ============================================================
-- INSERT : Un user peut créer UNE company (lors du register)
-- ============================================================
-- AVOCAT DU DIABLE : "with check (true)" permettait à n'importe qui
-- de créer autant de companies qu'il voulait. Fixé.
CREATE POLICY "companies_insert_own"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (
  -- L'user ne doit pas déjà avoir une company
  NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND company_id IS NOT NULL
  )
);

-- ============================================================
-- UPDATE : Seul l'ADMIN de la company peut la modifier
-- ============================================================
CREATE POLICY "companies_update_admin_only"
ON companies
FOR UPDATE
TO authenticated
USING (
  id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
)
WITH CHECK (
  id = (
    SELECT company_id FROM users
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SUPER_ADMIN')
    LIMIT 1
  )
);

-- ============================================================
-- DELETE : Seul SUPER_ADMIN peut supprimer une company
-- ============================================================
CREATE POLICY "companies_delete_super_admin_only"
ON companies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND company_id = companies.id
    AND role = 'SUPER_ADMIN'
  )
);

-- ============================================================
-- GRANT minimal
-- ============================================================
-- Le rôle "authenticated" ne reçoit que ce dont il a besoin.
-- Le service_role Supabase bypasse RLS par défaut — normal pour les Edge Functions.
GRANT SELECT, INSERT, UPDATE ON companies TO authenticated;
-- Pas de DELETE grant — géré par la policy mais on retire le privilege aussi
-- (double protection : policy + privilege)
REVOKE DELETE ON companies FROM authenticated;
-- Seule la Edge Function avec service_role peut supprimer (action rare, auditée)