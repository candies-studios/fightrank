/**
 * Database row shapes (snake_case), exactly as the tables and views return
 * them. Mapping to the camelCase domain model happens in `data/mappers.ts`.
 */

import type {
  ChampionshipKind,
  DecisionType,
  EventStatus,
  FightStatus,
  FightType,
  Gender,
  Method,
  MovementLabel,
  Outcome,
  Stance,
  UserRole,
} from './domain'

export interface DisciplineRow {
  id: string
  slug: string
  name: string
  short_code: string
  tagline: string | null
  description: string | null
  ruleset: string | null
  accent: string | null
  sort_order: number
  is_active: boolean
}

export interface DivisionRow {
  id: string
  discipline_id: string
  slug: string
  name: string
  gender: Gender
  weight_lbs: number | null
  weight_kg: number | null
  short_code: string | null
  sort_order: number
  is_p4p: boolean
  is_active: boolean
  description: string | null
}

export interface FighterRow {
  id: string
  fighter_code: string
  primary_discipline_id: string | null
  slug: string
  first_name: string
  last_name: string
  display_name: string
  nickname: string | null
  photo_url: string | null
  country: string | null
  country_code: string | null
  date_of_birth: string | null
  height_cm: number | null
  reach_cm: number | null
  stance: Stance | null
  division_id: string | null
  team: string | null
  debut_date: string | null
  rating: number | string
  ranking_score: number | string
  is_active: boolean
  is_champion: boolean
  is_interim_champion: boolean
  is_former_champion: boolean
  is_demo: boolean
  bio: string | null
  created_at: string
}

export interface FighterProfileRow extends FighterRow {
  discipline_name: string | null
  discipline_slug: string | null
  discipline_code: string | null
  discipline_count: number | null
  career_wins: number | null
  career_losses: number | null
  career_fights: number | null
  division_name: string | null
  division_slug: string | null
  division_gender: Gender | null
  wins: number | null
  losses: number | null
  draws: number | null
  no_contests: number | null
  ko_wins: number | null
  sub_wins: number | null
  dec_wins: number | null
  ko_losses: number | null
  sub_losses: number | null
  dec_losses: number | null
  title_wins: number | null
  title_defenses: number | null
  ranked_wins: number | null
  win_streak: number | null
  loss_streak: number | null
  longest_streak: number | null
  finish_rate: number | string | null
  recent_form: number | string | null
  strength_of_schedule: number | string | null
  total_fights: number | null
  last_fight_date: string | null
  first_fight_date: string | null
  days_inactive: number | null
  current_rank: number | null
  previous_rank: number | null
  rank_movement: number | null
  rank_movement_label: MovementLabel | null
  p4p_rank: number | null
  p4p_movement: number | null
}

export interface EventRow {
  id: string
  slug: string
  name: string
  event_number: number | null
  event_date: string
  venue: string | null
  city: string | null
  country: string | null
  country_code: string | null
  poster_url: string | null
  status: EventStatus
  is_demo: boolean
}

export interface EventCardRow extends EventRow {
  bout_count: number
  completed_count: number
  main_event_label: string | null
  main_event_division_id: string | null
  discipline_codes: string | null
}

/** A row of the `fighter_discipline_profiles` view. */
export interface FighterDisciplineRow {
  id: string
  fighter_id: string
  discipline_id: string
  division_id: string | null
  is_primary: boolean
  is_active: boolean
  debut_date: string | null
  rating: number | string
  ranking_score: number | string
  is_champion: boolean
  is_interim_champion: boolean
  is_former_champion: boolean
  fighter_code: string
  fighter_slug: string
  display_name: string
  nickname: string | null
  photo_url: string | null
  country: string | null
  country_code: string | null
  discipline_name: string
  discipline_slug: string
  discipline_code: string
  discipline_sort_order: number
  division_name: string | null
  division_slug: string | null
  wins: number | null
  losses: number | null
  draws: number | null
  no_contests: number | null
  ko_wins: number | null
  sub_wins: number | null
  dec_wins: number | null
  title_wins: number | null
  title_defenses: number | null
  ranked_wins: number | null
  win_streak: number | null
  loss_streak: number | null
  finish_rate: number | string | null
  recent_form: number | string | null
  strength_of_schedule: number | string | null
  total_fights: number | null
  last_fight_date: string | null
  days_inactive: number | null
  current_rank: number | null
  previous_rank: number | null
  rank_movement: number | null
  rank_movement_label: MovementLabel | null
  p4p_rank: number | null
}

export interface FighterApplicationRow {
  id: string
  reference: string
  first_name: string
  last_name: string
  display_name: string
  email: string
  date_of_birth: string | null
  country: string | null
  country_code: string | null
  height_cm: number | null
  reach_cm: number | null
  stance: string | null
  team: string | null
  discipline_id: string | null
  division_id: string | null
  note: string | null
  status: 'pending' | 'approved' | 'declined'
  fighter_id: string | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
}

export interface FightRow {
  id: string
  event_id: string
  discipline_id: string
  division_id: string
  fighter_a_id: string
  fighter_b_id: string
  bout_order: number
  scheduled_rounds: number
  status: FightStatus
  outcome: Outcome | null
  winner_id: string | null
  loser_id: string | null
  method: Method | null
  decision_type: DecisionType | null
  end_round: number | null
  end_time_seconds: number | null
  fight_type: FightType
  is_title_fight: boolean
  is_interim_title: boolean
  is_main_event: boolean
  bonuses: string[] | null
  notes: string | null
}

