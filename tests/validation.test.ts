import { describe, expect, it } from 'vitest'
import {
  validateDisciplineInput,
  validateDivisionInput,
  validateEvent,
  validateFight,
  validateFighter,
  type FightDraft,
} from '@/services/validation'

const DIV_A = 'div-a'
const DIV_B = 'div-b'

const baseDraft: FightDraft = {
  eventId: 'event-1',
  divisionId: DIV_A,
  fighterAId: 'a',
  fighterBId: 'b',
  status: 'completed',
  outcome: 'win',
  winnerId: 'a',
  method: 'decision',
  decisionType: 'unanimous',
  endRound: null,
  endTimeSeconds: null,
  scheduledRounds: 3,
  isTitleFight: false,
  isInterimTitle: false,
  isMainEvent: false,
  fightType: 'standard',
}

const context = (overrides: Partial<Parameters<typeof validateFight>[1]> = {}) => ({
  existingFights: [],
  divisionOf: (id: string) => (id === 'a' || id === 'b' ? DIV_A : DIV_B),
  ...overrides,
})

const fieldsOf = (issues: { field: string }[]) => issues.map((i) => i.field)

describe('fight validation (§23)', () => {
  it('accepts a well-formed result', () => {
    expect(validateFight(baseDraft, context())).toEqual([])
  })

  it('rejects a fighter booked against himself', () => {
    const issues = validateFight({ ...baseDraft, fighterBId: 'a' }, context())
    expect(fieldsOf(issues)).toContain('fighterBId')
  })

  it('rejects a winner who is not one of the two fighters', () => {
    const issues = validateFight({ ...baseDraft, winnerId: 'someone-else' }, context())
    expect(fieldsOf(issues)).toContain('winnerId')
  })

  it('rejects a win with no winner', () => {
    const issues = validateFight({ ...baseDraft, winnerId: null }, context())
    expect(fieldsOf(issues)).toContain('winnerId')
  })

  it('rejects a draw that names a winner', () => {
    const issues = validateFight(
      { ...baseDraft, outcome: 'draw', method: 'draw', winnerId: 'a' },
      context(),
    )
    expect(issues.some((i) => i.message.includes('draw cannot have a winner'))).toBe(true)
  })

  it('rejects a no contest that names a winner', () => {
    const issues = validateFight(
      { ...baseDraft, outcome: 'no_contest', method: 'no_contest', winnerId: 'a' },
      context(),
    )
    expect(issues.some((i) => i.message.includes('no contest cannot have a winner'))).toBe(true)
  })

  it('rejects a bout where neither fighter competes in the division', () => {
    const issues = validateFight(
      { ...baseDraft, divisionId: 'div-c' },
      context({ divisionOf: () => DIV_B }),
    )
    expect(fieldsOf(issues)).toContain('divisionId')
  })

  it('allows a cross-division bout when it is marked as a catchweight', () => {
    const issues = validateFight(
      { ...baseDraft, divisionId: 'div-c', fightType: 'catchweight' },
      context({ divisionOf: () => DIV_B }),
    )
    expect(fieldsOf(issues)).not.toContain('divisionId')
  })

  it('rejects a duplicate bout on the same card in either order', () => {
    const existing = [{ id: 'f1', eventId: 'event-1', fighterAId: 'b', fighterBId: 'a' }]
    const issues = validateFight(baseDraft, context({ existingFights: existing }))
    expect(issues.some((i) => i.message.includes('already booked against each other'))).toBe(true)
  })

  it('rejects a fighter appearing twice on the same card', () => {
    const existing = [{ id: 'f1', eventId: 'event-1', fighterAId: 'a', fighterBId: 'c' }]
    const issues = validateFight(baseDraft, context({ existingFights: existing }))
    expect(issues.some((i) => i.message.includes('already booked on this card'))).toBe(true)
  })

  it('requires a decision type for a decision win', () => {
    const issues = validateFight({ ...baseDraft, decisionType: null }, context())
    expect(fieldsOf(issues)).toContain('decisionType')
  })

  it('requires a round and time for a finish', () => {
    const issues = validateFight({ ...baseDraft, method: 'ko', decisionType: null }, context())
    expect(fieldsOf(issues)).toEqual(expect.arrayContaining(['endRound', 'endTimeSeconds']))
  })

  it('rejects a finish in a round beyond the scheduled distance', () => {
    const issues = validateFight(
      {
        ...baseDraft,
        method: 'ko',
        decisionType: null,
        endRound: 5,
        endTimeSeconds: 30,
        scheduledRounds: 3,
      },
      context(),
    )
    expect(fieldsOf(issues)).toContain('endRound')
  })

  it('rejects an interim bout that is not also a title fight', () => {
    const issues = validateFight({ ...baseDraft, isInterimTitle: true }, context())
    expect(fieldsOf(issues)).toContain('isInterimTitle')
  })

  it('rejects an interim bout involving the reigning champion', () => {
    const issues = validateFight(
      { ...baseDraft, isTitleFight: true, isInterimTitle: true },
      context({ championId: 'a' }),
    )
    expect(issues.some((i) => i.message.includes('reigning champion'))).toBe(true)
  })

  it('rejects a result on a scheduled bout', () => {
    const issues = validateFight({ ...baseDraft, status: 'scheduled' }, context())
    expect(fieldsOf(issues)).toContain('outcome')
  })
})

