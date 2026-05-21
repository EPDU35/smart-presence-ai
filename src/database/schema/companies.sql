-- ===== companies.sql =====
-- Première table créée : aucune dépendance FK vers d'autres tables métier.
-- owner_id référence users(id) MAIS users n'existe pas encore à ce stade.
-- Solution : FK owner_id ajoutée en ALTER TABLE dans users.sql après création de users.
-- Cela casse la dépendance circulaire companies ↔ users proprement.

CREATE TABLE companies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nom de la société affiché dans l'UI et les rapports
  name            text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 255),

  -- owner_id : UUID de l'admin fondateur — FK ajoutée APRÈS création de users (voir users.sql)
  -- Nullable temporairement pour permettre l'INSERT initial avant d'avoir l'user
  owner_id        uuid        NULL,

  -- Coordonnées GPS du site principal pour la validation de présence géolocalisée
  latitude        numeric(10, 7)  NOT NULL,
  longitude       numeric(10, 7)  NOT NULL,

  -- Rayon en mètres autour du point GPS dans lequel un check-in est considéré valide
  radius_meters   integer     NOT NULL DEFAULT 100 CHECK (radius_meters > 0),

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index sur owner_id anticipant les lookups "mes entreprises"
CREATE INDEX idx_companies_owner_id ON companies(owner_id);

COMMENT ON TABLE  companies                IS 'Entité racine multi-tenant. Chaque ressource sensible porte un company_id.';
COMMENT ON COLUMN companies.owner_id       IS 'FK vers users(id) ajoutée en différé dans users.sql pour éviter la circularité.';
COMMENT ON COLUMN companies.radius_meters  IS 'Périmètre géofencing. Check-in refusé si distance > radius_meters.';