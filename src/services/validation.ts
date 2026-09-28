/**
 * Ranking-calculation safety (§23).
 *
 * The database enforces these rules too (CHECK constraints, unique indexes and
 * a BEFORE trigger — see `0001_schema.sql` and `0002_functions.sql`). This
 * module exists so the administrator sees a clear message in the form instead
 * of a Postgres error, and so nothing depends on client-side validation alone.
 */

import type { DecisionType, Fight, FightStatus, Method, Outcome } from '@/types/domain'

export interface ValidationIssue {
  field: string
  message: string
}

export interface FightDraft {
  id?: string
  eventId: string
  divisionId: string
  fighterAId: string
  fighterBId: string
  status: FightStatus
  outcome: Outcome | null
  winnerId: string | null
  method: Method | null
  decisionType: DecisionType | null
  endRound: number | null
  endTimeSeconds: number | null
  scheduledRounds: number
  isTitleFight: boolean
  isInterimTitle: boolean
  isMainEvent: boolean
  fightType: string
}

export interface FightValidationContext {
  /** Every other bout already on this card. */
  existingFights: Pick<Fight, 'id' | 'eventId' | 'fighterAId' | 'fighterBId'>[]
  /** Division each fighter competes in, for the compatibility rule. */
  divisionOf: (fighterId: string) => string | null | undefined
  /** Current champion of the bout's division, if any. */
  championId?: string | null
  interimChampionId?: string | null
}

const FINISH_METHODS: Method[] = ['ko', 'tko', 'submission', 'doctor_stoppage', 'retirement', 'dq']
const DECISION_METHODS: Method[] = ['decision', 'technical_decision']

export function validateFight(
  draft: FightDraft,
  context: FightValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })

  if (!draft.eventId) add('eventId', 'Choose an event.')
  if (!draft.divisionId) add('divisionId', 'Choose a division.')
  if (!draft.fighterAId) add('fighterAId', 'Choose the first fighter.')
  if (!draft.fighterBId) add('fighterBId', 'Choose the second fighter.')

  // A fighter cannot fight himself.
  if (draft.fighterAId && draft.fighterAId === draft.fighterBId) {
    add('fighterBId', 'A fighter cannot be booked against himself.')
  }

  // Division compatibility. `divisionOf` answers per discipline, so an athlete
  // who competes in several is judged against the right one.
  if (draft.divisionId && draft.fightType !== 'catchweight') {
    const divA = context.divisionOf(draft.fighterAId)
    const divB = context.divisionOf(draft.fighterBId)
    const aMismatch = divA && divA !== draft.divisionId
    const bMismatch = divB && divB !== draft.divisionId
    if (aMismatch && bMismatch) {
      add(
        'divisionId',
        'Neither athlete competes in this division. Register them in the discipline, or mark the bout as a catchweight.',
      )
    }
  }

  // Duplicate bout on the same card.
  const duplicate = context.existingFights.find(
    (f) =>
      f.id !== draft.id &&
      f.eventId === draft.eventId &&
      ((f.fighterAId === draft.fighterAId && f.fighterBId === draft.fighterBId) ||
        (f.fighterAId === draft.fighterBId && f.fighterBId === draft.fighterAId)),
  )
  if (duplicate) add('fighterBId', 'These two are already booked against each other on this card.')

  // A fighter can only appear once per card.
  const alreadyBooked = context.existingFights.find(
    (f) =>
      f.id !== draft.id &&
      f.eventId === draft.eventId &&
      [f.fighterAId, f.fighterBId].some((id) =>
        [draft.fighterAId, draft.fighterBId].includes(id),
      ),
  )
  if (alreadyBooked && !duplicate) {
    add('fighterAId', 'One of these fighters is already booked on this card.')
  }

  // Interim implies title.
  if (draft.isInterimTitle && !draft.isTitleFight) {
    add('isInterimTitle', 'An interim bout must also be marked as a title fight.')
  }

  // Champion uniqueness is enforced by the engine, but an interim bout should
  // not involve the reigning champion.
  if (draft.isInterimTitle && context.championId) {
    if ([draft.fighterAId, draft.fighterBId].includes(context.championId)) {
      add('isInterimTitle', 'The reigning champion cannot contest an interim title.')
    }
  }

  if (draft.scheduledRounds !== 1 && draft.scheduledRounds !== 3 && draft.scheduledRounds !== 5) {
    add('scheduledRounds', 'A bout is scheduled for 1, 3 or 5 rounds.')
  }

  // ---- result rules --------------------------------------------------------
  if (draft.status !== 'completed') {
    if (draft.outcome || draft.winnerId) {
      add('outcome', 'A scheduled bout cannot carry a result yet.')
    }
    return issues
  }

  if (!draft.outcome) {
    add('outcome', 'Record the outcome of the bout.')
    return issues
  }

  if (draft.outcome === 'win') {
    if (!draft.winnerId) {
      add('winnerId', 'Select the winner.')
    } else if (![draft.fighterAId, draft.fighterBId].includes(draft.winnerId)) {
      add('winnerId', 'The winner must be one of the two fighters.')
    }
    if (!draft.method) add('method', 'Select the method of victory.')
    if (draft.method && DECISION_METHODS.includes(draft.method) && !draft.decisionType) {
      add('decisionType', 'Select unanimous, split or majority.')
    }
    if (draft.method && FINISH_METHODS.includes(draft.method)) {
      if (draft.endRound === null) add('endRound', 'A finish needs the round it happened in.')
      if (draft.endTimeSeconds === null) add('endTimeSeconds', 'A finish needs a time.')
    }
  } else {
    // Draw, majority draw, split draw, no contest.
    if (draft.winnerId) {
      add(
        'winnerId',
        draft.outcome === 'no_contest'
          ? 'A no contest cannot have a winner.'
          : 'A draw cannot have a winner.',
      )
    }
    if (draft.outcome === 'no_contest' && draft.method && draft.method !== 'no_contest') {
      add('method', 'A no contest has no method of victory.')
    }
  }

  if (draft.endRound !== null && draft.endRound > draft.scheduledRounds) {
    add('endRound', `This bout is only scheduled for ${draft.scheduledRounds} rounds.`)
  }
  // Round length varies by discipline — five minutes in MMA, three in Muay
  // Thai, a single ten-minute period in grappling — so this is the outer bound
  // the database enforces rather than one sport's clock.
  if (draft.endTimeSeconds !== null && (draft.endTimeSeconds < 0 || draft.endTimeSeconds > 900)) {
    add('endTimeSeconds', 'A round or period cannot run past fifteen minutes.')
  }

  return issues
}

