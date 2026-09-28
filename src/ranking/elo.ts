/**
 * Elo core (§7).
 *
 * A standard logistic Elo expectation with MMA-specific modifiers layered on
 * top. Deliberately *not* zero-sum: method bonuses and opponent-quality
 * multipliers reward the winner without taking the same amount from the loser,
 * because a fighter who loses a close split decision to the champion should not
 * be punished as hard as one knocked out by an unranked opponent.
 */

import type { DecisionType, Method } from '@/types/domain'
import { bool, num, type RankingConfig } from './config'
import type { EngineFight } from './types'

/** Probability that A beats B given both ratings. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

/** Numeric score for an outcome, from A's point of view. */
export function actualScore(kind: 'win' | 'loss' | 'draw'): number {
  if (kind === 'win') return 1
  if (kind === 'draw') return 0.5
  return 0
}

/** K factor for a specific bout (§14 — title fights get a *moderate* uplift). */
export function kFactor(
  config: RankingConfig,
  fight: Pick<EngineFight, 'isTitleFight' | 'isInterimTitle' | 'scheduledRounds'>,
): number {
  let k = num(config, 'kFactor')
  if (fight.isTitleFight) k *= num(config, 'kFactorTitleMultiplier')
  if (fight.scheduledRounds >= 5) k *= num(config, 'kFactorFiveRoundMultiplier')
  return k
}

/** Additional rating awarded to the winner for *how* they won (§9). */
export function methodBonus(
  config: RankingConfig,
  method: Method | null,
  decisionType: DecisionType | null,
): number {
  switch (method) {
    case 'ko':
      return num(config, 'bonusKo')
    case 'tko':
      return num(config, 'bonusTko')
    case 'submission':
      return num(config, 'bonusSubmission')
    case 'pin':
      return num(config, 'bonusPin')
    case 'technical_fall':
      return num(config, 'bonusTechnicalFall')
    case 'decision':
    case 'technical_decision':
      if (decisionType === 'split') return num(config, 'bonusDecisionSplit')
      if (decisionType === 'majority') return num(config, 'bonusDecisionMajority')
      return num(config, 'bonusDecisionUnanimous')
    case 'dq':
    case 'doctor_stoppage':
    case 'retirement':
      return num(config, 'bonusOther')
    default:
      return 0
  }
}

export interface RatingDeltaInput {
  config: RankingConfig
  ratingA: number
  ratingB: number
  kind: 'win' | 'loss' | 'draw'
  /** Opponent-quality multiplier, applied to *gains* only (§10). */
  qualityMultiplier: number
  method: Method | null
  decisionType: DecisionType | null
  isTitleFight: boolean
  k: number
}

export interface RatingDelta {
  delta: number
  expected: number
  base: number
  bonus: number
}

/**
 * Rating change for one side of a bout.
 *
 *   win  → K·(1 − E)·quality + methodBonus + titleBonus
 *   loss → K·(0 − E)·lossSeverity
 *   draw → K·(0.5 − E)·drawWeight
 */
export function ratingDelta(input: RatingDeltaInput): RatingDelta {
  const { config, ratingA, ratingB, kind, qualityMultiplier, k } = input
  const expected = expectedScore(ratingA, ratingB)
  const base = k * (actualScore(kind) - expected)

  if (kind === 'win') {
    const bonus =
      methodBonus(config, input.method, input.decisionType) +
      (input.isTitleFight ? num(config, 'titleWinBonus') : 0)
    // A win always gains rating, even against a far weaker opponent.
    const scaled = Math.max(base, 0) * qualityMultiplier
    return { delta: scaled + bonus, expected, base: scaled, bonus }
  }

  if (kind === 'draw') {
    const scaled = base * num(config, 'drawWeight')
    return { delta: scaled, expected, base: scaled, bonus: 0 }
  }

  const scaled = base * num(config, 'lossSeverity')
  return { delta: scaled, expected, base: scaled, bonus: 0 }
}

/** Clamp a rating to the configured floor. */
export function clampRating(config: RankingConfig, rating: number): number {
  return Math.max(num(config, 'ratingFloor'), rating)
}

/** Should this outcome touch ratings at all? */
export function affectsRating(config: RankingConfig, outcome: string): boolean {
  if (outcome === 'no_contest') return bool(config, 'noContestAffectsRating')
  return true
}

/** A win is an upset when the winner was expected to lose. */
export function isUpset(expected: number): boolean {
  return expected < 0.5
}
