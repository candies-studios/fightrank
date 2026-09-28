/**
 * Administrative operations (§22, §39).
 *
 * Each mutation follows the same order: validate → write → recalculate the
 * affected divisions → record the change in the audit log → hand back a
 * summary of what moved.
 */

import type { DataContext } from '@/data'
import type { AuthSession } from '@/data/auth'
import type {
  Discipline,
  Division,
  FightEvent,
  FighterApplication,
  FighterProfile,
  Mover,
} from '@/types/domain'
import { recalculate, type RecalculationSummary } from './recalculate'
import {
  validateDisciplineInput,
  validateDivisionInput,
  validateEvent,
  validateFight,
  validateFighter,
  type DisciplineInput,
  type DivisionInput,
  type EventInput,
  type FightDraft,
  type FighterInput,
  type ValidationIssue,
} from './validation'

export class ValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join(' '))
    this.name = 'ValidationError'
    this.issues = issues
  }
}

export interface SaveFightResult {
  fightId: string
  summary: RecalculationSummary
  changes: Mover[]
}

function audit(context: DataContext, session: AuthSession | null) {
  return (entry: {
    action: string
    entity: string
    entityId?: string | null
    entityLabel?: string | null
    previousValue?: unknown
    newValue?: unknown
  }) =>
    context.repository.writeAudit({
      userId: session?.userId ?? null,
      userEmail: session?.email ?? null,
      ...entry,
    })
}

function fightToRow(draft: FightDraft): Record<string, unknown> {
  const isWin = draft.status === 'completed' && draft.outcome === 'win'
  return {
    ...(draft.id ? { id: draft.id } : {}),
    event_id: draft.eventId,
    division_id: draft.divisionId,
    fighter_a_id: draft.fighterAId,
    fighter_b_id: draft.fighterBId,
    scheduled_rounds: draft.scheduledRounds,
    status: draft.status,
    outcome: draft.status === 'completed' ? draft.outcome : null,
    winner_id: isWin ? draft.winnerId : null,
    loser_id: isWin
      ? draft.winnerId === draft.fighterAId
        ? draft.fighterBId
        : draft.fighterAId
      : null,
    method: draft.status === 'completed' ? draft.method : null,
    decision_type: draft.status === 'completed' ? draft.decisionType : null,
    end_round: draft.status === 'completed' ? draft.endRound : null,
    end_time_seconds: draft.status === 'completed' ? draft.endTimeSeconds : null,
    fight_type: draft.fightType,
    is_title_fight: draft.isTitleFight,
    is_interim_title: draft.isInterimTitle,
    is_main_event: draft.isMainEvent,
  }
}

export async function saveFight(
  context: DataContext,
  session: AuthSession | null,
  draft: FightDraft,
): Promise<SaveFightResult> {
  const { repository } = context

  const ids = [draft.fighterAId, draft.fighterBId].filter(Boolean)
  const [cardFights, fighters, rankings, records] = await Promise.all([
    repository.listFights({ eventId: draft.eventId, status: 'all' }),
    repository.getFightersByIds(ids),
    draft.divisionId ? repository.listRankings(draft.divisionId) : Promise.resolve([]),
    Promise.all(ids.map((id) => repository.listDisciplineRecords(id))),
  ])

  // An athlete competes in a different division in each discipline, so the
  // division that matters is the one they hold in *this* bout's discipline.
  const flatRecords = records.flat()
  const divisionOf = (id: string) => {
    const owning = flatRecords.filter((r) => r.fighterId === id)
    const match = owning.find((r) => r.divisionId === draft.divisionId)
    if (match) return match.divisionId
    return owning.find((r) => r.isPrimary)?.divisionId ?? owning[0]?.divisionId ?? null
  }
  const issues = validateFight(draft, {
    existingFights: cardFights,
    divisionOf,
    championId: rankings.find((r) => r.isChampion)?.fighterId ?? null,
    interimChampionId: rankings.find((r) => r.isInterimChampion)?.fighterId ?? null,
  })
  if (issues.length > 0) throw new ValidationError(issues)

  const previous = draft.id ? await repository.getFight(draft.id) : null
  const saved = await repository.saveFight(fightToRow(draft))

  // §43 — only the divisions this bout could have disturbed.
  const affected = new Set<string>([draft.divisionId])
  for (const fighter of fighters) if (fighter.divisionId) affected.add(fighter.divisionId)
  if (previous) affected.add(previous.divisionId)

  const { summary, result } = await recalculate(context, { divisionIds: [...affected] })

  await audit(context, session)({
    action: draft.id ? 'fight.updated' : 'fight.created',
    entity: 'fight',
    entityId: saved.id,
    entityLabel: fighters.map((f) => f.displayName).join(' vs '),
    previousValue: previous,
    newValue: saved,
  })

  const changes = await repository.listEventRankingChanges(draft.eventId)
  void result
  return { fightId: saved.id, summary, changes }
}

