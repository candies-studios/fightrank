/**
 * Row → domain mapping.
 *
 * PostgreSQL `numeric` arrives as a string over the wire (both through
 * PostgREST and the wasm driver), so every numeric column goes through `dec()`.
 */

import type {
  AuditEntry,
  Championship,
  Discipline,
  DisciplineRecord,
  Division,
  Fight,
  FightEvent,
  FightWithContext,
  FighterApplication,
  FighterProfile,
  P4PEntry,
  RankingEntry,
  RankingHistoryEntry,
  ScoreBreakdown,
  UserProfile,
} from '@/types/domain'
import type {
  AuditLogRow,
  ChampionshipRow,
  DisciplineRow,
  DivisionRow,
  FighterApplicationRow,
  FighterDisciplineRow,
  EventCardRow,
  EventRow,
  FightDetailRow,
  FightRow,
  FighterProfileRow,
  P4PTableRow,
  ProfileRow,
  RankingBreakdownRow,
  RankingHistoryDetailRow,
  RankingTableRow,
} from '@/types/db'

/** numeric → number, tolerating string, null and undefined. */
export function dec(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

export function int(value: number | string | null | undefined, fallback = 0): number {
  return Math.round(dec(value, fallback))
}

export function mapApplication(row: FighterApplicationRow): FighterApplication {
  return {
    id: row.id,
    reference: row.reference,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    email: row.email,
    dateOfBirth: row.date_of_birth,
    country: row.country,
    countryCode: row.country_code,
    heightCm: row.height_cm,
    reachCm: row.reach_cm,
    stance: (row.stance as FighterApplication['stance']) ?? null,
    team: row.team,
    disciplineId: row.discipline_id,
    divisionId: row.division_id,
    note: row.note,
    status: row.status,
    fighterId: row.fighter_id,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
  }
}

export function mapDiscipline(row: DisciplineRow): Discipline {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortCode: row.short_code,
    tagline: row.tagline,
    description: row.description,
    ruleset: row.ruleset,
    accent: row.accent,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

/** One athlete's record in one discipline — the profile page reads these. */
export function mapDisciplineRecord(row: FighterDisciplineRow): DisciplineRecord {
  return {
    id: row.id,
    fighterId: row.fighter_id,
    disciplineId: row.discipline_id,
    disciplineName: row.discipline_name,
    disciplineSlug: row.discipline_slug,
    disciplineCode: row.discipline_code,
    disciplineSortOrder: row.discipline_sort_order,
    divisionId: row.division_id,
    divisionName: row.division_name,
    divisionSlug: row.division_slug,
    isPrimary: row.is_primary,
    isActive: row.is_active,
    debutDate: row.debut_date,
    rating: dec(row.rating, 1500),
    rankingScore: dec(row.ranking_score, 1500),
    isChampion: row.is_champion,
    isInterimChampion: row.is_interim_champion,
    isFormerChampion: row.is_former_champion,
    currentRank: row.current_rank,
    previousRank: row.previous_rank,
    rankMovement: row.rank_movement,
    rankMovementLabel: row.rank_movement_label,
    p4pRank: row.p4p_rank,
    wins: int(row.wins),
    losses: int(row.losses),
    draws: int(row.draws),
    noContests: int(row.no_contests),
    koWins: int(row.ko_wins),
    subWins: int(row.sub_wins),
    decWins: int(row.dec_wins),
    koLosses: 0,
    subLosses: 0,
    decLosses: 0,
    titleFights: 0,
    titleWins: int(row.title_wins),
    titleDefenses: int(row.title_defenses),
    rankedWins: int(row.ranked_wins),
    winStreak: int(row.win_streak),
    lossStreak: int(row.loss_streak),
    longestStreak: 0,
    finishRate: dec(row.finish_rate),
    recentForm: dec(row.recent_form),
    strengthOfSchedule: dec(row.strength_of_schedule, 1500),
    totalFights: int(row.total_fights),
    lastFightDate: row.last_fight_date,
    firstFightDate: null,
    daysInactive: row.days_inactive,
  }
}

export function mapDivision(row: DivisionRow): Division {
  return {
    id: row.id,
    disciplineId: row.discipline_id,
    slug: row.slug,
    name: row.name,
    gender: row.gender,
    weightLbs: row.weight_lbs,
    weightKg: row.weight_kg === null ? null : dec(row.weight_kg),
    shortCode: row.short_code,
    sortOrder: row.sort_order,
    isP4P: row.is_p4p,
    isActive: row.is_active,
    description: row.description,
  }
}

export function mapFighterProfile(row: FighterProfileRow): FighterProfile {
  return {
    id: row.id,
    fighterCode: row.fighter_code,
    primaryDisciplineId: row.primary_discipline_id,
    slug: row.slug,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    nickname: row.nickname,
    photoUrl: row.photo_url,
    country: row.country,
    countryCode: row.country_code,
    dateOfBirth: row.date_of_birth,
    heightCm: row.height_cm,
    reachCm: row.reach_cm,
    stance: row.stance,
    divisionId: row.division_id,
    team: row.team,
    debutDate: row.debut_date,
    rating: dec(row.rating, 1500),
    rankingScore: dec(row.ranking_score, 1500),
    isActive: row.is_active,
    isChampion: row.is_champion,
    isInterimChampion: row.is_interim_champion,
    isFormerChampion: row.is_former_champion,
    isDemo: row.is_demo,
    bio: row.bio,
    createdAt: row.created_at,
    disciplineName: row.discipline_name,
    disciplineSlug: row.discipline_slug,
    disciplineCode: row.discipline_code,
    disciplineCount: int(row.discipline_count),
    careerWins: int(row.career_wins),
    careerLosses: int(row.career_losses),
    careerFights: int(row.career_fights),
    divisionName: row.division_name,
    divisionSlug: row.division_slug,
    divisionGender: row.division_gender,
    wins: int(row.wins),
    losses: int(row.losses),
    draws: int(row.draws),
    noContests: int(row.no_contests),
    koWins: int(row.ko_wins),
    subWins: int(row.sub_wins),
    decWins: int(row.dec_wins),
    koLosses: int(row.ko_losses),
    subLosses: int(row.sub_losses),
    decLosses: int(row.dec_losses),
    titleFights: 0,
    titleWins: int(row.title_wins),
    titleDefenses: int(row.title_defenses),
    rankedWins: int(row.ranked_wins),
    winStreak: int(row.win_streak),
    lossStreak: int(row.loss_streak),
    longestStreak: int(row.longest_streak),
    finishRate: dec(row.finish_rate),
    recentForm: dec(row.recent_form),
    strengthOfSchedule: dec(row.strength_of_schedule, 1500),
    totalFights: int(row.total_fights),
    lastFightDate: row.last_fight_date,
    firstFightDate: row.first_fight_date,
    daysInactive: row.days_inactive,
    currentRank: row.current_rank,
    previousRank: row.previous_rank,
    rankMovement: row.rank_movement,
    rankMovementLabel: row.rank_movement_label,
    p4pRank: row.p4p_rank,
    p4pMovement: row.p4p_movement,
  }
}

/** Build a FighterProfile from the denormalised ranking_table view. */
export function mapRankingRowToProfile(row: RankingTableRow): FighterProfile {
  return {
    id: row.fighter_id,
    fighterCode: row.fighter_code,
    primaryDisciplineId: row.discipline_id,
    slug: row.slug,
    firstName: '',
    lastName: '',
    displayName: row.display_name,
    nickname: row.nickname,
    photoUrl: row.photo_url,
    country: row.country,
    countryCode: row.country_code,
    dateOfBirth: null,
    heightCm: null,
    reachCm: null,
    stance: null,
    divisionId: row.division_id,
    team: null,
    debutDate: null,
    rating: dec(row.rating, 1500),
    rankingScore: dec(row.score, 1500),
    isActive: row.is_active,
    isChampion: row.is_champion,
    isInterimChampion: row.is_interim_champion,
    isFormerChampion: row.is_former_champion,
    isDemo: false,
    bio: null,
    createdAt: row.computed_at,
    disciplineName: row.discipline_name,
    disciplineSlug: row.discipline_slug,
    disciplineCode: row.discipline_code,
    disciplineCount: 0,
    careerWins: int(row.wins),
    careerLosses: int(row.losses),
    careerFights: int(row.total_fights),
    divisionName: row.division_name,
    divisionSlug: row.division_slug,
    divisionGender: row.division_gender,
    wins: int(row.wins),
    losses: int(row.losses),
    draws: int(row.draws),
    noContests: int(row.no_contests),
    koWins: int(row.ko_wins),
    subWins: int(row.sub_wins),
    decWins: int(row.dec_wins),
    koLosses: 0,
    subLosses: 0,
    decLosses: 0,
    titleFights: 0,
    titleWins: 0,
    titleDefenses: 0,
    rankedWins: int(row.ranked_wins),
    winStreak: int(row.win_streak),
    lossStreak: int(row.loss_streak),
    longestStreak: 0,
    finishRate: dec(row.finish_rate),
    recentForm: dec(row.recent_form),
    strengthOfSchedule: dec(row.strength_of_schedule, 1500),
    totalFights: int(row.total_fights),
    lastFightDate: row.last_fight_date,
    firstFightDate: null,
    daysInactive: row.days_inactive,
    currentRank: row.position,
    previousRank: row.previous_position,
    rankMovement: row.movement,
    rankMovementLabel: row.movement_label,
    p4pRank: null,
    p4pMovement: null,
  }
}

export function mapRankingEntry(row: RankingTableRow): RankingEntry {
  return {
    disciplineId: row.discipline_id,
    divisionId: row.division_id,
    fighterId: row.fighter_id,
    position: row.position,
    previousPosition: row.previous_position,
    movement: row.movement,
    movementLabel: row.movement_label,
    isChampion: row.is_champion,
    isInterimChampion: row.is_interim_champion,
    rating: dec(row.rating),
    score: dec(row.score),
  }
}

export function mapBreakdownFromRankingRow(row: RankingTableRow): ScoreBreakdown | null {
  if (row.base_rating === null || row.base_rating === undefined) return null
  return {
    fighterId: row.fighter_id,
    divisionId: row.division_id,
    baseRating: dec(row.base_rating),
    opponentQuality: dec(row.opponent_quality),
    recentForm: dec(row.form_points),
    winStreak: dec(row.streak_points),
    finishBonus: dec(row.finish_bonus),
    activity: dec(row.activity_points),
    titleBonus: 0,
    finalScore: dec(row.final_score, dec(row.score)),
    details: {},
  }
}

export function mapBreakdown(row: RankingBreakdownRow): ScoreBreakdown {
  return {
    fighterId: row.fighter_id,
    divisionId: row.division_id,
    baseRating: dec(row.base_rating),
    opponentQuality: dec(row.opponent_quality),
    recentForm: dec(row.recent_form),
    winStreak: dec(row.win_streak),
    finishBonus: dec(row.finish_bonus),
    activity: dec(row.activity),
    titleBonus: dec(row.title_bonus),
    finalScore: dec(row.final_score),
    details: row.details ?? {},
  }
}

export function mapEvent(row: EventRow | EventCardRow): FightEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    eventNumber: row.event_number,
    eventDate: row.event_date,
    venue: row.venue,
    city: row.city,
    country: row.country,
    countryCode: row.country_code,
    posterUrl: row.poster_url,
    status: row.status,
    isDemo: row.is_demo,
  }
}

