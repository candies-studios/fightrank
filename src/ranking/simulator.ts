/**
 * Ranking simulator (§38).
 *
 * Runs the real engine twice — once over the existing bouts, once with a
 * hypothetical bout appended — and diffs the two worlds. No separate "estimate"
 * maths exists, so what the simulator shows is exactly what recording the
 * result would produce.
 */

import type { DecisionType, Method } from '@/types/domain'
import { runEngine, type EngineInput } from './rankingEngine'
import { todayISO } from './activity'
import type { EngineFight } from './types'

export interface SimulationRequest {
  base: EngineInput
  divisionId: string
  fighterAId: string
  fighterBId: string
  /** `null` produces a draw. */
  winnerId: string | null
  method: Method
  decisionType: DecisionType | null
  endRound: number | null
  endTimeSeconds: number | null
  isTitleFight: boolean
  isInterimTitle: boolean
  scheduledRounds: number
  /** Defaults to today. */
  date?: string
}

export interface SimulatedFighter {
  fighterId: string
  before: { rating: number; rank: number | null; score: number; isChampion: boolean }
  after: { rating: number; rank: number | null; score: number; isChampion: boolean }
  ratingChange: number
  rankChange: number
  scoreChange: number
  explanation: string[]
}

export interface SimulationResult {
  fighters: SimulatedFighter[]
  /** Everyone else in the division whose position shifted. */
  collateral: Array<{ fighterId: string; before: number | null; after: number | null; movement: number }>
  date: string
}

const SIMULATED_FIGHT_ID = '00000000-0000-4000-8000-000000000sim'

export function simulate(request: SimulationRequest): SimulationResult {
  const date = request.date ?? todayISO()
  const asOf = date > (request.base.asOf ?? todayISO()) ? date : (request.base.asOf ?? todayISO())

  const hypothetical: EngineFight = {
    id: SIMULATED_FIGHT_ID,
    eventId: '00000000-0000-4000-8000-00000000sime',
    eventName: 'Simulated bout',
    eventDate: date,
    divisionId: request.divisionId,
    fighterAId: request.fighterAId,
    fighterBId: request.fighterBId,
    boutOrder: 9999,
    scheduledRounds: request.scheduledRounds,
    outcome: request.winnerId ? 'win' : 'draw',
    winnerId: request.winnerId,
    method: request.winnerId ? request.method : 'draw',
    decisionType: request.decisionType,
    endRound: request.endRound,
    endTimeSeconds: request.endTimeSeconds,
    isTitleFight: request.isTitleFight,
    isInterimTitle: request.isInterimTitle,
  }

  const before = runEngine({ ...request.base, asOf })
  const after = runEngine({
    ...request.base,
    asOf,
    fights: [...request.base.fights, hypothetical],
  })

  const rankOf = (result: ReturnType<typeof runEngine>, fighterId: string): number | null => {
    const standing = result.standings.get(request.divisionId)
    if (!standing) return null
    if (standing.championId === fighterId) return 0
    const idx = standing.order.indexOf(fighterId)
    return idx >= 0 ? idx + 1 : null
  }

  const snapshot = (result: ReturnType<typeof runEngine>, fighterId: string) => {
    const state = result.states.get(fighterId)
    const breakdown = result.breakdowns.get(fighterId)
    return {
      rating: state?.rating ?? 0,
      rank: rankOf(result, fighterId),
      score: breakdown?.finalScore ?? 0,
      isChampion: state?.isChampion ?? false,
    }
  }

  const fighters: SimulatedFighter[] = [request.fighterAId, request.fighterBId].map((id) => {
    const b = snapshot(before, id)
    const a = snapshot(after, id)
    const explanation =
      after.history
        .filter((h) => h.fighterId === id && h.fightId === SIMULATED_FIGHT_ID)
        .flatMap((h) => h.movementReason) ?? []
    return {
      fighterId: id,
      before: b,
      after: a,
      ratingChange: a.rating - b.rating,
      rankChange: b.rank !== null && a.rank !== null ? b.rank - a.rank : 0,
      scoreChange: a.score - b.score,
      explanation,
    }
  })

  const participants = new Set([request.fighterAId, request.fighterBId])
  const divisionIds = new Set<string>([
    ...(before.standings.get(request.divisionId)?.order ?? []),
    ...(after.standings.get(request.divisionId)?.order ?? []),
  ])

  const collateral = [...divisionIds]
    .filter((id) => !participants.has(id))
    .map((id) => {
      const b = rankOf(before, id)
      const a = rankOf(after, id)
      return { fighterId: id, before: b, after: a, movement: b !== null && a !== null ? b - a : 0 }
    })
    .filter((row) => row.movement !== 0 || row.before === null || row.after === null)
    .sort((x, y) => Math.abs(y.movement) - Math.abs(x.movement))

  return { fighters, collateral, date }
}
