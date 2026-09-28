/**
 * Applies every migration plus the seed file to a throwaway in-memory
 * PostgreSQL instance and reports what landed. This is how we know the SQL is
 * valid before it ever reaches a Supabase project.
 *
 * Run with: npm run db:verify
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { AUTH_STUB_SQL, MIGRATION_ORDER } from '../src/data/pglite/migrations'
import { PGLITE_OPTIONS } from '../src/data/pglite/options'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFileSync(path.join(root, 'supabase', file), 'utf8')

const db = new PGlite(PGLITE_OPTIONS)
await db.waitReady

console.log('· auth stub')
await db.exec(AUTH_STUB_SQL)

for (const file of MIGRATION_ORDER) {
  console.log(`· ${file}`)
  await db.exec(read(`migrations/${file}`))
}

console.log('· seed.demo.sql (fixture)')
const started = Date.now()
// The shipped `seed.sql` carries structure only — no athletes — so these
// scripts load the demo roster fixture instead. Proving that a constraint
// bites requires rows for it to bite on.
await db.exec(read('seed.demo.sql'))
console.log(`  seeded in ${Date.now() - started}ms`)

const counts = await db.query<{ table_name: string; n: number }>(`
  select 'disciplines' as table_name, count(*)::int as n from disciplines
  union all select 'divisions', count(*)::int from divisions
  union all select 'fighters', count(*)::int from fighters
  union all select 'fighter_disciplines', count(*)::int from fighter_disciplines
  union all select 'fighter_stats', count(*)::int from fighter_stats
  union all select 'events', count(*)::int from events
  union all select 'fights', count(*)::int from fights
  union all select 'ranking_config', count(*)::int from ranking_config
  order by 1
`)
console.table(counts.rows)

const views = await db.query<{ name: string; n: number }>(`
  select 'fighter_profiles' as name, count(*)::int as n from fighter_profiles
  union all select 'fighter_discipline_profiles', count(*)::int from fighter_discipline_profiles
  union all select 'fight_details', count(*)::int from fight_details
  union all select 'event_cards', count(*)::int from event_cards
  union all select 'search_index', count(*)::int from search_index
  order by 1
`)
console.table(views.rows)

const constraints = await db.query<{ n: number }>(`
  select count(*)::int as n from information_schema.table_constraints
  where table_schema = 'public' and constraint_type in ('PRIMARY KEY','FOREIGN KEY','CHECK','UNIQUE')
`)
const indexes = await db.query<{ n: number }>(
  `select count(*)::int as n from pg_indexes where schemaname = 'public'`,
)
console.log(`constraints: ${constraints.rows[0].n}   indexes: ${indexes.rows[0].n}`)

// Prove the safety rules actually bite (§23).
const expectFailure = async (label: string, sql: string) => {
  try {
    await db.exec(sql)
    console.error(`  ✗ ${label} — NOT rejected`)
    process.exitCode = 1
  } catch {
    console.log(`  ✓ ${label} — rejected`)
  }
}

const [{ id: fighterId, division_id: divisionId }] = (
  await db.query<{ id: string; division_id: string }>(
    `select id, division_id from fighters where division_id is not null limit 1`,
  )
).rows
const [{ id: eventId }] = (await db.query<{ id: string }>(`select id from events limit 1`)).rows

console.log('database-level safety rules:')
await expectFailure(
  'fighter cannot fight himself',
  `insert into fights (event_id, division_id, fighter_a_id, fighter_b_id)
   values ('${eventId}', '${divisionId}', '${fighterId}', '${fighterId}')`,
)
await expectFailure(
  'a draw cannot have a winner',
  `insert into fights (event_id, division_id, fighter_a_id, fighter_b_id, outcome, winner_id)
   select '${eventId}', '${divisionId}', a.id, b.id, 'draw', a.id
   from fighters a, fighters b
   where a.division_id = '${divisionId}' and b.division_id = '${divisionId}' and a.id <> b.id limit 1`,
)
await expectFailure(
  'duplicate bout on the same card',
  `insert into fights (event_id, division_id, fighter_a_id, fighter_b_id)
   select event_id, division_id, fighter_b_id, fighter_a_id from fights limit 1`,
)
await expectFailure(
  'two champions in one division',
  `update fighters set is_champion = true where division_id = '${divisionId}'`,
)

// Multi-discipline rules: the Fighter ID is shared, the records are not.
await expectFailure(
  'booking an athlete in a discipline they are not registered in',
  `insert into fights (event_id, division_id, fighter_a_id, fighter_b_id)
   select '${eventId}', d.id, a.id, b.id
   from divisions d, fighters a, fighters b
   where d.is_p4p = false
     and a.id <> b.id
     and not exists (select 1 from fighter_disciplines fd
                      where fd.fighter_id = a.id and fd.discipline_id = d.discipline_id)
     and not exists (select 1 from fighter_disciplines fd
                      where fd.fighter_id = b.id and fd.discipline_id = d.discipline_id)
   limit 1`,
)
await expectFailure(
  'registering one athlete twice in the same discipline',
  `insert into fighter_disciplines (fighter_id, discipline_id, division_id)
   select fighter_id, discipline_id, division_id from fighter_disciplines limit 1`,
)
await expectFailure(
  'two champions in one division across the per-discipline records',
  `update fighter_disciplines set is_champion = true where division_id = '${divisionId}'`,
)

await db.close()
console.log('\nSchema verified.')