export interface EventCard extends FightEvent {
  boutCount: number
  completedCount: number
  mainEventLabel: string | null
  disciplineCodes: string[]
}

export function mapEventCard(row: EventCardRow): EventCard {
  return {
    ...mapEvent(row),
    boutCount: int(row.bout_count),
    completedCount: int(row.completed_count),
    mainEventLabel: row.main_event_label,
    disciplineCodes: (row.discipline_codes ?? '')
      .split(' · ')
      .map((code) => code.trim())
      .filter(Boolean),
  }
}

export function mapFight(row: FightRow): Fight {
  return {
    id: row.id,
    eventId: row.event_id,
    disciplineId: row.discipline_id,
    divisionId: row.division_id,
    fighterAId: row.fighter_a_id,
    fighterBId: row.fighter_b_id,
    boutOrder: row.bout_order,
    scheduledRounds: row.scheduled_rounds,
    status: row.status,
    outcome: row.outcome,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    method: row.method,
    decisionType: row.decision_type,
    endRound: row.end_round,
    endTimeSeconds: row.end_time_seconds,
    fightType: row.fight_type,
    isTitleFight: row.is_title_fight,
    isInterimTitle: row.is_interim_title,
    isMainEvent: row.is_main_event,
    bonuses: row.bonuses ?? [],
    notes: row.notes,
  }
}

