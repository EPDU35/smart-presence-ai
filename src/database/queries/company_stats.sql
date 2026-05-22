-- ===== company_stats.sql =====
-- Utilisé par : Page Analytics — cartes KPI et graphiques de synthèse
-- Appelé via : supabase.rpc('get_company_stats') ou query paramétrée
-- Paramètres : $1 = company_id (uuid), $2 = date_from (timestamptz),
--              $3 = date_to (timestamptz)
--
-- Résultat : UNE SEULE LIGNE avec tous les agrégats.
-- Le frontend peut consommer directement data[0].valid_count etc.
--
-- Principe clé : les agrégats conditionnels (COUNT FILTER) permettent
-- de calculer les 3 compteurs par status en un seul passage sur les données.
-- C'est l'équivalent d'un PIVOT, mais natif PostgreSQL et bien plus performant
-- que 3 sous-requêtes séparées qui scanneraient la table 3 fois chacune.

SELECT
  -- Compteurs par status : FILTER est l'équivalent d'un WHERE à l'intérieur
  -- d'un agrégat. PostgreSQL évalue la condition ligne par ligne pendant
  -- le scan, sans relire la table. C'est O(n) au lieu de O(3n).
  COUNT(*) FILTER (WHERE c.status = 'VALID')      AS valid_count,
  COUNT(*) FILTER (WHERE c.status = 'INVALID')    AS invalid_count,
  COUNT(*) FILTER (WHERE c.status = 'SUSPICIOUS') AS suspicious_count,

  -- Employés distincts : combien de personnes DIFFÉRENTES ont pointé
  -- sur la période. COUNT(DISTINCT) est plus coûteux qu'un COUNT simple
  -- (nécessite un tri interne ou une hash table), mais c'est inévitable ici.
  -- Sur des volumes SaaS typiques (< 10K checkins par période), c'est acceptable.
  COUNT(DISTINCT c.user_id) AS unique_employees,

  -- Total toutes catégories confondues
  COUNT(*)                  AS total_checkins,

  -- Distance moyenne arrondie à 2 décimales pour l'affichage.
  -- ROUND(..., 2) sur un float retourne un float8 — le frontend reçoit
  -- un nombre, pas une string. NULL si aucun checkin sur la période.
  ROUND(AVG(c.distance)::numeric, 2) AS avg_distance

FROM checkins c

WHERE
  -- Isolation multi-tenant en tête de WHERE (règle SEC-01) :
  -- idx_checkins_company_date a company_id comme leading column,
  -- ce qui permet un index range scan borné à la company AVANT
  -- d'appliquer le filtre temporel.
  c.company_id = $1
  AND c.created_at >= $2
  AND c.created_at <  $3;

-- Note sur le résultat quand aucun checkin n'existe sur la période :
-- COUNT retourne 0 (jamais NULL), mais AVG retourne NULL.
-- Le frontend doit gérer avg_distance pouvant être null et afficher "—" ou "0m".