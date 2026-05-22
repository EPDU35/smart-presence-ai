-- ===== idx_checkins_user_id.sql =====
-- Répond à : "Récupérer l'historique de présence d'un employé sur une période"
-- Pattern : WHERE user_id = $1 AND created_at BETWEEN $2 AND $3 ORDER BY created_at DESC
--
-- Problème sans cet index : l'index simple idx_checkins_user_id oblige PostgreSQL
-- à charger TOUTES les lignes de l'utilisateur, puis à les filtrer par date en mémoire
-- (opération Filter, pas Index Cond). Sur un employé avec 500 checkins, c'est 500
-- lectures heap pour n'en retourner peut-être que 30.
--
-- Gain attendu : seq scan sur idx_checkins_user_id (~500 lignes lues) →
-- index range scan direct (~30 lignes lues). Latence estimée : 8ms → 0.4ms.

CREATE INDEX IF NOT EXISTS idx_checkins_user_date
  ON checkins (user_id, created_at DESC);

-- Choix DESC sur created_at : l'application affiche toujours les checkins
-- du plus récent au plus ancien (dashboard employé, historique personnel).
-- PostgreSQL peut lire l'index dans l'ordre naturel sans Sort node.
-- Le composite (user_id en tête) garantit que le scan est borné à un seul user
-- avant de naviguer dans la plage temporelle — cardinalité haute en premier,
-- c'est la règle d'or des index composites.