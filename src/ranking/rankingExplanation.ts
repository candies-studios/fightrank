/**
 * Ranking explanations (§18).
 *
 * Every line is derived deterministically from the engine's own ledger — no
 * language model, no hand-written copy per fighter. Given the same data the
 * same sentences come out, every time.
 */

import { METHOD_LABELS, type ScoreBreakdown } from '@/types/domain'
import { num, type RankingConfig } from './config'
import { activityComponent } from './activity'
import { standingLabel } from './opponentStrength'
import { ordinal } from './streak'
import type { FighterState, ResultRecord } from './types'

function methodPhrase(r: ResultRecord): string {
  if (!r.method) return 'Won the bout'
  const label = METHOD_LABELS[r.method]
  if (r.method === 'decision' || r.method === 'technical_decision') {
    const d = r.decisionType ? `${r.decisionType} ` : ''
    return `Won by ${d}${label.toLowerCase()}`
  }
  const where =
    r.endRound !== null
      ? ` (R${r.endRound}${
          r.endTimeSeconds !== null
            ? `, ${Math.floor(r.endTimeSeconds / 60)}:${String(r.endTimeSeconds % 60).padStart(2, '0')}`
            : ''
        })`
      : ''
  return `Won by ${label}${where}`
}

function lossPhrase(r: ResultRecord): string {
  if (!r.method) return 'Lost the bout'
  const label = METHOD_LABELS[r.method]
  if (r.method === 'decision' || r.method === 'technical_decision') {
    const d = r.decisionType ? `${r.decisionType} ` : ''
    return `Lost by ${d}${label.toLowerCase()}`
  }
  return `Lost by ${label}`
}

export interface ExplanationContext {
  /** Streak *after* the bout. */
  winStreakAfter: number
  lossStreakAfter: number
  /** Streak the fighter carried *into* the bout. */
  winStreakBefore: number
  titleOutcome: 'won' | 'defended' | 'lost' | 'interim_won' | 'unified' | 'retained_draw' | null
  defenseCount: number
}

/** Reasons attached to a fighter who competed at this event. */
export function explainResult(
  result: ResultRecord,
  ctx: ExplanationContext,
): string[] {
  const reasons: string[] = []
  const opp = `${standingLabel(result.opponentStanding)} ${result.opponentName}`.trim()

  switch (result.kind) {
    case 'win': {
      reasons.push(
        result.opponentStanding.rank !== null ||
          result.opponentStanding.isChampion ||
          result.opponentStanding.isInterimChampion
          ? `Defeated ${opp}`
          : `Defeated unranked ${result.opponentName}`,
      )
      reasons.push(methodPhrase(result))
      if (result.isUpset) {
        reasons.push(
          `Upset win — rated ${Math.round((1 - result.expectedScore) * 100)}% underdog by rating`,
        )
      }
      if (ctx.winStreakAfter >= 2) {
        reasons.push(`Extended win streak to ${ctx.winStreakAfter}`)
      }
      break
    }
    case 'loss': {
      reasons.push(`Lost to ${opp}`)
      reasons.push(lossPhrase(result))
      if (ctx.winStreakBefore >= 2) {
        reasons.push(`Snapped a ${ctx.winStreakBefore}-fight win streak`)
      }
      if (ctx.lossStreakAfter >= 2) {
        reasons.push(`On a ${ctx.lossStreakAfter}-fight losing streak`)
      }
      break
    }
    case 'draw': {
      reasons.push(`Drew with ${opp}`)
      reasons.push('Draw — minimal rating adjustment')
      break
    }
    case 'no_contest': {
      reasons.push(`Bout with ${result.opponentName} ruled a no contest`)
      reasons.push('No contest — rating unchanged')
      break
    }
  }

  switch (ctx.titleOutcome) {
    case 'won':
      reasons.push('Captured the undisputed championship')
      break
    case 'interim_won':
      reasons.push('Captured the interim championship')
      break
    case 'unified':
      reasons.push('Unified the championship')
      break
    case 'defended':
      reasons.push(`Defended the championship (${ordinal(ctx.defenseCount)} defence)`)
      break
    case 'lost':
      reasons.push('Lost the championship')
      break
    case 'retained_draw':
      reasons.push('Retained the championship — draw')
      break
    default:
      break
  }

  const delta = Math.round(result.ratingDelta)
  reasons.push(`Rating ${delta >= 0 ? '+' : ''}${delta} → ${Math.round(result.ratingAfter)}`)
  return reasons
}

