/**
 * Opponent strength (§8, §10).
 *
 * Two things happen here:
 *   1. a *multiplier* applied to the rating gained from a win, based on where
 *      the beaten opponent stood at the time of the bout;
 *   2. a *ranking-score component* summarising the quality of the opposition a
 *      fighter has faced recently.
 *
 * Every band is configurable — nothing is hard-coded (§9, §40).
 */

import { num, type RankingConfig } from './config'
import type { OpponentStanding, ResultRecord } from './types'

export const UNRANKED_STANDING: OpponentStanding = {
  rank: null,
  isChampion: false,
  isInterimChampion: false,
}

/** Multiplier for beating a fighter who stood here at the time. */
export function opponentQualityMultiplier(
  config: RankingConfig,
  standing: OpponentStanding,
): number {
  if (standing.isChampion) return num(config, 'oppMultiplierChampion')
  if (standing.isInterimChampion) return num(config, 'oppMultiplierInterim')
  const rank = standing.rank
  if (rank === null) return num(config, 'oppMultiplierUnranked')
  if (rank <= 1) return num(config, 'oppMultiplierRank1')
  if (rank <= 5) return num(config, 'oppMultiplierRank2to5')
  if (rank <= 10) return num(config, 'oppMultiplierRank6to10')
  if (rank <= 15) return num(config, 'oppMultiplierRank11to15')
  return num(config, 'oppMultiplierUnranked')
}

/** Human-readable band, used in ranking explanations and the UI. */
export function standingLabel(standing: OpponentStanding): string {
  if (standing.isChampion) return 'champion'
  if (standing.isInterimChampion) return 'interim champion'
  if (standing.rank === null) return 'unranked'
  return `#${standing.rank}`
}

export function standingTier(standing: OpponentStanding): string {
  if (standing.isChampion) return 'Champion'
  if (standing.isInterimChampion) return 'Interim champion'
  if (standing.rank === null) return 'Unranked'
  if (standing.rank <= 1) return '#1 contender'
  if (standing.rank <= 5) return 'Top 5'
  if (standing.rank <= 10) return 'Top 10'
  if (standing.rank <= 15) return 'Top 15'
  return 'Outside top 15'
}

export interface OpponentQualityComponent {
  points: number
  averageMultiplier: number
  sampleSize: number
  rankedOpponents: number
  bestWinLabel: string | null
}

/**
 * Ranking-score contribution from quality of opposition.
 * Averages the opponent-quality multiplier across the most recent bouts and
 * converts the distance from 1.0 into points.
 */
export function opponentQualityComponent(
  config: RankingConfig,
  results: ResultRecord[],
): OpponentQualityComponent {
  const window = Math.max(1, Math.round(num(config, 'opponentQualityWindow')))
  const scored = results.filter((r) => r.kind !== 'no_contest').slice(-window)

  if (scored.length === 0) {
    return {
      points: 0,
      averageMultiplier: 1,
      sampleSize: 0,
      rankedOpponents: 0,
      bestWinLabel: null,
    }
  }

  const total = scored.reduce(
    (sum, r) => sum + opponentQualityMultiplier(config, r.opponentStanding),
    0,
  )
  const average = total / scored.length
  const points = (average - 1) * num(config, 'opponentQualityWeight')

  const wins = scored.filter((r) => r.kind === 'win')
  const best = wins.reduce<ResultRecord | null>((acc, r) => {
    if (!acc) return r
    const a = opponentQualityMultiplier(config, acc.opponentStanding)
    const b = opponentQualityMultiplier(config, r.opponentStanding)
    return b > a ? r : acc
  }, null)

  return {
    points,
    averageMultiplier: average,
    sampleSize: scored.length,
    rankedOpponents: scored.filter(
      (r) =>
        r.opponentStanding.rank !== null ||
        r.opponentStanding.isChampion ||
        r.opponentStanding.isInterimChampion,
    ).length,
    bestWinLabel: best ? `${standingLabel(best.opponentStanding)} ${best.opponentName}` : null,
  }
}

/** Average rating of every opponent faced — "strength of schedule". */
export function strengthOfSchedule(config: RankingConfig, results: ResultRecord[]): number {
  const rated = results.filter((r) => r.kind !== 'no_contest')
  if (rated.length === 0) return num(config, 'baseRating')
  return rated.reduce((sum, r) => sum + r.opponentRatingBefore, 0) / rated.length
}
