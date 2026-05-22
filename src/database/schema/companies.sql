-- ===== companies.sql =====
-- Première table créée : aucune dépendance FK vers d'autres tables métier.
-- owner_id référence users(id) MAIS users n'existe pas encore à ce stade.
-- Solution : FK owner_id ajoutée en ALTER TABLE dans users.sql après création de users.
-- Cela casse la dépendance circulaire companies ↔ users proprement.

CREATE TABLE companies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  code            text        NOT NULL UNIQUE,
  email           text,
  phone           text,
  location        text,
  latitude        float       NOT NULL DEFAULT 0,
  longitude       float       NOT NULL DEFAULT 0,
  radius          integer     NOT NULL DEFAULT 100 CHECK (radius > 0),
  opening_time    time        NULL,
  closing_time    time        NULL,
  late_tolerance  integer     NULL CHECK (late_tolerance >= 0),
  plan            text        NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  owner_id        uuid        NULL,
  logo_url        text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index sur owner_id anticipant les lookups "mes entreprises"
CREATE INDEX idx_companies_owner_id ON companies(owner_id);
CREATE INDEX idx_companies_code ON companies(code);
CREATE INDEX idx_companies_is_active ON companies(is_active) WHERE is_active = true;

COMMENT ON TABLE  companies                IS 'Entité racine multi-tenant. Chaque ressource sensible porte un company_id.';
COMMENT ON COLUMN companies.code           IS 'Code unique format SP-XXXXXX pour invitations.';
COMMENT ON COLUMN companies.owner_id       IS 'FK vers users(id) ajoutée en différé dans users.sql pour éviter la circularité.';
COMMENT ON COLUMN companies.radius         IS 'Rayon GPS autorisé en mètres.';
COMMENT ON COLUMN companies.is_active      IS 'Indique si la société est active.';
COMMENT ON COLUMN companies.updated_at     IS 'Horodatage de la dernière modification.';