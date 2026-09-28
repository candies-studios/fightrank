-- =============================================================================
-- FIGHTRANK - 0002_functions.sql
-- Triggers, helper functions and the new-user hook.
-- =============================================================================

-- updated_at maintenance ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'disciplines', 'divisions', 'fighters', 'fighter_disciplines',
    'fighter_stats', 'events', 'fights', 'ranking_config'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- Role helper used by every RLS policy ---------------------------------------
-- SECURITY DEFINER so that reading profiles inside a policy does not recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'editor')
  );
$$;

create or replace function public.is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Every authenticated user gets a profile row --------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    -- First ever user bootstraps as admin; everyone after that is a viewer.
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'viewer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'auth' and table_name = 'users') then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
    execute 'create trigger on_auth_user_created after insert on auth.users
             for each row execute function public.handle_new_user()';
  end if;
end;
$$;

-- Ranking-integrity guard ------------------------------------------------------
-- Belt-and-braces on top of the CHECK constraints: both fighters must belong to
-- a division compatible with the bout's division (Section 23).
create or replace function public.validate_fight()
returns trigger
language plpgsql
as $$
declare
  a_div uuid;
  b_div uuid;
  div_discipline uuid;
  is_catchweight boolean := new.fight_type = 'catchweight';
begin
  -- The bout's discipline must match its division's discipline.
  select discipline_id into div_discipline
    from public.divisions where id = new.division_id;
  if div_discipline is null then
    raise exception 'That division does not exist';
  end if;
  if new.discipline_id is null then
    new.discipline_id := div_discipline;
  elsif new.discipline_id <> div_discipline then
    raise exception 'The bout discipline does not match the division''s discipline';
  end if;

  -- Both athletes must be registered in this discipline (Section 23).
  select division_id into a_div from public.fighter_disciplines
    where fighter_id = new.fighter_a_id and discipline_id = new.discipline_id;
  select division_id into b_div from public.fighter_disciplines
    where fighter_id = new.fighter_b_id and discipline_id = new.discipline_id;

  if a_div is null and b_div is null then
    raise exception
      'Neither athlete is registered in this discipline - add the discipline to their Fighter ID first';
  end if;

  if not is_catchweight then
    if a_div is not null and a_div <> new.division_id
       and b_div is not null and b_div <> new.division_id then
      raise exception
        'Neither fighter competes in the selected division (use fight_type = catchweight to override)';
    end if;
  end if;

  if new.outcome = 'win' and new.loser_id is null then
    new.loser_id := case when new.winner_id = new.fighter_a_id
                         then new.fighter_b_id else new.fighter_a_id end;
  end if;

  if new.outcome is distinct from 'win' then
    new.loser_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_fight on public.fights;
create trigger validate_fight before insert or update on public.fights
  for each row execute function public.validate_fight();
