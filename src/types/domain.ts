/**
 * Domain model. These are the shapes the ranking engine and UI speak in.
 * Database row shapes live in `types/db.ts`; mapping happens in the data layer.
 */

export type Gender = 'men' | 'women' | 'open'
export type Stance = 'orthodox' | 'southpaw' | 'switch'

export type Outcome = 'win' | 'draw' | 'majority_draw' | 'split_draw' | 'no_contest'

export type Method =
  | 'ko'
  | 'tko'
  | 'submission'
  | 'pin'
  | 'technical_fall'
  | 'decision'
  | 'technical_decision'
  | 'dq'
  | 'doctor_stoppage'
  | 'retirement'
  | 'no_contest'
  | 'draw'

export type DecisionType = 'unanimous' | 'split' | 'majority'

export type FightStatus = 'scheduled' | 'completed' | 'cancelled'
export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'
export type FightType = 'standard' | 'catchweight' | 'tournament' | 'exhibition'
export type MovementLabel = 'up' | 'down' | 'none' | 'new' | 'out'
export type UserRole = 'admin' | 'editor' | 'viewer'
export type ChampionshipKind = 'undisputed' | 'interim'

export const METHOD_LABELS: Record<Method, string> = {
  ko: 'KO',
  tko: 'TKO',
  submission: 'Submission',
  pin: 'Pin',
  technical_fall: 'Technical Fall',
  decision: 'Decision',
  technical_decision: 'Technical Decision',
  dq: 'Disqualification',
  doctor_stoppage: 'Doctor Stoppage',
  retirement: 'Retirement',
  no_contest: 'No Contest',
  draw: 'Draw',
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  win: 'Win',
  draw: 'Draw',
  majority_draw: 'Majority Draw',
  split_draw: 'Split Draw',
  no_contest: 'No Contest',
}

export const DECISION_LABELS: Record<DecisionType, string> = {
  unanimous: 'Unanimous',
  split: 'Split',
  majority: 'Majority',
}

/** Methods that count as a finish (used for dominance / finish bonus). */
export const FINISH_METHODS: ReadonlySet<Method> = new Set<Method>([
  'ko',
  'tko',
  'submission',
  'pin',
  'technical_fall',
  'doctor_stoppage',
  'retirement',
])

export interface Discipline {
  id: string
  slug: string
  name: string
  shortCode: string
  tagline: string | null
  description: string | null
  ruleset: string | null
  accent: string | null
  sortOrder: number
  isActive: boolean
}

export interface Division {
  id: string
  disciplineId: string
  slug: string
  name: string
  gender: Gender
  weightLbs: number | null
  weightKg: number | null
  shortCode: string | null
  sortOrder: number
  isP4P: boolean
  isActive: boolean
  description: string | null
}

export interface FighterStats {
  wins: number
  losses: number
  draws: number
  noContests: number
  koWins: number
  subWins: number
  decWins: number
  koLosses: number
  subLosses: number
  decLosses: number
  titleFights: number
  titleWins: number
  titleDefenses: number
  rankedWins: number
  winStreak: number
  lossStreak: number
  longestStreak: number
  finishRate: number
  recentForm: number
  strengthOfSchedule: number
  totalFights: number
  lastFightDate: string | null
  firstFightDate: string | null
  daysInactive: number | null
}

export interface Fighter {
  id: string
  /** Public-facing Fighter ID, e.g. FR-00123. One per athlete, for life. */
  fighterCode: string
  /** The discipline whose record the denormalised columns below describe. */
  primaryDisciplineId: string | null
  slug: string
  firstName: string
  lastName: string
  displayName: string
  nickname: string | null
  photoUrl: string | null
  country: string | null
  countryCode: string | null
  dateOfBirth: string | null
  heightCm: number | null
  reachCm: number | null
  stance: Stance | null
  divisionId: string | null
  team: string | null
  debutDate: string | null
  rating: number
  rankingScore: number
  isActive: boolean
  isChampion: boolean
  isInterimChampion: boolean
  isFormerChampion: boolean
  isDemo: boolean
  bio: string | null
  createdAt: string
}

/** Fighter joined with derived stats + current standings (the `fighter_profiles` view). */
export interface FighterProfile extends Fighter, FighterStats {
  disciplineName: string | null
  disciplineSlug: string | null
  disciplineCode: string | null
  /** How many disciplines this athlete competes in under one Fighter ID. */
  disciplineCount: number
  /** Totals across every discipline. */
  careerWins: number
  careerLosses: number
  careerFights: number
  divisionName: string | null
  divisionSlug: string | null
  divisionGender: Gender | null
  currentRank: number | null
  previousRank: number | null
  rankMovement: number | null
  rankMovementLabel: MovementLabel | null
  p4pRank: number | null
  p4pMovement: number | null
}

