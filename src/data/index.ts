/**
 * Data-layer entry point.
 *
 * Chooses the backend once per session:
 *   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set → Supabase (production)
 *   otherwise                                      → local PostgreSQL demo
 *
 * Both expose the same repository, so nothing above this file knows or cares
 * which one is running.
 */

import type { AuthProvider } from './auth'
import { createRepository, type Repository } from './repository'
import { getSupabasePostgrest, isSupabaseConfigured } from './supabase/client'
import { createSupabaseAuth } from './supabase/supabaseAuth'

export type DataMode = 'supabase' | 'local'

export interface DataContext {
  mode: DataMode
  repository: Repository
  auth: AuthProvider
  /** Local demo only: wipe and reload the fictional dataset. */
  resetDemoData?: () => Promise<void>
  /** Local demo only: wrap a unit of work in a real SQL transaction. */
  transaction?: <T>(work: () => Promise<T>) => Promise<T>
  freshlySeeded: boolean
}

let contextPromise: Promise<DataContext> | null = null

async function createContext(): Promise<DataContext> {
  if (isSupabaseConfigured()) {
    const db = getSupabasePostgrest()
    return {
      mode: 'supabase',
      repository: createRepository(db),
      auth: createSupabaseAuth(),
      freshlySeeded: false,
    }
  }

  // Lazily imported so the 3 MB wasm bundle never loads in Supabase mode.
  const [{ createLocalDatabase, resetLocalDatabase }, { createLocalAuth }] = await Promise.all([
    import('./pglite/client'),
    import('./pglite/localAuth'),
  ])

  const local = await createLocalDatabase()
  return {
    mode: 'local',
    repository: createRepository(local.db),
    auth: createLocalAuth(local.pg),
    resetDemoData: resetLocalDatabase,
    freshlySeeded: local.freshlySeeded,
    transaction: async <T,>(work: () => Promise<T>): Promise<T> => {
      await local.pg.exec('begin')
      try {
        const result = await work()
        await local.pg.exec('commit')
        return result
      } catch (error) {
        await local.pg.exec('rollback')
        throw error
      }
    },
  }
}

export function getData(): Promise<DataContext> {
  contextPromise ??= createContext()
  return contextPromise
}

export type { Repository }
export * from './auth'