export function mapFightDetail(row: FightDetailRow): FightWithContext {
  return {
    ...mapFight(row),
    eventName: row.event_name,
    eventSlug: row.event_slug,
    eventDate: row.event_date,
    disciplineName: row.discipline_name,
    disciplineSlug: row.discipline_slug,
    disciplineCode: row.discipline_code,
    divisionName: row.division_name,
    fighterA: {
      id: row.fighter_a_id,
      slug: row.fighter_a_slug,
      displayName: row.fighter_a_name,
      nickname: row.fighter_a_nickname,
      photoUrl: row.fighter_a_photo,
      countryCode: row.fighter_a_country_code,
    },
    fighterB: {
      id: row.fighter_b_id,
      slug: row.fighter_b_slug,
      displayName: row.fighter_b_name,
      nickname: row.fighter_b_nickname,
      photoUrl: row.fighter_b_photo,
      countryCode: row.fighter_b_country_code,
    },
  }
}

export function mapHistory(row: RankingHistoryDetailRow): RankingHistoryEntry {
  return {
    id: row.id,
    fighterId: row.fighter_id,
    disciplineId: row.discipline_id,
    divisionId: row.division_id,
    eventId: row.event_id,
    fightId: row.fight_id,
    previousRank: row.previous_rank,
    newRank: row.new_rank,
    previousRating: row.previous_rating === null ? null : dec(row.previous_rating),
    newRating: row.new_rating === null ? null : dec(row.new_rating),
    movement: row.movement,
    movementLabel: row.movement_label,
    movementReason: row.movement_reason ?? [],
    effectiveDate: row.effective_date,
  }
}

