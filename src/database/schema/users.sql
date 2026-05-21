-- ===== users.sql =====
-- users.id est le MÊME UUID que auth.users(id) géré par Supabase Auth.
-- PAS de DEFAULT gen_random_uuid() ici : l'UUID est fourni par le trigger Auth.
-- La vérité du rôle est ici, PAS dans les user_metadata du JWT.

CREATE TABLE users (
  -- Miroir exact de auth.users(id) — inséré via trigger after signup
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Source de vérité du rôle applicatif — ne pas lire depuis JWT user_metadata
  role            text        NOT NULL DEFAULT 'EMPLOYEE'
                  CHECK (role IN ('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN')),

  -- Activation globale du 2FA pour cet utilisateur
  two_fa_enabled  boolean     NOT NULL DEFAULT false,

  -- Canal 2FA choisi — NULL si two_fa_enabled = false
  -- 'SMS' | 'EMAIL' | 'TOTP'
  two_fa_channel  text        NULL
                  CHECK (two_fa_channel IN ('SMS', 'EMAIL', 'TOTP')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Contrainte : si 2FA activé, le canal DOIT être renseigné
ALTER TABLE users
  ADD CONSTRAINT chk_two_fa_channel_required
  CHECK (
    (two_fa_enabled = false)
    OR
    (two_fa_enabled = true AND two_fa_channel IS NOT NULL)
  );

-- Index tenant — quasi toutes les requêtes filtrent par company_id
CREATE INDEX idx_users_company_id ON users(company_id);

-- -----------------------------------------------------------------------
-- Résolution dépendance circulaire companies ↔ users
-- companies.owner_id ne pouvait pas référencer users(id) avant que users existe.
-- On ajoute la FK maintenant que users est créée.
-- -----------------------------------------------------------------------
ALTER TABLE companies
  ADD CONSTRAINT fk_companies_owner_id
  FOREIGN KEY (owner_id)
  REFERENCES users(id)
  ON DELETE SET NULL;  -- Si l'owner est supprimé, company survit sans owner

-- Index côté companies pour le lookup inverse
CREATE INDEX idx_users_id_for_owner ON users(id);

COMMENT ON TABLE  users                  IS 'Miroir de auth.users. Toujours synchronisé via trigger Supabase after-signup.';
COMMENT ON COLUMN users.id               IS 'UUID identique à auth.users(id). Jamais généré localement.';
COMMENT ON COLUMN users.role             IS 'Source de vérité rôle. Lire ICI, pas dans JWT user_metadata.';
COMMENT ON COLUMN users.two_fa_channel   IS 'NULL autorisé seulement si two_fa_enabled = false (contrainte applicative + CHECK).';