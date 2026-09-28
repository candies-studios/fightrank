-- =============================================================================
-- FIGHTRANK - 0004_views.sql
-- Read models. All joins live here in SQL so the client only ever issues flat
-- selects - which is what lets one repository implementation serve both
-- Supabase (PostgREST) and the local PGlite demo database.
-- =============================================================================

-- Fights with everything needed to render a bout row -------------------------
create or replace view public.fight_details as
select
  fi.*,
  e.name        as event_name,
  e.slug        as event_slug,
  e.event_date  as event_date,
  e.event_number as event_number,
  e.status      as event_status,
  e.city        as event_city,
  e.country     as event_country,
  d.name        as division_name,
  d.slug        as division_slug,
  disc.name       as discipline_name,
  disc.slug       as discipline_slug,
  disc.short_code as discipline_code,
  a.slug        as fighter_a_slug,
  a.display_name as fighter_a_name,
  a.nickname    as fighter_a_nickname,
  a.photo_url   as fighter_a_photo,
  a.country_code as fighter_a_country_code,
  a.fighter_code as fighter_a_code,
  b.slug        as fighter_b_slug,
  b.display_name as fighter_b_name,
  b.nickname    as fighter_b_nickname,
  b.photo_url   as fighter_b_photo,
  b.country_code as fighter_b_country_code,
  b.fighter_code as fighter_b_code
from public.fights fi
join public.events      e on e.id = fi.event_id
join public.divisions   d on d.id = fi.division_id
join public.disciplines disc on disc.id = fi.discipline_id
join public.fighters    a on a.id = fi.fighter_a_id
join public.fighters    b on b.id = fi.fighter_b_id;

-- Divisional ranking table ----------------------------------------------------
create or replace view public.ranking_table as
select
  r.id,
  r.discipline_id,
  r.division_id,
  r.fighter_id,
  r.position,
  r.previous_position,
  r.movement,
  r.movement_label,
  r.is_champion,
  r.is_interim_champion,
  r.rating,
  r.score,
  r.computed_at,
  d.name  as division_name,
  d.slug  as division_slug,
  d.gender as division_gender,
  d.sort_order as division_sort_order,
  disc.name       as discipline_name,
  disc.slug       as discipline_slug,
  disc.short_code as discipline_code,
  disc.sort_order as discipline_sort_order,
  f.slug, f.display_name, f.nickname, f.photo_url, f.fighter_code,
  f.country, f.country_code, f.is_active,
  fd.is_former_champion,
  s.wins, s.losses, s.draws, s.no_contests,
  s.ko_wins, s.sub_wins, s.dec_wins,
  s.win_streak, s.loss_streak, s.ranked_wins,
  s.finish_rate, s.recent_form, s.strength_of_schedule,
  s.last_fight_date, s.days_inactive, s.total_fights,
  b.opponent_quality, b.recent_form as form_points, b.win_streak as streak_points,
  b.finish_bonus, b.activity as activity_points, b.base_rating, b.final_score
from public.rankings r
join public.divisions   d on d.id = r.division_id
join public.disciplines disc on disc.id = r.discipline_id
join public.fighters    f on f.id = r.fighter_id
left join public.fighter_disciplines fd
       on fd.fighter_id = r.fighter_id and fd.discipline_id = r.discipline_id
left join public.fighter_stats s
       on s.fighter_id = r.fighter_id and s.discipline_id = r.discipline_id
left join public.ranking_breakdowns b
       on b.fighter_id = r.fighter_id and b.division_id = r.division_id;

-- Pound-for-pound table, per discipline ---------------------------------------
create or replace view public.p4p_table as
select
  p.id,
  p.discipline_id,
  p.fighter_id,
  p.position,
  p.previous_position,
  p.movement,
  p.movement_label,
  p.score,
  p.components,
  p.computed_at,
  f.slug, f.display_name, f.nickname, f.photo_url, f.fighter_code,
  f.country, f.country_code,
  fd.rating, fd.is_champion, fd.is_interim_champion,
  disc.name       as discipline_name,
  disc.slug       as discipline_slug,
  disc.short_code as discipline_code,
  d.name as division_name,
  d.slug as division_slug,
  s.wins, s.losses, s.draws, s.no_contests,
  s.win_streak, s.finish_rate, s.last_fight_date,
  r.position as division_rank
from public.p4p_rankings p
join public.fighters    f on f.id = p.fighter_id
join public.disciplines disc on disc.id = p.discipline_id
left join public.fighter_disciplines fd
       on fd.fighter_id = p.fighter_id and fd.discipline_id = p.discipline_id
