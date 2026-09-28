import { describe, expect, it } from 'vitest'
import { runEngine } from '@/ranking/rankingEngine'
import { DEFAULT_CONFIG } from '@/ranking/config'
import { bout, day, DIVISION, DIVISION_B, divisions, fighter, rankOf } from './helpers'
import type { EngineFight, EngineFighter } from '@/ranking/types'

/**
 * Builds a division with a clean, deterministic 1–15 ladder:
 * f1 has the most wins over unranked opposition, f16 the fewest.
 */
function ladder(): { fighters: EngineFighter[]; fights: EngineFight[]; lastDate: string } {
  const contenders = Array.from({ length: 16 }, (_, i) =>
    fighter(`f${i + 1}`, { divisionId: DIVISION }),
  )
  const jobbers: EngineFighter[] = []
  const fights: EngineFight[] = []
  let jobberId = 0
  let lastDate = ''

  // 16 rounds. Contender i (0-indexed) competes in rounds i+1..16, giving them
  // 16 − i wins — and every contender's most recent bout falls on the same day,
  // so the ladder is ordered by merit rather than by activity decay.
  for (let round = 1; round <= 16; round += 1) {
    const date = day(-1200 + round * 2)
    lastDate = date
    for (let i = 0; i < contenders.length; i += 1) {
      if (round < i + 1) continue
      jobberId += 1
      const j = `j${jobberId}`
      jobbers.push(fighter(j, { divisionId: DIVISION_B }))
      fights.push(
        bout(contenders[i].id, j, {
          date,
          eventId: `ladder-round-${round}`,
          divisionId: DIVISION,
          boutOrder: i,
        }),
      )
    }
  }

  return { fighters: [...contenders, ...jobbers], fights, lastDate }
}

const LADDER_ASOF = day(-1000)

function runLadder(extra: EngineFight[] = [], asOf = LADDER_ASOF) {
  const base = ladder()
  return runEngine({
    fighters: base.fighters,
    fights: [...base.fights, ...extra],
    divisions,
    asOf,
  })
}

