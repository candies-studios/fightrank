/**
 * Multi-discipline ranking (the unified Fighter ID model).
 *
 * A discipline is a self-contained competitive world. Beating a national-level
 * wrestler says nothing about your striking, so a wrestling result must never
 * move a Muay Thai rating. The cleanest way to guarantee that is not to make
 * the engine cleverer — it is to run the existing, tested single-sport engine
 * once per discipline over that discipline's own athletes, divisions and bouts.
 *
 * What ties the disciplines together is the athlete, not the rating: one row in
 * `fighters` (one Fighter ID), several rows in `fighter_disciplines`, and
 * therefore several independent records shown on one profile.
 */

import { runEngine, type EngineInput, type EngineResult } from './rankingEngine'
import { todayISO } from './activity'
import type { RankingConfig } from './config'
import type { EngineDivision, EngineFight } from './types'

export interface EngineDiscipline {
  id: string
  slug: string
  name: string
  shortCode: string
}

/** A division, tagged with the discipline that owns it. */
export interface ScopedDivision extends EngineDivision {
  disciplineId: string
}

/** A bout, tagged with the discipline it was contested under. */
export interface ScopedFight extends EngineFight {
  disciplineId: string
}

/**
 * One athlete's registration in one discipline — the `fighter_disciplines` row.
 * The same athlete appears once per discipline they compete in, with a
 * different division each time.
 */
export interface DisciplineRegistration {
  fighterId: string
  disciplineId: string
  divisionId: string | null
  isActive: boolean
  isPrimary: boolean
  displayName: string
}

export interface MultiEngineInput {
  disciplines: EngineDiscipline[]
  divisions: ScopedDivision[]
  registrations: DisciplineRegistration[]
  fights: ScopedFight[]
  config?: Partial<RankingConfig> | null
  asOf?: string
  /** Limit the run to these disciplines (§43). */
  disciplineScope?: string[] | null
  /** Limit history/standing output to these divisions (§43). */
  divisionScope?: string[] | null
}

export interface MultiEngineResult {
  /** One complete engine result per discipline, keyed by discipline id. */
  byDiscipline: Map<string, EngineResult>
  /** Disciplines that were actually run. */
  disciplines: EngineDiscipline[]
  asOf: string
}

/**
 * Narrow the whole-platform input to one discipline's world. Within a single
 * discipline an athlete is an ordinary fighter with one division — which is
 * exactly what the single-sport engine expects — so this is also what the
 * simulator runs against.
 */
export function scopeToDiscipline(
  input: MultiEngineInput,
  disciplineId: string,
  asOf?: string,
): EngineInput {
  return {
    fighters: input.registrations
      .filter((r) => r.disciplineId === disciplineId)
      .map((r) => ({
        id: r.fighterId,
        divisionId: r.divisionId,
        isActive: r.isActive,
        displayName: r.displayName,
      })),
    fights: input.fights.filter((f) => f.disciplineId === disciplineId),
    divisions: input.divisions.filter((d) => d.disciplineId === disciplineId),
    config: input.config,
    asOf: asOf ?? input.asOf ?? todayISO(),
    divisionScope: input.divisionScope,
  }
}

export function runMultiEngine(input: MultiEngineInput): MultiEngineResult {
  const asOf = input.asOf ?? todayISO()
  const scope =
    input.disciplineScope && input.disciplineScope.length
      ? new Set(input.disciplineScope)
      : null

  const disciplines = input.disciplines.filter((d) => !scope || scope.has(d.id))
  const byDiscipline = new Map<string, EngineResult>()

  for (const discipline of disciplines) {
    byDiscipline.set(discipline.id, runEngine(scopeToDiscipline(input, discipline.id, asOf)))
  }

  return { byDiscipline, disciplines, asOf }
}

/** Which disciplines own these divisions — used to scope a recalculation. */
export function disciplinesForDivisions(
  divisions: ScopedDivision[],
  divisionIds: string[],
): string[] {
  const wanted = new Set(divisionIds)
  return [
    ...new Set(
      divisions.filter((d) => wanted.has(d.id)).map((d) => d.disciplineId),
    ),
  ]
}
