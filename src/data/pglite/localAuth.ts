/**
 * Demo-mode authentication.
 *
 * A deliberately simple stand-in for Supabase Auth so the admin panel is usable
 * without a backend. It is only ever constructed when no Supabase project is
 * configured, it never leaves the browser, and the sign-in screen states
 * plainly that it is a demo stub.
 *
 * Production authentication is `supabase/supabaseAuth.ts`.
 */

import type { PGlite } from '@electric-sql/pglite'
import type { UserRole } from '@/types/domain'
import type { AuthProvider, AuthSession } from '../auth'

const STORAGE_KEY = 'fightrank.demo.session'

export const DEMO_ADMIN = {
  email: 'admin@fightrank.demo',
  password: 'fightrank',
}

/** Not a security control — demo mode only. */
async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`fightrank::${value}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function createLocalAuth(pg: PGlite): AuthProvider {
  const listeners = new Set<(session: AuthSession | null) => void>()

  /**
   * Make sure the demo administrator exists, in both halves.
   *
   * The account spans two schemas: the login in `auth`, the role in `public`.
   * Those are not rebuilt together — `public` is dropped and reseeded whenever
   * the schema version changes, while `auth` persists — so checking only for
   * the login would leave a database where signing in succeeds and then finds
   * no profile. Each half is therefore checked, and repaired, on its own.
   */
  const ensureSeedUser = async (): Promise<void> => {
    const existing = await pg.query<{ id: string }>(
      `select id from auth.users where lower(email) = lower($1)`,
      [DEMO_ADMIN.email],
    )

    let userId = existing.rows[0]?.id
    if (!userId) {
      const password = await digest(DEMO_ADMIN.password)
      const inserted = await pg.query<{ id: string }>(
        `insert into auth.users (email, encrypted_password, raw_user_meta_data)
         values ($1, $2, '{"display_name":"Demo Administrator"}'::jsonb)
         returning id`,
        [DEMO_ADMIN.email, password],
      )
      userId = inserted.rows[0].id
    }

    await pg.query(
      `insert into public.profiles (id, email, display_name, role)
       values ($1, $2, 'Demo Administrator', 'admin')
       on conflict (id) do nothing`,
      [userId, DEMO_ADMIN.email],
    )
  }

  const loadProfile = async (userId: string): Promise<AuthSession | null> => {
    const res = await pg.query<{
      id: string
      email: string
      display_name: string | null
      role: UserRole
    }>(`select id, email, display_name, role from public.profiles where id = $1`, [userId])
    const row = res.rows[0]
    if (!row) return null
    return { userId: row.id, email: row.email, displayName: row.display_name, role: row.role }
  }

  const persist = (session: AuthSession | null): void => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, session.userId)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable — session simply will not survive a reload */
    }
    for (const listener of listeners) listener(session)
  }

  return {
    kind: 'local',
    demoCredentials: DEMO_ADMIN,

    async getSession() {
      await ensureSeedUser()
      let userId: string | null = null
      try {
        userId = localStorage.getItem(STORAGE_KEY)
      } catch {
        userId = null
      }
      if (!userId) return null
      return loadProfile(userId)
    },

    async signIn(email, password) {
      await ensureSeedUser()
      const hashed = await digest(password)
      const res = await pg.query<{ id: string }>(
        `select id from auth.users where lower(email) = lower($1) and encrypted_password = $2`,
        [email, hashed],
      )
      const user = res.rows[0]
      if (!user) throw new Error('Invalid email or password.')
      const session = await loadProfile(user.id)
      if (!session) throw new Error('This account has no profile.')
      persist(session)
      return session
    },

    async signUp(email, password, displayName) {
      await ensureSeedUser()
      const hashed = await digest(password)
      const existing = await pg.query(`select 1 from auth.users where lower(email) = lower($1)`, [
        email,
      ])
      if (existing.rows.length > 0) throw new Error('An account with that email already exists.')
      const inserted = await pg.query<{ id: string }>(
        `insert into auth.users (email, encrypted_password, raw_user_meta_data)
         values ($1, $2, $3::jsonb) returning id`,
        [email, hashed, JSON.stringify({ display_name: displayName ?? email.split('@')[0] })],
      )
      const id = inserted.rows[0].id
      await pg.query(
        `insert into public.profiles (id, email, display_name, role) values ($1, $2, $3, 'viewer')`,
        [id, email, displayName ?? email.split('@')[0]],
      )
      const session = await loadProfile(id)
      if (!session) throw new Error('Could not create the account.')
      persist(session)
      return session
    },

    async signOut() {
      persist(null)
    },

    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
