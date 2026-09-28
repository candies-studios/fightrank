/**
 * Activity and rating decay (§13).
 *
 * Inactive fighters drift down; they are never automatically deleted from a
 * division unless an administrator explicitly enables that.
 */

import { bool, num, type RankingConfig } from './config'

const MS_PER_DAY = 86_400_000

/** Whole days from `from` to `to`, both ISO `YYYY-MM-DD` (or full timestamps). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / MS_PER_DAY)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export type ActivityTier = 'active' | 'current' | 'lapsed' | 'stale' | 'dormant' | 'unknown'

export interface ActivityComponent {
  points: number
  daysInactive: number | null
  tier: ActivityTier
  label: string
}

const TIER_LABELS: Record<ActivityTier, string> = {
  active: 'Active',
  current: 'Current',
  lapsed: 'Lapsed',
  stale: 'Inactive',
  dormant: 'Long-term inactive',
  unknown: 'No recorded bouts',
}

export function activityComponent(
  config: RankingConfig,
  lastFightDate: string | null,
  asOf: string,
): ActivityComponent {
  if (!lastFightDate) {
    return { points: 0, daysInactive: null, tier: 'unknown', label: TIER_LABELS.unknown }
  }

  const days = Math.max(0, daysBetween(lastFightDate, asOf))
  const t1 = num(config, 'decayTier1Days')
  const t2 = num(config, 'decayTier2Days')
  const t3 = num(config, 'decayTier3Days')

  if (days <= num(config, 'activityBonusDays')) {
    return {
      points: num(config, 'activityBonusPoints'),
      daysInactive: days,
      tier: 'active',
      label: TIER_LABELS.active,
    }
  }
  if (days <= t1) {
    return { points: 0, daysInactive: days, tier: 'current', label: TIER_LABELS.current }
  }
  if (days <= t2) {
    return {
      points: -num(config, 'decayTier2Points'),
      daysInactive: days,
      tier: 'lapsed',
      label: TIER_LABELS.lapsed,
    }
  }
  if (days <= t3) {
    return {
      points: -num(config, 'decayTier3Points'),
      daysInactive: days,
      tier: 'stale',
      label: TIER_LABELS.stale,
    }
  }
  return {
    points: -num(config, 'decayTier4Points'),
    daysInactive: days,
    tier: 'dormant',
    label: TIER_LABELS.dormant,
  }
}

/**
 * Should this fighter be dropped from the ranking table for inactivity?
 * Defaults to `false` for everyone — §13 requires an explicit admin opt-in.
 */
export function shouldRemoveForInactivity(
  config: RankingConfig,
  lastFightDate: string | null,
  asOf: string,
): boolean {
  if (!bool(config, 'autoRemoveInactive')) return false
  if (!lastFightDate) return false
  return daysBetween(lastFightDate, asOf) > num(config, 'inactiveCutoffDays')
}
