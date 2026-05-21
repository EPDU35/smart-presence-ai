-- ===== devices.sql =====
-- Dépendances : users(id)
-- Pas de company_id direct : le tenant est résolu via users.company_id.
-- UNIQUE(user_id, device_fingerprint) empêche le double-enregistrement d'un device.

CREATE TABLE devices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Empreinte déterministe du device côté client (navigator, canvas, WebGL hash, etc.)
  -- Utilisée comme clé de déduplication — doit être stable entre sessions
  device_fingerprint  text        NOT NULL CHECK (char_length(device_fingerprint) > 0),

  -- Nom lisible du device (ex: "iPhone 15 Pro de Marc") — fourni ou déduit du UA
  device_name         text        NOT NULL DEFAULT 'Unknown Device',

  -- Un device trusted bypass certaines vérifications 2FA selon la politique company
  trusted             boolean     NOT NULL DEFAULT false,

  -- Dernière connexion authentifiée depuis ce device
  last_login          timestamptz NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Contrainte critique : un user ne peut pas avoir deux entrées pour le même device
  CONSTRAINT uq_devices_user_fingerprint UNIQUE (user_id, device_fingerprint)
);

-- Index pour lookup rapide "tous les devices d'un user"
CREATE INDEX idx_devices_user_id ON devices(user_id);

-- Index partiel pour lister uniquement les devices de confiance
CREATE INDEX idx_devices_trusted ON devices(user_id) WHERE trusted = true;

COMMENT ON TABLE  devices                   IS 'Device connu et potentiellement de confiance d'un utilisateur.';
COMMENT ON COLUMN devices.device_fingerprint IS 'Hash côté client (FingerprintJS ou équivalent). Stable entre sessions, opaque en base.';
COMMENT ON COLUMN devices.trusted            IS 'Si true, peut réduire la friction 2FA selon config company.';