export interface FightDetailRow extends FightRow {
  event_name: string
  event_slug: string
  event_date: string
  event_number: number | null
  event_status: EventStatus
  event_city: string | null
  event_country: string | null
  division_name: string
  division_slug: string
  discipline_name: string
  discipline_slug: string
  discipline_code: string
  fighter_a_slug: string
  fighter_a_name: string
  fighter_a_nickname: string | null
  fighter_a_photo: string | null
  fighter_a_country_code: string | null
  fighter_b_slug: string
  fighter_b_name: string
  fighter_b_nickname: string | null
  fighter_b_photo: string | null
  fighter_b_country_code: string | null
}

export interface RankingTableRow {
  id: string
  discipline_id: string
  division_id: string
  fighter_id: string
  position: number
  previous_position: number | null
  movement: number
  movement_label: MovementLabel
  is_champion: boolean
  is_interim_champion: boolean
  rating: number | string
  score: number | string
  computed_at: string
  division_name: string
  division_slug: string
  division_gender: Gender
  division_sort_order: number
  discipline_name: string
  discipline_slug: string
  discipline_code: string
  discipline_sort_order: number
  fighter_code: string
  slug: string
  display_name: string
  nickname: string | null
  photo_url: string | null
  country: string | null
  country_code: string | null
  is_active: boolean
  is_former_champion: boolean
  wins: number | null
  losses: number | null
  draws: number | null
  no_contests: number | null
  ko_wins: number | null
  sub_wins: number | null
  dec_wins: number | null
  win_streak: number | null
  loss_streak: number | null
  ranked_wins: number | null
  finish_rate: number | string | null
  recent_form: number | string | null
  strength_of_schedule: number | string | null
  last_fight_date: string | null
  days_inactive: number | null
  total_fights: number | null
  opponent_quality: number | string | null
  form_points: number | string | null
  streak_points: number | string | null
  finish_bonus: number | string | null
  activity_points: number | string | null
  base_rating: number | string | null
  final_score: number | string | null
}

export interface P4PTableRow {
  id: string
  discipline_id: string
  discipline_name: string
  discipline_slug: string
  discipline_code: string
  fighter_code: string
  fighter_id: string
  position: number
  previous_position: number | null
  movement: number
  movement_label: MovementLabel
  score: number | string
  components: Record<string, number>
  computed_at: string
  slug: string
  display_name: string
  nickname: string | null
  photo_url: string | null
  country: string | null
  country_code: string | null
  rating: number | string
  is_champion: boolean
  is_interim_champion: boolean
  division_name: string | null
  division_slug: string | null
  wins: number | null
  losses: number | null
  draws: number | null
  no_contests: number | null
  win_streak: number | null
  finish_rate: number | string | null
  last_fight_date: string | null
  division_rank: number | null
}

export interface RankingHistoryRow {
  id: string
  fighter_id: string
  discipline_id: string
  division_id: string
  event_id: string | null
  fight_id: string | null
  previous_rank: number | null
  new_rank: number | null
  previous_rating: number | string | null
  new_rating: number | string | null
  movement: number
  movement_label: MovementLabel
  movement_reason: string[]
  effective_date: string
  created_at: string
}

export interface RankingHistoryDetailRow extends RankingHistoryRow {
  fighter_slug: string
  fighter_name: string
  fighter_photo: string | null
  fighter_country_code: string | null
  division_name: string
  division_slug: string
  discipline_name: string
  discipline_slug: string
  discipline_code: string
  fighter_code: string
  event_name: string | null
  event_slug: string | null
}

export interface RankingBreakdownRow {
  id: string
  fighter_id: string
  discipline_id: string
  division_id: string
  base_rating: number | string
  opponent_quality: number | string
  recent_form: number | string
  win_streak: number | string
  finish_bonus: number | string
  activity: number | string
  title_bonus: number | string
  final_score: number | string
  details: Record<string, number | string | boolean | string[]>
  computed_at: string
}

export interface ChampionshipRow {
  id: string
  discipline_id: string
  division_id: string
  fighter_id: string
  kind: ChampionshipKind
  won_at: string
  won_fight_id: string | null
  lost_at: string | null
  lost_fight_id: string | null
  end_reason: string | null
  defenses: number
  is_current: boolean
}

export interface RankingConfigRow {
  id: string
  scope: 'division' | 'p4p'
  key: string
  value: number | boolean
  data_type: 'number' | 'boolean' | 'json'
  label: string
  description: string | null
  group_name: string
  min_value: number | string | null
  max_value: number | string | null
  step: number | string | null
  updated_at: string
}

export interface AuditLogRow {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  entity: string
  entity_id: string | null
  entity_label: string | null
  previous_value: unknown
  new_value: unknown
  created_at: string
}

export interface ProfileRow {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
}

export interface SearchIndexRow {
  kind: 'fighter' | 'event' | 'division' | 'discipline'
  id: string
  slug: string
  label: string
  sublabel: string | null
  image_url: string | null
  country_code: string | null
  search_text: string
}