export async function deleteFight(
  context: DataContext,
  session: AuthSession | null,
  fightId: string,
): Promise<RecalculationSummary> {
  const { repository } = context
  const fight = await repository.getFight(fightId)
  if (!fight) throw new Error('That bout no longer exists.')

  await repository.deleteFight(fightId)
  const { summary } = await recalculate(context, { divisionIds: [fight.divisionId] })

  await audit(context, session)({
    action: 'fight.deleted',
    entity: 'fight',
    entityId: fightId,
    entityLabel: `${fight.fighterA.displayName} vs ${fight.fighterB.displayName}`,
    previousValue: fight,
  })
  return summary
}

export async function saveFighter(
  context: DataContext,
  session: AuthSession | null,
  draft: FighterInput,
): Promise<FighterProfile> {
  const { repository } = context
  const existing = await repository.listFighters({ pageSize: 1000 })
  const issues = validateFighter(draft, {
    existingSlugs: existing.rows.map((f) => ({ id: f.id, slug: f.slug })),
  })
  if (issues.length > 0) throw new ValidationError(issues)

  const previous = draft.id ? await repository.getFighter(draft.id) : null

  // The Fighter ID is issued once and never reissued: an athlete keeps it for
  // life, across every discipline they go on to compete in. It is issued by
  // the database (a sequence that skips anything already taken), so it is
  // never computed here — counting rows would hand out a duplicate the moment
  // an athlete is deleted.
  const disciplineId =
    draft.disciplineId ??
    previous?.primaryDisciplineId ??
    (draft.divisionId
      ? ((await repository.listDivisions(true)).find((d) => d.id === draft.divisionId)
          ?.disciplineId ?? null)
      : null)

  const row: Record<string, unknown> = {
    ...(draft.id ? { id: draft.id } : {}),
    primary_discipline_id: disciplineId,
    slug: draft.slug,
    first_name: draft.firstName,
    last_name: draft.lastName,
    display_name: draft.displayName,
    nickname: draft.nickname ?? null,
    photo_url: draft.photoUrl ?? null,
    country: draft.country ?? null,
    country_code: draft.countryCode ?? null,
    date_of_birth: draft.dateOfBirth,
    height_cm: draft.heightCm,
    reach_cm: draft.reachCm,
    stance: draft.stance ?? null,
    division_id: draft.divisionId,
    team: draft.team ?? null,
    debut_date: draft.debutDate ?? null,
    is_active: draft.isActive ?? true,
    bio: draft.bio ?? null,
  }

  const saved = await repository.saveFighter(row)

  // Keep the primary `fighter_disciplines` row in step with the profile, so an
  // athlete created here is immediately eligible to be booked.
  if (disciplineId) {
    await repository.saveDisciplineRecord({
      fighter_id: saved.id,
      discipline_id: disciplineId,
      division_id: draft.divisionId,
      is_primary: true,
      is_active: draft.isActive ?? true,
      debut_date: draft.debutDate ?? null,
    })
  }

  const affected = new Set<string>()
  if (saved.divisionId) affected.add(saved.divisionId)
  if (previous?.divisionId) affected.add(previous.divisionId)
  if (affected.size > 0) await recalculate(context, { divisionIds: [...affected] })

  await audit(context, session)({
    action: draft.id ? 'fighter.updated' : 'fighter.created',
    entity: 'fighter',
    entityId: saved.id,
    entityLabel: saved.displayName,
    previousValue: previous,
    newValue: saved,
  })
  return saved
}

