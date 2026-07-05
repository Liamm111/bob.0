-- =============================================================
-- Bootstrap "façon Supabase" pour tester les migrations sur un
-- Postgres nu (docker). Recrée le strict minimum que Supabase
-- fournit d'office : rôles anon/authenticated/service_role, schéma
-- auth + auth.users + auth.uid(). NE PAS utiliser en production.
-- =============================================================

create extension if not exists pgcrypto;

-- Rôles Supabase (service_role contourne la RLS, comme en prod).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end$$;

-- Schéma auth minimal.
create schema if not exists auth;

create table if not exists auth.users (
  id                uuid primary key,
  instance_id       uuid,
  aud               text,
  role              text,
  email             text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at        timestamptz,
  updated_at        timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb
);

-- auth.uid() lit le claim JWT ; en test on le pose via
--   set local request.jwt.claim.sub = '<uuid>';
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;

-- Supabase accorde par défaut USAGE sur public + les privilèges de table
-- aux rôles ; c'est ENSUITE la RLS qui filtre. On reproduit ce modèle pour
-- que le test RLS soit réaliste (le staff a le droit SELECT, mais la RLS
-- ne lui rend QUE les lignes de son café).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
-- anon : aucun droit de table (il ne passe que par les RPC grantées).
