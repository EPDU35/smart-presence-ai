-- ===== user_history.sql =====
-- Utilisé par : Page History de l'employé — vue calendrier et liste chronologique
-- Appelé via : requête paramétrée depuis employee.service.ts
-- Paramètres : $1 = user_id (uuid), $2 = date_from (timestamptz),
--              $3 = date_to (timestamptz)
--
-- Résultat : une ligne PAR JOUR, pas par checkin.
-- Le frontend reçoit un tableau de jours qu'il peut mapper sur un calendrier.
--
-- Pourquoi grouper par jour côté SQL plutôt que côté JS ?
-- Parce que ramener tous les checkins bruts puis grouper en JS signifie
-- transférer potentiellement des milliers de lignes sur le réseau.
-- Grouper en SQL = on ne transfère qu'une ligne par jour actif,
-- soit 30 lignes pour un mois complet. La différence est radicale.

SELECT
  -- DATE_TRUNC('day', ...) tronque le timestamp à minuit du jour concerné.
  -- Le frontend peut utiliser cette valeur directement comme clé de calendrier
  -- ou la formatter avec date-fns : format(new Date(row.day), 'yyyy-MM-dd').
  DATE_TRUNC('day', c.created_at)  AS day,

  -- Nombre de tentatives de pointage dans la journée.
  -- Un employé peut avoir plusieurs checkins dans une journée (ex: matin + soir,
  -- ou tentatives refusées). Le frontend affiche ce compteur en badge.
  COUNT(*)                          AS checkins_count,

  -- Heure du premier pointage de la journée (heure d'arrivée).
  MIN(c.created_at)                 AS first_checkin_time,

  -- Heure du dernier pointage (utile pour calculer la durée de présence).
  MAX(c.created_at)                 AS last_checkin_time,

  -- Distance moyenne de la journée (peut varier si plusieurs checkins).
  ROUND(AVG(c.distance)::numeric, 2) AS avg_distance,

  -- Status "dominant" de la journée : si au moins un checkin est VALID,
  -- la journée est considérée comme "présente". Sinon SUSPICIOUS prime sur INVALID.
  -- Cette logique de priorité est encodée avec CASE pour que le frontend
  -- reçoive directement la valeur à afficher dans le badge calendrier,
  -- sans avoir à recalculer côté JS.
  CASE
    WHEN COUNT(*) FILTER (WHERE c.status = 'VALID')      > 0 THEN 'VALID'
    WHEN COUNT(*) FILTER (WHERE c.status = 'SUSPICIOUS') > 0 THEN 'SUSPICIOUS'
    ELSE 'INVALID'
  END                               AS day_status,

  -- Tableau de tous les statuts individuels de la journée.
  -- Permet au frontend d'afficher une infobulle détaillée sur chaque jour
  -- (ex: "2 VALID, 1 SUSPICIOUS"). ARRAY_AGG préserve les doublons intentionnellement.
  ARRAY_AGG(c.status ORDER BY c.created_at) AS statuses,

  -- Compteurs par status pour l'affichage détaillé dans le drawer latéral.
  COUNT(*) FILTER (WHERE c.status = 'VALID')       AS valid_count,
  COUNT(*) FILTER (WHERE c.status = 'INVALID')     AS invalid_count,
  COUNT(*) FILTER (WHERE c.status = 'SUSPICIOUS')  AS suspicious_count

FROM checkins c

WHERE
  -- Filtre user_id en tête : idx_checkins_user_date (que nous venons de créer
  -- dans idx_checkins_user_id.sql) a user_id comme leading column.
  -- PostgreSQL fait un index range scan sur (user_id, created_at DESC)
  -- sans jamais toucher les lignes d'autres utilisateurs.
  c.user_id   = $1
  AND c.created_at >= $2
  AND c.created_at <  $3

GROUP BY
  -- On groupe sur l'expression exacte utilisée dans le SELECT.
  -- PostgreSQL est capable d'utiliser l'index pour le GROUP BY
  -- si les colonnes sont dans l'ordre du composite index.
  DATE_TRUNC('day', c.created_at)

ORDER BY
  -- Du jour le plus récent au plus ancien — cohérent avec le reste de l'app.
  DATE_TRUNC('day', c.created_at) DESC;