/**
 * One athlete's competitive record in one discipline. An athlete with a
 * unified Fighter ID has several of these, and none of them affect the others.
 */
export interface DisciplineRecord extends FighterStats {
  id: string
  fighterId: string
  disciplineId: string
  disciplineName: string
  disciplineSlug: string
  disciplineCode: string
  disciplineSortOrder: number
  divisionId: string | null
  divisionName: string | null
  divisionSlug: string | null
  isPrimary: boolean
  isActive: boolean
  debutDate: string | null
  rating: number
  rankingScore: number
  isChampion: boolean
  isInterimChampion: boolean
  isFormerChampion: boolean
  currentRank: number | null
  previousRank: number | null
  rankMovement: number | null
  rankMovementLabel: MovementLabel | null
  p4pRank: number | null
}

/** A request for a Fighter ID. Becomes an athlete only once approved. */
export interface FighterApplication {
  id: string
  reference: string
  firstName: string
  lastName: string
  displayName: string
  email: string
  dateOfBirth: string | null
  country: string | null
  countryCode: string | null
  heightCm: number | null
  reachCm: number | null
  stance: Stance | null
  team: string | null
  disciplineId: string | null
  divisionId: string | null
  note: string | null
  status: 'pending' | 'approved' | 'declined'
  fighterId: string | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
}

export interface FightEvent {
  id: string
  slug: string
  name: string
  eventNumber: number | null
  eventDate: string
  venue: string | null
  city: string | null
  country: string | null
  countryCode: string | null
  posterUrl: string | null
  status: EventStatus
  isDemo: boolean
}

export interface Fight {
  id: string
  eventId: string
  disciplineId: string
  divisionId: string
  fighterAId: string
  fighterBId: string
  boutOrder: number
  scheduledRounds: number
  status: FightStatus
  outcome: Outcome | null
  winnerId: string | null
  loserId: string | null
  method: Method | null
  decisionType: DecisionType | null
  endRound: number | null
  endTimeSeconds: number | null
  fightType: FightType
  isTitleFight: boolean
  isInterimTitle: boolean
  isMainEvent: boolean
  bonuses: string[]
  notes: string | null
}

/** A fight enriched with the names/labels needed to render it. */
export interface FightWithContext extends Fight {
  eventName: string
  eventSlug: string
  eventDate: string
  disciplineName: string
  disciplineSlug: string
  disciplineCode: string
  divisionName: string
  fighterA: FighterRef
  fighterB: FighterRef
}

export interface FighterRef {
  id: string
  slug: string
  displayName: string
  nickname: string | null
  photoUrl: string | null
  countryCode: string | null
}

export interface RankingEntry {
  disciplineId: string
  divisionId: string
  fighterId: string
  position: number
  previousPosition: number | null
  movement: number
  movementLabel: MovementLabel
  isChampion: boolean
  isInterimChampion: boolean
  rating: number
  score: number
}

export interface RankingRow extends RankingEntry {
  fighter: FighterProfile
  /** Component breakdown from `ranking_breakdowns`, when it has been computed. */
  breakdown: ScoreBreakdown | null
}

export interface ScoreBreakdown {
  fighterId: string
  divisionId: string
  baseRating: number
  opponentQuality: number
  recentForm: number
  winStreak: number
  finishBonus: number
  activity: number
  titleBonus: number
  finalScore: number
  details: Record<string, number | string | boolean | string[]>
}

export interface RankingHistoryEntry {
  id: string
  fighterId: string
  disciplineId: string
  divisionId: string
  eventId: string | null
  fightId: string | null
  previousRank: number | null
  newRank: number | null
  previousRating: number | null
  newRating: number | null
  movement: number
  movementLabel: MovementLabel
  movementReason: string[]
  effectiveDate: string
}

export interface P4PEntry {
  disciplineId: string
  fighterId: string
  position: number
  previousPosition: number | null
  movement: number
  movementLabel: MovementLabel
  score: number
  components: Record<string, number>
}

export interface P4PRow extends P4PEntry {
  fighter: FighterProfile
}

export interface Championship {
  id: string
  disciplineId: string
  divisionId: string
  fighterId: string
  kind: ChampionshipKind
  wonAt: string
  wonFightId: string | null
  lostAt: string | null
  lostFightId: string | null
  endReason: string | null
  defenses: number
  isCurrent: boolean
}

export interface AuditEntry {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  entity: string
  entityId: string | null
  entityLabel: string | null
  previousValue: unknown
  newValue: unknown
  createdAt: string
}

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  role: UserRole
  createdAt: string
}

export interface Mover {
  fighter: FighterProfile
  disciplineId: string
  disciplineName: string
  disciplineSlug: string
  divisionId: string
  divisionName: string
  previousRank: number | null
  newRank: number | null
  movement: number
  movementLabel: MovementLabel
  reasons: string[]
  effectiveDate: string
}
