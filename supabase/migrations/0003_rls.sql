-- =============================================================================
-- FIGHTRANK - 0003_rls.sql
-- Row Level Security (Section 25).
--   anon / authenticated : READ competitive data
--   admin / editor       : full write access
-- The service-role key is never used in the browser.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'disciplines', 'divisions', 'fighters', 'fighter_disciplines',
    'fighter_stats', 'events', 'fights',
    'rankings', 'ranking_breakdowns', 'ranking_history',
    'p4p_rankings', 'p4p_history', 'championships', 'ranking_config', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Public, read-only tables ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'disciplines', 'divisions', 'fighters', 'fighter_disciplines',
    'fighter_stats', 'events', 'fights',
    'rankings', 'ranking_breakdowns', 'ranking_history',
    'p4p_rankings', 'p4p_history', 'championships', 'ranking_config'
  ] loop
    execute format('drop policy if exists "public_read" on public.%I', t);
    execute format(
      'create policy "public_read" on public.%I for select using (true)', t);

    execute format('drop policy if exists "admin_write" on public.%I', t);
    execute format(
      'create policy "admin_write" on public.%I for all
         to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

-- profiles --------------------------------------------------------------------
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));

-- Only a full admin (not an editor) may change roles / manage users.
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_owner_admin()) with check (public.is_owner_admin());

-- audit_log -------------------------------------------------------------------
drop policy if exists "audit_admin_read" on public.audit_log;
create policy "audit_admin_read" on public.audit_log
  for select to authenticated using (public.is_admin());

drop policy if exists "audit_admin_insert" on public.audit_log;
create policy "audit_admin_insert" on public.audit_log
  for insert to authenticated with check (public.is_admin());

-- The audit trail is append-only: no update, no delete policy exists.

-- Grants ----------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
