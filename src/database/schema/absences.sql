-- Table: absences

CREATE TABLE IF NOT EXISTS absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_absences_user_id ON absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absences_company_id ON absences(company_id);
CREATE INDEX IF NOT EXISTS idx_absences_start_ts ON absences(start_ts);
