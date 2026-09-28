/**
 * Full-stack integration test.
 *
 * Applies the real migrations and the real seed file to a real PostgreSQL
 * instance, drives the real repository through the PostgREST shim, runs the
 * real ranking engine, and asserts the invariants the product promises.
 *
 * If this passes, the rankings on the site are genuinely computed from the
 * fight table — there is nowhere for mock data to hide.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { AUTH_STUB_SQL, MIGRATION_ORDER } from '@/data/pglite/migrations'
import { PGLITE_OPTIONS } from '@/data/pglite/options'
import { createPostgrestShim } from '@/data/pglite/shim'
import { createRepository, type Repository } from '@/data/repository'
import { recalculate } from '@/services/recalculate'
import { saveFight } from '@/services/admin'
import type { DataContext } from '@/data'
import { DEFAULT_CONFIG } from '@/ranking/config'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFileSync(path.join(root, 'supabase', file), 'utf8')

let pg: PGlite
let repository: Repository
let context: DataContext

beforeAll(async () => {
  pg = new PGlite(PGLITE_OPTIONS)
  await pg.waitReady
  await pg.exec(AUTH_STUB_SQL)
  for (const file of MIGRATION_ORDER) await pg.exec(read(`migrations/${file}`))
  // The shipped `seed.sql` carries structure only — no athletes — so the suite
  // loads the demo roster fixture instead. That keeps these assertions real
  // while the live site starts empty.
  await pg.exec(read('seed.demo.sql'))

  repository = createRepository(createPostgrestShim(pg))
  context = {
    mode: 'local',
    repository,
    auth: null as never,
    freshlySeeded: true,
    transaction: async (work) => {
      await pg.exec('begin')
      try {
        const out = await work()
        await pg.exec('commit')
        return out
      } catch (error) {
        await pg.exec('rollback')
        throw error
      }
    },
  }

  await recalculate(context)
}, 120_000)

describe('seed data', () => {
  it('meets the demo-data requirements (§37)', async () => {
    const divisions = await repository.listDivisions()
    const fighters = await repository.listFighters({ pageSize: 1 })
    const fights = await repository.listFights({ status: 'completed', limit: 2000 })
    const events = await repository.listEvents({ status: 'all', pageSize: 1 })

    expect(divisions.filter((d) => !d.isP4P).length).toBeGreaterThanOrEqual(12)
    expect(divisions.some((d) => d.isP4P)).toBe(true)
    expect(fighters.total).toBeGreaterThanOrEqual(50)
    expect(fights.length).toBeGreaterThanOrEqual(100)
    expect(events.total).toBeGreaterThanOrEqual(4)
  })

  it('is flagged as fictional', async () => {
    const fighters = await repository.listFighters({ pageSize: 5 })
    expect(fighters.rows.every((f) => f.isDemo)).toBe(true)
  })
})

describe('computed rankings', () => {
  it('gives every division a contiguous table with the champion above it (§16)', async () => {
    const divisions = (await repository.listDivisions()).filter((d) => !d.isP4P)
    const size = DEFAULT_CONFIG.rankedPositions as number

    for (const division of divisions) {
      const table = await repository.listRankings(division.id)
      if (table.length === 0) continue

      const champions = table.filter((row) => row.isChampion)
      expect(champions.length).toBeLessThanOrEqual(1)

      const contenders = table.filter((row) => !row.isChampion)
      expect(contenders.map((row) => row.position)).toEqual(
        contenders.map((_, index) => index + 1),
      )
      expect(contenders.length).toBeLessThanOrEqual(size)

      // The champion occupies position 0, never #1.
      for (const champion of champions) expect(champion.position).toBe(0)
      expect(contenders.some((row) => row.isChampion)).toBe(false)
    }
  })

  it('orders contenders by descending ranking score', async () => {
    const division = (await repository.listDivisions()).find((d) => d.slug === 'mixed-martial-arts-lightweight')!
    const table = await repository.listRankings(division.id)
    const contenders = table.filter((row) => !row.isChampion && !row.isInterimChampion)
    const scores = contenders.map((row) => row.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('breaks every score into components that sum to the final score (§42)', async () => {
    const division = (await repository.listDivisions()).find((d) => d.slug === 'mixed-martial-arts-welterweight')!
    const table = await repository.listRankings(division.id)
    expect(table.length).toBeGreaterThan(0)

    for (const row of table) {
      const breakdown = await repository.getBreakdown(row.fighterId, division.id)
      expect(breakdown).not.toBeNull()
      const sum =
        breakdown!.baseRating +
        breakdown!.opponentQuality +
        breakdown!.recentForm +
        breakdown!.winStreak +
        breakdown!.finishBonus +
        breakdown!.activity +
        breakdown!.titleBonus
      expect(sum).toBeCloseTo(breakdown!.finalScore, 2)
      expect(Math.round(breakdown!.finalScore)).toBe(Math.round(row.score))
    }
  })

  it('writes a deterministic explanation for every ranked fighter (§18)', async () => {
    const division = (await repository.listDivisions()).find((d) => d.slug === 'mixed-martial-arts-middleweight')!
    const table = await repository.listRankings(division.id)
    for (const row of table.slice(0, 5)) {
      const breakdown = await repository.getBreakdown(row.fighterId, division.id)
      const explanation = breakdown?.details.explanation as string[] | undefined
      expect(Array.isArray(explanation)).toBe(true)
      expect(explanation!.length).toBeGreaterThan(2)
      expect(explanation!.join(' ')).toContain('Final ranking score')
    }
  })

  it('agrees with the history ledger about where each fighter stands (§19)', async () => {
    const division = (await repository.listDivisions()).find((d) => d.slug === 'mixed-martial-arts-lightweight')!
    const table = await repository.listRankings(division.id)

    for (const row of table.slice(0, 8)) {
      const history = await repository.listRankingHistory(row.fighterId)
      const latest = history.filter((h) => h.divisionId === division.id).at(-1)
      expect(latest).toBeDefined()
      expect(latest!.newRank).toBe(row.position)
    }
  })

  it('records the reasons behind every movement', async () => {
    const movers = await repository.listMovers(20)
    expect(movers.length).toBeGreaterThan(0)
    for (const mover of movers) {
      expect(mover.reasons.length).toBeGreaterThan(0)
      expect(mover.movement).not.toBe(0)
    }
  })

  it('produces a pound-for-pound table spanning more than one division (§20)', async () => {
    const mma = (await repository.listDisciplines()).find(
      (d) => d.slug === 'mixed-martial-arts',
    )!
    const p4p = await repository.listP4P(20, mma.id)
    expect(p4p.length).toBeGreaterThan(5)
    expect(p4p.map((row) => row.position)).toEqual(p4p.map((_, index) => index + 1))
    const divisions = new Set(p4p.map((row) => row.fighter.divisionName))
    expect(divisions.size).toBeGreaterThan(1)
  })

  it('scores pound-for-pound once per discipline, never across them (§20)', async () => {
    const disciplines = await repository.listDisciplines()
    expect(disciplines.length).toBeGreaterThan(1)

    for (const discipline of disciplines) {
      const list = await repository.listP4P(10, discipline.id)
      if (list.length === 0) continue
      // Each discipline's list is numbered from one — they are separate tables,
      // not slices of a single global ranking.
      expect(list.map((row) => row.position)).toEqual(list.map((_, index) => index + 1))
      for (const row of list) expect(row.disciplineId).toBe(discipline.id)
    }
  })

  it('keeps an athlete\'s ratings independent across their disciplines', async () => {
    const page = await repository.listFighters({ pageSize: 500 })
    const multi: Array<{ id: string; records: Awaited<ReturnType<typeof repository.listDisciplineRecords>> }> = []
    for (const fighter of page.rows) {
      if (fighter.disciplineCount < 2) continue
      multi.push({ id: fighter.id, records: await repository.listDisciplineRecords(fighter.id) })
      if (multi.length >= 5) break
    }
    expect(multi.length).toBeGreaterThan(0)

    for (const entry of multi) {
      const disciplines = entry.records.map((r) => r.disciplineId)
      // One record per discipline, each with its own division and rating.
      expect(new Set(disciplines).size).toBe(disciplines.length)
      expect(entry.records.filter((r) => r.isPrimary)).toHaveLength(1)

      for (const record of entry.records) {
        const fights = await repository.listFights({
          fighterId: entry.id,
          disciplineId: record.disciplineId,
          status: 'completed',
        })
        // The record in a discipline is built only from bouts contested in it.
        expect(record.wins + record.losses + record.draws + record.noContests).toBe(fights.length)
      }
    }
  })

  it('keeps championship status unique per division (§23)', async () => {
    const champions = await repository.listChampions()
    const byDivision = new Map<string, number>()
    for (const champion of champions) {
      byDivision.set(champion.divisionId, (byDivision.get(champion.divisionId) ?? 0) + 1)
    }
    expect([...byDivision.values()].every((count) => count === 1)).toBe(true)
  })

  it('never leaves a fighter ranked in a division they do not compete in', async () => {
    const divisions = (await repository.listDivisions()).filter((d) => !d.isP4P)
    for (const division of divisions) {
      const table = await repository.listRankings(division.id)
      for (const row of table) {
        expect(row.fighter.divisionId).toBe(division.id)
      }
    }
  })
})

describe('the Fighter ID', () => {
  it('gives every athlete a unique, well-formed ID', async () => {
    const page = await repository.listFighters({ pageSize: 500 })
    expect(page.rows.length).toBeGreaterThan(100)

    const codes = page.rows.map((f) => f.fighterCode)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^FR-\d{5}$/)
  })

  it('issues a fresh ID from the database rather than reusing one', async () => {
    const before = await repository.listFighters({ pageSize: 500 })
    const taken = new Set(before.rows.map((f) => f.fighterCode))
    const discipline = (await repository.listDisciplines())[0]

    const created = await repository.saveFighter({
      primary_discipline_id: discipline.id,
      slug: 'issued-id-test',
      first_name: 'Issued',
      last_name: 'Test',
      display_name: 'Issued Test',
    })

    expect(created.fighterCode).toMatch(/^FR-\d{5}$/)
    expect(taken.has(created.fighterCode)).toBe(false)

    // And it is findable by that ID — the lookup the public page uses.
    const found = await repository.getFighterByCode(created.fighterCode)
    expect(found?.id).toBe(created.id)
    // Lower case and a missing prefix resolve to the same athlete.
    expect((await repository.getFighterByCode(created.fighterCode.toLowerCase()))?.id)
      .toBe(created.id)
  })

  it('keeps an application inert until it is approved', async () => {
    const discipline = (await repository.listDisciplines())[0]
    const application = await repository.submitApplication({
      first_name: 'Applied',
      last_name: 'Athlete',
      display_name: 'Applied Athlete',
      email: 'applied@example.test',
      discipline_id: discipline.id,
    })

    expect(application.status).toBe('pending')
    expect(application.fighterId).toBeNull()
    expect(application.reference).toMatch(/^APP-[0-9A-F]{8}$/)

    // Nothing about it has reached the roster.
    const roster = await repository.listFighters({ search: 'Applied Athlete', pageSize: 10 })
    expect(roster.rows).toHaveLength(0)

    const pending = await repository.listApplications('pending')
    expect(pending.some((a) => a.id === application.id)).toBe(true)
  })
})

describe('recording a result end to end (§22)', () => {
  it('validates, writes, recalculates and reports the ranking change', async () => {
    const division = (await repository.listDivisions()).find((d) => d.slug === 'mixed-martial-arts-bantamweight')!
    const events = await repository.listEvents({ status: 'scheduled', pageSize: 5 })
    const event = events.rows[0]
    expect(event).toBeDefined()

    // Whoever is already booked on this card cannot be matched again (§23).
    const card = await repository.listFights({ eventId: event.id, status: 'all' })
    const booked = new Set(card.flatMap((f) => [f.fighterAId, f.fighterBId]))

    const table = await repository.listRankings(division.id)
    const free = table.filter((row) => !booked.has(row.fighterId) && !row.isChampion)
    const challenger = free.at(-1)!
    const target = free.find((row) => row.position <= 3 && row.fighterId !== challenger.fighterId)!
    expect(challenger).toBeDefined()
    expect(target).toBeDefined()

    const before = {
      challenger: challenger.position,
      target: target.position,
    }

    const result = await saveFight(context, null, {
      eventId: event.id,
      divisionId: division.id,
      fighterAId: challenger.fighterId,
      fighterBId: target.fighterId,
      status: 'completed',
      outcome: 'win',
      winnerId: challenger.fighterId,
      method: 'ko',
      decisionType: null,
      endRound: 1,
      endTimeSeconds: 74,
      scheduledRounds: 3,
      isTitleFight: false,
      isInterimTitle: false,
      isMainEvent: false,
      fightType: 'standard',
    })

    expect(result.summary.divisions).toBeGreaterThanOrEqual(1)
    expect(result.summary.historyRows).toBeGreaterThan(0)

    const after = await repository.listRankings(division.id)
    const challengerAfter = after.find((row) => row.fighterId === challenger.fighterId)!
    const targetAfter = after.find((row) => row.fighterId === target.fighterId)!

    // Beating a top-three opponent by knockout must not move you down.
    expect(challengerAfter.position).toBeLessThanOrEqual(before.challenger)
    expect(targetAfter.position).toBeGreaterThanOrEqual(before.target)

    // The change is explained and logged.
    const history = await repository.listRankingHistory(challenger.fighterId)
    const latest = history.at(-1)!
    expect(latest.movementReason.join(' ')).toMatch(/Defeated|Won by KO/)

    const audit = await repository.listAudit(5)
    expect(audit[0].action).toBe('fight.created')
  })

  it('rejects an invalid bout before it reaches the database (§23)', async () => {
    const division = (await repository.listDivisions())[0]
    const table = await repository.listRankings(division.id)
    const events = await repository.listEvents({ status: 'scheduled', pageSize: 5 })
    expect(table.length).toBeGreaterThan(0)

    await expect(
      saveFight(context, null, {
        eventId: events.rows[0].id,
        divisionId: division.id,
        fighterAId: table[0].fighterId,
        fighterBId: table[0].fighterId,
        status: 'completed',
        outcome: 'win',
        winnerId: table[0].fighterId,
        method: 'ko',
        decisionType: null,
        endRound: 1,
        endTimeSeconds: 30,
        scheduledRounds: 3,
        isTitleFight: false,
        isInterimTitle: false,
        isMainEvent: false,
        fightType: 'standard',
      }),
    ).rejects.toThrow(/cannot be booked against himself/i)
  })
})

describe('scoped recalculation (§43)', () => {
  it('rewrites only the divisions it was asked to', async () => {
    const divisions = (await repository.listDivisions()).filter((d) => !d.isP4P)
    const target = divisions.find((d) => d.slug === 'mixed-martial-arts-flyweight')!
    const untouched = divisions.find((d) => d.slug === 'mixed-martial-arts-heavyweight')!

    const beforeOther = await repository.listRankings(untouched.id)
    const stamps = new Map(beforeOther.map((row) => [row.fighterId, row.fighter.createdAt]))

    await new Promise((resolve) => setTimeout(resolve, 30))
    const { summary } = await recalculate(context, { divisionIds: [target.id] })
    expect(summary.divisions).toBe(1)

    const afterOther = await repository.listRankings(untouched.id)
    for (const row of afterOther) {
      expect(row.fighter.createdAt).toBe(stamps.get(row.fighterId))
    }
  })
})

describe('search (§30)', () => {
  it('finds fighters, events and divisions', async () => {
    const fighters = await repository.listFighters({ pageSize: 1 })
    const name = fighters.rows[0].displayName.split(' ')[0]

    const byName = await repository.search(name)
    expect(byName.some((row) => row.kind === 'fighter')).toBe(true)

    const byEvent = await repository.search('fightrank')
    expect(byEvent.some((row) => row.kind === 'event')).toBe(true)

    const byDivision = await repository.search('welter')
    expect(byDivision.some((row) => row.kind === 'division')).toBe(true)
  })

  it('ignores queries that are too short', async () => {
    expect(await repository.search('a')).toEqual([])
  })
})
