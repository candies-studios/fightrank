/**
 * Win / loss streaks (§12).
 *
 * Sustained winning is rewarded, but the bonus is hard-capped so that a long
 * run against weak opposition can never outweigh quality of opponent.
 */

import { num, type RankingConfig } from './config'

export interface StreakComponent {
  points: number
  winStreak: number
  lossStreak: number
  label: string
}

export function streakComponent(
  config: RankingConfig,
  winStreak: number,
  lossStreak: number,
): StreakComponent {
  const min = Math.max(2, Math.round(num(config, 'streakMinLength')))
  const perWin = num(config, 'streakBonusPerWin')
  const cap = num(config, 'streakBonusCap')

  if (winStreak >= min) {
    const raw = (winStreak - min + 1) * perWin
    return {
      points: Math.min(cap, raw),
      winStreak,
      lossStreak,
      label: `${winStreak}-fight win streak`,
    }
  }

  if (lossStreak >= 2) {
    const raw = lossStreak * num(config, 'lossStreakPenaltyPerLoss')
    return {
      points: -Math.min(num(config, 'lossStreakPenaltyCap'), raw),
      winStreak,
      lossStreak,
      label: `${lossStreak}-fight losing streak`,
    }
  }

  return {
    points: 0,
    winStreak,
    lossStreak,
    label: winStreak === 1 ? 'Coming off a win' : lossStreak === 1 ? 'Coming off a loss' : 'No streak',
  }
}

/** Ordinal helper used in ranking explanations ("3rd defence"). */
export function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
