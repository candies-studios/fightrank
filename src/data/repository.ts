/**
 * The single data-access implementation.
 *
 * Written once against the PostgREST surface, so it runs unchanged against
 * Supabase and against the local PGlite demo database. Every join is resolved
 * by a database view; this layer only filters, sorts and paginates.
 */

import type {
  AuditEntry,
  Championship,
  Discipline,
  DisciplineRecord,
  Division,
  Fight,
  FightEvent,
  FightWithContext,
  FighterApplication,
  FighterProfile,
  Mover,
  P4PRow,
  RankingHistoryEntry,
  RankingRow,
  ScoreBreakdown,
  UserProfile,
  UserRole,
} from '@/types/domain'
import type {
  AuditLogRow,
  ChampionshipRow,
  DisciplineRow,
  DivisionRow,
  FighterDisciplineRow,
  EventCardRow,
  EventRow,
  FightDetailRow,
  FightRow,
  FighterApplicationRow,
  FighterProfileRow,
  P4PTableRow,
  ProfileRow,
  RankingBreakdownRow,
  RankingConfigRow,
  RankingHistoryDetailRow,
  RankingTableRow,
  SearchIndexRow,
} from '@/types/db'
import type { RankingConfig } from '@/ranking/config'
import type { PostgrestLike } from './postgrest'
import { unwrap } from './postgrest'
import {
  dec,
  mapApplication,
  mapAudit,
  mapBreakdown,
  mapBreakdownFromRankingRow,
  mapChampionship,
  mapDiscipline,
  mapDisciplineRecord,
  mapDivision,
  mapEvent,
  mapEventCard,
  mapFight,
  mapFightDetail,
  mapFighterProfile,
  mapHistory,
  mapP4P,
  mapP4PToProfile,
  mapProfile,
  mapRankingEntry,
  mapRankingRowToProfile,
  type EventCard,
} from './mappers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value: string): boolean => UUID_RE.test(value)

export interface Paged<T> {
  rows: T[]
  total: number
}

export interface FighterQuery {
  disciplineId?: string | null
  divisionId?: string | null
  search?: string
  activeOnly?: boolean
  rankedOnly?: boolean
  page?: number
  pageSize?: number
  sort?: 'rank' | 'rating' | 'name' | 'recent'
}

export interface EventQuery {
  status?: 'scheduled' | 'completed' | 'all'
  page?: number
  pageSize?: number
}

export interface FightQuery {
  eventId?: string
  fighterId?: string
  disciplineId?: string
  divisionId?: string
  status?: 'scheduled' | 'completed' | 'all'
  limit?: number
  offset?: number
}

export interface DashboardStats {
  fighters: number
  fights: number
  events: number
  champions: number
  divisions: number
  disciplines: number
  lastRecalculation: string | null
}

export interface SearchResult {
  kind: 'fighter' | 'event' | 'division' | 'discipline'
  id: string
  slug: string
  label: string
  sublabel: string | null
  imageUrl: string | null
  countryCode: string | null
}

