import { describe, expect, it } from 'vitest'
import {
  disciplinesForDivisions,
  runMultiEngine,
  scopeToDiscipline,
  type DisciplineRegistration,
  type MultiEngineInput,
  type ScopedDivision,
  type ScopedFight,
} from '@/ranking/multiDiscipline'
import { bout, day } from './helpers'

/**
 * The central promise of the unified Fighter ID: one athlete, several records,
 * and no leakage between them. A wrestling result must never move a Muay Thai
 * rating, however good the wrestler is.
 */

const MMA = 'disc-mma'
const WRE = 'disc-wrestling'

const MMA_LW: ScopedDivision = { id: 'mma-lw', name: 'Lightweight', isP4P: false, disciplineId: MMA }
const WRE_LW: ScopedDivision = { id: 'wre-lw', name: 'Lightweight', isP4P: false, disciplineId: WRE }

const disciplines = [
  { id: MMA, slug: 'mixed-martial-arts', name: 'Mixed Martial Arts', shortCode: 'MMA' },
  { id: WRE, slug: 'wrestling', name: 'Wrestling', shortCode: 'WRE' },
]

/** The same four athletes, registered in both disciplines. */
function registrations(): DisciplineRegistration[] {
  const ids = ['a', 'b', 'c', 'd']
  return [
    ...ids.map((id) => ({
      fighterId: id,
      disciplineId: MMA,
      divisionId: MMA_LW.id,
      isActive: true,
      isPrimary: true,
      displayName: id.toUpperCase(),
    })),
    ...ids.map((id) => ({
      fighterId: id,
      disciplineId: WRE,
      divisionId: WRE_LW.id,
      isActive: true,
      isPrimary: false,
      displayName: id.toUpperCase(),
    })),
  ]
}

const scoped = (fight: ReturnType<typeof bout>, disciplineId: string, divisionId: string): ScopedFight => ({
  ...fight,
  divisionId,
  disciplineId,
})

function input(fights: ScopedFight[]): MultiEngineInput {
  return {
    disciplines,
    divisions: [MMA_LW, WRE_LW],
    registrations: registrations(),
    fights,
    asOf: day(0),
  }
}

describe('running one engine per discipline', () => {
  it('produces a separate, independently numbered table for each discipline', () => {
    const result = runMultiEngine(
      input([
        scoped(bout('a', 'b', { date: day(-40) }), MMA, MMA_LW.id),
        scoped(bout('a', 'c', { date: day(-30) }), MMA, MMA_LW.id),
        scoped(bout('d', 'c', { date: day(-20) }), WRE, WRE_LW.id),
        scoped(bout('d', 'b', { date: day(-10) }), WRE, WRE_LW.id),
      ]),
    )

    expect(result.byDiscipline.size).toBe(2)
    const mma = result.byDiscipline.get(MMA)!
    const wrestling = result.byDiscipline.get(WRE)!

    // The MMA winner tops the MMA table; the wrestling winner tops wrestling.
    expect(mma.standings.get(MMA_LW.id)!.order[0]).toBe('a')
    expect(wrestling.standings.get(WRE_LW.id)!.order[0]).toBe('d')

    // Neither run knows anything about the other's divisions.
    expect([...mma.standings.keys()]).toEqual([MMA_LW.id])
    expect([...wrestling.standings.keys()]).toEqual([WRE_LW.id])
  })

  it('never lets a result in one discipline move a rating in another', () => {
    const mmaOnly = [
      scoped(bout('a', 'b', { date: day(-40) }), MMA, MMA_LW.id),
      scoped(bout('a', 'c', { date: day(-30) }), MMA, MMA_LW.id),
    ]

    const before = runMultiEngine(input(mmaOnly))
    const after = runMultiEngine(
      input([
        ...mmaOnly,
        // 'b' goes on a wrestling tear. Their MMA rating must not budge.
        scoped(bout('b', 'c', { date: day(-20) }), WRE, WRE_LW.id),
        scoped(bout('b', 'd', { date: day(-15) }), WRE, WRE_LW.id),
        scoped(bout('b', 'a', { date: day(-10) }), WRE, WRE_LW.id),
      ]),
    )

    const mmaRatingBefore = before.byDiscipline.get(MMA)!.states.get('b')!.rating
    const mmaRatingAfter = after.byDiscipline.get(MMA)!.states.get('b')!.rating
    expect(mmaRatingAfter).toBe(mmaRatingBefore)

    // …while the wrestling rating they earned is genuinely higher.
    const wrestlingRating = after.byDiscipline.get(WRE)!.states.get('b')!.rating
    expect(wrestlingRating).toBeGreaterThan(mmaRatingAfter)
  })

  it('lets one athlete be champion in one discipline and unranked in another', () => {
    const result = runMultiEngine(
      input([
        scoped(
          bout('a', 'b', { date: day(-30), isTitleFight: true, scheduledRounds: 5 }),
          MMA,
          MMA_LW.id,
        ),
        scoped(bout('c', 'a', { date: day(-20) }), WRE, WRE_LW.id),
        scoped(bout('d', 'a', { date: day(-10) }), WRE, WRE_LW.id),
      ]),
    )

    const mma = result.byDiscipline.get(MMA)!
    const wrestling = result.byDiscipline.get(WRE)!

    expect(mma.standings.get(MMA_LW.id)!.championId).toBe('a')
    expect(wrestling.standings.get(WRE_LW.id)!.championId).not.toBe('a')

    // Two losses in wrestling leave them below the athletes who beat them.
    const order = wrestling.standings.get(WRE_LW.id)!.order
    expect(order.indexOf('a')).toBeGreaterThan(order.indexOf('d'))
  })

  it('honours a discipline scope so a partial run leaves the rest alone', () => {
    const all = input([
      scoped(bout('a', 'b', { date: day(-30) }), MMA, MMA_LW.id),
      scoped(bout('d', 'c', { date: day(-20) }), WRE, WRE_LW.id),
    ])

    const scopedRun = runMultiEngine({ ...all, disciplineScope: [WRE] })
    expect([...scopedRun.byDiscipline.keys()]).toEqual([WRE])
    expect(scopedRun.disciplines.map((d) => d.id)).toEqual([WRE])
  })
})

describe('scoping helpers', () => {
  it('narrows the whole-platform input to one discipline', () => {
    const narrowed = scopeToDiscipline(
      input([
        scoped(bout('a', 'b', { date: day(-30) }), MMA, MMA_LW.id),
        scoped(bout('d', 'c', { date: day(-20) }), WRE, WRE_LW.id),
      ]),
      WRE,
    )

    expect(narrowed.divisions).toHaveLength(1)
    expect(narrowed.divisions[0].id).toBe(WRE_LW.id)
    expect(narrowed.fights).toHaveLength(1)
    expect(narrowed.fighters.every((f) => f.divisionId === WRE_LW.id)).toBe(true)
  })

  it('derives the disciplines a set of divisions belongs to', () => {
    expect(disciplinesForDivisions([MMA_LW, WRE_LW], [WRE_LW.id])).toEqual([WRE])
    expect(disciplinesForDivisions([MMA_LW, WRE_LW], [MMA_LW.id, WRE_LW.id]).sort()).toEqual(
      [MMA, WRE].sort(),
    )
  })
})
