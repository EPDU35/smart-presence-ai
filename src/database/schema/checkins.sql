-- ===== checkins.sql =====
-- Dépendances : users(id), companies(id), qr_sessions(id)
-- IMMUABLE PAR DESIGN : aucun updated_at. Un check-in ne se corrige pas, il se conteste.
-- Toute modification passerait par une entrée dans suspicious_logs.

CREATE TABLE checkins (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  company_id     uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Statut du check-in au moment de l'enregistrement
  -- 'PRESENT' | 'LATE' | 'ABSENT' | 'FLAGGED'
  -- FLAGGED = check-in reçu mais suspect (distance hors zone, device inconnu, etc.)
  status         text        NOT NULL
                 CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'FLAGGED')),

  -- Snapshot JSON du device au moment du check-in (UA, IP, fingerprint snapshot)
  -- Stocké tel quel pour forensics — ne pas normaliser
  device_info    jsonb       NULL,

  -- Référence à la session QR scannée — NULL si check-in manuel (ex: ADMIN)
  qr_session_id  uuid        NULL REFERENCES qr_sessions(id) ON DELETE SET NULL,

  -- Horodatage de création = horodatage du check-in. C'est la colonne de référence.
  created_at     timestamptz NOT NULL DEFAULT now()

  -- ⛔ PAS DE updated_at — ce serait une violation du pattern audit trail immuable
);

-- Index tenant + date pour les rapports de présence (requête la plus fréquente)
CREATE INDEX idx_checkins_company_date  ON checkins(company_id, created_at DESC);

-- Index user pour l'historique personnel
CREATE INDEX idx_checkins_user_id       ON checkins(user_id, created_at DESC);

-- Index sur qr_session_id pour détecter les doubles scans d'un même QR
CREATE INDEX idx_checkins_qr_session    ON checkins(qr_session_id) WHERE qr_session_id IS NOT NULL;

-- Contrainte : un user ne peut pas avoir deux check-ins PRESENT/LATE sur la même session QR
-- Empêche le double-tap ou le replay d'un token intercepté
ALTER TABLE checkins
  ADD CONSTRAINT uq_checkins_user_qr_session
  UNIQUE (user_id, qr_session_id);

COMMENT ON TABLE  checkins              IS 'Audit trail immuable des présences. Jamais modifié après INSERT.';
COMMENT ON COLUMN checkins.device_info  IS 'Snapshot JSONB du contexte device. Opaque, conservé pour forensics.';
COMMENT ON COLUMN checkins.status       IS 'FLAGGED déclenche une entrée dans suspicious_logs par le service métier.';
COMMENT ON COLUMN checkins.qr_session_id IS 'NULL autorisé pour les check-ins manuels (saisie ADMIN).';