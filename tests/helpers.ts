import type { DecisionType, Method, Outcome } from '@/types/domain'
import type { EngineDivision, EngineFight, EngineFighter } from '@/ranking/types'

export const DIVISION = 'div-lightweight'
export const DIVISION_B = 'div-welterweight'

export const divisions: EngineDivision[] = [
  { id: DIVISION, name: 'Lightweight', isP4P: false },
  { id: DIVISION_B, name: 'Welterweight', isP4P: false },
]

export function fighter(
  id: string,
  overrides: Partial<EngineFighter> = {},
): EngineFighter {
  return {
    id,
    displayName: id,
    divisionId: DIVISION,
    isActive: true,
    ...overrides,
  }
}

/** Build a roster of `n` fighters named f1..fn. */
export function roster(n: number, divisionId = DIVISION): EngineFighter[] {
  return Array.from({ length: n }, (_, i) => fighter(`f${i + 1}`, { divisionId }))
}

let boutSeq = 0

export interface FightOptions {
  date?: string
  eventId?: string
  eventName?: string
  divisionId?: string
  outcome?: Outcome
  method?: Method
  decisionType?: DecisionType | null
  endRound?: number | null
  endTimeSeconds?: number | null
  isTitleFight?: boolean
  isInterimTitle?: boolean
  scheduledRounds?: number
  boutOrder?: number
}

/** `a` beats `b` unless an outcome override says otherwise. */
export function bout(a: string, b: string, opts: FightOptions = {}): EngineFight {
  boutSeq += 1
  const outcome = opts.outcome ?? 'win'
  const date = opts.date ?? '2024-01-01'
  return {
    id: `fight-${boutSeq}`,
    eventId: opts.eventId ?? `event-${date}`,
    eventName: opts.eventName ?? `FIGHTRANK ${date}`,
    eventDate: date,
    divisionId: opts.divisionId ?? DIVISION,
    fighterAId: a,
    fighterBId: b,
    boutOrder: opts.boutOrder ?? boutSeq,
    scheduledRounds: opts.scheduledRounds ?? 3,
    outcome,
    winnerId: outcome === 'win' ? a : null,
    method:
      opts.method ??
      (outcome === 'win'
        ? 'decision'
        : outcome === 'no_contest'
          ? 'no_contest'
          : 'draw'),
    decisionType:
      opts.decisionType !== undefined
        ? opts.decisionType
        : (opts.method ?? 'decision') === 'decision'
          ? 'unanimous'
          : null,
    endRound: opts.endRound ?? null,
    endTimeSeconds: opts.endTimeSeconds ?? null,
    isTitleFight: opts.isTitleFight ?? false,
    isInterimTitle: opts.isInterimTitle ?? false,
  }
}

/** Day offset helper: `days(-400)` → an ISO date 400 days before 2025-01-01. */
export function day(offsetDays: number, from = '2025-01-01'): string {
  const base = Date.parse(`${from}T00:00:00Z`)
  return new Date(base + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

export function rankOf(
  standings: Map<string, { championId: string | null; order: string[] }>,
  divisionId: string,
  fighterId: string,
): number | null {
  const s = standings.get(divisionId)
  if (!s) return null
  if (s.championId === fighterId) return 0
  const idx = s.order.indexOf(fighterId)
  return idx >= 0 ? idx + 1 : null
}