describe('fighter validation', () => {
  const fighter = {
    firstName: 'Dario',
    lastName: 'Vasquez-Moor',
    displayName: 'Dario Vasquez-Moor',
    slug: 'dario-vasquez-moor',
    divisionId: 'div-a',
    heightCm: 180,
    reachCm: 185,
    dateOfBirth: '1995-04-02',
    isChampion: false,
    isInterimChampion: false,
  }

  it('accepts a complete fighter', () => {
    expect(validateFighter(fighter, { existingSlugs: [] })).toEqual([])
  })

  it('rejects a duplicate slug', () => {
    const issues = validateFighter(fighter, {
      existingSlugs: [{ id: 'other', slug: 'dario-vasquez-moor' }],
    })
    expect(fieldsOf(issues)).toContain('slug')
  })

  it('rejects a fighter holding both the undisputed and interim title', () => {
    const issues = validateFighter(
      { ...fighter, isChampion: true, isInterimChampion: true },
      { existingSlugs: [] },
    )
    expect(fieldsOf(issues)).toContain('isInterimChampion')
  })

  it('rejects a champion with no division', () => {
    const issues = validateFighter(
      { ...fighter, isChampion: true, divisionId: null },
      { existingSlugs: [] },
    )
    expect(fieldsOf(issues)).toContain('divisionId')
  })

  it('rejects an implausible height', () => {
    const issues = validateFighter({ ...fighter, heightCm: 30 }, { existingSlugs: [] })
    expect(fieldsOf(issues)).toContain('heightCm')
  })
})

describe('event validation', () => {
  const event = { name: 'FIGHTRANK 200', slug: 'fightrank-200', eventDate: '2026-01-01', eventNumber: 200 }

  it('accepts a complete event', () => {
    expect(validateEvent(event, { existing: [] })).toEqual([])
  })

  it('rejects a duplicate slug', () => {
    const issues = validateEvent(event, {
      existing: [{ id: 'x', slug: 'fightrank-200', eventNumber: null }],
    })
    expect(fieldsOf(issues)).toContain('slug')
  })

  it('rejects a duplicate event number', () => {
    const issues = validateEvent(event, {
      existing: [{ id: 'x', slug: 'other', eventNumber: 200 }],
    })
    expect(fieldsOf(issues)).toContain('eventNumber')
  })
})

describe('division validation', () => {
  it('requires a name and slug', () => {
    const issues = validateDivisionInput(
      { disciplineId: 'mma', name: '', slug: '', gender: 'men', weightLbs: null },
      { existing: [] },
    )
    expect(fieldsOf(issues)).toEqual(expect.arrayContaining(['name', 'slug']))
  })

  it('rejects a duplicate slug', () => {
    const issues = validateDivisionInput(
      {
        disciplineId: 'mma',
        name: 'Lightweight',
        slug: 'mma-lightweight',
        gender: 'men',
        weightLbs: 155,
      },
      { existing: [{ id: 'x', slug: 'mma-lightweight' }] },
    )
    expect(fieldsOf(issues)).toContain('slug')
  })

  it('requires a discipline — a division cannot float free of one', () => {
    const issues = validateDivisionInput(
      { disciplineId: '', name: 'Lightweight', slug: 'lightweight', gender: 'men', weightLbs: 155 },
      { existing: [] },
    )
    expect(fieldsOf(issues)).toContain('disciplineId')
  })
})

describe('discipline validation', () => {
  it('requires a name, slug and short code', () => {
    const issues = validateDisciplineInput(
      { name: '', slug: '', shortCode: '' },
      { existing: [] },
    )
    expect(fieldsOf(issues)).toEqual(expect.arrayContaining(['name', 'slug', 'shortCode']))
  })

  it('rejects a duplicate slug', () => {
    const issues = validateDisciplineInput(
      { name: 'Wrestling', slug: 'wrestling', shortCode: 'WRE' },
      { existing: [{ id: 'x', slug: 'wrestling' }] },
    )
    expect(fieldsOf(issues)).toContain('slug')
  })
})