export function mapP4P(row: P4PTableRow): P4PEntry {
  return {
    disciplineId: row.discipline_id,
    fighterId: row.fighter_id,
    position: row.position,
    previousPosition: row.previous_position,
    movement: row.movement,
    movementLabel: row.movement_label,
    score: dec(row.score),
    components: row.components ?? {},
  }
}

export function mapP4PToProfile(row: P4PTableRow): FighterProfile {
  return {
    id: row.fighter_id,
    fighterCode: row.fighter_code,
    primaryDisciplineId: row.discipline_id,
    slug: row.slug,
    firstName: '',
    lastName: '',
    displayName: row.display_name,
    nickname: row.nickname,
    photoUrl: row.photo_url,
    country: row.country,
    countryCode: row.country_code,
    dateOfBirth: null,
    heightCm: null,
    reachCm: null,
    stance: null,
    divisionId: null,
    team: null,
    debutDate: null,
    rating: dec(row.rating, 1500),
    rankingScore: dec(row.score),
    isActive: true,
    isChampion: row.is_champion,
    isInterimChampion: row.is_interim_champion,
    isFormerChampion: false,
    isDemo: false,
    bio: null,
    createdAt: row.computed_at,
    disciplineName: row.discipline_name,
    disciplineSlug: row.discipline_slug,
    disciplineCode: row.discipline_code,
    disciplineCount: 0,
    careerWins: int(row.wins),
    careerLosses: int(row.losses),
    careerFights: int(row.wins) + int(row.losses) + int(row.draws) + int(row.no_contests),
    divisionName: row.division_name,
    divisionSlug: row.division_slug,
    divisionGender: null,
    wins: int(row.wins),
    losses: int(row.losses),
    draws: int(row.draws),
    noContests: int(row.no_contests),
    koWins: 0,
    subWins: 0,
    decWins: 0,
    koLosses: 0,
    subLosses: 0,
    decLosses: 0,
    titleFights: 0,
    titleWins: 0,
    titleDefenses: 0,
    rankedWins: 0,
    winStreak: int(row.win_streak),
    lossStreak: 0,
    longestStreak: 0,
    finishRate: dec(row.finish_rate),
    recentForm: 0,
    strengthOfSchedule: 1500,
    totalFights: int(row.wins) + int(row.losses) + int(row.draws) + int(row.no_contests),
    lastFightDate: row.last_fight_date,
    firstFightDate: null,
    daysInactive: null,
    currentRank: row.division_rank,
    previousRank: null,
    rankMovement: null,
    rankMovementLabel: null,
    p4pRank: row.position,
    p4pMovement: row.movement,
  }
}

export function mapChampionship(row: ChampionshipRow): Championship {
  return {
    id: row.id,
    disciplineId: row.discipline_id,
    divisionId: row.division_id,
    fighterId: row.fighter_id,
    kind: row.kind,
    wonAt: row.won_at,
    wonFightId: row.won_fight_id,
    lostAt: row.lost_at,
    lostFightId: row.lost_fight_id,
    endReason: row.end_reason,
    defenses: row.defenses,
    isCurrent: row.is_current,
  }
}

export function mapAudit(row: AuditLogRow): AuditEntry {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    previousValue: row.previous_value,
    newValue: row.new_value,
    createdAt: row.created_at,
  }
}

export function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  }
}
