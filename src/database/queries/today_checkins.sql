-- ===== today_checkins.sql =====
-- Utilisé par : Dashboard admin — tableau "Présences du jour" (temps réel)
-- Appelé via : requête paramétrée depuis le service checkin.service.ts
-- Paramètres : $1 = company_id (uuid)
--
-- Résultat : une ligne par checkin du jour, avec les infos d'identité
-- de l'employé dénormalisées. Trié du plus récent au plus ancien.
-- LIMIT 500 : protection contre les timeouts sur les très grandes companies
-- (une company avec 500 checkins en une journée a probablement 200+ employés,
-- ce qui dépasse les plans starter/pro typiques).

SELECT
  -- Données du checkin
  c.id            AS checkin_id,
  c.created_at,
  c.status,
  c.distance,
  c.device_info,
  c.latitude,
  c.longitude,
  c.ip_address,

  -- Identité de l'employé (dénormalisée pour éviter un JOIN côté client)
  c.user_id,
  u.firstname,
  u.lastname,
  u.email

FROM checkins c

-- INNER JOIN : on ne veut que les checkins dont l'utilisateur existe encore.
-- Un LEFT JOIN retournerait des lignes avec firstname/lastname NULL si
-- un compte a été supprimé — ce qui créerait des bugs d'affichage frontend.
INNER JOIN users u ON u.id = c.user_id

WHERE
  -- Filtre company_id EN PREMIER : permet à PostgreSQL d'utiliser
  -- idx_checkins_company_date en tant qu'index leading column,
  -- ce qui réduit immédiatement le scan à la company concernée.
  c.company_id = $1

  -- Filtre sur la journée en cours : on borne la plage de created_at
  -- entre le début et la fin de la journée courante UTC.
  -- CURRENT_DATE::timestamptz = minuit UTC du jour courant.
  -- On utilise < CURRENT_DATE + 1 plutôt que <= pour éviter
  -- les ambiguïtés sur les timestamps à exactement minuit.
  AND c.created_at >= CURRENT_DATE::timestamptz
  AND c.created_at <  (CURRENT_DATE + INTERVAL '1 day')::timestamptz

ORDER BY c.created_at DESC

LIMIT 500;