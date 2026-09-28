/**
 * FIGHTRANK ranking engine (§7, §17, §34, §35).
 *
 * A single deterministic function of (fighters, fights, config, asOf).
 * It knows nothing about React, Supabase or HTTP — it takes plain data and
 * returns plain data, which is what makes it independently testable.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 * 1. Every fighter starts at `baseRating` (1500).
 * 2. Completed bouts are replayed in chronological order, grouped by event.
 *    Each bout adjusts both fighters' Elo rating using the opponent's rating,
 *    the opponent's *standing at that moment*, the method of victory and the
 *    championship status of the bout.
 * 3. After every event the affected divisions are re-ranked and the difference
 *    against the previous standing is written to the history ledger with a
 *    deterministic explanation.
 * 4. A final pass re-ranks every division as of `asOf`, which is where
 *    inactivity decay bites.
 *
 * The ranking SCORE is a two-layer model, and both layers are shown to users:
 *    Layer 1 — career rating: cumulative Elo (result + opponent + method).
 *    Layer 2 — current-standing modifiers computed from a recency window:
 *              opponent quality, recent form, streak, finish rate, activity,
 *              championship status.
 * Layer 1 is history; layer 2 is where a fighter is *right now*.
 */

import type { MovementLabel, ScoreBreakdown } from '@/types/domain'
import { FINISH_METHODS } from '@/types/domain'
import { bool, num, resolveConfig, type RankingConfig } from './config'
import { activityComponent, daysBetween, shouldRemoveForInactivity, todayISO } from './activity'
import { clampRating, expectedScore, isUpset, kFactor, ratingDelta } from './elo'
import { finishComponent, recentForm } from './form'
import {
  opponentQualityComponent,
  opponentQualityMultiplier,
  strengthOfSchedule,
  UNRANKED_STANDING,
} from './opponentStrength'
import { streakComponent } from './streak'
import { computeP4P } from './p4pEngine'
import {
  explainBreakdown,
  explainDecayMove,
  explainPassiveMove,
  explainResult,
  type ExplanationContext,
} from './rankingExplanation'
import type {
  DivisionStanding,
  EngineChampionshipReign,
  EngineDivision,
  EngineFight,
  EngineFighter,
  EngineP4PChange,
  EngineRankingChange,
  EngineResult,
  FighterState,
  OpponentStanding,
  ResultRecord,
} from './types'