export function createRepository(db: PostgrestLike) {
  // --- disciplines ----------------------------------------------------------
  async function listDisciplines(includeInactive = false): Promise<Discipline[]> {
    let query = db.from<DisciplineRow>('disciplines').select('*').order('sort_order')
    if (!includeInactive) query = query.eq('is_active', true)
    return (await unwrap(query)).map(mapDiscipline)
  }

  async function getDiscipline(idOrSlug: string): Promise<Discipline | null> {
    const { data, error } = await db
      .from<DisciplineRow>('disciplines')
      .select('*')
      .eq(isUuid(idOrSlug) ? 'id' : 'slug', idOrSlug)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? mapDiscipline(data) : null
  }

  async function saveDiscipline(input: Record<string, unknown>): Promise<Discipline> {
    const rows = await unwrap(
      input.id
        ? db.from<DisciplineRow>('disciplines').update(input).eq('id', input.id as string)
        : db.from<DisciplineRow>('disciplines').insert(input),
    )
    return mapDiscipline(rows[0])
  }

  async function deleteDiscipline(id: string): Promise<void> {
    await unwrap(db.from('disciplines').delete().eq('id', id))
  }

  /**
   * Every athlete's registration in every discipline — the engine's roster.
   * Read from the view so the engine gets display names without a second pass.
   */
  async function loadRegistrations(): Promise<FighterDisciplineRow[]> {
    return unwrap(
      db
        .from<FighterDisciplineRow>('fighter_discipline_profiles')
        .select('*')
        .order('discipline_sort_order', { ascending: true }),
    )
  }

  /** Every record held under one Fighter ID, best discipline first. */
  async function listDisciplineRecords(fighterId: string): Promise<DisciplineRecord[]> {
    const rows = await unwrap(
      db
        .from<FighterDisciplineRow>('fighter_discipline_profiles')
        .select('*')
        .eq('fighter_id', fighterId)
        .order('discipline_sort_order', { ascending: true }),
    )
    return rows
      .map(mapDisciplineRecord)
      .sort(
        (a, b) =>
          Number(b.isPrimary) - Number(a.isPrimary) ||
          a.disciplineSortOrder - b.disciplineSortOrder,
      )
  }

  /** Everyone registered in one discipline — the discipline roster page. */
  async function listDisciplineRoster(disciplineId: string): Promise<DisciplineRecord[]> {
    const rows = await unwrap(
      db
        .from<FighterDisciplineRow>('fighter_discipline_profiles')
        .select('*')
        .eq('discipline_id', disciplineId)
        .order('ranking_score', { ascending: false }),
    )
    return rows.map(mapDisciplineRecord)
  }

  /** Register an athlete in a discipline (or move them between divisions). */
  async function saveDisciplineRecord(input: Record<string, unknown>): Promise<void> {
    await unwrap(
      db
        .from<FighterDisciplineRow>('fighter_disciplines')
        .upsert(input, { onConflict: 'fighter_id,discipline_id' }),
    )
    await unwrap(
      db.from('fighter_stats').upsert(
        { fighter_id: input.fighter_id, discipline_id: input.discipline_id },
        { onConflict: 'fighter_id,discipline_id' },
      ),
    )
  }

  async function deleteDisciplineRecord(fighterId: string, disciplineId: string): Promise<void> {
    await unwrap(
      db
        .from('fighter_disciplines')
        .delete()
        .eq('fighter_id', fighterId)
        .eq('discipline_id', disciplineId),
    )
  }

  // --- Fighter ID applications ---------------------------------------------
  /**
   * Submit a request for a Fighter ID. This is the one write an anonymous
   * visitor is allowed to make, and it creates a request — never an athlete.
   */
  async function submitApplication(
    input: Record<string, unknown>,
  ): Promise<FighterApplication> {
    const rows = await unwrap(
      db.from<FighterApplicationRow>('fighter_applications').insert(input),
    )
    return mapApplication(rows[0])
  }

  async function listApplications(
    status?: 'pending' | 'approved' | 'declined',
  ): Promise<FighterApplication[]> {
    let builder = db.from<FighterApplicationRow>('fighter_applications').select('*')
    if (status) builder = builder.eq('status', status)
    const rows = await unwrap(builder.order('created_at', { ascending: false }))
    return rows.map(mapApplication)
  }

  async function updateApplication(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<FighterApplication> {
    const rows = await unwrap(
      db.from<FighterApplicationRow>('fighter_applications').update(patch).eq('id', id),
    )
    return mapApplication(rows[0])
  }

  /** Look an athlete up by their Fighter ID (FR-00123). */
  async function getFighterByCode(code: string): Promise<FighterProfile | null> {
    const { data, error } = await db
      .from<FighterProfileRow>('fighter_profiles')
      .select('*')
      .eq('fighter_code', code.trim().toUpperCase())
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? mapFighterProfile(data) : null
  }

  // --- divisions ------------------------------------------------------------
  async function listDivisions(
    includeInactive = false,
    disciplineId?: string | null,
  ): Promise<Division[]> {
    let query = db.from<DivisionRow>('divisions').select('*').order('sort_order')
    if (!includeInactive) query = query.eq('is_active', true)
    if (disciplineId) query = query.eq('discipline_id', disciplineId)
    return (await unwrap(query)).map(mapDivision)
  }

  async function getDivision(idOrSlug: string): Promise<Division | null> {
    const query = db
      .from<DivisionRow>('divisions')
      .select('*')
      .eq(isUuid(idOrSlug) ? 'id' : 'slug', idOrSlug)
      .maybeSingle()
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ? mapDivision(data) : null
  }

  async function saveDivision(input: Record<string, unknown>): Promise<Division> {
    const rows = await unwrap(
      input.id
        ? db.from<DivisionRow>('divisions').update(input).eq('id', input.id as string)
        : db.from<DivisionRow>('divisions').insert(input),
    )
    return mapDivision(rows[0])
  }

  async function deleteDivision(id: string): Promise<void> {
    await unwrap(db.from('divisions').delete().eq('id', id))
  }

  // --- fighters -------------------------------------------------------------
  async function listFighters(query: FighterQuery = {}): Promise<Paged<FighterProfile>> {
    const pageSize = query.pageSize ?? 24
    const page = query.page ?? 0

    let builder = db
      .from<FighterProfileRow>('fighter_profiles')
      .select('*', { count: 'exact' })

    if (query.disciplineId) builder = builder.eq('primary_discipline_id', query.disciplineId)
    if (query.divisionId) builder = builder.eq('division_id', query.divisionId)
    if (query.activeOnly) builder = builder.eq('is_active', true)
    if (query.rankedOnly) builder = builder.not('current_rank', 'is', null)
    if (query.search?.trim()) {
      builder = builder.ilike('display_name', `%${query.search.trim()}%`)
    }

    switch (query.sort ?? 'rank') {
      case 'name':
        builder = builder.order('display_name', { ascending: true })
        break
      case 'recent':
        builder = builder.order('last_fight_date', { ascending: false })
        break
      case 'rating':
        builder = builder.order('rating', { ascending: false })
        break
      default:
        builder = builder
          .order('current_rank', { ascending: true, nullsFirst: false })
          .order('ranking_score', { ascending: false })
    }

    const res = await builder.range(page * pageSize, page * pageSize + pageSize - 1)
    if (res.error) throw new Error(res.error.message)
    return { rows: res.data.map(mapFighterProfile), total: res.count ?? res.data.length }
  }

  async function getFighter(idOrSlug: string): Promise<FighterProfile | null> {
    const { data, error } = await db
      .from<FighterProfileRow>('fighter_profiles')
      .select('*')
      .eq(isUuid(idOrSlug) ? 'id' : 'slug', idOrSlug)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? mapFighterProfile(data) : null
  }

  async function getFightersByIds(ids: string[]): Promise<FighterProfile[]> {
    if (ids.length === 0) return []
    const rows = await unwrap(
      db.from<FighterProfileRow>('fighter_profiles').select('*').in('id', ids),
    )
    return rows.map(mapFighterProfile)
  }

  async function saveFighter(input: Record<string, unknown>): Promise<FighterProfile> {
    const id = input.id as string | undefined
    const rows = await unwrap(
      id
        ? db.from<{ id: string }>('fighters').update(input).eq('id', id)
        : db.from<{ id: string }>('fighters').insert(input),
    )
    const savedId = rows[0]?.id ?? id
    if (savedId) {
      await db.from('fighter_stats').upsert({ fighter_id: savedId }, { onConflict: 'fighter_id' })
    }
    const fighter = await getFighter(savedId as string)
    if (!fighter) throw new Error('Fighter could not be loaded after saving.')
    return fighter
  }

  async function deleteFighter(id: string): Promise<void> {
    await unwrap(db.from('fighters').delete().eq('id', id))
  }

  // --- events ---------------------------------------------------------------
  async function listEvents(query: EventQuery = {}): Promise<Paged<EventCard>> {
    const pageSize = query.pageSize ?? 12
    const page = query.page ?? 0
    let builder = db.from<EventCardRow>('event_cards').select('*', { count: 'exact' })
    if (query.status && query.status !== 'all') builder = builder.eq('status', query.status)
    const res = await builder
      .order('event_date', { ascending: query.status === 'scheduled' })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (res.error) throw new Error(res.error.message)
    return { rows: res.data.map(mapEventCard), total: res.count ?? res.data.length }
  }

  async function getEvent(idOrSlug: string): Promise<EventCard | null> {
    const { data, error } = await db
      .from<EventCardRow>('event_cards')
      .select('*')
      .eq(isUuid(idOrSlug) ? 'id' : 'slug', idOrSlug)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? mapEventCard(data) : null
  }

  async function saveEvent(input: Record<string, unknown>): Promise<FightEvent> {
    const rows = await unwrap(
      input.id
        ? db.from<EventRow>('events').update(input).eq('id', input.id as string)
        : db.from<EventRow>('events').insert(input),
    )
    return mapEvent(rows[0])
  }

  async function deleteEvent(id: string): Promise<void> {
    await unwrap(db.from('events').delete().eq('id', id))
  }

  // --- fights ---------------------------------------------------------------
  async function listFights(query: FightQuery = {}): Promise<FightWithContext[]> {
    const scoped = () => {
      let b = db.from<FightDetailRow>('fight_details').select('*')
      if (query.eventId) b = b.eq('event_id', query.eventId)
      if (query.disciplineId) b = b.eq('discipline_id', query.disciplineId)
      if (query.divisionId) b = b.eq('division_id', query.divisionId)
      if (query.status && query.status !== 'all') b = b.eq('status', query.status)
      return b
    }

    let builder = scoped()
    if (query.fighterId) {
      // Two flat queries beat an `or` filter here and keep the shim simple.
      const [a, b] = await Promise.all([
        unwrap(builder.eq('fighter_a_id', query.fighterId)),
        unwrap(scoped().eq('fighter_b_id', query.fighterId)),
      ])
      return [...a, ...b]
        .sort((x, y) => y.event_date.localeCompare(x.event_date) || x.bout_order - y.bout_order)
        .slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 200))
        .map(mapFightDetail)
    }

    builder = builder
      .order('event_date', { ascending: false })
      .order('bout_order', { ascending: true })
    if (query.limit) builder = builder.limit(query.limit)
    return (await unwrap(builder)).map(mapFightDetail)
  }

  async function getFight(id: string): Promise<FightWithContext | null> {
    const { data, error } = await db
      .from<FightDetailRow>('fight_details')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? mapFightDetail(data) : null
  }

  async function saveFight(input: Record<string, unknown>): Promise<Fight> {
    const rows = await unwrap(
      input.id
        ? db.from<FightRow>('fights').update(input).eq('id', input.id as string)
        : db.from<FightRow>('fights').insert(input),
    )
    return mapFight(rows[0])
  }

  async function deleteFight(id: string): Promise<void> {
    await unwrap(db.from('fights').delete().eq('id', id))
  }

  /** Raw fight rows for the ranking engine — every completed bout, ever. */
  async function loadAllFights(): Promise<FightDetailRow[]> {
    return unwrap(
      db
        .from<FightDetailRow>('fight_details')
        .select('*')
        .eq('status', 'completed')
        .order('event_date', { ascending: true })
        .order('bout_order', { ascending: true }),
    )
  }

  async function loadAllFighters(): Promise<FighterProfileRow[]> {
    return unwrap(db.from<FighterProfileRow>('fighter_profiles').select('*'))
  }

  // --- rankings -------------------------------------------------------------
  async function listRankings(divisionId: string): Promise<RankingRow[]> {
    const rows = await unwrap(
      db
        .from<RankingTableRow>('ranking_table')
        .select('*')
        .eq('division_id', divisionId)
        .order('position', { ascending: true }),
    )
    return rows.map((row) => ({
      ...mapRankingEntry(row),
      fighter: mapRankingRowToProfile(row),
      breakdown: mapBreakdownFromRankingRow(row),
    }))
  }

  async function listAllRankings(disciplineId?: string | null): Promise<RankingRow[]> {
    let builder = db.from<RankingTableRow>('ranking_table').select('*')
    if (disciplineId) builder = builder.eq('discipline_id', disciplineId)
    const rows = await unwrap(
      builder
        .order('discipline_sort_order', { ascending: true })
        .order('division_sort_order', { ascending: true })
        .order('position', { ascending: true }),
    )
    return rows.map((row) => ({
      ...mapRankingEntry(row),
      fighter: mapRankingRowToProfile(row),
      breakdown: mapBreakdownFromRankingRow(row),
    }))
  }

  async function listChampions(disciplineId?: string | null): Promise<RankingRow[]> {
    let builder = db.from<RankingTableRow>('ranking_table').select('*').eq('is_champion', true)
    if (disciplineId) builder = builder.eq('discipline_id', disciplineId)
    const rows = await unwrap(
      builder
        .order('discipline_sort_order', { ascending: true })
        .order('division_sort_order', { ascending: true }),
    )
    return rows.map((row) => ({
      ...mapRankingEntry(row),
      fighter: mapRankingRowToProfile(row),
      breakdown: mapBreakdownFromRankingRow(row),
    }))
  }

  /**
   * Pound-for-pound is per discipline — comparing a grappler to a kickboxer
   * would be exactly the apples-to-oranges the two-layer model exists to avoid.
   * With no discipline given, every discipline's list comes back in order.
   */
  async function listP4P(limit = 15, disciplineId?: string | null): Promise<P4PRow[]> {
    let builder = db.from<P4PTableRow>('p4p_table').select('*')
    if (disciplineId) builder = builder.eq('discipline_id', disciplineId)
    const rows = await unwrap(builder.order('position', { ascending: true }))
    const byDiscipline = new Map<string, P4PTableRow[]>()
    for (const row of rows) {
      const list = byDiscipline.get(row.discipline_id) ?? []
      list.push(row)
      byDiscipline.set(row.discipline_id, list)
    }
    return [...byDiscipline.values()]
      .flatMap((list) => list.slice(0, limit))
      .map((row) => ({ ...mapP4P(row), fighter: mapP4PToProfile(row) }))
  }

  async function getBreakdown(
    fighterId: string,
    divisionId?: string | null,
    disciplineId?: string | null,
  ): Promise<ScoreBreakdown | null> {
    let builder = db.from<RankingBreakdownRow>('ranking_breakdowns').select('*').eq('fighter_id', fighterId)
    if (divisionId) builder = builder.eq('division_id', divisionId)
    if (disciplineId) builder = builder.eq('discipline_id', disciplineId)
    const rows = await unwrap(builder.limit(1))
    return rows[0] ? mapBreakdown(rows[0]) : null
  }

  async function listRankingHistory(
    fighterId: string,
    disciplineId?: string | null,
  ): Promise<RankingHistoryEntry[]> {
    let builder = db
      .from<RankingHistoryDetailRow>('ranking_history_details')
      .select('*')
      .eq('fighter_id', fighterId)
    if (disciplineId) builder = builder.eq('discipline_id', disciplineId)
    const rows = await unwrap(builder.order('effective_date', { ascending: true }))
    return rows.map(mapHistory)
  }

  async function listEventRankingChanges(eventId: string): Promise<Mover[]> {
    const rows = await unwrap(
      db
        .from<RankingHistoryDetailRow>('ranking_history_details')
        .select('*')
        .eq('event_id', eventId)
        .order('movement', { ascending: false }),
    )
    return rowsToMovers(rows)
  }

  /**
   * Movement caused by *results*. Rows with no event behind them come from the
   * inactivity pass, which belongs on a fighter's profile rather than in a
   * "biggest movers" widget.
   */
  async function listMovers(limit = 8, disciplineId?: string | null): Promise<Mover[]> {
    let builder = db
      .from<RankingHistoryDetailRow>('ranking_history_details')
      .select('*')
      .neq('movement', 0)
      .not('event_id', 'is', null)
    if (disciplineId) builder = builder.eq('discipline_id', disciplineId)
    const rows = await unwrap(builder.order('effective_date', { ascending: false }).limit(400))
    if (rows.length === 0) return []
    const latestDate = rows[0].effective_date
    const window = rows.filter((r) => r.effective_date >= latestDate)
    const pool = window.length >= limit ? window : rows
    const seen = new Set<string>()
    return rowsToMovers(
      pool
        .filter((r) => {
          if (seen.has(r.fighter_id)) return false
          seen.add(r.fighter_id)
          return true
        })
        .sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement))
        .slice(0, limit),
    )
  }

  function rowsToMovers(rows: RankingHistoryDetailRow[]): Mover[] {
    return rows.map((row) => ({
      fighter: {
        id: row.fighter_id,
        slug: row.fighter_slug,
        displayName: row.fighter_name,
        photoUrl: row.fighter_photo,
        countryCode: row.fighter_country_code,
      } as unknown as FighterProfile,
      disciplineId: row.discipline_id,
      disciplineName: row.discipline_name,
      disciplineSlug: row.discipline_slug,
      divisionId: row.division_id,
      divisionName: row.division_name,
      previousRank: row.previous_rank,
      newRank: row.new_rank,
      movement: row.movement,
      movementLabel: row.movement_label,
      reasons: row.movement_reason ?? [],
      effectiveDate: row.effective_date,
    }))
  }

  async function listChampionships(
    divisionId?: string,
    disciplineId?: string | null,
  ): Promise<Championship[]> {
    let builder = db.from<ChampionshipRow>('championships').select('*')
    if (divisionId) builder = builder.eq('division_id', divisionId)
    if (disciplineId) builder = builder.eq('discipline_id', disciplineId)
    const rows = await unwrap(builder.order('won_at', { ascending: false }))
    return rows.map(mapChampionship)
  }

  // --- configuration --------------------------------------------------------
  async function listConfigRows(): Promise<RankingConfigRow[]> {
    return unwrap(
      db.from<RankingConfigRow>('ranking_config').select('*').order('sort_order', { ascending: true }),
    )
  }

  async function getConfig(): Promise<Partial<RankingConfig>> {
    const rows = await listConfigRows()
    const config: Record<string, number | boolean> = {}
    for (const row of rows) {
      config[row.key] =
        row.data_type === 'boolean' ? Boolean(row.value) : dec(row.value as number | string)
    }
    return config as Partial<RankingConfig>
  }

  async function updateConfig(
    updates: Array<{ scope: string; key: string; value: number | boolean }>,
    userId: string | null,
  ): Promise<void> {
    for (const update of updates) {
      await unwrap(
        db
          .from('ranking_config')
          .update({ value: update.value, updated_by: userId, updated_at: new Date().toISOString() })
          .eq('scope', update.scope)
          .eq('key', update.key),
      )
    }
  }

  // --- audit ----------------------------------------------------------------
  async function listAudit(limit = 100): Promise<AuditEntry[]> {
    const rows = await unwrap(
      db
        .from<AuditLogRow>('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
    )
    return rows.map(mapAudit)
  }

  async function writeAudit(entry: {
    userId: string | null
    userEmail: string | null
    action: string
    entity: string
    entityId?: string | null
    entityLabel?: string | null
    previousValue?: unknown
    newValue?: unknown
  }): Promise<void> {
    const { error } = await db.from('audit_log').insert({
      user_id: entry.userId,
      user_email: entry.userEmail,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      previous_value: entry.previousValue ?? null,
      new_value: entry.newValue ?? null,
    })
    // An audit failure must never take down the operation it describes, but it
    // must be visible.
    if (error) console.error('[audit] failed to record action:', error.message)
  }

  // --- users ----------------------------------------------------------------
  async function listUsers(): Promise<UserProfile[]> {
    const rows = await unwrap(
      db.from<ProfileRow>('profiles').select('*').order('created_at', { ascending: true }),
    )
    return rows.map(mapProfile)
  }

  async function updateUserRole(id: string, role: UserRole): Promise<void> {
    await unwrap(db.from('profiles').update({ role }).eq('id', id))
  }

  // --- search ---------------------------------------------------------------
  async function search(term: string, limit = 12): Promise<SearchResult[]> {
    const needle = term.trim().toLowerCase()
    if (needle.length < 2) return []
    const rows = await unwrap(
      db
        .from<SearchIndexRow>('search_index')
        .select('*')
        .ilike('search_text', `%${needle}%`)
        .limit(limit * 3),
    )
    const weight = (row: SearchIndexRow): number => {
      const label = row.label.toLowerCase()
      if (label.startsWith(needle)) return 0
      if (label.includes(needle)) return 1
      return 2
    }
    return rows
      .sort((a, b) => weight(a) - weight(b) || a.label.localeCompare(b.label))
      .slice(0, limit)
      .map((row) => ({
        kind: row.kind,
        id: row.id,
        slug: row.slug,
        label: row.label,
        sublabel: row.sublabel,
        imageUrl: row.image_url,
        countryCode: row.country_code,
      }))
  }

  // --- dashboard ------------------------------------------------------------
  async function dashboardStats(): Promise<DashboardStats> {
    const count = async (table: string, filter?: (b: ReturnType<typeof db.from>) => unknown) => {
      const builder = db.from(table).select('*', { count: 'exact', head: true })
      const applied = (filter ? (filter(builder as never) as typeof builder) : builder) ?? builder
      const res = await applied
      if (res.error) throw new Error(res.error.message)
      return res.count ?? 0
    }

    const [fighters, fights, events, divisions, disciplines] = await Promise.all([
      count('fighters'),
      count('fights'),
      count('events'),
      count('divisions'),
      count('disciplines'),
    ])

    const champions = await unwrap(
      db
        .from<{ id: string }>('championships')
        .select('*')
        .eq('is_current', true)
        .eq('kind', 'undisputed'),
    )

    const latest = await unwrap(
      db
        .from<{ computed_at: string }>('rankings')
        .select('*')
        .order('computed_at', { ascending: false })
        .limit(1),
    )

    return {
      fighters,
      fights,
      events,
      divisions,
      disciplines,
      champions: champions.length,
      lastRecalculation: latest[0]?.computed_at ?? null,
    }
  }

  return {
    raw: db,
    submitApplication,
    listApplications,
    updateApplication,
    getFighterByCode,
    listDisciplines,
    getDiscipline,
    saveDiscipline,
    deleteDiscipline,
    loadRegistrations,
    listDisciplineRecords,
    listDisciplineRoster,
    saveDisciplineRecord,
    deleteDisciplineRecord,
    listDivisions,
    getDivision,
    saveDivision,
    deleteDivision,
    listFighters,
    getFighter,
    getFightersByIds,
    saveFighter,
    deleteFighter,
    listEvents,
    getEvent,
    saveEvent,
    deleteEvent,
    listFights,
    getFight,
    saveFight,
    deleteFight,
    loadAllFights,
    loadAllFighters,
    listRankings,
    listAllRankings,
    listChampions,
    listP4P,
    getBreakdown,
    listRankingHistory,
    listEventRankingChanges,
    listMovers,
    listChampionships,
    listConfigRows,
    getConfig,
    updateConfig,
    listAudit,
    writeAudit,
    listUsers,
    updateUserRole,
    search,
    dashboardStats,
  }
}

export type Repository = ReturnType<typeof createRepository>
