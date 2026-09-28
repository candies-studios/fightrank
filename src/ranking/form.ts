/**
 * Recent form (§11).
 *
 * A rolling, recency-weighted view of the last N bouts. Form is a *modifier*,
 * never the ranking mechanism on its own: the maximum it can contribute is
 * `formWeight` points, against ratings that span hundreds.
 */

import { num, type RankingConfig } from './config'
import { daysBetween } from './activity'
import type { ResultRecord } from './types'

export interface FormComponent {
  points: number
  /** 0 → lost every bout in the window, 1 → won every bout. */
  index: number
  wins: number
  losses: number
  draws: number
  sampleSize: number
  label: string
  /** e.g. "W-W-L-W-W", most recent last. */
  sequence: string
}

const LABELS: Array<{ min: number; label: string }> = [
  { min: 1, label: 'Excellent' },
  { min: 0.8, label: 'Very good' },
  { min: 0.6, label: 'Good' },
  { min: 0.4, label: 'Average' },
  { min: 0.2, label: 'Poor' },
  { min: 0, label: 'Very poor' },
]

export function formLabel(index: number): string {
  return LABELS.find((l) => index >= l.min)?.label ?? 'Very poor'
}

export function recentForm(
  config: RankingConfig,
  results: ResultRecord[],
  asOf: string,
): FormComponent {
  const window = Math.max(1, Math.round(num(config, 'formWindow')))
  const halfLife = Math.max(1, num(config, 'formRecencyHalfLifeDays'))
  const scored = results.filter((r) => r.kind !== 'no_contest').slice(-window)

  if (scored.length === 0) {
    return {
      points: 0,
      index: 0.5,
      wins: 0,
      losses: 0,
      draws: 0,
      sampleSize: 0,
      label: 'No data',
      sequence: '',
    }
  }

  let weighted = 0
  let weightTotal = 0
  for (const r of scored) {
    const age = Math.max(0, daysBetween(r.date, asOf))
    const weight = 0.5 ** (age / halfLife)
    const value = r.kind === 'win' ? 1 : r.kind === 'draw' ? 0.5 : 0
    weighted += value * weight
    weightTotal += weight
  }

  const index = weightTotal > 0 ? weighted / weightTotal : 0.5
  // 100% wins → +formWeight, 0% → −formWeight.
  const points = (index * 2 - 1) * num(config, 'formWeight')

  return {
    points,
    index,
    wins: scored.filter((r) => r.kind === 'win').length,
    losses: scored.filter((r) => r.kind === 'loss').length,
    draws: scored.filter((r) => r.kind === 'draw').length,
    sampleSize: scored.length,
    label: formLabel(index),
    sequence: scored
      .map((r) => (r.kind === 'win' ? 'W' : r.kind === 'loss' ? 'L' : 'D'))
      .join('-'),
  }
}

export interface FinishComponent {
  points: number
  finishRate: number
  finishes: number
  sampleSize: number
}

/**
 * Finish quality — the share of recent *wins* that ended inside the distance.
 * Rewards dominance without ever penalising a decision win (§9).
 */
export function finishComponent(
  config: RankingConfig,
  results: ResultRecord[],
): FinishComponent {
  const window = Math.max(1, Math.round(num(config, 'finishWindow')))
  const wins = results.filter((r) => r.kind === 'win').slice(-window)
  if (wins.length === 0) {
    return { points: 0, finishRate: 0, finishes: 0, sampleSize: 0 }
  }
  const finishes = wins.filter((r) => r.isFinish).length
  const rate = finishes / wins.length
  return {
    points: rate * num(config, 'finishBonusWeight'),
    finishRate: rate,
    finishes,
    sampleSize: wins.length,
  }
}

/** Career finish rate across every win. */
export function careerFinishRate(results: ResultRecord[]): number {
  const wins = results.filter((r) => r.kind === 'win')
  if (wins.length === 0) return 0
  return wins.filter((r) => r.isFinish).length / wins.length
}