export async function deleteFighter(
  context: DataContext,
  session: AuthSession | null,
  fighterId: string,
): Promise<void> {
  const { repository } = context
  const fighter = await repository.getFighter(fighterId)
  if (!fighter) return
  await repository.deleteFighter(fighterId)
  if (fighter.divisionId) await recalculate(context, { divisionIds: [fighter.divisionId] })
  await audit(context, session)({
    action: 'fighter.deleted',
    entity: 'fighter',
    entityId: fighterId,
    entityLabel: fighter.displayName,
    previousValue: fighter,
  })
}

export async function saveEvent(
  context: DataContext,
  session: AuthSession | null,
  draft: EventInput,
): Promise<FightEvent> {
  const { repository } = context
  const existing = await repository.listEvents({ status: 'all', pageSize: 1000 })
  const issues = validateEvent(draft, {
    existing: existing.rows.map((e) => ({ id: e.id, slug: e.slug, eventNumber: e.eventNumber })),
  })
  if (issues.length > 0) throw new ValidationError(issues)

  const previous = draft.id ? await repository.getEvent(draft.id) : null
  const saved = await repository.saveEvent({
    ...(draft.id ? { id: draft.id } : {}),
    slug: draft.slug,
    name: draft.name,
    event_number: draft.eventNumber,
    event_date: draft.eventDate,
    venue: draft.venue ?? null,
    city: draft.city ?? null,
    country: draft.country ?? null,
    country_code: draft.countryCode ?? null,
    poster_url: draft.posterUrl ?? null,
    status: draft.status ?? 'scheduled',
  })

  await audit(context, session)({
    action: draft.id ? 'event.updated' : 'event.created',
    entity: 'event',
    entityId: saved.id,
    entityLabel: saved.name,
    previousValue: previous,
    newValue: saved,
  })
  return saved
}

export async function deleteEvent(
  context: DataContext,
  session: AuthSession | null,
  eventId: string,
): Promise<void> {
  const { repository } = context
  const event = await repository.getEvent(eventId)
  if (!event) return
  const fights = await repository.listFights({ eventId, status: 'all' })
  const divisions = [...new Set(fights.map((f) => f.divisionId))]
  await repository.deleteEvent(eventId)
  if (divisions.length > 0) await recalculate(context, { divisionIds: divisions })
  await audit(context, session)({
    action: 'event.deleted',
    entity: 'event',
    entityId: eventId,
    entityLabel: event.name,
    previousValue: event,
  })
}

/**
 * Approve a Fighter ID application: create the athlete, issue the ID, register
 * them in their chosen discipline, and stamp the application with the athlete
 * it became. The ID comes from the database, never from here.
 */
export async function approveApplication(
  context: DataContext,
  session: AuthSession | null,
  application: FighterApplication,
): Promise<FighterProfile> {
  const { repository } = context
  if (application.status !== 'pending') {
    throw new Error('That application has already been decided.')
  }

  const existing = await repository.listFighters({ pageSize: 1000 })
  const base = slugifyName(application.displayName)
  let slug = base
  let suffix = 2
  while (existing.rows.some((f) => f.slug === slug)) {
    slug = `${base}-${suffix}`
    suffix += 1
  }

  const saved = await repository.saveFighter({
    // fighter_code is omitted deliberately: the database issues it.
    primary_discipline_id: application.disciplineId,
    slug,
    first_name: application.firstName,
    last_name: application.lastName,
    display_name: application.displayName,
    country: application.country,
    country_code: application.countryCode,
    date_of_birth: application.dateOfBirth,
    height_cm: application.heightCm,
    reach_cm: application.reachCm,
    stance: application.stance,
    division_id: application.divisionId,
    team: application.team,
    is_active: true,
  })

  if (application.disciplineId) {
    await repository.saveDisciplineRecord({
      fighter_id: saved.id,
      discipline_id: application.disciplineId,
      division_id: application.divisionId,
      is_primary: true,
      is_active: true,
    })
  }

  await repository.updateApplication(application.id, {
    status: 'approved',
    fighter_id: saved.id,
    decided_at: new Date().toISOString(),
    decided_by: session?.userId ?? null,
  })

  await audit(context, session)({
    action: 'application.approved',
    entity: 'fighter_application',
    entityId: application.id,
    entityLabel: `${application.reference} → ${saved.fighterCode}`,
    previousValue: application,
    newValue: saved,
  })

  const profile = await repository.getFighter(saved.id)
  if (!profile) throw new Error('The athlete could not be loaded after approval.')
  return profile
}

