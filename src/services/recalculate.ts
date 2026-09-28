/**
 * Recalculation service (§17, §22, §43).
 *
 * Loads the competitive facts, runs the ranking engine once per discipline, and
 * writes the derived tables back. Nothing here decides a ranking — it only
 * moves the engine's output into PostgreSQL.
 *
 * Scope: when a bout is recorded only the divisions it touched (and therefore
 * only their disciplines) are rewritten.
 */

import type { DataContext } from '@/data'
import type { FightDetailRow, FighterDisciplineRow } from '@/types/db'
import { runMultiEngine, type MultiEngineInput, type ScopedFight } from '@/ranking/multiDiscipline'
import { daysBetween, todayISO } from '@/ranking/activity'
import { careerFinishRate } from '@/ranking/form'
import { strengthOfSchedule } from '@/ranking/opponentStrength'
import { resolveConfig } from '@/ranking/config'
import type { EngineResult } from '@/ranking/rankingEngine'

const CHUNK = 400

function chunked<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function toEngineFight(row: FightDetailRow): ScopedFight {
  return {
    id: row.id,
    eventId: row.event_id,
    eventName: row.event_name,
    eventDate: row.event_date,
    disciplineId: row.discipline_id,
    divisionId: row.division_id,
    fighterAId: row.fighter_a_id,
    fighterBId: row.fighter_b_id,
    boutOrder: row.bout_order,
    scheduledRounds: row.scheduled_rounds,
    outcome: row.outcome ?? 'no_contest',
    winnerId: row.winner_id,
    method: row.method,
    decisionType: row.decision_type,
    endRound: row.end_round,
    endTimeSeconds: row.end_time_seconds,
    isTitleFight: row.is_title_fight,
    isInterimTitle: row.is_interim_title,
  }
}

/** Everything the engine needs, straight from the database. */
export async function loadEngineInput(context: DataContext): Promise<MultiEngineInput> {
  const { repository } = context
  const [disciplines, divisions, registrations, fights, config] = await Promise.all([
    repository.listDisciplines(true),
    repository.listDivisions(true),
    repository.loadRegistrations(),
    repository.loadAllFights(),
    repository.getConfig(),
  ])

  return {
    disciplines: disciplines.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      shortCode: d.shortCode,
    })),
    divisions: divisions.map((d) => ({
      id: d.id,
      name: d.name,
      isP4P: d.isP4P,
      disciplineId: d.disciplineId,
    })),
    registrations: registrations.map((r: FighterDisciplineRow) => ({
      fighterId: r.fighter_id,
      disciplineId: r.discipline_id,
      divisionId: r.division_id,
      isActive: r.is_active,
      isPrimary: r.is_primary,
      displayName: r.display_name,
    })),
    fights: fights.map(toEngineFight),
    config,
    asOf: todayISO(),
  }
}

export interface RecalculationSummary {
  disciplines: number
  divisions: number
  fighters: number
  rankingRows: number
  historyRows: number
  p4pRows: number
  durationMs: number
  asOf: string
}

export interface RecalculateOptions {
  /** Limit the rewrite to these divisions (§43). Omit to rebuild everything. */
  divisionIds?: string[] | null
  /** Limit the rewrite to these disciplines. */
  disciplineIds?: string[] | null
}

export async function recalculate(
  context: DataContext,
  options: RecalculateOptions = {},
): Promise<{ summary: RecalculationSummary; result: Map<string, EngineResult> }> {
  const started = Date.now()
  const input = await loadEngineInput(context)

  const divisionScope =
    options.divisionIds && options.divisionIds.length ? [...new Set(options.divisionIds)] : null

  // A division belongs to exactly one discipline, so scoping by division
  // implies the disciplines to re-run.
  const disciplineScope = options.disciplineIds?.length
    ? [...new Set(options.disciplineIds)]
    : divisionScope
      ? [
          ...new Set(
            input.divisions
              .filter((d) => divisionScope.includes(d.id))
              .map((d) => d.disciplineId),
          ),
        ]
      : null

  const result = runMultiEngine({ ...input, divisionScope, disciplineScope })
  const summary = await persist(context, result.byDiscipline, input, divisionScope, disciplineScope)

  return {
    summary: { ...summary, durationMs: Date.now() - started, asOf: result.asOf },
    result: result.byDiscipline,
  }
}

