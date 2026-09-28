-- =============================================================================
-- FIGHTRANK - 0006_fighter_identity.sql
-- The Fighter ID, and how someone asks for one.
--
-- Two things live here:
--
--   1. Issuing the ID. The code (FR-00123) is now handed out by the database
--      itself, from a sequence, rather than counted in application code. An ID
--      is issued once and never reissued: it follows the athlete for life,
--      across every discipline they go on to compete in.
--
--   2. Applying for one. `fighter_applications` is the only table on the
--      platform an anonymous visitor may write to, and it is deliberately
--      inert: a row here is a request, not an athlete. Nothing in it reaches
--      the rankings until an administrator approves it, at which point a real
--      `fighters` row is created and the ID is issued.
-- =============================================================================

-- --- 1. Issuing the Fighter ID ----------------------------------------------
create sequence if not exists public.fighter_code_seq as bigint start with 1;

-- A code is issued once and never reissued, so the sequence is not trusted on
-- its own: it is advanced past anything already taken. This matters because
-- the seed inserts explicit codes after this migration runs, and because a
-- restored backup can leave the sequence behind the table.
create or replace function public.next_fighter_code() returns text
language plpgsql volatile as $$
declare
  candidate text;
begin
  loop
    candidate := 'FR-' || lpad(nextval('public.fighter_code_seq')::text, 5, '0');
    exit when not exists (
      select 1 from public.fighters where fighter_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

/** Move the sequence above every code currently in use. */
create or replace function public.align_fighter_code_seq() returns bigint
language plpgsql volatile as $$
declare highest bigint;
begin
  select coalesce(max(nullif(regexp_replace(fighter_code, '\D', '', 'g'), '')::bigint), 0)
    into highest
  from public.fighters;
  perform setval('public.fighter_code_seq', greatest(highest, 1), highest > 0);
  return highest;
end;
$$;

select public.align_fighter_code_seq();

alter table public.fighters
  alter column fighter_code set default public.next_fighter_code();

-- --- 2. Applying for one ----------------------------------------------------
create table if not exists public.fighter_applications (
  id              uuid primary key default gen_random_uuid(),
  -- Shown to the applicant so they can chase it up. Not a Fighter ID: no ID is
  -- issued until an administrator approves the application.
  reference       text not null unique default
                    'APP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  first_name      text not null,
  last_name       text not null,
  display_name    text not null,
  email           text not null,
  date_of_birth   date,
  country         text,
  country_code    text check (country_code is null or char_length(country_code) = 2),
  height_cm       integer check (height_cm is null or height_cm between 120 and 250),
  reach_cm        integer check (reach_cm is null or reach_cm between 120 and 260),
  stance          text check (stance is null or stance in ('orthodox', 'southpaw', 'switch')),
  team            text,
  discipline_id   uuid references public.disciplines (id) on delete set null,
  division_id     uuid references public.divisions (id) on delete set null,
  note            text,

  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'declined')),
  -- Set when approved: the athlete this application became.
  fighter_id      uuid references public.fighters (id) on delete set null,
  decided_at      timestamptz,
  decided_by      uuid references public.profiles (id) on delete set null,
  decision_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint fighter_applications_decision_is_recorded
    check (status = 'pending' or decided_at is not null),
  constraint fighter_applications_approved_has_fighter
    check (status <> 'approved' or fighter_id is not null)
);

create index if not exists fighter_applications_status_idx
  on public.fighter_applications (status, created_at desc);

-- One pending application per email, so a double-submit cannot create two
-- athletes for the same person.
create unique index if not exists fighter_applications_one_pending_per_email
  on public.fighter_applications (lower(email)) where status = 'pending';

drop trigger if exists set_updated_at on public.fighter_applications;
create trigger set_updated_at before update on public.fighter_applications
  for each row execute function public.set_updated_at();

-- --- 3. Row-level security --------------------------------------------------
alter table public.fighter_applications enable row level security;

-- Anyone may apply. That is the whole point of the form.
drop policy if exists "anyone_may_apply" on public.fighter_applications;
create policy "anyone_may_apply" on public.fighter_applications
  for insert with check (status = 'pending' and fighter_id is null);

-- Only staff may read or decide them. An application holds a personal email
-- and date of birth, so it is never publicly readable.
drop policy if exists "staff_read" on public.fighter_applications;
create policy "staff_read" on public.fighter_applications
  for select to authenticated using (public.is_admin());

drop policy if exists "staff_decide" on public.fighter_applications;
create policy "staff_decide" on public.fighter_applications
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff_delete" on public.fighter_applications;
create policy "staff_delete" on public.fighter_applications
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.fighter_applications to authenticated;
grant insert on public.fighter_applications to anon;
grant usage, select on sequence public.fighter_code_seq to authenticated;