export interface EngineInput {
  fighters: EngineFighter[]
  fights: EngineFight[]
  divisions: EngineDivision[]
  config?: Partial<RankingConfig> | null
  /** Date the final standings are computed for. Defaults to today. */
  asOf?: string
  /** Restrict history/standing output to these divisions (§43). */
  divisionScope?: string[] | null
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function createState(fighter: EngineFighter, config: RankingConfig): FighterState {
  return {
    id: fighter.id,
    displayName: fighter.displayName,
    divisionId: fighter.divisionId,
    isActive: fighter.isActive,
    rating: num(config, 'baseRating'),
    results: [],
    wins: 0,
    losses: 0,
    draws: 0,
    noContests: 0,
    koWins: 0,
    subWins: 0,
    decWins: 0,
    koLosses: 0,
    subLosses: 0,
    decLosses: 0,
    titleFights: 0,
    titleWins: 0,
    titleDefenses: 0,
    rankedWins: 0,
    winStreak: 0,
    lossStreak: 0,
    longestStreak: 0,
    lastFightDate: null,
    firstFightDate: null,
    isChampion: false,
    isInterimChampion: false,
    isFormerChampion: false,
    championDivisionId: null,
  }
}

export function ratedFightCount(state: FighterState): number {
  return state.results.filter((r) => r.kind !== 'no_contest').length
}

function standingOf(standing: DivisionStanding | undefined, fighterId: string): OpponentStanding {
  if (!standing) return UNRANKED_STANDING
  if (standing.championId === fighterId) {
    return { rank: null, isChampion: true, isInterimChampion: false }
  }
  if (standing.interimChampionId === fighterId) {
    const idx = standing.order.indexOf(fighterId)
    return { rank: idx >= 0 ? idx + 1 : null, isChampion: false, isInterimChampion: true }
  }
  const idx = standing.order.indexOf(fighterId)
  return {
    rank: idx >= 0 ? idx + 1 : null,
    isChampion: false,
    isInterimChampion: false,
  }
}

// ---------------------------------------------------------------------------
// Score breakdown (§42)
// ---------------------------------------------------------------------------

export function computeBreakdown(
  state: FighterState,
  config: RankingConfig,
  asOf: string,
  divisionId: string,
): ScoreBreakdown {
  const oq = opponentQualityComponent(config, state.results)
  const form = recentForm(config, state.results, asOf)
  const streak = streakComponent(config, state.winStreak, state.lossStreak)
  const finish = finishComponent(config, state.results)
  const activity = activityComponent(config, state.lastFightDate, asOf)
  const titleBonus = state.isChampion
    ? num(config, 'championBonus')
    : state.isInterimChampion
      ? num(config, 'interimChampionBonus')
      : 0

  const finalScore =
    state.rating +
    oq.points +
    form.points +
    streak.points +
    finish.points +
    activity.points +
    titleBonus

  return {
    fighterId: state.id,
    divisionId,
    baseRating: state.rating,
    opponentQuality: oq.points,
    recentForm: form.points,
    winStreak: streak.points,
    finishBonus: finish.points,
    activity: activity.points,
    titleBonus,
    finalScore,
    details: {
      opponentQualityAverage: oq.averageMultiplier,
      opponentQualitySample: oq.sampleSize,
      rankedOpponents: oq.rankedOpponents,
      bestWin: oq.bestWinLabel ?? '',
      formIndex: form.index,
      formLabel: form.label,
      formSequence: form.sequence,
      formWins: form.wins,
      formSample: form.sampleSize,
      streakLabel: streak.label,
      winStreak: state.winStreak,
      lossStreak: state.lossStreak,
      finishes: finish.finishes,
      finishSample: finish.sampleSize,
      finishRate: finish.finishRate,
      daysInactive: activity.daysInactive ?? -1,
      activityTier: activity.tier,
      strengthOfSchedule: strengthOfSchedule(config, state.results),
      ratedFights: ratedFightCount(state),
    },
  }
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

function compareForRanking(
  a: FighterState,
  b: FighterState,
  scores: Map<string, ScoreBreakdown>,
): number {
  const sa = scores.get(a.id)?.finalScore ?? 0
  const sb = scores.get(b.id)?.finalScore ?? 0
  if (sb !== sa) return sb - sa
  if (b.rating !== a.rating) return b.rating - a.rating
  if (b.wins !== a.wins) return b.wins - a.wins
  if (b.results.length !== a.results.length) return b.results.length - a.results.length
  const la = a.lastFightDate ?? ''
  const lb = b.lastFightDate ?? ''
  if (la !== lb) return lb.localeCompare(la)
  return a.id.localeCompare(b.id)
}

export function computeStanding(
  divisionId: string,
  states: Map<string, FighterState>,
  config: RankingConfig,
  asOf: string,
): DivisionStanding {
  const members = [...states.values()].filter((s) => s.divisionId === divisionId)
  const championId = members.find((s) => s.isChampion)?.id ?? null
  const interimChampionId = members.find((s) => s.isInterimChampion)?.id ?? null

  const scores = new Map<string, ScoreBreakdown>()
  const eligible: FighterState[] = []
  const minFights = num(config, 'minFightsToRank')

  for (const member of members) {
    scores.set(member.id, computeBreakdown(member, config, asOf, divisionId))
    if (member.id === championId) continue
    if (ratedFightCount(member) < minFights) continue
    if (shouldRemoveForInactivity(config, member.lastFightDate, asOf)) continue
    eligible.push(member)
  }

  eligible.sort((a, b) => compareForRanking(a, b, scores))

  // An interim champion is the mandatory next challenger.
  if (interimChampionId && bool(config, 'interimRanksAtTop')) {
    const idx = eligible.findIndex((s) => s.id === interimChampionId)
    if (idx > 0) {
      const [interim] = eligible.splice(idx, 1)
      eligible.unshift(interim)
    }
  }

  const size = Math.max(1, Math.round(num(config, 'rankedPositions')))
  return {
    divisionId,
    championId,
    interimChampionId,
    order: eligible.slice(0, size).map((s) => s.id),
    scores,
  }
}

function movementLabelFor(prev: number | null, next: number | null): MovementLabel {
  if (prev === null && next !== null) return 'new'
  if (next === null) return 'out'
  if (prev === null) return 'new'
  if (next < prev) return 'up'
  if (next > prev) return 'down'
  return 'none'
}

function positionIn(standing: DivisionStanding | undefined, fighterId: string): number | null {
  if (!standing) return null
  if (standing.championId === fighterId) return 0
  const idx = standing.order.indexOf(fighterId)
  return idx >= 0 ? idx + 1 : null
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export function runEngine(input: EngineInput): EngineResult {
  const config = resolveConfig(input.config)
  const asOf = input.asOf ?? todayISO()
  const scope = input.divisionScope && input.divisionScope.length ? new Set(input.divisionScope) : null

  const states = new Map<string, FighterState>()
  for (const fighter of input.fighters) states.set(fighter.id, createState(fighter, config))

  const divisionIds = input.divisions.filter((d) => !d.isP4P).map((d) => d.id)
  const standings = new Map<string, DivisionStanding>()
  const history: EngineRankingChange[] = []
  const p4pHistory: EngineP4PChange[] = []
  const reigns: EngineChampionshipReign[] = []
  const currentReign = new Map<string, EngineChampionshipReign>() // `${divisionId}:${kind}`

  // Only completed bouts with a recorded outcome feed the engine.
  const fights = input.fights
    .filter((f) => f.outcome !== null && f.outcome !== undefined)
    .slice()
    .sort((a, b) => {
      if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate)
      if (a.eventId !== b.eventId) return a.eventId.localeCompare(b.eventId)
      if (a.boutOrder !== b.boutOrder) return a.boutOrder - b.boutOrder
      return a.id.localeCompare(b.id)
    })

  // Group by event, preserving chronological order.
  const eventGroups: EngineFight[][] = []
  let currentKey = ''
  for (const fight of fights) {
    const key = `${fight.eventDate}::${fight.eventId}`
    if (key !== currentKey) {
      eventGroups.push([])
      currentKey = key
    }
    eventGroups[eventGroups.length - 1].push(fight)
  }

  let p4pPrevious = new Map<string, { position: number; score: number }>()

  for (const group of eventGroups) {
    const eventDate = group[0].eventDate
    const eventId = group[0].eventId
    const eventName = group[0].eventName
    const affected = new Set<string>()
    const reasonsByFighter = new Map<string, string[]>()
    const fightByFighter = new Map<string, string>()
    const ratingBefore = new Map<string, number>()

    for (const fight of group) {
      const a = states.get(fight.fighterAId)
      const b = states.get(fight.fighterBId)
      if (!a || !b) continue

      if (!ratingBefore.has(a.id)) ratingBefore.set(a.id, a.rating)
      if (!ratingBefore.has(b.id)) ratingBefore.set(b.id, b.rating)

      affected.add(fight.divisionId)
      if (a.divisionId) affected.add(a.divisionId)
      if (b.divisionId) affected.add(b.divisionId)

      const outcome = applyFight(fight, a, b, states, standings, config, currentReign, reigns)
      for (const [fighterId, reasons] of outcome.reasons) {
        reasonsByFighter.set(fighterId, reasons)
        fightByFighter.set(fighterId, fight.id)
      }
    }

    // §43 — re-rank only the divisions this event touched.
    for (const divisionId of affected) {
      if (!divisionIds.includes(divisionId)) continue
      const previous = standings.get(divisionId)
      const next = computeStanding(divisionId, states, config, eventDate)
      standings.set(divisionId, next)
      if (scope && !scope.has(divisionId)) continue
      history.push(
        ...diffStanding({
          divisionId,
          previous,
          next,
          states,
          eventId,
          eventName,
          effectiveDate: eventDate,
          reasonsByFighter,
          fightByFighter,
          ratingBefore,
        }),
      )
    }

    // Pound-for-pound is recomputed after every event.
    const p4pNow = computeP4P(config, states, eventDate)
    const p4pMap = new Map(p4pNow.map((e) => [e.fighterId, e]))
    for (const entry of p4pNow) {
      const prev = p4pPrevious.get(entry.fighterId) ?? null
      const movement = prev ? prev.position - entry.position : 0
      if (prev && movement === 0) continue
      p4pHistory.push({
        fighterId: entry.fighterId,
        eventId,
        previousPosition: prev?.position ?? null,
        newPosition: entry.position,
        previousScore: prev?.score ?? null,
        newScore: entry.score,
        movement,
        effectiveDate: eventDate,
      })
    }
    for (const [fighterId, prev] of p4pPrevious) {
      if (p4pMap.has(fighterId)) continue
      p4pHistory.push({
        fighterId,
        eventId,
        previousPosition: prev.position,
        newPosition: null,
        previousScore: prev.score,
        newScore: null,
        movement: 0,
        effectiveDate: eventDate,
      })
    }
    p4pPrevious = new Map(p4pNow.map((e) => [e.fighterId, { position: e.position, score: e.score }]))
  }

  // ---- Final pass: re-rank everything as of `asOf` (this is where decay bites)
  const breakdowns = new Map<string, ScoreBreakdown>()
  for (const divisionId of divisionIds) {
    const previous = standings.get(divisionId)
    const next = computeStanding(divisionId, states, config, asOf)
    standings.set(divisionId, next)
    for (const [fighterId, breakdown] of next.scores) {
      const state = states.get(fighterId)
      if (state) {
        breakdown.details.explanation = explainBreakdown(breakdown, state, config, asOf)
      }
      breakdowns.set(fighterId, breakdown)
    }
    if (scope && !scope.has(divisionId)) continue
    if (!previous) continue
    for (const change of diffStanding({
      divisionId,
      previous,
      next,
      states,
      eventId: null,
      eventName: 'ranking update',
      effectiveDate: asOf,
      reasonsByFighter: new Map(),
      fightByFighter: new Map(),
      ratingBefore: new Map(),
      decayPass: true,
      config,
    })) {
      if (change.movement !== 0 || change.movementLabel === 'out') history.push(change)
    }
  }

  // Fighters with no division still need a breakdown for search / comparison.
  for (const state of states.values()) {
    if (breakdowns.has(state.id)) continue
    breakdowns.set(state.id, computeBreakdown(state, config, asOf, state.divisionId ?? ''))
  }

  const p4p = computeP4P(config, states, asOf)

  return {
    states,
    standings,
    breakdowns,
    history,
    p4p,
    p4pHistory,
    championships: reigns,
    asOf,
  }
}

// ---------------------------------------------------------------------------
// Applying a single bout
// ---------------------------------------------------------------------------

interface ApplyOutcome {
  reasons: Map<string, string[]>
}

function applyFight(
  fight: EngineFight,
  a: FighterState,
  b: FighterState,
  _states: Map<string, FighterState>,
  standings: Map<string, DivisionStanding>,
  config: RankingConfig,
  currentReign: Map<string, EngineChampionshipReign>,
  reigns: EngineChampionshipReign[],
): ApplyOutcome {
  const divisionStanding = standings.get(fight.divisionId)
  const standingA = standingOf(divisionStanding, a.id)
  const standingB = standingOf(divisionStanding, b.id)

  const winStreakBeforeA = a.winStreak
  const winStreakBeforeB = b.winStreak
  const ratingBeforeA = a.rating
  const ratingBeforeB = b.rating

  const isNoContest = fight.outcome === 'no_contest'
  const isDraw =
    fight.outcome === 'draw' || fight.outcome === 'majority_draw' || fight.outcome === 'split_draw'

  const k = kFactor(config, fight)
  const qualityA = opponentQualityMultiplier(config, standingB)
  const qualityB = opponentQualityMultiplier(config, standingA)

  let kindA: ResultRecord['kind']
  let kindB: ResultRecord['kind']
  if (isNoContest) {
    kindA = 'no_contest'
    kindB = 'no_contest'
  } else if (isDraw) {
    kindA = 'draw'
    kindB = 'draw'
  } else if (fight.winnerId === a.id) {
    kindA = 'win'
    kindB = 'loss'
  } else {
    kindA = 'loss'
    kindB = 'win'
  }

  const ratingAffected = !isNoContest || bool(config, 'noContestAffectsRating')

  const deltaA = ratingAffected && kindA !== 'no_contest'
    ? ratingDelta({
        config,
        ratingA: ratingBeforeA,
        ratingB: ratingBeforeB,
        kind: kindA,
        qualityMultiplier: qualityA,
        method: fight.method,
        decisionType: fight.decisionType,
        isTitleFight: fight.isTitleFight && kindA === 'win',
        k,
      })
    : { delta: 0, expected: expectedScore(ratingBeforeA, ratingBeforeB), base: 0, bonus: 0 }

  const deltaB = ratingAffected && kindB !== 'no_contest'
    ? ratingDelta({
        config,
        ratingA: ratingBeforeB,
        ratingB: ratingBeforeA,
        kind: kindB,
        qualityMultiplier: qualityB,
        method: fight.method,
        decisionType: fight.decisionType,
        isTitleFight: fight.isTitleFight && kindB === 'win',
        k,
      })
    : { delta: 0, expected: expectedScore(ratingBeforeB, ratingBeforeA), base: 0, bonus: 0 }

  a.rating = clampRating(config, ratingBeforeA + deltaA.delta)
  b.rating = clampRating(config, ratingBeforeB + deltaB.delta)

  const isFinish = fight.method ? FINISH_METHODS.has(fight.method) : false

  const recordA: ResultRecord = {
    fightId: fight.id,
    eventId: fight.eventId,
    eventName: fight.eventName,
    date: fight.eventDate,
    divisionId: fight.divisionId,
    opponentId: b.id,
    opponentName: b.displayName,
    kind: kindA,
    method: fight.method,
    decisionType: fight.decisionType,
    endRound: fight.endRound,
    endTimeSeconds: fight.endTimeSeconds,
    isFinish: kindA === 'win' && isFinish,
    isTitleFight: fight.isTitleFight,
    isInterimTitle: fight.isInterimTitle,
    opponentStanding: standingB,
    opponentRatingBefore: ratingBeforeB,
    qualityMultiplier: qualityA,
    ratingBefore: ratingBeforeA,
    ratingAfter: a.rating,
    ratingDelta: a.rating - ratingBeforeA,
    expectedScore: deltaA.expected,
    isUpset: kindA === 'win' && isUpset(deltaA.expected),
  }

  const recordB: ResultRecord = {
    ...recordA,
    opponentId: a.id,
    opponentName: a.displayName,
    kind: kindB,
    isFinish: kindB === 'win' && isFinish,
    opponentStanding: standingA,
    opponentRatingBefore: ratingBeforeA,
    qualityMultiplier: qualityB,
    ratingBefore: ratingBeforeB,
    ratingAfter: b.rating,
    ratingDelta: b.rating - ratingBeforeB,
    expectedScore: deltaB.expected,
    isUpset: kindB === 'win' && isUpset(deltaB.expected),
  }

  applyRecordToState(a, recordA, fight, config)
  applyRecordToState(b, recordB, fight, config)

  const titles = applyChampionship(fight, a, b, kindA, currentReign, reigns)

  const ctxA: ExplanationContext = {
    winStreakAfter: a.winStreak,
    lossStreakAfter: a.lossStreak,
    winStreakBefore: winStreakBeforeA,
    titleOutcome: titles.a,
    defenseCount: a.titleDefenses,
  }
  const ctxB: ExplanationContext = {
    winStreakAfter: b.winStreak,
    lossStreakAfter: b.lossStreak,
    winStreakBefore: winStreakBeforeB,
    titleOutcome: titles.b,
    defenseCount: b.titleDefenses,
  }

  return {
    reasons: new Map([
      [a.id, explainResult(recordA, ctxA)],
      [b.id, explainResult(recordB, ctxB)],
    ]),
  }
}

function applyRecordToState(
  state: FighterState,
  record: ResultRecord,
  fight: EngineFight,
  config: RankingConfig,
): void {
  state.results.push(record)
  state.lastFightDate = record.date
  if (!state.firstFightDate) state.firstFightDate = record.date
  if (fight.isTitleFight) state.titleFights += 1

  const opponentIsRanked =
    record.opponentStanding.rank !== null ||
    record.opponentStanding.isChampion ||
    record.opponentStanding.isInterimChampion

  switch (record.kind) {
    case 'win': {
      state.wins += 1
      state.winStreak += 1
      state.lossStreak = 0
      state.longestStreak = Math.max(state.longestStreak, state.winStreak)
      if (opponentIsRanked) state.rankedWins += 1
      if (fight.method === 'ko' || fight.method === 'tko') state.koWins += 1
      else if (fight.method === 'submission') state.subWins += 1
      else if (fight.method === 'decision' || fight.method === 'technical_decision')
        state.decWins += 1
      break
    }
    case 'loss': {
      state.losses += 1
      state.lossStreak += 1
      state.winStreak = 0
      if (fight.method === 'ko' || fight.method === 'tko') state.koLosses += 1
      else if (fight.method === 'submission') state.subLosses += 1
      else if (fight.method === 'decision' || fight.method === 'technical_decision')
        state.decLosses += 1
      break
    }
    case 'draw': {
      state.draws += 1
      state.winStreak = 0
      state.lossStreak = 0
      break
    }
    case 'no_contest': {
      state.noContests += 1
      // A no contest breaks nothing — streaks are preserved (§7).
      break
    }
  }

  void config
}

type TitleOutcome = ExplanationContext['titleOutcome']

function applyChampionship(
  fight: EngineFight,
  a: FighterState,
  b: FighterState,
  kindA: ResultRecord['kind'],
  currentReign: Map<string, EngineChampionshipReign>,
  reigns: EngineChampionshipReign[],
): { a: TitleOutcome; b: TitleOutcome } {
  if (!fight.isTitleFight) return { a: null, b: null }

  const division = fight.divisionId
  const kind: 'undisputed' | 'interim' = fight.isInterimTitle ? 'interim' : 'undisputed'
  const key = `${division}:${kind}`

  // A draw in a championship bout: the champion keeps the belt.
  if (kindA === 'draw' || kindA === 'no_contest') {
    const champ = [a, b].find((f) =>
      kind === 'interim' ? f.isInterimChampion : f.isChampion,
    )
    if (!champ) return { a: null, b: null }
    return champ.id === a.id ? { a: 'retained_draw', b: null } : { a: null, b: 'retained_draw' }
  }

  const winner = kindA === 'win' ? a : b
  const loser = kindA === 'win' ? b : a
  const date = fight.eventDate

  const closeReign = (reignKey: string, reason: string): void => {
    const reign = currentReign.get(reignKey)
    if (!reign) return
    reign.isCurrent = false
    reign.lostAt = date
    reign.lostFightId = fight.id
    reign.endReason = reason
    currentReign.delete(reignKey)
  }

  const openReign = (
    reignKey: string,
    fighter: FighterState,
    reignKind: 'undisputed' | 'interim',
  ): void => {
    const reign: EngineChampionshipReign = {
      divisionId: division,
      fighterId: fighter.id,
      kind: reignKind,
      wonAt: date,
      wonFightId: fight.id,
      lostAt: null,
      lostFightId: null,
      endReason: null,
      defenses: 0,
      isCurrent: true,
    }
    reigns.push(reign)
    currentReign.set(reignKey, reign)
  }

  let winnerOutcome: TitleOutcome
  let loserOutcome: TitleOutcome = null

  if (kind === 'interim') {
    if (winner.isInterimChampion) {
      winner.titleDefenses += 1
      const reign = currentReign.get(key)
      if (reign) reign.defenses += 1
      winnerOutcome = 'defended'
    } else {
      if (loser.isInterimChampion) {
        loser.isInterimChampion = false
        loser.isFormerChampion = true
        loserOutcome = 'lost'
        closeReign(key, 'defeat')
      } else {
        closeReign(key, 'vacated')
      }
      winner.isInterimChampion = true
      winner.championDivisionId = division
      winner.titleWins += 1
      openReign(key, winner, 'interim')
      winnerOutcome = 'interim_won'
    }
  } else {
    const loserWasInterim = loser.isInterimChampion
    if (winner.isChampion) {
      winner.titleDefenses += 1
      const reign = currentReign.get(key)
      if (reign) reign.defenses += 1
      winnerOutcome = loserWasInterim ? 'unified' : 'defended'
      if (loserWasInterim) {
        loser.isInterimChampion = false
        loser.isFormerChampion = true
        loserOutcome = 'lost'
        closeReign(`${division}:interim`, 'unified')
      }
    } else {
      if (loser.isChampion) {
        loser.isChampion = false
        loser.isFormerChampion = true
        loserOutcome = 'lost'
        closeReign(key, 'defeat')
      } else {
        closeReign(key, 'vacated')
      }
      const winnerWasInterim = winner.isInterimChampion
      if (winnerWasInterim) {
        winner.isInterimChampion = false
        closeReign(`${division}:interim`, 'promoted')
      }
      if (loserWasInterim) {
        loser.isInterimChampion = false
        closeReign(`${division}:interim`, 'unified')
      }
      winner.isChampion = true
      winner.championDivisionId = division
      winner.titleWins += 1
      openReign(key, winner, 'undisputed')
      winnerOutcome = winnerWasInterim || loserWasInterim ? 'unified' : 'won'
    }
  }

  return kindA === 'win'
    ? { a: winnerOutcome, b: loserOutcome }
    : { a: loserOutcome, b: winnerOutcome }
}

// ---------------------------------------------------------------------------
// Diffing two standings into history rows (§17, §19)
// ---------------------------------------------------------------------------

interface DiffInput {
  divisionId: string
  previous: DivisionStanding | undefined
  next: DivisionStanding
  states: Map<string, FighterState>
  eventId: string | null
  eventName: string
  effectiveDate: string
  reasonsByFighter: Map<string, string[]>
  fightByFighter: Map<string, string>
  ratingBefore: Map<string, number>
  decayPass?: boolean
  config?: RankingConfig
}

function diffStanding(input: DiffInput): EngineRankingChange[] {
  const { previous, next, states } = input
  const changes: EngineRankingChange[] = []

  const ids = new Set<string>([
    ...(previous ? [...previous.order, ...(previous.championId ? [previous.championId] : [])] : []),
    ...next.order,
    ...(next.championId ? [next.championId] : []),
  ])

  for (const fighterId of ids) {
    const state = states.get(fighterId)
    if (!state) continue

    const previousRank = positionIn(previous, fighterId)
    const newRank = positionIn(next, fighterId)
    const competed = input.reasonsByFighter.has(fighterId)

    if (previousRank === newRank && !competed) continue

    const movement =
      previousRank !== null && newRank !== null ? previousRank - newRank : 0
    const movementLabel = movementLabelFor(previousRank, newRank)

    let reasons = input.reasonsByFighter.get(fighterId)
    if (!reasons) {
      reasons =
        input.decayPass && input.config
          ? explainDecayMove(input.config, state.lastFightDate, input.effectiveDate, movement)
          : explainPassiveMove(input.eventName, movement)
    }

    const before = input.ratingBefore.get(fighterId) ?? null
    changes.push({
      fighterId,
      divisionId: input.divisionId,
      eventId: input.eventId,
      fightId: input.fightByFighter.get(fighterId) ?? null,
      previousRank,
      newRank,
      previousRating: before,
      newRating: state.rating,
      movement,
      movementLabel,
      movementReason: reasons,
      effectiveDate: input.effectiveDate,
    })
  }

  return changes
}

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

export { daysBetween, todayISO }
export type { EngineResult }
