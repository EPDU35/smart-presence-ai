-- ============================================================
-- RLS POLICIES — otp_codes
-- ============================================================
-- AVOCAT DU DIABLE :
-- La table otp_codes est probablement la plus sensible du système.
-- Quatre attaques à bloquer absolument :
--
-- 1. LECTURE : un attaquant qui lit sa propre ligne otp_codes
--    voit code_hash. SHA-256 d'un OTP à 6 chiffres = 1M combinaisons.
--    Avec un GPU, craquable en < 1 seconde via rainbow table.
--    → EMPLOYEE ne voit JAMAIS ses propres otp_codes. Jamais.
--
-- 2. INSERTION : un user qui peut INSERT peut créer un OTP
--    de son choix (code_hash qu'il contrôle) pour s'auto-valider.
--    → INSERT uniquement via Edge Function send-otp (service_role).
--
-- 3. UPDATE : un user qui peut UPDATE peut marquer used=false
--    sur un code consommé → replay attack.
--    → UPDATE uniquement via Edge Function validate-otp (service_role).
--
-- 4. DELETE : un user qui peut DELETE peut effacer un OTP
--    avant qu'il soit marqué comme utilisé → contourner l'audit.
--    → DELETE uniquement via service_role (job de purge).
--
-- RÈGLE D'OR : AUCUN accès client à cette table. Zéro.
-- Tout passe par les Edge Functions avec service_role.
-- ============================================================

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes FORCE ROW LEVEL SECURITY;

-- ============================================================
-- SELECT : SUPER_ADMIN uniquement (monitoring sécurité)
-- ============================================================
-- AVOCAT DU DIABLE : même l'ADMIN d'une company ne devrait pas
-- lire les otp_codes de ses employés. Vie privée + risque sécurité.
-- Seul le SUPER_ADMIN (monitoring plateforme) y accède, et uniquement
-- les métadonnées (pas code_hash — mais RLS ne peut pas filtrer les colonnes,
-- donc c'est la politique de l'application qui n'expose jamais code_hash dans l'UI).

CREATE POLICY "otp_codes_select_superadmin_only"
ON otp_codes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);

-- IMPORTANT : Pas de policy SELECT pour EMPLOYEE ni ADMIN.
-- L'absence de policy = deny by default (RLS deny-all).
-- Un EMPLOYEE qui tente GET /otp_codes?user_id=eq.xxx reçoit 0 lignes.
-- C'est voulu. Documenté. Intentionnel.

-- ============================================================
-- INSERT : Aucune policy → deny by default
-- ============================================================
-- Insertions effectuées uniquement par la Edge Function send-otp
-- via service_role. Service_role bypasse RLS.
-- (pas de CREATE POLICY INSERT — intentionnel)

-- ============================================================
-- UPDATE : Aucune policy → deny by default
-- ============================================================
-- Updates effectués uniquement par la Edge Function validate-otp
-- (marquer used=true, incrémenter attempts) via service_role.
-- (pas de CREATE POLICY UPDATE — intentionnel)

-- ============================================================
-- DELETE : Aucune policy → deny by default
-- ============================================================
-- Purge via job cron (Edge Function scheduled) avec service_role.
-- Purge les OTPs expired + used depuis > 30 jours.
-- (pas de CREATE POLICY DELETE — intentionnel)

-- ============================================================
-- GRANT : retirer tous les privileges pour authenticated
-- ============================================================
-- AVOCAT DU DIABLE : même avec RLS deny-all, retirer les privileges
-- ajoute une couche de défense. Un bug dans RLS ne pourrait pas
-- être exploité si le privilege n'existe pas.
REVOKE ALL ON otp_codes FROM authenticated;

-- Accorder uniquement SELECT au SUPER_ADMIN via la policy définie
-- (SELECT est le seul cas prévu pour un user authentifié)
GRANT SELECT ON otp_codes TO authenticated;

-- Note : INSERT, UPDATE, DELETE sont réservés à service_role.
-- service_role n'est pas dans ce GRANT — il a déjà tous les droits.

-- ============================================================
-- RAPPEL : Colonnes sensibles à ne JAMAIS exposer dans l'UI
-- ============================================================
-- code_hash : SHA-256 du code — craquable par rainbow table si exposé
-- attempts  : exposer ça aide un attaquant à calibrer son bruteforce
--
-- Dans les queries admin UI, toujours exclure ces colonnes :
-- SELECT id, user_id, channel, expires_at, used, used_at, created_at
-- FROM otp_codes WHERE ...
-- (pas de code_hash, pas de attempts dans les SELECT UI)