async function persist(
  context: DataContext,
  byDiscipline: Map<string, EngineResult>,
  input: MultiEngineInput,
  divisionScope: string[] | null,
  disciplineScope: string[] | null,
): Promise<Omit<RecalculationSummary, 'durationMs' | 'asOf'>> {
  const db = context.repository.raw
  const asOf = input.asOf ?? todayISO()
  const config = resolveConfig(input.config)

  const disciplineIds = disciplineScope ?? input.disciplines.map((d) => d.id)
  const divisionIds =
    divisionScope ??
    input.divisions.filter((d) => disciplineIds.includes(d.disciplineId)).map((d) => d.id)

  const primaryOf = new Map(
    input.registrations.filter((r) => r.isPrimary).map((r) => [r.fighterId, r.disciplineId]),
  )
  const fighterRowsById = new Map(
    (await context.repository.loadAllFighters()).map((row) => [row.id, row]),
  )

  const run = async () => {
    const registrationRows: Record<string, unknown>[] = []
    const statRows: Record<string, unknown>[] = []
    const rankingRows: Record<string, unknown>[] = []
    const breakdownRows: Record<string, unknown>[] = []
    const historyRows: Record<string, unknown>[] = []
    const reignRows: Record<string, unknown>[] = []
    const p4pRows: Record<string, unknown>[] = []
    const p4pHistoryRows: Record<string, unknown>[] = []
    const fighterUpdates: Record<string, unknown>[] = []
    const now = new Date().toISOString()

    for (const disciplineId of disciplineIds) {
      const result = byDiscipline.get(disciplineId)
      if (!result) continue
      const inScopeDivision = (id: string | null): boolean =>
        id !== null && divisionIds.includes(id)

      // ---- per-discipline competitive state --------------------------------
      for (const state of result.states.values()) {
        const breakdown = result.breakdowns.get(state.id)
        registrationRows.push({
          fighter_id: state.id,
          discipline_id: disciplineId,
          division_id: state.divisionId,
          is_primary: primaryOf.get(state.id) === disciplineId,
          is_active: state.isActive,
          rating: round(state.rating),
          ranking_score: round(breakdown?.finalScore ?? state.rating),
          is_champion: state.isChampion,
          is_interim_champion: state.isInterimChampion,
          is_former_champion: state.isFormerChampion,
          updated_at: now,
        })

        statRows.push({
          fighter_id: state.id,
          discipline_id: disciplineId,
          wins: state.wins,
          losses: state.losses,
          draws: state.draws,
          no_contests: state.noContests,
          ko_wins: state.koWins,
          sub_wins: state.subWins,
          dec_wins: state.decWins,
          ko_losses: state.koLosses,
          sub_losses: state.subLosses,
          dec_losses: state.decLosses,
          title_fights: state.titleFights,
          title_wins: state.titleWins,
          title_defenses: state.titleDefenses,
          ranked_wins: state.rankedWins,
          win_streak: state.winStreak,
          loss_streak: state.lossStreak,
          longest_streak: state.longestStreak,
          finish_rate: round(careerFinishRate(state.results), 4),
          recent_form: round(Number(result.breakdowns.get(state.id)?.details.formIndex ?? 0), 4),
          strength_of_schedule: round(strengthOfSchedule(config, state.results)),
          total_fights: state.results.length,
          last_fight_date: state.lastFightDate,
          first_fight_date: state.firstFightDate,
          days_inactive: state.lastFightDate ? daysBetween(state.lastFightDate, asOf) : null,
          updated_at: now,
        })

        // The denormalised columns on `fighters` mirror the primary discipline.
        if (primaryOf.get(state.id) === disciplineId) {
          const row = fighterRowsById.get(state.id)
          fighterUpdates.push({
            id: state.id,
            fighter_code: row?.fighter_code ?? state.id.slice(0, 8),
            slug: row?.slug ?? state.id,
            first_name: row?.first_name ?? state.displayName,
            last_name: row?.last_name ?? '',
            display_name: row?.display_name ?? state.displayName,
            primary_discipline_id: disciplineId,
            division_id: state.divisionId,
            rating: round(state.rating),
            ranking_score: round(breakdown?.finalScore ?? state.rating),
            is_champion: state.isChampion,
            is_interim_champion: state.isInterimChampion,
            is_former_champion: state.isFormerChampion,
          })
        }
      }

      // ---- standings --------------------------------------------------------
      for (const divisionId of divisionIds) {
        const standing = result.standings.get(divisionId)
        if (!standing) continue
        const previousByFighter = latestPreviousRanks(result, divisionId)

        const entries: Array<{ fighterId: string; position: number }> = []
        if (standing.championId) entries.push({ fighterId: standing.championId, position: 0 })
        standing.order.forEach((fighterId, index) =>
          entries.push({ fighterId, position: index + 1 }),
        )

        for (const entry of entries) {
          const state = result.states.get(entry.fighterId)
          const breakdown = standing.scores.get(entry.fighterId)
          const previous = previousByFighter.get(entry.fighterId) ?? null
          const movement = previous === null ? 0 : previous - entry.position
          rankingRows.push({
            discipline_id: disciplineId,
            division_id: divisionId,
            fighter_id: entry.fighterId,
            position: entry.position,
            previous_position: previous,
            movement,
            movement_label:
              previous === null ? 'new' : movement > 0 ? 'up' : movement < 0 ? 'down' : 'none',
            is_champion: entry.position === 0,
            is_interim_champion: standing.interimChampionId === entry.fighterId,
            rating: round(state?.rating ?? 1500),
            score: round(breakdown?.finalScore ?? state?.rating ?? 1500),
            computed_at: now,
          })
        }
      }

      for (const breakdown of result.breakdowns.values()) {
        if (!inScopeDivision(breakdown.divisionId)) continue
        breakdownRows.push({
          fighter_id: breakdown.fighterId,
          discipline_id: disciplineId,
          division_id: breakdown.divisionId,
          base_rating: round(breakdown.baseRating),
          opponent_quality: round(breakdown.opponentQuality),
          recent_form: round(breakdown.recentForm),
          win_streak: round(breakdown.winStreak),
          finish_bonus: round(breakdown.finishBonus),
          activity: round(breakdown.activity),
          title_bonus: round(breakdown.titleBonus),
          final_score: round(breakdown.finalScore),
          details: breakdown.details,
          computed_at: now,
        })
      }

      for (const h of result.history) {
        if (!inScopeDivision(h.divisionId)) continue
        historyRows.push({
          fighter_id: h.fighterId,
          discipline_id: disciplineId,
          division_id: h.divisionId,
          event_id: h.eventId,
          fight_id: h.fightId,
          previous_rank: h.previousRank,
          new_rank: h.newRank,
          previous_rating: h.previousRating === null ? null : round(h.previousRating),
          new_rating: h.newRating === null ? null : round(h.newRating),
          movement: h.movement,
          movement_label: h.movementLabel,
          movement_reason: h.movementReason,
          effective_date: h.effectiveDate,
        })
      }

      for (const r of result.championships) {
        if (!inScopeDivision(r.divisionId)) continue
        reignRows.push({
          discipline_id: disciplineId,
          division_id: r.divisionId,
          fighter_id: r.fighterId,
          kind: r.kind,
          won_at: r.wonAt,
          won_fight_id: r.wonFightId,
          lost_at: r.lostAt,
          lost_fight_id: r.lostFightId,
          end_reason: r.endReason,
          defenses: r.defenses,
          is_current: r.isCurrent,
        })
      }

      // ---- pound for pound, within this discipline --------------------------
      const p4pPrevious = latestP4PPositions(result)
      for (const entry of result.p4p) {
        const previous = p4pPrevious.get(entry.fighterId) ?? null
        const movement = previous === null ? 0 : previous - entry.position
        p4pRows.push({
          discipline_id: disciplineId,
          fighter_id: entry.fighterId,
          position: entry.position,
          previous_position: previous,
          movement,
          movement_label:
            previous === null ? 'new' : movement > 0 ? 'up' : movement < 0 ? 'down' : 'none',
          score: round(entry.score, 4),
          components: entry.components,
          computed_at: now,
        })
      }
      for (const h of result.p4pHistory) {
        p4pHistoryRows.push({
          discipline_id: disciplineId,
          fighter_id: h.fighterId,
          event_id: h.eventId,
          previous_position: h.previousPosition,
          new_position: h.newPosition,
          previous_score: h.previousScore === null ? null : round(h.previousScore, 4),
          new_score: h.newScore === null ? null : round(h.newScore, 4),
          movement: h.movement,
          effective_date: h.effectiveDate,
        })
      }
    }

    // ---- write ---------------------------------------------------------------
    for (const batch of chunked(fighterUpdates)) {
      await write(db.from('fighters').upsert(batch, { onConflict: 'id' }))
    }
    for (const batch of chunked(registrationRows)) {
      await write(
        db
          .from('fighter_disciplines')
          .upsert(batch, { onConflict: 'fighter_id,discipline_id' }),
      )
    }
    for (const batch of chunked(statRows)) {
      await write(
        db.from('fighter_stats').upsert(batch, { onConflict: 'fighter_id,discipline_id' }),
      )
    }

    await write(db.from('rankings').delete().in('division_id', divisionIds))
    for (const batch of chunked(rankingRows)) await write(db.from('rankings').insert(batch))

    await write(db.from('ranking_breakdowns').delete().in('division_id', divisionIds))
    for (const batch of chunked(breakdownRows)) {
      await write(db.from('ranking_breakdowns').insert(batch))
    }

    await write(db.from('ranking_history').delete().in('division_id', divisionIds))
    for (const batch of chunked(historyRows)) await write(db.from('ranking_history').insert(batch))

    await write(db.from('championships').delete().in('division_id', divisionIds))
    for (const batch of chunked(reignRows)) await write(db.from('championships').insert(batch))

    await write(db.from('p4p_rankings').delete().in('discipline_id', disciplineIds))
    for (const batch of chunked(p4pRows)) await write(db.from('p4p_rankings').insert(batch))

    await write(db.from('p4p_history').delete().in('discipline_id', disciplineIds))
    for (const batch of chunked(p4pHistoryRows)) {
      await write(db.from('p4p_history').insert(batch))
    }

    return {
      disciplines: disciplineIds.length,
      divisions: divisionIds.length,
      fighters: registrationRows.length,
      rankingRows: rankingRows.length,
      historyRows: historyRows.length,
      p4pRows: p4pRows.length,
    }
  }

  // A real SQL transaction where the backend allows one (§22).
  return context.transaction ? context.transaction(run) : run()
}

/** The position each fighter held before the most recent change, from history. */
function latestPreviousRanks(result: EngineResult, divisionId: string): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const entry of result.history) {
    if (entry.divisionId !== divisionId) continue
    map.set(entry.fighterId, entry.previousRank)
  }
  return map
}

function latestP4PPositions(result: EngineResult): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const entry of result.p4pHistory) {
    map.set(entry.fighterId, entry.previousPosition)
  }
  return map
}

function round(value: number, places = 3): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

async function write(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await query
  if (error) throw new Error(error.message)
}