/** Reason for a fighter who moved without competing. */
export function explainPassiveMove(eventName: string, movement: number): string[] {
  if (movement > 0) {
    return [`Did not compete`, `Moved up ${movement} after results at ${eventName}`]
  }
  if (movement < 0) {
    return [`Did not compete`, `Moved down ${Math.abs(movement)} after results at ${eventName}`]
  }
  return ['No change']
}

/** Reason for a move caused only by the passage of time. */
export function explainDecayMove(
  config: RankingConfig,
  lastFightDate: string | null,
  asOf: string,
  movement: number,
): string[] {
  const activity = activityComponent(config, lastFightDate, asOf)
  const reasons: string[] = ['Did not compete']
  if (activity.daysInactive !== null) {
    reasons.push(`${activity.daysInactive} days since last bout (${activity.label.toLowerCase()})`)
  }
  if (activity.points < 0) {
    reasons.push(`Inactivity decay ${Math.round(activity.points)} points`)
  }
  if (movement !== 0) {
    reasons.push(`Position adjusted ${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)}`)
  }
  return reasons
}

/**
 * "Why this ranking?" — a plain-language reading of the current score
 * breakdown, shown on the fighter profile (§18, §42).
 */
export function explainBreakdown(
  breakdown: ScoreBreakdown,
  state: FighterState,
  config: RankingConfig,
  asOf: string,
): string[] {
  const lines: string[] = []
  const d = breakdown.details

  lines.push(
    `Career rating of ${Math.round(breakdown.baseRating)} built from ${state.results.filter((r) => r.kind !== 'no_contest').length} rated bouts.`,
  )

  if (typeof d.opponentQualityAverage === 'number' && breakdown.opponentQuality !== 0) {
    const verb = breakdown.opponentQuality > 0 ? 'above' : 'below'
    lines.push(
      `Opposition faced in the last ${d.opponentQualitySample} bouts scores ${d.opponentQualityAverage.toFixed(2)}× — ${verb} the neutral baseline (${breakdown.opponentQuality >= 0 ? '+' : ''}${Math.round(breakdown.opponentQuality)}).`,
    )
  }

  if (typeof d.formSequence === 'string' && d.formSequence) {
    lines.push(
      `Recent form ${d.formSequence} rated "${d.formLabel}" (${breakdown.recentForm >= 0 ? '+' : ''}${Math.round(breakdown.recentForm)}).`,
    )
  }

  if (breakdown.winStreak !== 0) {
    lines.push(
      `${d.streakLabel} (${breakdown.winStreak >= 0 ? '+' : ''}${Math.round(breakdown.winStreak)}, capped at ${num(config, 'streakBonusCap')}).`,
    )
  }

  if (breakdown.finishBonus > 0) {
    lines.push(
      `Finished ${d.finishes} of the last ${d.finishSample} wins (+${Math.round(breakdown.finishBonus)}).`,
    )
  }

  const activity = activityComponent(config, state.lastFightDate, asOf)
  if (activity.daysInactive !== null) {
    lines.push(
      breakdown.activity >= 0
        ? `Competed ${activity.daysInactive} days ago — no decay applied (+${Math.round(breakdown.activity)}).`
        : `${activity.daysInactive} days since last bout — decay applied (${Math.round(breakdown.activity)}).`,
    )
  }

  if (breakdown.titleBonus !== 0) {
    lines.push(`Championship status modifier (+${Math.round(breakdown.titleBonus)}).`)
  }

  lines.push(`Final ranking score ${Math.round(breakdown.finalScore)}.`)
  return lines
}