export async function declineApplication(
  context: DataContext,
  session: AuthSession | null,
  application: FighterApplication,
  reason: string,
): Promise<void> {
  await context.repository.updateApplication(application.id, {
    status: 'declined',
    decided_at: new Date().toISOString(),
    decided_by: session?.userId ?? null,
    decision_note: reason || null,
  })
  await audit(context, session)({
    action: 'application.declined',
    entity: 'fighter_application',
    entityId: application.id,
    entityLabel: application.reference,
    previousValue: application,
    newValue: { reason },
  })
}

function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function saveDiscipline(
  context: DataContext,
  session: AuthSession | null,
  draft: DisciplineInput,
): Promise<Discipline> {
  const { repository } = context
  const existing = await repository.listDisciplines(true)
  const issues = validateDisciplineInput(draft, {
    existing: existing.map((d) => ({ id: d.id, slug: d.slug })),
  })
  if (issues.length > 0) throw new ValidationError(issues)

  const previous = draft.id ? await repository.getDiscipline(draft.id) : null
  const saved = await repository.saveDiscipline({
    ...(draft.id ? { id: draft.id } : {}),
    slug: draft.slug,
    name: draft.name,
    short_code: draft.shortCode,
    tagline: draft.tagline ?? null,
    description: draft.description ?? null,
    ruleset: draft.ruleset ?? null,
    accent: draft.accent ?? null,
    sort_order: draft.sortOrder ?? 0,
    is_active: draft.isActive ?? true,
  })
  await audit(context, session)({
    action: draft.id ? 'discipline.updated' : 'discipline.created',
    entity: 'discipline',
    entityId: saved.id,
    entityLabel: saved.name,
    previousValue: previous,
    newValue: saved,
  })
  return saved
}

export async function deleteDiscipline(
  context: DataContext,
  session: AuthSession | null,
  disciplineId: string,
): Promise<void> {
  const { repository } = context
  const discipline = await repository.getDiscipline(disciplineId)
  if (!discipline) return
  await repository.deleteDiscipline(disciplineId)
  await audit(context, session)({
    action: 'discipline.deleted',
    entity: 'discipline',
    entityId: disciplineId,
    entityLabel: discipline.name,
    previousValue: discipline,
  })
}

/**
 * Register an athlete in a discipline, or move them to another division inside
 * one. This is what gives a Fighter ID a second record; it never touches the
 * records they already hold elsewhere.
 */
export async function saveDisciplineRegistration(
  context: DataContext,
  session: AuthSession | null,
  input: {
    fighterId: string
    disciplineId: string
    divisionId: string | null
    isPrimary?: boolean
    isActive?: boolean
    debutDate?: string | null
  },
): Promise<void> {
  await context.repository.saveDisciplineRecord({
    fighter_id: input.fighterId,
    discipline_id: input.disciplineId,
    division_id: input.divisionId,
    is_primary: input.isPrimary ?? false,
    is_active: input.isActive ?? true,
    debut_date: input.debutDate ?? null,
  })
  await audit(context, session)({
    action: 'fighter.discipline_registered',
    entity: 'fighter_discipline',
    entityId: input.fighterId,
    newValue: input,
  })
}

