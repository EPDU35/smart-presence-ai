-- ===== suspicious_logs.sql =====
-- Dépendances : users(id), companies(id)
-- Log append-only des événements de sécurité suspects.
-- resolved = false par défaut → nécessite une action ADMIN explicite.

CREATE TABLE suspicious_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Description courte lisible du motif de suspicion
  -- ex: 'GPS_OUT_OF_RANGE', 'UNKNOWN_DEVICE', 'BRUTE_FORCE_OTP', 'QR_REPLAY_ATTEMPT'
  reason      text        NOT NULL CHECK (char_length(reason) > 0),

  -- Snapshot du device impliqué dans l'événement (UA, IP, fingerprint au moment du fait)
  -- Champ texte libre ou JSON stringifié — conservé tel quel côté frontend selon le type
  device      text        NULL,

  -- Données contextuelles arbitraires : localisation, checkin_id source, tentatives, etc.
  -- JSONB permet des requêtes filtrées sur les clés (ex: metadata->>'checkin_id')
  metadata    jsonb       NULL,

  -- false = en attente de traitement par un ADMIN
  -- true  = log examiné et clôturé (avec note possible dans metadata)
  resolved    boolean     NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now()

  -- Pas de updated_at : la résolution est tracée via resolved + metadata, pas une mutation
);

-- Index tenant pour le dashboard sécurité ADMIN (non-résolus en premier)
CREATE INDEX idx_suspicious_logs_company     ON suspicious_logs(company_id, created_at DESC);

-- Index partiel pour les alertes actives uniquement (le plus utilisé)
CREATE INDEX idx_suspicious_logs_unresolved  ON suspicious_logs(company_id, created_at DESC)
  WHERE resolved = false;

-- Index user pour l'historique de suspicion individuel
CREATE INDEX idx_suspicious_logs_user_id     ON suspicious_logs(user_id);

-- Index GIN pour les requêtes filtrées sur le contenu JSONB de metadata
CREATE INDEX idx_suspicious_logs_metadata    ON suspicious_logs USING GIN (metadata);

COMMENT ON TABLE  suspicious_logs           IS 'Log sécurité append-only. Résolution explicite ADMIN requise.';
COMMENT ON COLUMN suspicious_logs.reason    IS 'Code événement normalisé. Utiliser des constantes côté applicatif.';
COMMENT ON COLUMN suspicious_logs.device    IS 'Snapshot texte ou JSON du device. Opaque pour forensics.';
COMMENT ON COLUMN suspicious_logs.metadata  IS 'Contexte libre JSONB. Requêtable via ->> ou @> opérateurs.';
COMMENT ON COLUMN suspicious_logs.resolved  IS 'Mis à true manuellement par ADMIN après investigation.';