-- =============================================================================
-- FIGHTRANK - 0001_schema.sql
-- Core relational schema. Normalised: competitive facts (fights) are the single
-- source of truth; everything else (records, ratings, rankings) is DERIVED and
-- rebuilt by the ranking engine. Nothing here is hand-entered ranking data.
-- =============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+. pgcrypto is requested for
-- older servers but its absence is not fatal (the WASM build omits it).
do $$
begin
  execute 'create extension if not exists "pgcrypto"';
exception
  when others then null;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles - application users. Mirrors auth.users (Supabase Auth).
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'viewer'
                  check (role in ('admin', 'editor', 'viewer')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- -----------------------------------------------------------------------------
-- disciplines - the combat sports the platform ranks.
--
-- A discipline is a self-contained competitive world: its own weight classes,
-- its own ratings, its own champions. A grappling result never moves an MMA
-- rating. Athletes cross between them, but records do not.
-- -----------------------------------------------------------------------------
create table if not exists public.disciplines (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  short_code  text not null,
  tagline     text,
  description text,
  ruleset     text,
  accent      text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists disciplines_sort_idx on public.disciplines (sort_order, name);
create unique index if not exists disciplines_code_idx on public.disciplines (lower(short_code));

-- -----------------------------------------------------------------------------
-- divisions - weight classes, each belonging to exactly one discipline (Section 3).
-- NOT hard-coded in the UI.
-- -----------------------------------------------------------------------------
create table if not exists public.divisions (
  id           uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines (id) on delete cascade,
  slug         text not null unique,
  name         text not null,
  gender       text not null default 'men'
                 check (gender in ('men', 'women', 'open')),
  weight_lbs   integer check (weight_lbs is null or weight_lbs between 100 and 400),
  weight_kg    numeric(5, 2),
  short_code   text,
  sort_order   integer not null default 0,
  is_p4p       boolean not null default false,
  is_active    boolean not null default true,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists divisions_sort_idx on public.divisions (sort_order, name);
create index if not exists divisions_active_idx on public.divisions (is_active);
create index if not exists divisions_discipline_idx on public.divisions (discipline_id, sort_order);
-- Exactly one pound-for-pound division per discipline.
create unique index if not exists divisions_single_p4p_idx
  on public.divisions (discipline_id) where is_p4p;

-- -----------------------------------------------------------------------------
-- fighters - ONE ROW PER ATHLETE, for their whole career.
--
-- This is the Fighter ID: a single identity that follows an athlete across
-- every discipline they compete in. `fighter_code` is the public-facing form
-- of it (FR-00123).
--
-- The engine-owned columns below (division_id, rating, ranking_score, the
-- champion flags) hold the values for the athlete's PRIMARY discipline only,
-- denormalised so roster listings and search stay a single flat read. The
-- per-discipline truth lives in `fighter_disciplines`; both are written by the
-- ranking engine and neither is ever edited by hand.
-- -----------------------------------------------------------------------------
create table if not exists public.fighters (
  id                  uuid primary key default gen_random_uuid(),
  fighter_code        text not null unique,
  primary_discipline_id uuid references public.disciplines (id) on delete set null,
  slug                text not null unique,
  first_name          text not null,
  last_name           text not null,
  display_name        text not null,
  nickname            text,
  photo_url           text,
  country             text,
  country_code        text check (country_code is null or char_length(country_code) = 2),
  date_of_birth       date,
  height_cm           integer check (height_cm is null or height_cm between 120 and 250),
  reach_cm            integer check (reach_cm is null or reach_cm between 120 and 260),
  stance              text check (stance is null or stance in ('orthodox', 'southpaw', 'switch')),
  division_id         uuid references public.divisions (id) on delete set null,
  team                text,
  debut_date          date,
  -- Engine-owned. Never edited by hand; rewritten by rankingEngine.
  rating              numeric(10, 3) not null default 1500,
  ranking_score       numeric(10, 3) not null default 1500,
  is_active           boolean not null default true,
  is_champion         boolean not null default false,
  is_interim_champion boolean not null default false,
  is_former_champion  boolean not null default false,
  is_demo             boolean not null default false,
  bio                 text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fighters_not_both_champ
    check (not (is_champion and is_interim_champion))
);

create index if not exists fighters_division_idx on public.fighters (division_id);
create index if not exists fighters_score_idx on public.fighters (division_id, ranking_score desc);
create index if not exists fighters_active_idx on public.fighters (is_active);
create index if not exists fighters_name_idx on public.fighters (lower(display_name));
create index if not exists fighters_discipline_idx on public.fighters (primary_discipline_id);
-- Champion uniqueness is enforced per division (Section 23).
create unique index if not exists fighters_one_champion_per_division
  on public.fighters (division_id) where is_champion;
create unique index if not exists fighters_one_interim_per_division
  on public.fighters (division_id) where is_interim_champion;

-- -----------------------------------------------------------------------------
-- fighter_disciplines - which athlete competes in which discipline.
--
-- This is what the unified Fighter ID buys: one athlete, several competitive
-- records, none of which contaminate the others. An athlete ranked #3 at
-- grappling middleweight and unranked in MMA has two rows here and one row in
-- `fighters`.
-- -----------------------------------------------------------------------------
create table if not exists public.fighter_disciplines (
  id                  uuid primary key default gen_random_uuid(),
  fighter_id          uuid not null references public.fighters (id) on delete cascade,
  discipline_id       uuid not null references public.disciplines (id) on delete cascade,
  division_id         uuid references public.divisions (id) on delete set null,
  is_primary          boolean not null default false,
  is_active           boolean not null default true,
  debut_date          date,
  -- Engine-owned, per discipline.
  rating              numeric(10, 3) not null default 1500,
  ranking_score       numeric(10, 3) not null default 1500,
  is_champion         boolean not null default false,
  is_interim_champion boolean not null default false,
  is_former_champion  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (fighter_id, discipline_id),
  constraint fighter_disciplines_not_both_champ
    check (not (is_champion and is_interim_champion))
);

create index if not exists fighter_disciplines_fighter_idx
  on public.fighter_disciplines (fighter_id);
create index if not exists fighter_disciplines_discipline_idx
  on public.fighter_disciplines (discipline_id, ranking_score desc);
create index if not exists fighter_disciplines_division_idx
  on public.fighter_disciplines (division_id);
-- An athlete has exactly one primary discipline.
create unique index if not exists fighter_disciplines_one_primary
  on public.fighter_disciplines (fighter_id) where is_primary;
-- Championship uniqueness, per division (Section 23).
create unique index if not exists fighter_disciplines_one_champion
  on public.fighter_disciplines (division_id) where is_champion;
create unique index if not exists fighter_disciplines_one_interim
  on public.fighter_disciplines (division_id) where is_interim_champion;

-- -----------------------------------------------------------------------------
-- fighter_stats - derived record, PER DISCIPLINE. Rebuilt by the engine.
-- -----------------------------------------------------------------------------
create table if not exists public.fighter_stats (
  fighter_id       uuid not null references public.fighters (id) on delete cascade,
  discipline_id    uuid not null references public.disciplines (id) on delete cascade,
  wins             integer not null default 0,
  losses           integer not null default 0,
  draws            integer not null default 0,
  no_contests      integer not null default 0,
  ko_wins          integer not null default 0,
  sub_wins         integer not null default 0,
  dec_wins         integer not null default 0,
  ko_losses        integer not null default 0,
  sub_losses       integer not null default 0,
  dec_losses       integer not null default 0,
  title_fights     integer not null default 0,
  title_wins       integer not null default 0,
  title_defenses   integer not null default 0,
  ranked_wins      integer not null default 0,
  win_streak       integer not null default 0,
  loss_streak      integer not null default 0,
  longest_streak   integer not null default 0,
  finish_rate      numeric(5, 4) not null default 0,
  recent_form      numeric(5, 4) not null default 0,
  strength_of_schedule numeric(10, 3) not null default 1500,
  total_fights     integer not null default 0,
  last_fight_date  date,
  first_fight_date date,
  days_inactive    integer,
  updated_at       timestamptz not null default now(),
  primary key (fighter_id, discipline_id)
);

create index if not exists fighter_stats_discipline_idx
  on public.fighter_stats (discipline_id);

-- -----------------------------------------------------------------------------
-- events - fight cards.
-- -----------------------------------------------------------------------------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  event_number integer,
  event_date   date not null,
  venue        text,
  city         text,
  country      text,
  country_code text check (country_code is null or char_length(country_code) = 2),
  poster_url   text,
  status       text not null default 'scheduled'
                 check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists events_date_idx on public.events (event_date desc);
create index if not exists events_status_idx on public.events (status, event_date desc);
create unique index if not exists events_number_idx on public.events (event_number)
  where event_number is not null;

-- -----------------------------------------------------------------------------
-- fights - the single source of competitive truth.
-- -----------------------------------------------------------------------------
create table if not exists public.fights (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  discipline_id    uuid not null references public.disciplines (id) on delete restrict,
  division_id      uuid not null references public.divisions (id) on delete restrict,
  fighter_a_id     uuid not null references public.fighters (id) on delete restrict,
  fighter_b_id     uuid not null references public.fighters (id) on delete restrict,
  bout_order       integer not null default 0,
  scheduled_rounds integer not null default 3 check (scheduled_rounds in (1, 3, 5)),
  status           text not null default 'scheduled'
                     check (status in ('scheduled', 'completed', 'cancelled')),
  -- Outcome
  outcome          text check (outcome is null or outcome in
                     ('win', 'draw', 'majority_draw', 'split_draw', 'no_contest')),
  winner_id        uuid references public.fighters (id) on delete restrict,
  loser_id         uuid references public.fighters (id) on delete restrict,
  method           text check (method is null or method in
                     ('ko', 'tko', 'submission', 'pin', 'technical_fall',
                      'decision', 'technical_decision',
                      'dq', 'doctor_stoppage', 'retirement', 'no_contest', 'draw')),
  decision_type    text check (decision_type is null or decision_type in
                     ('unanimous', 'split', 'majority')),
  end_round        integer check (end_round is null or end_round between 1 and 5),
  end_time_seconds integer check (end_time_seconds is null or end_time_seconds between 0 and 900),
  -- Classification
  fight_type       text not null default 'standard'
                     check (fight_type in ('standard', 'catchweight', 'tournament', 'exhibition')),
  is_title_fight   boolean not null default false,
  is_interim_title boolean not null default false,
  is_main_event    boolean not null default false,
  bonuses          text[] not null default '{}',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Section 23 Ranking calculation safety, enforced in the database itself.
  constraint fights_distinct_fighters
    check (fighter_a_id <> fighter_b_id),
  constraint fights_winner_is_participant
    check (winner_id is null or winner_id in (fighter_a_id, fighter_b_id)),
  constraint fights_loser_is_participant
    check (loser_id is null or loser_id in (fighter_a_id, fighter_b_id)),
  constraint fights_winner_not_loser
    check (winner_id is null or loser_id is null or winner_id <> loser_id),
  constraint fights_win_requires_winner
    check (outcome is distinct from 'win' or winner_id is not null),
  constraint fights_nonwin_has_no_winner
    check (outcome is null or outcome = 'win' or winner_id is null),
  constraint fights_completed_has_outcome
    check (status <> 'completed' or outcome is not null),
  constraint fights_decision_type_only_for_decisions
    check (decision_type is null or method in ('decision', 'technical_decision')
           or outcome in ('majority_draw', 'split_draw', 'draw')),
  constraint fights_interim_implies_title
    check (not is_interim_title or is_title_fight)
);

create index if not exists fights_event_idx on public.fights (event_id, bout_order);
create index if not exists fights_division_idx on public.fights (division_id);
create index if not exists fights_discipline_idx on public.fights (discipline_id);
create index if not exists fights_a_idx on public.fights (fighter_a_id);
create index if not exists fights_b_idx on public.fights (fighter_b_id);
create index if not exists fights_winner_idx on public.fights (winner_id);
create index if not exists fights_status_idx on public.fights (status);
-- Duplicate-bout prevention, order-independent (Section 23).
create unique index if not exists fights_unique_bout_per_event
  on public.fights (event_id, least(fighter_a_id, fighter_b_id), greatest(fighter_a_id, fighter_b_id));

-- -----------------------------------------------------------------------------
-- rankings - current divisional standings. Champion = position 0.
-- -----------------------------------------------------------------------------
create table if not exists public.rankings (
  id             uuid primary key default gen_random_uuid(),
  discipline_id  uuid not null references public.disciplines (id) on delete cascade,
  division_id    uuid not null references public.divisions (id) on delete cascade,
  fighter_id     uuid not null references public.fighters (id) on delete cascade,
  position       integer not null check (position >= 0),
  previous_position integer,
  movement       integer not null default 0,
  movement_label text not null default 'none'
                   check (movement_label in ('up', 'down', 'none', 'new', 'out')),
  is_champion    boolean not null default false,
  is_interim_champion boolean not null default false,
  rating         numeric(10, 3) not null,
  score          numeric(10, 3) not null,
  computed_at    timestamptz not null default now(),
  unique (division_id, fighter_id)
);

create index if not exists rankings_division_pos_idx on public.rankings (division_id, position);
create index if not exists rankings_fighter_idx on public.rankings (fighter_id);
create index if not exists rankings_discipline_idx on public.rankings (discipline_id, position);

-- -----------------------------------------------------------------------------
-- ranking_breakdowns - transparent score decomposition (Section 42).
-- -----------------------------------------------------------------------------
create table if not exists public.ranking_breakdowns (
  id               uuid primary key default gen_random_uuid(),
  fighter_id       uuid not null references public.fighters (id) on delete cascade,
  discipline_id    uuid not null references public.disciplines (id) on delete cascade,
  division_id      uuid not null references public.divisions (id) on delete cascade,
  base_rating      numeric(10, 3) not null,
  opponent_quality numeric(10, 3) not null default 0,
  recent_form      numeric(10, 3) not null default 0,
  win_streak       numeric(10, 3) not null default 0,
  finish_bonus     numeric(10, 3) not null default 0,
  activity         numeric(10, 3) not null default 0,
  title_bonus      numeric(10, 3) not null default 0,
  final_score      numeric(10, 3) not null,
  details          jsonb not null default '{}'::jsonb,
  computed_at      timestamptz not null default now(),
  unique (fighter_id, division_id)
);

-- -----------------------------------------------------------------------------
-- ranking_history - every movement, ever (Section 19).
-- -----------------------------------------------------------------------------
create table if not exists public.ranking_history (
  id               uuid primary key default gen_random_uuid(),
  fighter_id       uuid not null references public.fighters (id) on delete cascade,
  discipline_id    uuid not null references public.disciplines (id) on delete cascade,
  division_id      uuid not null references public.divisions (id) on delete cascade,
  event_id         uuid references public.events (id) on delete set null,
  fight_id         uuid references public.fights (id) on delete set null,
  previous_rank    integer,
  new_rank         integer,
  previous_rating  numeric(10, 3),
  new_rating       numeric(10, 3),
  movement         integer not null default 0,
  movement_label   text not null default 'none'
                     check (movement_label in ('up', 'down', 'none', 'new', 'out')),
  movement_reason  text[] not null default '{}',
  effective_date   date not null,
  created_at       timestamptz not null default now()
);

create index if not exists ranking_history_fighter_idx
  on public.ranking_history (fighter_id, effective_date);
create index if not exists ranking_history_division_idx
  on public.ranking_history (division_id, effective_date desc);
create index if not exists ranking_history_event_idx on public.ranking_history (event_id);
create index if not exists ranking_history_discipline_idx
  on public.ranking_history (discipline_id, effective_date desc);
create index if not exists ranking_history_movement_idx
  on public.ranking_history (effective_date desc, movement desc);

-- -----------------------------------------------------------------------------
-- p4p_rankings / p4p_history - separate scoring model (Section 20).
-- -----------------------------------------------------------------------------
create table if not exists public.p4p_rankings (
  id                uuid primary key default gen_random_uuid(),
  discipline_id     uuid not null references public.disciplines (id) on delete cascade,
  fighter_id        uuid not null references public.fighters (id) on delete cascade,
  position          integer not null check (position >= 1),
  previous_position integer,
  movement          integer not null default 0,
  movement_label    text not null default 'none'
                      check (movement_label in ('up', 'down', 'none', 'new', 'out')),
  score             numeric(10, 4) not null,
  components        jsonb not null default '{}'::jsonb,
  computed_at       timestamptz not null default now()
);

create unique index if not exists p4p_unique_idx
  on public.p4p_rankings (discipline_id, fighter_id);
create index if not exists p4p_position_idx on public.p4p_rankings (discipline_id, position);

create table if not exists public.p4p_history (
  id                uuid primary key default gen_random_uuid(),
  discipline_id     uuid not null references public.disciplines (id) on delete cascade,
  fighter_id        uuid not null references public.fighters (id) on delete cascade,
  event_id          uuid references public.events (id) on delete set null,
  previous_position integer,
  new_position      integer,
  previous_score    numeric(10, 4),
  new_score         numeric(10, 4),
  movement          integer not null default 0,
  effective_date    date not null,
  created_at        timestamptz not null default now()
);

create index if not exists p4p_history_fighter_idx on public.p4p_history (fighter_id, effective_date);

-- -----------------------------------------------------------------------------
-- championships - title reigns, including interim (Section 15).
-- -----------------------------------------------------------------------------
create table if not exists public.championships (
  id            uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines (id) on delete cascade,
  division_id   uuid not null references public.divisions (id) on delete cascade,
  fighter_id    uuid not null references public.fighters (id) on delete cascade,
  kind          text not null default 'undisputed'
                  check (kind in ('undisputed', 'interim')),
  won_at        date not null,
  won_fight_id  uuid references public.fights (id) on delete set null,
  lost_at       date,
  lost_fight_id uuid references public.fights (id) on delete set null,
  end_reason    text check (end_reason is null or end_reason in
                  ('defeat', 'vacated', 'unified', 'stripped', 'promoted')),
  defenses      integer not null default 0,
  is_current    boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists championships_division_idx on public.championships (division_id, is_current);
create index if not exists championships_fighter_idx on public.championships (fighter_id);
create index if not exists championships_discipline_idx
  on public.championships (discipline_id, is_current);
-- One current undisputed + one current interim champion per division (Section 23).
create unique index if not exists championships_one_current_undisputed
  on public.championships (division_id) where is_current and kind = 'undisputed';
create unique index if not exists championships_one_current_interim
  on public.championships (division_id) where is_current and kind = 'interim';

-- -----------------------------------------------------------------------------
-- ranking_config - every engine constant, editable without code changes (Section 40).
-- A registry table: the admin UI renders it generically from these rows.
-- -----------------------------------------------------------------------------
create table if not exists public.ranking_config (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null default 'division'
                check (scope in ('division', 'p4p')),
  key         text not null,
  value       jsonb not null,
  data_type   text not null default 'number'
                check (data_type in ('number', 'boolean', 'json')),
  label       text not null,
  description text,
  group_name  text not null default 'General',
  min_value   numeric,
  max_value   numeric,
  step        numeric,
  sort_order  integer not null default 0,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (scope, key)
);

create index if not exists ranking_config_scope_idx on public.ranking_config (scope, sort_order);

-- -----------------------------------------------------------------------------
-- audit_log - every administrative action (Section 39).
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles (id) on delete set null,
  user_email     text,
  action         text not null,
  entity         text not null,
  entity_id      uuid,
  entity_label   text,
  previous_value jsonb,
  new_value      jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);

-- -----------------------------------------------------------------------------
-- Read models.
--
-- `fighter_profiles`  - one row per ATHLETE, carrying their primary
--                       discipline's record and standing. Roster, search, lists.
-- `fighter_discipline_profiles`
--                     - one row per (athlete, discipline). This is what the
--                       fighter profile page reads to show every record an
--                       athlete holds under their single Fighter ID.
-- -----------------------------------------------------------------------------
create or replace view public.fighter_profiles as
select
  f.*,
  disc.name       as discipline_name,
  disc.slug       as discipline_slug,
  disc.short_code as discipline_code,
  d.name          as division_name,
  d.slug          as division_slug,
  d.gender        as division_gender,
  s.wins, s.losses, s.draws, s.no_contests,
  s.ko_wins, s.sub_wins, s.dec_wins,
  s.ko_losses, s.sub_losses, s.dec_losses,
  s.title_wins, s.title_defenses, s.ranked_wins,
  s.win_streak, s.loss_streak, s.longest_streak,
  s.finish_rate, s.recent_form, s.strength_of_schedule,
  s.total_fights, s.last_fight_date, s.first_fight_date, s.days_inactive,
  r.position           as current_rank,
  r.previous_position  as previous_rank,
  r.movement           as rank_movement,
  r.movement_label     as rank_movement_label,
  p.position           as p4p_rank,
  p.movement           as p4p_movement,
  (select count(*) from public.fighter_disciplines fd
    where fd.fighter_id = f.id) as discipline_count,
  (select coalesce(sum(st.wins), 0) from public.fighter_stats st
    where st.fighter_id = f.id) as career_wins,
  (select coalesce(sum(st.losses), 0) from public.fighter_stats st
    where st.fighter_id = f.id) as career_losses,
  (select coalesce(sum(st.total_fights), 0) from public.fighter_stats st
    where st.fighter_id = f.id) as career_fights
from public.fighters f
left join public.disciplines    disc on disc.id = f.primary_discipline_id
left join public.divisions      d on d.id = f.division_id
left join public.fighter_stats  s on s.fighter_id = f.id
                                 and s.discipline_id = f.primary_discipline_id
left join public.rankings       r on r.fighter_id = f.id and r.division_id = f.division_id
left join public.p4p_rankings   p on p.fighter_id = f.id
                                 and p.discipline_id = f.primary_discipline_id;

create or replace view public.fighter_discipline_profiles as
select
  fd.id,
  fd.fighter_id,
  fd.discipline_id,
  fd.division_id,
  fd.is_primary,
  fd.is_active,
  fd.debut_date,
  fd.rating,
  fd.ranking_score,
  fd.is_champion,
  fd.is_interim_champion,
  fd.is_former_champion,
  f.fighter_code,
  f.slug        as fighter_slug,
  f.display_name,
  f.nickname,
  f.photo_url,
  f.country,
  f.country_code,
  disc.name       as discipline_name,
  disc.slug       as discipline_slug,
  disc.short_code as discipline_code,
  disc.sort_order as discipline_sort_order,
  d.name  as division_name,
  d.slug  as division_slug,
  s.wins, s.losses, s.draws, s.no_contests,
  s.ko_wins, s.sub_wins, s.dec_wins,
  s.title_wins, s.title_defenses, s.ranked_wins,
  s.win_streak, s.loss_streak, s.finish_rate, s.recent_form,
  s.strength_of_schedule, s.total_fights, s.last_fight_date, s.days_inactive,
  r.position          as current_rank,
  r.previous_position as previous_rank,
  r.movement          as rank_movement,
  r.movement_label    as rank_movement_label,
  p.position          as p4p_rank
from public.fighter_disciplines fd
join public.fighters    f on f.id = fd.fighter_id
join public.disciplines disc on disc.id = fd.discipline_id
left join public.divisions d on d.id = fd.division_id
left join public.fighter_stats s on s.fighter_id = fd.fighter_id
                                and s.discipline_id = fd.discipline_id
left join public.rankings r on r.fighter_id = fd.fighter_id
                           and r.division_id = fd.division_id
left join public.p4p_rankings p on p.fighter_id = fd.fighter_id
                               and p.discipline_id = fd.discipline_id;