export async function deleteDisciplineRegistration(
  context: DataContext,
  session: AuthSession | null,
  fighterId: string,
  disciplineId: string,
): Promise<void> {
  await context.repository.deleteDisciplineRecord(fighterId, disciplineId)
  await audit(context, session)({
    action: 'fighter.discipline_removed',
    entity: 'fighter_discipline',
    entityId: fighterId,
    previousValue: { fighterId, disciplineId },
  })
}

export async function saveDivision(
  context: DataContext,
  session: AuthSession | null,
  draft: DivisionInput,
): Promise<Division> {
  const { repository } = context
  const existing = await repository.listDivisions(true)
  const issues = validateDivisionInput(draft, {
    existing: existing.map((d) => ({ id: d.id, slug: d.slug })),
  })
  if (issues.length > 0) throw new ValidationError(issues)

  const previous = draft.id ? await repository.getDivision(draft.id) : null
  const saved = await repository.saveDivision({
    ...(draft.id ? { id: draft.id } : {}),
    discipline_id: draft.disciplineId,
    slug: draft.slug,
    name: draft.name,
    gender: draft.gender,
    weight_lbs: draft.weightLbs ?? null,
    weight_kg: draft.weightKg ?? null,
    short_code: draft.shortCode ?? null,
    sort_order: draft.sortOrder ?? 0,
    is_p4p: draft.isP4P ?? false,
    is_active: draft.isActive ?? true,
    description: draft.description ?? null,
  })
  await audit(context, session)({
    action: draft.id ? 'division.updated' : 'division.created',
    entity: 'division',
    entityId: saved.id,
    entityLabel: saved.name,
    previousValue: previous,
    newValue: saved,
  })
  return saved
}

export async function deleteDivision(
  context: DataContext,
  session: AuthSession | null,
  divisionId: string,
): Promise<void> {
  const { repository } = context
  const division = await repository.getDivision(divisionId)
  if (!division) return
  await repository.deleteDivision(divisionId)
  await audit(context, session)({
    action: 'division.deleted',
    entity: 'division',
    entityId: divisionId,
    entityLabel: division.name,
    previousValue: division,
  })
}

export async function updateRankingConfig(
  context: DataContext,
  session: AuthSession | null,
  updates: Array<{ scope: string; key: string; value: number | boolean; previous: number | boolean }>,
): Promise<RecalculationSummary> {
  const { repository } = context
  await repository.updateConfig(
    updates.map(({ scope, key, value }) => ({ scope, key, value })),
    session?.userId ?? null,
  )
  // Configuration touches every division, so this is a full rebuild.
  const { summary } = await recalculate(context)
  await audit(context, session)({
    action: 'config.updated',
    entity: 'ranking_config',
    entityLabel: `${updates.length} setting${updates.length === 1 ? '' : 's'}`,
    previousValue: Object.fromEntries(updates.map((u) => [u.key, u.previous])),
    newValue: Object.fromEntries(updates.map((u) => [u.key, u.value])),
  })
  return summary
}

export async function recalculateAll(
  context: DataContext,
  session: AuthSession | null,
): Promise<RecalculationSummary> {
  const { summary } = await recalculate(context)
  await audit(context, session)({
    action: 'rankings.recalculated',
    entity: 'rankings',
    entityLabel: `${summary.divisions} divisions · ${summary.fighters} fighters`,
    newValue: summary,
  })
  return summary
}

export async function updateUserRole(
  context: DataContext,
  session: AuthSession | null,
  userId: string,
  role: 'admin' | 'editor' | 'viewer',
): Promise<void> {
  const users = await context.repository.listUsers()
  const target = users.find((u) => u.id === userId)
  await context.repository.updateUserRole(userId, role)
  await audit(context, session)({
    action: 'user.role_changed',
    entity: 'profile',
    entityId: userId,
    entityLabel: target?.email ?? userId,
    previousValue: target?.role,
    newValue: role,
  })
}
