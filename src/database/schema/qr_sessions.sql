-- ===== qr_sessions.sql =====
-- Dépendances : companies(id)
-- Une session QR est générée par un ADMIN pour permettre le check-in.
-- Elle a une durée de vie courte (expires_at) et ne peut être utilisée qu'une fois.

CREATE TABLE qr_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Token opaque encodé dans le QR code — scanné par le device employee
  -- Doit être unique globalement, généré avec suffisamment d'entropie (ex: crypto.randomUUID)
  token       text        NOT NULL UNIQUE CHECK (char_length(token) > 0),

  -- Timestamp d'expiration — après cette date, le token est rejeté même s'il n'a pas été utilisé
  expires_at  timestamptz NOT NULL,

  -- active = false dès que la session est révoquée manuellement ou expirée
  active      boolean     NOT NULL DEFAULT true,

  -- Horodatage du premier (et unique) check-in ayant consommé ce token
  -- NULL si le token n'a pas encore été utilisé
  used_at     timestamptz NULL,

  created_at  timestamptz NOT NULL DEFAULT now()

  -- Pas de updated_at : état géré par active + used_at
);

-- Index tenant pour lister les sessions actives d'une company
CREATE INDEX idx_qr_sessions_company_id ON qr_sessions(company_id);

-- Index pour validation rapide du token lors du scan (chemin critique)
CREATE INDEX idx_qr_sessions_token ON qr_sessions(token);

-- Index partiel : seules les sessions encore actives et non expirées sont fréquemment lookupées
CREATE INDEX idx_qr_sessions_active ON qr_sessions(company_id, expires_at)
  WHERE active = true AND used_at IS NULL;

COMMENT ON TABLE  qr_sessions          IS 'Session QR à usage unique générée par un ADMIN. Valide jusqu''à expires_at.';
COMMENT ON COLUMN qr_sessions.token    IS 'Encodé dans le QR code. Haute entropie. Validé à chaque scan.';
COMMENT ON COLUMN qr_sessions.active   IS 'Mis à false en cas de révocation manuelle ou expiration traitée.';
COMMENT ON COLUMN qr_sessions.used_at  IS 'NULL = non consommée. Renseignée lors du premier check-in valide.';