export interface FighterDraft {
  id?: string
  firstName: string
  lastName: string
  displayName: string
  slug: string
  divisionId: string | null
  heightCm: number | null
  reachCm: number | null
  dateOfBirth: string | null
  isChampion: boolean
  isInterimChampion: boolean
}

/** Everything the fighter form submits. */
export interface FighterInput extends FighterDraft {
  /** The discipline this athlete's primary record belongs to. */
  disciplineId?: string | null
  nickname?: string | null
  photoUrl?: string | null
  country?: string | null
  countryCode?: string | null
  stance?: string | null
  team?: string | null
  debutDate?: string | null
  isActive?: boolean
  bio?: string | null
}

export function validateFighter(
  draft: FighterDraft,
  context: { existingSlugs: Array<{ id: string; slug: string }> },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })

  if (!draft.firstName.trim()) add('firstName', 'First name is required.')
  if (!draft.lastName.trim()) add('lastName', 'Last name is required.')
  if (!draft.displayName.trim()) add('displayName', 'Display name is required.')
  if (!draft.slug.trim()) add('slug', 'A URL slug is required.')

  if (context.existingSlugs.some((f) => f.slug === draft.slug && f.id !== draft.id)) {
    add('slug', 'That slug is already in use.')
  }
  if (draft.isChampion && draft.isInterimChampion) {
    add('isInterimChampion', 'A fighter cannot hold both the undisputed and interim title.')
  }
  if (draft.isChampion && !draft.divisionId) {
    add('divisionId', 'A champion must belong to a division.')
  }
  if (draft.heightCm !== null && (draft.heightCm < 120 || draft.heightCm > 250)) {
    add('heightCm', 'Height should be between 120 cm and 250 cm.')
  }
  if (draft.reachCm !== null && (draft.reachCm < 120 || draft.reachCm > 260)) {
    add('reachCm', 'Reach should be between 120 cm and 260 cm.')
  }
  if (draft.dateOfBirth) {
    const age = (Date.now() - Date.parse(draft.dateOfBirth)) / (365.25 * 86_400_000)
    if (age < 16) add('dateOfBirth', 'A professional fighter must be at least 16.')
    if (age > 70) add('dateOfBirth', 'Check the date of birth.')
  }

  return issues
}

