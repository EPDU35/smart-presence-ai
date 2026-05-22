-- Exécuter dans Supabase → SQL Editor (une fois)
drop policy if exists "qr_sessions_employee_consume" on public.qr_sessions;

create policy "qr_sessions_employee_consume"
  on public.qr_sessions for update
  using (
    company_id = public.my_company_id()
    and used_at is null
    and active = true
    and expires_at > now()
  )
  with check (used_at is not null and active = false);
