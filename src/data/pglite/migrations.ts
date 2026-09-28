/**
 * Migration ordering shared by the browser bootstrap and the CLI verifier.
 *
 * The local demo database is real PostgreSQL (PGlite/WASM) running the exact
 * same migration files that a Supabase project runs. Two differences, both
 * deliberate and both local-only:
 *
 *  1. `AUTH_STUB_SQL` recreates the little bit of Supabase's `auth` schema the
 *     public schema references, since there is no GoTrue service in the browser.
 *  2. The `anon` / `authenticated` / `service_role` roles Supabase provides are
 *     created up front so the RLS migration applies unchanged. The policies are
 *     installed but not *enforced* locally, because PGlite runs the session as
 *     superuser and there is no PostgREST in front of it — RLS does its real
 *     work in Supabase mode, which is the mode that faces the internet.
 */

export const MIGRATION_ORDER = [
  '0001_schema.sql',
  '0002_functions.sql',
  '0003_rls.sql',
  '0004_views.sql',
  '0005_config_defaults.sql',
  '0006_fighter_identity.sql',
] as const

export const AUTH_STUB_SQL = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
exception when others then null;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  encrypted_password  text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('fightrank.user_id', true), '')::uuid $$;

create or replace function auth.role() returns text
language sql stable as $$ select coalesce(nullif(current_setting('fightrank.role', true), ''), 'anon') $$;
`