export interface EventDraft {
  id?: string
  name: string
  slug: string
  eventDate: string
  eventNumber: number | null
}

/** Everything the event form submits. */
export interface EventInput extends EventDraft {
  venue?: string | null
  city?: string | null
  country?: string | null
  countryCode?: string | null
  posterUrl?: string | null
  status?: 'scheduled' | 'live' | 'completed' | 'cancelled'
}

/** Everything the division editor submits. */
export interface DisciplineInput {
  id?: string
  name: string
  slug: string
  shortCode: string
  tagline?: string | null
  description?: string | null
  ruleset?: string | null
  accent?: string | null
  sortOrder?: number
  isActive?: boolean
}

export function validateDisciplineInput(
  draft: Pick<DisciplineInput, 'id' | 'name' | 'slug' | 'shortCode'>,
  context: { existing: Array<{ id: string; slug: string }> },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!draft.name.trim()) issues.push({ field: 'name', message: 'Discipline name is required.' })
  if (!draft.slug.trim()) issues.push({ field: 'slug', message: 'A URL slug is required.' })
  if (!draft.shortCode.trim()) {
    issues.push({ field: 'shortCode', message: 'A short code is required — it labels every bout.' })
  }
  if (context.existing.some((d) => d.slug === draft.slug && d.id !== draft.id)) {
    issues.push({ field: 'slug', message: 'That slug is already in use.' })
  }
  return issues
}

export interface DivisionInput {
  id?: string
  disciplineId: string
  name: string
  slug: string
  gender: 'men' | 'women' | 'open'
  weightLbs: number | null
  weightKg?: number | null
  shortCode?: string | null
  sortOrder?: number
  isP4P?: boolean
  isActive?: boolean
  description?: string | null
}

export function validateEvent(
  draft: EventDraft,
  context: { existing: Array<{ id: string; slug: string; eventNumber: number | null }> },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!draft.name.trim()) issues.push({ field: 'name', message: 'Event name is required.' })
  if (!draft.slug.trim()) issues.push({ field: 'slug', message: 'A URL slug is required.' })
  if (!draft.eventDate) issues.push({ field: 'eventDate', message: 'Event date is required.' })
  if (context.existing.some((e) => e.slug === draft.slug && e.id !== draft.id)) {
    issues.push({ field: 'slug', message: 'That slug is already in use.' })
  }
  if (
    draft.eventNumber !== null &&
    context.existing.some((e) => e.eventNumber === draft.eventNumber && e.id !== draft.id)
  ) {
    issues.push({ field: 'eventNumber', message: 'That event number already exists.' })
  }
  return issues
}

export function validateDivisionInput(
  draft: Pick<DivisionInput, 'id' | 'disciplineId' | 'name' | 'slug' | 'gender' | 'weightLbs'>,
  context: { existing: Array<{ id: string; slug: string }> },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!draft.disciplineId) {
    issues.push({ field: 'disciplineId', message: 'Every division belongs to a discipline.' })
  }
  if (!draft.name.trim()) issues.push({ field: 'name', message: 'Division name is required.' })
  if (!draft.slug.trim()) issues.push({ field: 'slug', message: 'A URL slug is required.' })
  if (context.existing.some((d) => d.slug === draft.slug && d.id !== draft.id)) {
    issues.push({ field: 'slug', message: 'That slug is already in use.' })
  }
  if (draft.weightLbs !== null && (draft.weightLbs < 100 || draft.weightLbs > 400)) {
    issues.push({ field: 'weightLbs', message: 'A weight limit should be between 100 and 400 lb.' })
  }
  return issues
}

export function issuesByField(issues: ValidationIssue[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const issue of issues) map[issue.field] ??= issue.message
  return map
}
