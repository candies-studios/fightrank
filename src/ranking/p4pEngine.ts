/**
 * Pound-for-pound (§20).
 *
 * Deliberately NOT a merge of the divisional tables. P4P asks a different
 * question — "who is the best fighter regardless of weight?" — so it is scored
 * from its own weighted model over six normalised components, each in [0, 1],
 * with weights an administrator can tune independently of the divisional
 * engine.
 */

import { num, type RankingConfig } from './config'
import { daysBetween } from './activity'
import { finishComponent, recentForm } from './form'
import { opponentQualityComponent, opponentQualityMultiplier } from './opponentStrength'
import type { FighterState, P4PComputedEntry } from './types'

export interface P4PComponents extends Record<string, number> {
  rating: number
  opponentQuality: number
  recentForm: number
  dominance: number
  championship: number
  activity: number
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

export function p4pComponents(
  config: RankingConfig,
  state: FighterState,
  asOf: string,
): P4PComponents {
  const reference = num(config, 'p4pRatingReference')
  const span = Math.max(1, num(config, 'p4pRatingSpan'))

  // 1. Overall rating, normalised against the configured span.
  const rating = clamp01((state.rating - reference) / span)

  // 2. Quality of opposition, normalised between the unranked and champion bands.
  const lo = opponentQualityMultiplier(config, {
    rank: null,
    isChampion: false,
    isInterimChampion: false,
  })
  const hi = num(config, 'oppMultiplierChampion')
  const oq = opponentQualityComponent(config, state.results)
  const opponentQuality = hi > lo ? clamp01((oq.averageMultiplier - lo) / (hi - lo)) : 0

  // 3. Recent form.
  const form = recentForm(config, state.results, asOf)
  const recentFormScore = state.results.length === 0 ? 0 : clamp01(form.index)

  // 4. Dominance — how often the fighter finishes.
  const finish = finishComponent(config, state.results)
  const dominance = clamp01(finish.finishRate)

  // 5. Championship success.
  const championship = clamp01(
    (state.titleWins + state.titleDefenses * 0.75 + (state.isChampion ? 1 : 0)) / 4,
  )

  // 6. Activity — linear decay to zero at the tier-3 inactivity threshold.
  let activity = 0
  if (state.lastFightDate) {
    const days = daysBetween(state.lastFightDate, asOf)
    const cutoff = Math.max(1, num(config, 'decayTier3Days'))
    activity = clamp01(1 - days / cutoff)
  }

  return { rating, opponentQuality, recentForm: recentFormScore, dominance, championship, activity }
}

export function p4pScore(config: RankingConfig, components: P4PComponents): number {
  const weights: Array<[keyof P4PComponents, string]> = [
    ['rating', 'p4pWeightRating'],
    ['opponentQuality', 'p4pWeightOpponentQuality'],
    ['recentForm', 'p4pWeightRecentForm'],
    ['dominance', 'p4pWeightDominance'],
    ['championship', 'p4pWeightChampionship'],
    ['activity', 'p4pWeightActivity'],
  ]
  let total = 0
  let weightSum = 0
  for (const [component, key] of weights) {
    const w = num(config, key)
    total += components[component] * w
    weightSum += w
  }
  // Normalise so the score stays comparable when weights do not sum to 1.
  const normalised = weightSum > 0 ? total / weightSum : 0
  return normalised * 100
}

export function computeP4P(
  config: RankingConfig,
  states: Map<string, FighterState>,
  asOf: string,
): P4PComputedEntry[] {
  const minFights = num(config, 'p4pMinFights')
  const size = Math.max(1, Math.round(num(config, 'p4pSize')))

  const entries = [...states.values()]
    .filter((s) => {
      const rated = s.results.filter((r) => r.kind !== 'no_contest').length
      return rated >= minFights && s.isActive
    })
    .map((s) => {
      const components = p4pComponents(config, s, asOf)
      return {
        fighterId: s.id,
        score: p4pScore(config, components),
        components: components as Record<string, number>,
        state: s,
      }
    })

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.state.rating !== a.state.rating) return b.state.rating - a.state.rating
    if (b.state.wins !== a.state.wins) return b.state.wins - a.state.wins
    return a.fighterId.localeCompare(b.fighterId)
  })

  return entries.slice(0, size).map((entry, index) => ({
    fighterId: entry.fighterId,
    position: index + 1,
    score: entry.score,
    components: entry.components,
  }))
}

export const P4P_COMPONENT_LABELS: Record<string, string> = {
  rating: 'Overall rating',
  opponentQuality: 'Quality of opposition',
  recentForm: 'Recent form',
  dominance: 'Dominance',
  championship: 'Championship success',
  activity: 'Activity',
}
