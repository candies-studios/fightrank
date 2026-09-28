/**
 * Local demo database — real PostgreSQL compiled to WebAssembly, persisted in
 * the browser's IndexedDB.
 *
 * This is the fallback when no Supabase project is configured. It is NOT a
 * mock: it runs the same migrations, the same constraints, the same views and
 * the same seed file as a production deployment, and the ranking engine reads
 * from it exactly as it reads from Supabase.
 */

import { PGlite } from '@electric-sql/pglite'
import schema0001 from '../../../supabase/migrations/0001_schema.sql?raw'
import functions0002 from '../../../supabase/migrations/0002_functions.sql?raw'
import rls0003 from '../../../supabase/migrations/0003_rls.sql?raw'
import views0004 from '../../../supabase/migrations/0004_views.sql?raw'
import config0005 from '../../../supabase/migrations/0005_config_defaults.sql?raw'
import identity0006 from '../../../supabase/migrations/0006_fighter_identity.sql?raw'
import seedSql from '../../../supabase/seed.sql?raw'
import { AUTH_STUB_SQL } from './migrations'
import { PGLITE_OPTIONS } from './options'
import { createPostgrestShim } from './shim'
import type { PostgrestLike } from '../postgrest'

const DATABASE_URL = 'idb://fightrank'

/**
 * Bump this whenever the migrations change shape.
 *
 * The database lives in the visitor's IndexedDB and survives deployments, so a
 * returning visitor arrives holding whatever schema they were last given. The
 * migrations are written with `create table if not exists`, which cannot alter
 * a table that already exists — so an old database is not upgraded in place,
 * it is rebuilt. That is safe here precisely because this database holds
 * nothing irreplaceable: every row comes from `seed.sql`, and every rating,
 * ranking and movement is derived from those rows by the engine.
 *
 *   1 — single-discipline schema
 *   2 — disciplines + fighter_disciplines (the unified Fighter ID)
 *   3 — database-issued fighter codes + fighter_applications
 *   4 — demo roster removed; structure only, real athletes entered by hand
 */
const SCHEMA_VERSION = '4'

const MIGRATIONS: Array<[string, string]> = [
  ['0001_schema', schema0001],
  ['0002_functions', functions0002],
  ['0003_rls', rls0003],
  ['0004_views', views0004],
  ['0005_config_defaults', config0005],
  ['0006_fighter_identity', identity0006],
]

let instance: Promise<LocalDatabase> | null = null

export interface LocalDatabase {
  pg: PGlite
  db: PostgrestLike
  /** True when this session created the schema and loaded the demo data. */
  freshlySeeded: boolean
}

/** The schema version this database was built with, if it records one. */
async function storedVersion(pg: PGlite): Promise<string | null> {
  const meta = await pg.query<{ exists: boolean }>(
    `select exists (
       select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'fightrank_meta'
     ) as exists`,
  )
  if (!meta.rows[0]?.exists) return null

  const version = await pg.query<{ value: string }>(
    `select value from public.fightrank_meta where key = 'schema_version'`,
  )
  return version.rows[0]?.value ?? null
}

/** Does this database already hold a schema of some sort? */
async function hasPublicTables(pg: PGlite): Promise<boolean> {
  const result = await pg.query<{ exists: boolean }>(
    `select exists (
       select 1 from information_schema.tables where table_schema = 'public'
     ) as exists`,
  )
  return result.rows[0]?.exists ?? false
}

async function applySchema(pg: PGlite): Promise<boolean> {
  const version = await storedVersion(pg)
  if (version === SCHEMA_VERSION) return false

  // Anything already here was built by an older version of the app — either a
  // recorded one, or one old enough to predate `fightrank_meta` entirely. It
  // cannot be migrated in place, so it goes and is rebuilt from the seed.
  //
  // `auth` goes with it. The demo administrator spans both schemas — the login
  // in `auth`, the role in `public.profiles` — so keeping one while replacing
  // the other leaves an account that can sign in but has no profile.
  if (version !== null || (await hasPublicTables(pg))) {
    await pg.exec(`
      drop schema public cascade;
      drop schema if exists auth cascade;
      create schema public;
    `)
  }

  await pg.exec(AUTH_STUB_SQL)
  for (const [, sql] of MIGRATIONS) {
    await pg.exec(sql)
  }
  await pg.exec(`
    create table if not exists public.fightrank_meta (
      key text primary key,
      value text not null,
      updated_at timestamptz not null default now()
    );
    insert into public.fightrank_meta (key, value) values ('schema_version', '${SCHEMA_VERSION}')
    on conflict (key) do update set value = excluded.value, updated_at = now();
  `)
  await pg.exec(seedSql)
  return true
}

export function createLocalDatabase(): Promise<LocalDatabase> {
  if (instance) return instance
  instance = (async () => {
    const pg = new PGlite({ dataDir: DATABASE_URL, ...PGLITE_OPTIONS })
    await pg.waitReady
    const freshlySeeded = await applySchema(pg)
    return { pg, db: createPostgrestShim(pg), freshlySeeded }
  })()
  return instance
}

/** Drop everything and reload the demo data from `seed.sql`. */
export async function resetLocalDatabase(): Promise<void> {
  const { pg } = await createLocalDatabase()
  await pg.exec(`drop schema public cascade; create schema public;`)
  await applySchema(pg)
}
