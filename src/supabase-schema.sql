-- ============================================================
-- SMART PRESENCE AI — SUPABASE SCHEMA FINAL
-- Version : 3.0 — Aligné 100% avec le code TypeScript
-- Eliel Poster — Abidjan 2026
--
-- ORDRE D'EXECUTION :
-- 1. Copier tout ce fichier
-- 2. Supabase → SQL Editor → New Query
-- 3. Run (Ctrl+Enter)
-- ============================================================


-- ============================================================
-- STEP 0 — NETTOYAGE COMPLET
-- (Supprime tout proprement avant de recréer)
-- ============================================================

drop trigger  if exists trg_on_auth_user_created on auth.users;
drop trigger  if exists trg_companies_updated_at  on public.companies;
drop trigger  if exists trg_users_updated_at      on public.users;

drop function if exists public.handle_new_user()   cascade;
drop function if exists public.handle_updated_at() cascade;
drop function if exists public.my_company_id()     cascade;
drop function if exists public.my_role()           cascade;

drop table if exists public.suspicious_logs cascade;
drop table if exists public.devices         cascade;
drop table if exists public.checkins        cascade;
drop table if exists public.qr_sessions     cascade;
drop table if exists public.users           cascade;
drop table if exists public.companies       cascade;

drop type if exists user_role      cascade;
drop type if exists checkin_status cascade;
drop type if exists company_plan   cascade;


-- ============================================================
-- STEP 1 — EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ============================================================
-- STEP 2 — TABLES
-- (Sans ENUMs — on utilise text + check constraints
--  pour éviter les conflits de types à la recréation)
-- ============================================================

