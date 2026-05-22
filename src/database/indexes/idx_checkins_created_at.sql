-- ===== idx_checkins_created_at.sql =====
-- Répond à : "Rapports agrégés sur une plage de dates, toutes companies confondues"
-- Pattern admin/SUPER_ADMIN : WHERE created_at >= $1 AND created_at < $2
-- ou requêtes analytiques type company_stats.sql sur la journée en cours.
--
-- Note : l'index idx_checkins_company_date (créé par Eliel) couvre déjà le pattern
-- (company_id, created_at). Cet index monotone sur created_at seul sert les requêtes
-- SUPER_ADMIN qui scannent TOUTES les companies sur une période, et les agrégats
-- analytiques qui font un range scan temporel avant de grouper par company_id.
--
-- Gain attendu : seq scan full table (potentiellement millions de lignes) →
-- index range scan borné à la fenêtre temporelle demandée.
-- Exemple : rapport mensuel → de 2M lignes scannées à ~50K. Latence : 400ms → 12ms.

CREATE INDEX IF NOT EXISTS idx_checkins_created_at_desc
  ON checkins (created_at DESC);

-- DESC choisi car les requêtes analytiques et les dashboards lisent
-- du plus récent vers le plus ancien. LIMIT en pagination bénéficie
-- directement de l'ordre natif de l'index (pas de Sort).
-- Cet index est volontairement simple (pas de filtre partiel) car il doit
-- couvrir des plages arbitraires sans condition booléenne fixe.