describe('ladder fixture', () => {
  it('produces a deterministic 15-deep contender list', () => {
    const result = runLadder()
    for (let i = 1; i <= 15; i += 1) {
      expect(rankOf(result.standings, DIVISION, `f${i}`)).toBe(i)
    }
    // 16 contenders, 15 positions — the weakest is unranked.
    expect(rankOf(result.standings, DIVISION, 'f16')).toBeNull()
  })

  it('never places a champion at #1 — there is no champion yet', () => {
    const result = runLadder()
    expect(result.standings.get(DIVISION)?.championId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// §36 — result types
// ---------------------------------------------------------------------------

describe('result types', () => {
  const fighters = [fighter('a'), fighter('b')]

  it('a win raises the winner and lowers the loser', () => {
    const result = runEngine({
      fighters,
      fights: [bout('a', 'b', { date: day(-10) })],
      divisions,
      asOf: day(0),
    })
    expect(result.states.get('a')!.rating).toBeGreaterThan(DEFAULT_CONFIG.baseRating as number)
    expect(result.states.get('b')!.rating).toBeLessThan(DEFAULT_CONFIG.baseRating as number)
    expect(result.states.get('a')!.wins).toBe(1)
    expect(result.states.get('b')!.losses).toBe(1)
  })

  it('a draw moves ratings only slightly and resets both streaks', () => {
    const result = runEngine({
      fighters,
      fights: [
        bout('a', 'b', { date: day(-20) }),
        bout('a', 'b', { date: day(-10), outcome: 'draw', method: 'draw' }),
      ],
      divisions,
      asOf: day(0),
    })
    const a = result.states.get('a')!
    expect(a.draws).toBe(1)
    expect(a.winStreak).toBe(0)
    const drawDelta = Math.abs(a.results[1].ratingDelta)
    const winDelta = Math.abs(a.results[0].ratingDelta)
    expect(drawDelta).toBeLessThan(winDelta)
  })

  it('a no contest leaves ratings untouched and preserves the streak', () => {
    const result = runEngine({
      fighters,
      fights: [
        bout('a', 'b', { date: day(-30) }),
        bout('a', 'b', { date: day(-20) }),
        bout('a', 'b', { date: day(-10), outcome: 'no_contest', method: 'no_contest' }),
      ],
      divisions,
      asOf: day(0),
    })
    const a = result.states.get('a')!
    expect(a.noContests).toBe(1)
    expect(a.winStreak).toBe(2)
    expect(a.results[2].ratingDelta).toBe(0)
  })

  it('a majority draw and a split draw are both treated as draws', () => {
    for (const outcome of ['majority_draw', 'split_draw'] as const) {
      const result = runEngine({
        fighters,
        fights: [bout('a', 'b', { date: day(-10), outcome, method: 'draw' })],
        divisions,
        asOf: day(0),
      })
      expect(result.states.get('a')!.draws).toBe(1)
    }
  })
})

// ---------------------------------------------------------------------------
// §36 — methods
// ---------------------------------------------------------------------------

describe('method of victory', () => {
  const fighters = [fighter('a'), fighter('b')]
  const ratingAfter = (method: 'ko' | 'submission' | 'decision', decisionType?: 'unanimous' | 'split' | 'majority') =>
    runEngine({
      fighters,
      fights: [
        bout('a', 'b', {
          date: day(-10),
          method,
          decisionType: decisionType ?? (method === 'decision' ? 'unanimous' : null),
          endRound: method === 'decision' ? null : 2,
          endTimeSeconds: method === 'decision' ? null : 130,
        }),
      ],
      divisions,
      asOf: day(0),
    }).states.get('a')!.rating

  it('rewards a knockout more than a decision', () => {
    expect(ratingAfter('ko')).toBeGreaterThan(ratingAfter('decision'))
  })

  it('treats a submission as equal to a knockout by default', () => {
    expect(ratingAfter('submission')).toBeCloseTo(ratingAfter('ko'), 6)
  })

  it('ranks decision bonuses unanimous > majority > split', () => {
    expect(ratingAfter('decision', 'unanimous')).toBeGreaterThan(ratingAfter('decision', 'majority'))
    expect(ratingAfter('decision', 'majority')).toBeGreaterThan(ratingAfter('decision', 'split'))
  })

  it('never makes a decision win worth less than no win at all', () => {
    expect(ratingAfter('decision', 'split')).toBeGreaterThan(DEFAULT_CONFIG.baseRating as number)
  })
})

// ---------------------------------------------------------------------------
// §36 — the named ranking scenarios
// ---------------------------------------------------------------------------

describe('ranking scenarios', () => {
  it('#15 beating #3 moves the underdog up and the favourite down', () => {
    const date = day(-999)
    const result = runLadder([
      bout('f15', 'f3', { date, eventId: 'upset', method: 'ko', endRound: 1, endTimeSeconds: 92 }),
    ], date)

    const newRank15 = rankOf(result.standings, DIVISION, 'f15')!
    const newRank3 = rankOf(result.standings, DIVISION, 'f3')!
    expect(newRank15).toBeLessThan(15)
    expect(newRank3).toBeGreaterThan(3)
  })

  it('#3 beating #1 is worth more than #3 beating #15', () => {
    const date = day(-999)
    const vsOne = runLadder([bout('f3', 'f1', { date, eventId: 'a' })], date)
    const vsFifteen = runLadder([bout('f3', 'f15', { date, eventId: 'b' })], date)
    expect(vsOne.states.get('f3')!.rating).toBeGreaterThan(vsFifteen.states.get('f3')!.rating)
  })

  it('beating a ranked opponent is worth more than beating an unranked one', () => {
    const date = day(-999)
    const vsRanked = runLadder([bout('f8', 'f15', { date, eventId: 'a' })], date)
    const vsUnranked = runLadder([bout('f8', 'f16', { date, eventId: 'b' })], date)
    const rankedGain = vsRanked.states.get('f8')!.rating
    const unrankedGain = vsUnranked.states.get('f8')!.rating
    expect(rankedGain).toBeGreaterThan(unrankedGain)
  })

  it('#1 losing to #10 costs the favourite its position', () => {
    const date = day(-999)
    const result = runLadder([bout('f10', 'f1', { date, eventId: 'upset2', method: 'submission', endRound: 3 })], date)
    expect(rankOf(result.standings, DIVISION, 'f1')!).toBeGreaterThan(1)
    expect(rankOf(result.standings, DIVISION, 'f10')!).toBeLessThan(10)
  })

  it('an unranked fighter beating a ranked one enters the rankings', () => {
    const date = day(-999)
    const result = runLadder([bout('f16', 'f2', { date, eventId: 'debutant', method: 'ko', endRound: 1 })], date)
    const rank = rankOf(result.standings, DIVISION, 'f16')
    expect(rank).not.toBeNull()
    expect(rank!).toBeLessThanOrEqual(15)
    const entered = result.history.find(
      (h) => h.fighterId === 'f16' && h.effectiveDate === date,
    )
    expect(entered?.movementLabel).toBe('new')
  })

  it('a brand-new fighter with no bouts is unranked', () => {
    const date = day(-999)
    const base = ladder()
    const result = runEngine({
      fighters: [...base.fighters, fighter('rookie', { divisionId: DIVISION })],
      fights: base.fights,
      divisions,
      asOf: date,
    })
    expect(rankOf(result.standings, DIVISION, 'rookie')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// §36 — championships
// ---------------------------------------------------------------------------

describe('championships', () => {
  const titleDate = day(-998)

  function crown() {
    // f1 beats f2 for the vacant title.
    return [
      bout('f1', 'f2', {
        date: day(-999),
        eventId: 'crowning',
        isTitleFight: true,
        scheduledRounds: 5,
        method: 'decision',
        decisionType: 'unanimous',
      }),
    ]
  }

  it('crowns a champion and removes them from the contender list', () => {
    const result = runLadder(crown(), day(-999))
    const standing = result.standings.get(DIVISION)!
    expect(standing.championId).toBe('f1')
    expect(standing.order).not.toContain('f1')
    // The champion does not occupy #1 (§16).
    expect(standing.order[0]).not.toBe('f1')
    expect(result.states.get('f1')!.isChampion).toBe(true)
  })

  it('records a successful defence', () => {
    const result = runLadder(
      [
        ...crown(),
        bout('f1', 'f3', {
          date: titleDate,
          eventId: 'defence',
          isTitleFight: true,
          scheduledRounds: 5,
          method: 'ko',
          endRound: 4,
        }),
      ],
      titleDate,
    )
    const champ = result.states.get('f1')!
    expect(champ.isChampion).toBe(true)
    expect(champ.titleDefenses).toBe(1)
    const reign = result.championships.find((r) => r.fighterId === 'f1' && r.kind === 'undisputed')!
    expect(reign.defenses).toBe(1)
    expect(reign.isCurrent).toBe(true)
  })

  it('transfers the belt when the champion loses to #5', () => {
    const result = runLadder(
      [
        ...crown(),
        bout('f5', 'f1', {
          date: titleDate,
          eventId: 'upsetTitle',
          isTitleFight: true,
          scheduledRounds: 5,
          method: 'submission',
          endRound: 2,
        }),
      ],
      titleDate,
    )
    expect(result.states.get('f5')!.isChampion).toBe(true)
    expect(result.states.get('f1')!.isChampion).toBe(false)
    expect(result.states.get('f1')!.isFormerChampion).toBe(true)
    expect(result.standings.get(DIVISION)!.championId).toBe('f5')
    // The deposed champion re-enters the contender list.
    expect(result.standings.get(DIVISION)!.order).toContain('f1')

    const oldReign = result.championships.find((r) => r.fighterId === 'f1')!
    expect(oldReign.isCurrent).toBe(false)
    expect(oldReign.endReason).toBe('defeat')
  })

  it('keeps the belt with the champion after a title-fight draw', () => {
    const result = runLadder(
      [
        ...crown(),
        bout('f1', 'f4', {
          date: titleDate,
          eventId: 'drawTitle',
          isTitleFight: true,
          scheduledRounds: 5,
          outcome: 'split_draw',
          method: 'draw',
        }),
      ],
      titleDate,
    )
    expect(result.states.get('f1')!.isChampion).toBe(true)
    expect(result.states.get('f4')!.isChampion).toBe(false)
  })

  it('supports an interim champion alongside the undisputed champion', () => {
    const result = runLadder(
      [
        ...crown(),
        bout('f4', 'f6', {
          date: titleDate,
          eventId: 'interim',
          isTitleFight: true,
          isInterimTitle: true,
          scheduledRounds: 5,
          method: 'decision',
          decisionType: 'unanimous',
        }),
      ],
      titleDate,
    )
    expect(result.states.get('f4')!.isInterimChampion).toBe(true)
    expect(result.states.get('f1')!.isChampion).toBe(true)
    const standing = result.standings.get(DIVISION)!
    expect(standing.interimChampionId).toBe('f4')
    // The interim champion is the mandatory next challenger.
    expect(standing.order[0]).toBe('f4')
  })

  it('unifies correctly when the interim champion beats the champion', () => {
    const result = runLadder(
      [
        ...crown(),
        bout('f4', 'f6', {
          date: titleDate,
          eventId: 'interim',
          isTitleFight: true,
          isInterimTitle: true,
          scheduledRounds: 5,
        }),
        bout('f4', 'f1', {
          date: day(-997),
          eventId: 'unification',
          isTitleFight: true,
          scheduledRounds: 5,
          method: 'ko',
          endRound: 5,
        }),
      ],
      day(-997),
    )
    const f4 = result.states.get('f4')!
    expect(f4.isChampion).toBe(true)
    expect(f4.isInterimChampion).toBe(false)
    expect(result.states.get('f1')!.isChampion).toBe(false)
    expect(result.standings.get(DIVISION)!.interimChampionId).toBeNull()
  })

  it('unifies correctly when the undisputed champion beats the interim champion', () => {
    const result = runLadder(
      [
        ...crown(),
        bout('f4', 'f6', {
          date: titleDate,
          eventId: 'interim',
          isTitleFight: true,
          isInterimTitle: true,
          scheduledRounds: 5,
        }),
        bout('f1', 'f4', {
          date: day(-997),
          eventId: 'unification2',
          isTitleFight: true,
          scheduledRounds: 5,
          method: 'decision',
          decisionType: 'unanimous',
        }),
      ],
      day(-997),
    )
    expect(result.states.get('f1')!.isChampion).toBe(true)
    expect(result.states.get('f4')!.isInterimChampion).toBe(false)
    expect(result.states.get('f4')!.isFormerChampion).toBe(true)
    expect(result.standings.get(DIVISION)!.interimChampionId).toBeNull()
  })

  it('never allows two champions in one division', () => {
    const result = runLadder(
      [
        ...crown(),
        bout('f5', 'f1', { date: titleDate, eventId: 't2', isTitleFight: true, scheduledRounds: 5 }),
        bout('f7', 'f5', { date: day(-997), eventId: 't3', isTitleFight: true, scheduledRounds: 5 }),
      ],
      day(-997),
    )
    const champions = [...result.states.values()].filter(
      (s) => s.isChampion && s.divisionId === DIVISION,
    )
    expect(champions).toHaveLength(1)
    expect(champions[0].id).toBe('f7')
  })
})

// ---------------------------------------------------------------------------
// §36 — modifiers
// ---------------------------------------------------------------------------

describe('modifiers', () => {
  it('rewards a win streak but caps the bonus', () => {
    const fighters = [fighter('a'), ...Array.from({ length: 10 }, (_, i) => fighter(`o${i}`, { divisionId: DIVISION_B }))]
    const make = (wins: number) =>
      runEngine({
        fighters,
        fights: Array.from({ length: wins }, (_, i) =>
          bout('a', `o${i}`, { date: day(-100 + i), eventId: `e${i}` }),
        ),
        divisions,
        asOf: day(0),
      }).breakdowns.get('a')!

    expect(make(1).winStreak).toBe(0)
    expect(make(2).winStreak).toBeGreaterThan(0)
    expect(make(4).winStreak).toBeGreaterThan(make(3).winStreak)
    expect(make(9).winStreak).toBe(DEFAULT_CONFIG.streakBonusCap)
    expect(make(10).winStreak).toBe(DEFAULT_CONFIG.streakBonusCap)
  })

  it('scores recent form on a five-fight window', () => {
    const opponents = Array.from({ length: 5 }, (_, i) => fighter(`o${i}`, { divisionId: DIVISION_B }))
    const build = (pattern: Array<'w' | 'l'>) =>
      runEngine({
        fighters: [fighter('a'), ...opponents],
        fights: pattern.map((p, i) =>
          p === 'w'
            ? bout('a', `o${i}`, { date: day(-50 + i), eventId: `e${i}` })
            : bout(`o${i}`, 'a', { date: day(-50 + i), eventId: `e${i}` }),
        ),
        divisions,
        asOf: day(0),
      }).breakdowns.get('a')!

    const perfect = build(['w', 'w', 'w', 'w', 'w'])
    const mixed = build(['w', 'w', 'w', 'l', 'l'])
    const terrible = build(['l', 'l', 'l', 'l', 'l'])

    expect(perfect.recentForm).toBeGreaterThan(mixed.recentForm)
    expect(mixed.recentForm).toBeGreaterThan(terrible.recentForm)
    expect(perfect.recentForm).toBeCloseTo(DEFAULT_CONFIG.formWeight as number, 4)
    expect(terrible.recentForm).toBeCloseTo(-(DEFAULT_CONFIG.formWeight as number), 4)
  })

  it('applies tiered inactivity decay', () => {
    const fighters = [fighter('a'), fighter('o', { divisionId: DIVISION_B })]
    const fights = [bout('a', 'o', { date: day(0) })]
    const decayAt = (offset: number) =>
      runEngine({ fighters, fights, divisions, asOf: day(offset) }).breakdowns.get('a')!.activity

    expect(decayAt(30)).toBeGreaterThan(0) // activity bonus
    expect(decayAt(170)).toBe(0)
    expect(decayAt(300)).toBe(-(DEFAULT_CONFIG.decayTier2Points as number))
    expect(decayAt(500)).toBe(-(DEFAULT_CONFIG.decayTier3Points as number))
    expect(decayAt(900)).toBe(-(DEFAULT_CONFIG.decayTier4Points as number))
  })

  it('does not remove inactive fighters from the rankings by default', () => {
    const result = runLadder([], day(2000))
    expect(rankOf(result.standings, DIVISION, 'f1')).toBe(1)
  })

  it('removes inactive fighters only when an administrator opts in', () => {
    const base = ladder()
    const result = runEngine({
      fighters: base.fighters,
      fights: base.fights,
      divisions,
      asOf: day(2000),
      config: { autoRemoveInactive: true, inactiveCutoffDays: 365 },
    })
    expect(result.standings.get(DIVISION)!.order).toHaveLength(0)
  })

  it('breaks the final score down into components that sum exactly', () => {
    const result = runLadder([], LADDER_ASOF)
    const b = result.breakdowns.get('f1')!
    const sum =
      b.baseRating +
      b.opponentQuality +
      b.recentForm +
      b.winStreak +
      b.finishBonus +
      b.activity +
      b.titleBonus
    expect(sum).toBeCloseTo(b.finalScore, 6)
  })
})

// ---------------------------------------------------------------------------
// §36 — history and movement
// ---------------------------------------------------------------------------

describe('ranking movement and history', () => {
  it('records previous rank, new rank, movement and a reason', () => {
    const date = day(-999)
    const result = runLadder([bout('f12', 'f4', { date, eventId: 'mover', method: 'ko', endRound: 1 })], date)
    const entry = result.history.find((h) => h.fighterId === 'f12' && h.effectiveDate === date)!
    expect(entry.previousRank).toBe(12)
    expect(entry.newRank).toBeLessThan(12)
    expect(entry.movement).toBe(entry.previousRank! - entry.newRank!)
    expect(entry.movementLabel).toBe('up')
    expect(entry.movementReason.join(' ')).toContain('Defeated')
    expect(entry.movementReason.join(' ')).toContain('Won by KO')
  })

  it('explains a move for a fighter who did not compete', () => {
    const date = day(-999)
    const result = runLadder([bout('f14', 'f2', { date, eventId: 'shuffle', method: 'ko', endRound: 1 })], date)
    const passive = result.history.find(
      (h) => h.effectiveDate === date && h.movementReason.includes('Did not compete'),
    )
    expect(passive).toBeDefined()
  })

  it('is deterministic — two runs over identical data agree exactly', () => {
    const a = runLadder()
    const b = runLadder()
    expect(a.standings.get(DIVISION)!.order).toEqual(b.standings.get(DIVISION)!.order)
    expect(a.history.length).toBe(b.history.length)
  })
})

// ---------------------------------------------------------------------------
// §36 — pound for pound
// ---------------------------------------------------------------------------

describe('pound for pound', () => {
  it('ranks across divisions and is not a copy of any one division', () => {
    const date = day(-999)
    const result = runLadder([], date)
    expect(result.p4p.length).toBeGreaterThan(0)
    expect(result.p4p[0].position).toBe(1)
    const components = result.p4p[0].components
    expect(Object.keys(components).sort()).toEqual([
      'activity',
      'championship',
      'dominance',
      'opponentQuality',
      'rating',
      'recentForm',
    ])
  })

  it('lifts a champion above an equally rated non-champion', () => {
    const date = day(-999)
    const withTitle = runLadder(
      [bout('f2', 'f3', { date, eventId: 'p4pTitle', isTitleFight: true, scheduledRounds: 5 })],
      date,
    )
    const withoutTitle = runLadder([bout('f2', 'f3', { date, eventId: 'p4pNoTitle' })], date)
    const scoreWith = withTitle.p4p.find((e) => e.fighterId === 'f2')!.score
    const scoreWithout = withoutTitle.p4p.find((e) => e.fighterId === 'f2')!.score
    expect(scoreWith).toBeGreaterThan(scoreWithout)
  })

  it('respects the configured minimum bout count', () => {
    const result = runEngine({
      fighters: [fighter('a'), fighter('o', { divisionId: DIVISION_B })],
      fights: [bout('a', 'o', { date: day(-10) })],
      divisions,
      asOf: day(0),
      config: { p4pMinFights: 3 },
    })
    expect(result.p4p.find((e) => e.fighterId === 'a')).toBeUndefined()
  })
})