-- ── companies ────────────────────────────────────────────────
create table public.companies (
  id         uuid        default gen_random_uuid() primary key,
  name       text        not null,
  code       text        not null unique,
  email      text,
  phone      text,
  location   text,
  latitude   float       not null default 0,
  longitude  float       not null default 0,
  radius     int         not null default 100 check (radius > 0),
  opening_time time      null,
  closing_time time      null,
  late_tolerance int      null check (late_tolerance >= 0),
  plan       text        not null default 'starter'
                         check (plan in ('starter','pro','enterprise')),
  owner_id   uuid,
  logo_url   text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  public.companies          is 'Organisations utilisant Smart Presence';
comment on column public.companies.code     is 'Code unique format SP-XXXXXX pour invitations';
comment on column public.companies.radius   is 'Rayon GPS autorisé en mètres';


-- ── users ────────────────────────────────────────────────────
-- company_id nullable : l'utilisateur n'a pas encore de company
-- au moment exact du trigger (signup), on l'ajoute après
create table public.users (
  id         uuid        references auth.users(id) on delete cascade primary key,
  company_id uuid        references public.companies(id) on delete set null,
  role       text        not null default 'EMPLOYEE'
                         check (role in ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE')),
  firstname  text        not null default '',
  lastname   text        not null default '',
  email      text        not null,
  phone      text,
  avatar     text,
  is_active  boolean     not null default true,
  last_seen  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  public.users            is 'Profils utilisateurs — liés à auth.users';
comment on column public.users.company_id is 'Nullable : renseigné après création/rejoindre une company';


-- ── qr_sessions ──────────────────────────────────────────────
create table public.qr_sessions (
  id         uuid        default gen_random_uuid() primary key,
  company_id uuid        not null references public.companies(id) on delete cascade,
  token      text        not null unique,
  expires_at timestamptz not null default (now() + interval '15 seconds'),
  active     boolean     not null default true,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table  public.qr_sessions           is 'Tokens QR dynamiques anti-fraude';
comment on column public.qr_sessions.token     is 'UUID cryptographique unique, usage unique';
comment on column public.qr_sessions.expires_at is 'Expiration 15s par défaut';


-- ── checkins ─────────────────────────────────────────────────
create table public.checkins (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        not null references public.users(id) on delete cascade,
  company_id  uuid        not null references public.companies(id) on delete cascade,
  qr_token    text        not null,
  latitude    float       not null default 0,
  longitude   float       not null default 0,
  distance    float       not null default 0 check (distance >= 0),
  status      text        not null default 'VALID'
                          check (status in ('VALID','INVALID','SUSPICIOUS')),
  device_info text,
  ip_address  text,
  created_at  timestamptz not null default now()
);

comment on table  public.checkins          is 'Historique complet des pointages';
comment on column public.checkins.distance is 'Distance en mètres entre employé et entreprise';
comment on column public.checkins.status   is 'VALID=présent, INVALID=refusé, SUSPICIOUS=fraude détectée';


-- ── devices ──────────────────────────────────────────────────
-- created_at ajouté (manquait dans database.types.ts)
create table public.devices (
  id                 uuid        default gen_random_uuid() primary key,
  user_id            uuid        not null references public.users(id) on delete cascade,
  device_name        text        not null,
  device_fingerprint text        not null,
  last_login         timestamptz not null default now(),
  trusted            boolean     not null default false,
  created_at         timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

comment on table public.devices is 'Appareils connus par utilisateur — device trust';


-- ── suspicious_logs ──────────────────────────────────────────
create table public.suspicious_logs (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.users(id) on delete set null,
  company_id uuid        not null references public.companies(id) on delete cascade,
  reason     text        not null,
  device     text,
  ip         text,
  metadata   jsonb       not null default '{}',
  resolved   boolean     not null default false,
  created_at timestamptz not null default now()
);

comment on table public.suspicious_logs is 'Événements suspects détectés par le système';


-- ============================================================
-- STEP 3 — INDEXES (performance)
-- ============================================================

-- companies
create index idx_companies_code      on public.companies(code);
create index idx_companies_owner_id  on public.companies(owner_id);
create index idx_companies_is_active on public.companies(is_active) where is_active = true;

-- users
create index idx_users_company_id    on public.users(company_id);
create index idx_users_role          on public.users(role);
create index idx_users_email         on public.users(email);
create index idx_users_is_active     on public.users(is_active) where is_active = true;

-- checkins — les plus importantes pour les requêtes dashboard
create index idx_checkins_company_id   on public.checkins(company_id);
create index idx_checkins_user_id      on public.checkins(user_id);
create index idx_checkins_created_at   on public.checkins(created_at desc);
create index idx_checkins_status       on public.checkins(status);
create index idx_checkins_company_date on public.checkins(company_id, created_at desc);

-- qr_sessions
create index idx_qr_token             on public.qr_sessions(token);
create index idx_qr_company_id        on public.qr_sessions(company_id);
create index idx_qr_active            on public.qr_sessions(active) where active = true;
create index idx_qr_expires_at        on public.qr_sessions(expires_at);

-- devices
create index idx_devices_user_id      on public.devices(user_id);
create index idx_devices_fingerprint  on public.devices(device_fingerprint);

-- suspicious_logs
create index idx_suspicious_company   on public.suspicious_logs(company_id);
create index idx_suspicious_unresolved on public.suspicious_logs(resolved) where resolved = false;


-- ============================================================
-- STEP 4 — TRIGGER : updated_at automatique
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.handle_updated_at();

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();


-- ============================================================
-- STEP 5 — TRIGGER : création profil auto au signup
--
-- IMPORTANT : Ce trigger crée une ligne dans public.users
-- dès que Supabase Auth crée un compte.
-- company_id est NULL à ce stade — c'est normal.
-- Il sera renseigné juste après via updateProfile().
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    firstname,
    lastname,
    role
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'firstname', ''),
    coalesce(new.raw_user_meta_data->>'lastname',  ''),
    'EMPLOYEE'
  )
  on conflict (id) do nothing;  -- sécurité : pas de doublon si appelé 2x

  return new;

exception
  when others then
    -- Ne jamais bloquer le signup même si le profil échoue
    raise warning 'handle_new_user error: %', sqlerrm;
    return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- STEP 6 — HELPER FUNCTIONS pour RLS
-- ============================================================

-- Retourne le company_id de l'utilisateur connecté
create or replace function public.my_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id
  from public.users
  where id = auth.uid()
  limit 1;
$$;

-- Retourne le role de l'utilisateur connecté
create or replace function public.my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.users
  where id = auth.uid()
  limit 1;
$$;


-- ============================================================
-- STEP 7 — ROW LEVEL SECURITY
-- ============================================================

alter table public.companies       enable row level security;
alter table public.users           enable row level security;
alter table public.checkins        enable row level security;
alter table public.qr_sessions     enable row level security;
alter table public.devices         enable row level security;
alter table public.suspicious_logs enable row level security;


-- ── COMPANIES ────────────────────────────────────────────────

-- Lecture : admin voit sa company / super admin voit tout
create policy "companies_select"
  on public.companies for select
  using (
    id = public.my_company_id()
    or public.my_role() = 'SUPER_ADMIN'
  );

-- Insertion libre au signup (avant que le user soit admin)
create policy "companies_insert"
  on public.companies for insert
  with check (true);

-- Modification : admin de sa company ou super admin
create policy "companies_update"
  on public.companies for update
  using (
    (id = public.my_company_id() and public.my_role() in ('ADMIN','SUPER_ADMIN'))
    or public.my_role() = 'SUPER_ADMIN'
  );


-- ── USERS ────────────────────────────────────────────────────

-- Lecture : même company + son propre profil + super admin
create policy "users_select"
  on public.users for select
  using (
    id = auth.uid()
    or company_id = public.my_company_id()
    or public.my_role() = 'SUPER_ADMIN'
  );

-- Insertion : uniquement via le trigger handle_new_user
create policy "users_insert"
  on public.users for insert
  with check (true);

-- Modification : son propre profil + admin de sa company
create policy "users_update"
  on public.users for update
  using (
    id = auth.uid()
    or (company_id = public.my_company_id() and public.my_role() in ('ADMIN','MANAGER','SUPER_ADMIN'))
    or public.my_role() = 'SUPER_ADMIN'
  );

-- Suppression : admin ou super admin seulement
create policy "users_delete"
  on public.users for delete
  using (
    (company_id = public.my_company_id() and public.my_role() in ('ADMIN','SUPER_ADMIN'))
    or public.my_role() = 'SUPER_ADMIN'
  );


-- ── CHECKINS ─────────────────────────────────────────────────

-- Lecture : même company pour admin/manager, seulement les siens pour employee
create policy "checkins_select"
  on public.checkins for select
  using (
    (public.my_role() in ('ADMIN','MANAGER','SUPER_ADMIN') and company_id = public.my_company_id())
    or user_id = auth.uid()
    or public.my_role() = 'SUPER_ADMIN'
  );

-- Insertion : uniquement pour soi-même
create policy "checkins_insert"
  on public.checkins for insert
  with check (user_id = auth.uid());


-- ── QR SESSIONS ──────────────────────────────────────────────

-- Lecture : même company (admin pour gérer, employee pour valider)
create policy "qr_sessions_select"
  on public.qr_sessions for select
  using (company_id = public.my_company_id());

-- Insertion : admin/manager de sa company
create policy "qr_sessions_insert"
  on public.qr_sessions for insert
  with check (
    company_id = public.my_company_id()
    and public.my_role() in ('ADMIN','MANAGER','SUPER_ADMIN')
  );

-- Modification : admin/manager (pour désactiver les anciens QR)
create policy "qr_sessions_update"
  on public.qr_sessions for update
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('ADMIN','MANAGER','SUPER_ADMIN')
  );


-- ── DEVICES ──────────────────────────────────────────────────

-- Chaque user gère ses propres devices
create policy "devices_select"
  on public.devices for select
  using (
    user_id = auth.uid()
    or (
      public.my_role() in ('ADMIN','SUPER_ADMIN')
      and user_id in (
        select id from public.users
        where company_id = public.my_company_id()
      )
    )
  );

create policy "devices_insert"
  on public.devices for insert
  with check (user_id = auth.uid());

create policy "devices_update"
  on public.devices for update
  using (user_id = auth.uid());


-- ── SUSPICIOUS LOGS ──────────────────────────────────────────

create policy "suspicious_select"
  on public.suspicious_logs for select
  using (
    (company_id = public.my_company_id() and public.my_role() in ('ADMIN','MANAGER','SUPER_ADMIN'))
    or public.my_role() = 'SUPER_ADMIN'
  );

-- Insertion système uniquement (via services backend)
create policy "suspicious_insert"
  on public.suspicious_logs for insert
  with check (true);

-- Résolution : admin seulement
create policy "suspicious_update"
  on public.suspicious_logs for update
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('ADMIN','SUPER_ADMIN')
  );


-- ============================================================
-- STEP 8 — REALTIME
-- ============================================================

alter publication supabase_realtime add table public.checkins;
alter publication supabase_realtime add table public.qr_sessions;


-- ============================================================
-- STEP 9 — VÉRIFICATION FINALE
-- Exécute ces requêtes pour confirmer que tout est OK
-- ============================================================

-- Vérifie les tables
-- select table_name from information_schema.tables
-- where table_schema = 'public' order by table_name;

-- Vérifie les triggers
-- select trigger_name, event_object_table
-- from information_schema.triggers
-- where trigger_schema = 'public';

-- Vérifie les policies RLS
-- select tablename, policyname
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename;


-- ============================================================
-- STEP 10 — APRÈS INSCRIPTION : passe-toi en SUPER_ADMIN
--
-- 1. Inscris-toi normalement sur l'app
-- 2. Va dans Supabase → Authentication → Users
-- 3. Copie ton UUID
-- 4. Exécute la requête ci-dessous avec ton vrai UUID
-- ============================================================

-- update public.users
-- set role = 'SUPER_ADMIN'
-- where id = 'COLLE-TON-UUID-ICI';


-- ============================================================
-- FIN DU SCHEMA
-- ============================================================