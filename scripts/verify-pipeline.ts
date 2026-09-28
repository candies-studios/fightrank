/**
 * End-to-end check of the real stack, headless:
 *   migrations → seed → repository (via the PostgREST shim) → ranking engine →
 *   persisted rankings → read back through the public views.
 *
 * Run with: npm run db:pipeline
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { AUTH_STUB_SQL, MIGRATION_ORDER } from '../src/data/pglite/migrations'
import { PGLITE_OPTIONS } from '../src/data/pglite/options'
import { createPostgrestShim } from '../src/data/pglite/shim'
import { createRepository } from '../src/data/repository'
import { recalculate } from '../src/services/recalculate'
import type { DataContext } from '../src/data'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFileSync(path.join(root, 'supabase', file), 'utf8')

const pg = new PGlite(PGLITE_OPTIONS)
await pg.waitReady
await pg.exec(AUTH_STUB_SQL)
for (const file of MIGRATION_ORDER) await pg.exec(read(`migrations/${file}`))
// The shipped `seed.sql` carries structure only — no athletes — so these
// scripts load the demo roster fixture instead. Proving that a constraint
// bites requires rows for it to bite on.
await pg.exec(read('seed.demo.sql'))

const repository = createRepository(createPostgrestShim(pg))
const context: DataContext = {
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

console.log('Running full recalculation…')
const { summary } = await recalculate(context)
console.log(summary)

const disciplines = await repository.listDisciplines()
console.log(`\nDisciplines: ${disciplines.map((d) => d.shortCode).join(' · ')}`)

const divisions = await repository.listDivisions()
const lightweight = divisions.find((d) => d.slug === 'mixed-martial-arts-lightweight')!
const table = await repository.listRankings(lightweight.id)

console.log(`\nMMA ${lightweight.name.toUpperCase()}`)
for (const row of table) {
  const label = row.isChampion ? 'C' : `#${row.position}`
  const move =
    row.movementLabel === 'up'
      ? `▲${row.movement}`
      : row.movementLabel === 'down'
        ? `▼${Math.abs(row.movement)}`
        : row.movementLabel === 'new'
          ? 'NEW'
          : '—'
  console.log(
    `  ${label.padStart(3)}  ${row.fighter.displayName.padEnd(26)} ` +
      `${String(row.fighter.wins)}-${row.fighter.losses}-${row.fighter.draws}`.padEnd(9) +
      `score ${row.score.toFixed(0).padStart(5)}  rating ${row.rating.toFixed(0)}  ${move}`,
  )
}

for (const discipline of disciplines) {
  const p4p = await repository.listP4P(5, discipline.id)
  console.log(`\nPOUND-FOR-POUND · ${discipline.name}`)
  for (const row of p4p) {
    console.log(
      `  #${String(row.position).padStart(2)}  ${row.fighter.displayName.padEnd(26)} ` +
        `${row.score.toFixed(1)}  ${row.fighter.divisionName ?? '—'}`,
    )
  }
}

const champions = await repository.listChampions()
console.log(`\nChampions crowned: ${champions.length}`)
for (const champion of champions) {
  console.log(
    `  ${(champion.fighter.disciplineCode ?? '—').padEnd(4)} ` +
      `${champion.fighter.divisionName?.padEnd(22)} ${champion.fighter.displayName}`,
  )
}

// One Fighter ID, several records: the whole point of the model.
const crossovers = (
  await Promise.all(
    (await repository.listFighters({ pageSize: 400 })).rows.map(async (fighter) => ({
      fighter,
      records: await repository.listDisciplineRecords(fighter.id),
    })),
  )
).filter((entry) => entry.records.length > 1)

console.log(`\nATHLETES WITH MORE THAN ONE DISCIPLINE: ${crossovers.length}`)
for (const entry of crossovers.slice(0, 6)) {
  console.log(`  ${entry.fighter.fighterCode}  ${entry.fighter.displayName}`)
  for (const record of entry.records) {
    console.log(
      `      ${record.disciplineCode.padEnd(4)} ${(record.divisionName ?? '—').padEnd(22)} ` +
        `${record.wins}-${record.losses}-${record.draws}  ` +
        `rank ${record.isChampion ? 'C' : (record.currentRank ?? 'NR')}  ` +
        `rating ${record.rating.toFixed(0)}`,
    )
  }
}

const movers = await repository.listMovers(6)
console.log('\nBIGGEST MOVERS')
for (const mover of movers) {
  console.log(
    `  ${mover.movement > 0 ? '↑' : '↓'}${String(Math.abs(mover.movement)).padEnd(2)} ` +
      `${mover.fighter.displayName.padEnd(26)} #${mover.previousRank} → #${mover.newRank}  ` +
      `(${mover.disciplineName} · ${mover.divisionName})`,
  )
  console.log(`      ${mover.reasons.slice(0, 3).join(' · ')}`)
}

const someone = table[3]
const history = await repository.listRankingHistory(someone.fighterId)
console.log(`\nRanking history for ${someone.fighter.displayName}: ${history.length} entries`)
console.log(
  '  ' +
    history
      .slice(-8)
      .map((h) => `#${h.newRank ?? '—'}`)
      .join(' → '),
)

const breakdown = await repository.getBreakdown(someone.fighterId, someone.divisionId)
console.log(`\nScore breakdown for ${someone.fighter.displayName}`)
console.log(breakdown)

const search = await repository.search(someone.fighter.displayName.split(' ')[0])
console.log(`\nSearch "${someone.fighter.displayName.split(' ')[0]}" → ${search.length} results`)

const stats = await repository.dashboardStats()
console.log('\nDashboard stats', stats)

await pg.close()
console.log('\nPipeline verified.')
