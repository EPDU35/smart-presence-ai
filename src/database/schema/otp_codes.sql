-- ===== otp_codes.sql =====
-- Dépendances : users(id)
-- ⛔ Le code OTP brut n'est JAMAIS stocké — seulement son hash SHA-256.
-- Validation côté serveur : hash(input) === code_hash stocké.

CREATE TABLE otp_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- SHA-256 du code OTP à 6 chiffres (ou TOTP selon canal)
  -- Format attendu : hex string 64 chars (output de digest('123456', 'sha256') en hex)
  -- ⛔ Jamais le code brut — violation de sécurité critique
  code_hash   text        NOT NULL CHECK (char_length(code_hash) = 64),

  -- Canal via lequel le code a été envoyé — doit correspondre à users.two_fa_channel
  channel     text        NOT NULL
              CHECK (channel IN ('SMS', 'EMAIL', 'TOTP')),

  -- Expiration stricte — le service doit rejeter après ce timestamp même si used = false
  expires_at  timestamptz NOT NULL,

  -- Compteur de tentatives de validation échouées
  -- Bloquer après N tentatives (ex: 3) pour éviter le brute-force
  attempts    integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),

  -- Marqueur de consommation — un code utilisé ne peut jamais être réutilisé
  used        boolean     NOT NULL DEFAULT false,

  -- Horodatage de consommation pour audit — NULL si jamais utilisé
  used_at     timestamptz NULL,

  created_at  timestamptz NOT NULL DEFAULT now()

  -- Pas de updated_at : état géré via used + used_at + attempts
);

-- Contrainte : used_at doit être renseigné si et seulement si used = true
ALTER TABLE otp_codes
  ADD CONSTRAINT chk_otp_used_at_consistency
  CHECK (
    (used = false AND used_at IS NULL)
    OR
    (used = true  AND used_at IS NOT NULL)
  );

-- Index pour lookup rapide "OTP valide non utilisé pour cet user" (chemin critique)
CREATE INDEX idx_otp_codes_user_active ON otp_codes(user_id, expires_at)
  WHERE used = false;

-- Index pour purge des OTP expirés (job cron)
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

COMMENT ON TABLE  otp_codes            IS 'Codes OTP hashés. Jamais le code brut. Expiration stricte + anti-bruteforce.';
COMMENT ON COLUMN otp_codes.code_hash  IS 'SHA-256 hex (64 chars) du code envoyé. Validation: hash(input)==code_hash.';
COMMENT ON COLUMN otp_codes.attempts   IS 'Incrémenter à chaque échec. Bloquer si attempts >= seuil configuré.';
COMMENT ON COLUMN otp_codes.used       IS 'true = consommé. Un code used ne valide JAMAIS une seconde fois.';