left join public.divisions d on d.id = fd.division_id
left join public.fighter_stats s
       on s.fighter_id = p.fighter_id and s.discipline_id = p.discipline_id
left join public.rankings r
       on r.fighter_id = p.fighter_id and r.division_id = fd.division_id;

-- Ranking history with labels -------------------------------------------------
create or replace view public.ranking_history_details as
select
  h.*,
  f.slug         as fighter_slug,
  f.display_name as fighter_name,
  f.photo_url    as fighter_photo,
  f.country_code as fighter_country_code,
  f.fighter_code as fighter_code,
  d.name         as division_name,
  d.slug         as division_slug,
  disc.name       as discipline_name,
  disc.slug       as discipline_slug,
  disc.short_code as discipline_code,
  e.name         as event_name,
  e.slug         as event_slug
from public.ranking_history h
join public.fighters    f on f.id = h.fighter_id
join public.divisions   d on d.id = h.division_id
join public.disciplines disc on disc.id = h.discipline_id
left join public.events e on e.id = h.event_id;

-- Event cards with headline information --------------------------------------
create or replace view public.event_cards as
select
  e.*,
  (select count(*) from public.fights fi where fi.event_id = e.id) as bout_count,
  (select count(*) from public.fights fi
     where fi.event_id = e.id and fi.status = 'completed') as completed_count,
  (select a.display_name || ' vs ' || b.display_name
     from public.fights fi
     join public.fighters a on a.id = fi.fighter_a_id
     join public.fighters b on b.id = fi.fighter_b_id
    where fi.event_id = e.id
    order by fi.is_main_event desc, fi.bout_order asc
    limit 1) as main_event_label,
  (select fi.division_id
     from public.fights fi
    where fi.event_id = e.id
    order by fi.is_main_event desc, fi.bout_order asc
    limit 1) as main_event_division_id,
  -- Which disciplines appear on this card, for the card badges.
  (select string_agg(distinct disc.short_code, ' - ' order by disc.short_code)
     from public.fights fi
     join public.disciplines disc on disc.id = fi.discipline_id
    where fi.event_id = e.id) as discipline_codes
from public.events e;

-- Global search index ---------------------------------------------------------
create or replace view public.search_index as
select
  'fighter'::text as kind,
  f.id,
  f.slug,
  f.display_name as label,
  coalesce(disc.name, 'Unassigned') as sublabel,
  f.photo_url as image_url,
  f.country_code,
  lower(coalesce(f.display_name, '') || ' ' || coalesce(f.nickname, '') || ' ' ||
        coalesce(f.first_name, '') || ' ' || coalesce(f.last_name, '') || ' ' ||
        coalesce(f.country, '') || ' ' || coalesce(f.fighter_code, '') || ' ' ||
        coalesce(disc.name, '')) as search_text
from public.fighters f
left join public.disciplines disc on disc.id = f.primary_discipline_id
union all
select
  'event'::text,
  e.id,
  e.slug,
  e.name,
  to_char(e.event_date, 'DD Mon YYYY') || coalesce(' - ' || e.city, ''),
  e.poster_url,
  e.country_code,
  lower(coalesce(e.name, '') || ' ' || coalesce(e.venue, '') || ' ' ||
        coalesce(e.city, '') || ' ' || coalesce(e.country, ''))
from public.events e
union all
select
  'division'::text,
  d.id,
  d.slug,
  d.name,
  disc.name || ' - ' || initcap(d.gender) ||
    coalesce(' - ' || d.weight_lbs::text || ' lb', ''),
  null,
  null,
  lower(coalesce(d.name, '') || ' ' || coalesce(d.gender, '') || ' ' ||
        coalesce(d.short_code, '') || ' ' || coalesce(disc.name, ''))
from public.divisions d
join public.disciplines disc on disc.id = d.discipline_id
union all
select
  'discipline'::text,
  disc.id,
  disc.slug,
  disc.name,
  coalesce(disc.tagline, disc.ruleset),
  null,
  null,
  lower(coalesce(disc.name, '') || ' ' || coalesce(disc.short_code, '') || ' ' ||
        coalesce(disc.tagline, '') || ' ' || coalesce(disc.ruleset, ''))
from public.disciplines disc;

grant select on public.fighter_profiles, public.fighter_discipline_profiles,
  public.fight_details, public.ranking_table, public.p4p_table,
  public.ranking_history_details, public.event_cards, public.search_index
  to anon, authenticated;
