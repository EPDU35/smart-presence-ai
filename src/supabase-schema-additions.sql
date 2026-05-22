-- ============================================================
-- SMART PRESENCE AI — SCHEMA ADDITIONS
-- Colonnes manquantes révélées par les erreurs TypeScript
-- Exécuter dans : Supabase → SQL Editor → New Query
-- ============================================================

-- ── 1. Colonnes 2FA sur users ────────────────────────────────
-- Erreur : "column 'two_fa_enabled' does not exist on 'users'"

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS two_fa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_fa_channel text;

-- ── 2. Colonnes horaires sur companies ───────────────────────
-- Utilisées dans CheckinPage et validate-checkin Edge Function

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS opening_time   time,
  ADD COLUMN IF NOT EXISTS closing_time   time,
  ADD COLUMN IF NOT EXISTS late_tolerance int DEFAULT 0;

-- ── 3. Table otp_codes ────────────────────────────────────────
-- Erreur : "type 'never[]'" sur toutes les requêtes otp_codes
-- La table n'existait pas encore

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash   text        NOT NULL,
  channel     text        NOT NULL CHECK (channel IN ('EMAIL', 'SMS')),
  expires_at  timestamptz NOT NULL,
  attempts    int         NOT NULL DEFAULT 0,
  used        boolean     NOT NULL DEFAULT false,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id
  ON public.otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_active
  ON public.otp_codes(user_id, used)
  WHERE used = false;

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.otp_codes FROM authenticated;
GRANT SELECT ON public.otp_codes TO authenticated;

-- ── 4. Table absences ─────────────────────────────────────────
-- Erreur : absences.service.ts type 'never[]'

CREATE TABLE IF NOT EXISTS public.absences (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  start_ts         timestamptz NOT NULL,
  end_ts           timestamptz NOT NULL,
  duration_minutes int         NOT NULL DEFAULT 0,
  reason           text        NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_absences_company_id
  ON public.absences(company_id);
CREATE INDEX IF NOT EXISTS idx_absences_user_id
  ON public.absences(user_id);

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "absences_select_company"
  ON public.absences FOR SELECT
  TO authenticated
  USING (company_id = public.my_company_id());

CREATE POLICY "absences_insert_admin"
  ON public.absences FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.my_company_id()
    AND public.my_role() IN ('ADMIN', 'SUPER_ADMIN')
  );

-- ── 5. Colonne qr_session_id sur checkins ─────────────────────
-- Utilisée dans validate-checkin Edge Function

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS qr_session_id uuid REFERENCES public.qr_sessions(id);

-- ── 6. Vérification ───────────────────────────────────────────
-- Exécuter pour confirmer :
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name IN ('two_fa_enabled','two_fa_channel');
