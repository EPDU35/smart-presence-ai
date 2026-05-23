-- Clôture journalière : présents / absents par employé et par date
-- Exécuter dans Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS public.daily_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status          text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
  closed_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_company_date
  ON public.daily_attendance (company_id, attendance_date DESC);

ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_attendance_select_company ON public.daily_attendance;
CREATE POLICY daily_attendance_select_company
  ON public.daily_attendance FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());

DROP POLICY IF EXISTS daily_attendance_write_admin ON public.daily_attendance;
CREATE POLICY daily_attendance_write_admin
  ON public.daily_attendance FOR ALL TO authenticated
  USING (
    company_id = public.my_company_id()
    AND public.my_role() IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  )
  WITH CHECK (
    company_id = public.my_company_id()
    AND public.my_role() IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_attendance TO authenticated;
