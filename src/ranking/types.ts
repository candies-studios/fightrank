import type {
  DecisionType,
  Method,
  MovementLabel,
  Outcome,
  ScoreBreakdown,
} from '@/types/domain'

/** Minimal fighter shape the engine needs. */
export interface EngineFighter {
  id: string
  divisionId: string | null
  isActive: boolean
  displayName: string
}

/** Minimal fight shape the engine needs. Only completed bouts are fed in. */
export interface EngineFight {
  id: string
  eventId: string
  eventName: string
  eventDate: string
  divisionId: string
  fighterAId: string
  fighterBId: string
  boutOrder: number
  scheduledRounds: number
  outcome: Outcome
  winnerId: string | null
  method: Method | null
  decisionType: DecisionType | null
  endRound: number | null
  endTimeSeconds: number | null
  isTitleFight: boolean
  isInterimTitle: boolean
}

export interface EngineDivision {
  id: string
  name: string
  isP4P: boolean
}

/** Where an opponent stood at the moment the bout took place. */
export interface OpponentStanding {
  rank: number | null
  isChampion: boolean
  isInterimChampion: boolean
}

export type ResultKind = 'win' | 'loss' | 'draw' | 'no_contest'

/** One line of a fighter's competitive ledger, produced by the engine. */
export interface ResultRecord {
  fightId: string
  eventId: string
  eventName: string
  date: string
  divisionId: string
  opponentId: string
  opponentName: string
  kind: ResultKind
  method: Method | null
  decisionType: DecisionType | null
  endRound: number | null
  endTimeSeconds: number | null
  isFinish: boolean
  isTitleFight: boolean
  isInterimTitle: boolean
  opponentStanding: OpponentStanding
  opponentRatingBefore: number
  qualityMultiplier: number
  ratingBefore: number
  ratingAfter: number
  ratingDelta: number
  expectedScore: number
  isUpset: boolean
}

/** Mutable per-fighter state carried through the chronological pass. */
export interface FighterState {
  id: string
  displayName: string
  divisionId: string | null
  isActive: boolean
  rating: number
  results: ResultRecord[]
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
  lastFightDate: string | null
  firstFightDate: string | null
  isChampion: boolean
  isInterimChampion: boolean
  isFormerChampion: boolean
  championDivisionId: string | null
}

export interface DivisionStanding {
  divisionId: string
  championId: string | null
  interimChampionId: string | null
  /** Ordered contender ids: index 0 is #1. */
  order: string[]
  scores: Map<string, ScoreBreakdown>
}

export interface EngineRankingChange {
  fighterId: string
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

export interface EngineP4PChange {
  fighterId: string
  eventId: string | null
  previousPosition: number | null
  newPosition: number | null
  previousScore: number | null
  newScore: number | null
  movement: number
  effectiveDate: string
}

export interface EngineChampionshipReign {
  divisionId: string
  fighterId: string
  kind: 'undisputed' | 'interim'
  wonAt: string
  wonFightId: string | null
  lostAt: string | null
  lostFightId: string | null
  endReason: string | null
  defenses: number
  isCurrent: boolean
}

export interface P4PComputedEntry {
  fighterId: string
  position: number
  score: number
  components: Record<string, number>
}

export interface EngineResult {
  /** Final fighter state keyed by id. */
  states: Map<string, FighterState>
  /** Final divisional standings keyed by division id. */
  standings: Map<string, DivisionStanding>
  /** Final score breakdowns keyed by fighter id. */
  breakdowns: Map<string, ScoreBreakdown>
  /** Complete, deterministic ranking-history ledger. */
  history: EngineRankingChange[]
  /** Final pound-for-pound table. */
  p4p: P4PComputedEntry[]
  p4pHistory: EngineP4PChange[]
  /** Title reigns derived from title-fight results. */
  championships: EngineChampionshipReign[]
  asOf: string
}
