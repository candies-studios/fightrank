/**
 * Authentication abstraction (§25).
 *
 * Supabase Auth in production; a clearly-labelled local stub for the offline
 * demo. Only the anon key ever reaches the browser — the service-role key is
 * never referenced in this codebase.
 */

import type { UserRole } from '@/types/domain'

export interface AuthSession {
  userId: string
  email: string
  displayName: string | null
  role: UserRole
}

export interface AuthProvider {
  readonly kind: 'supabase' | 'local'
  getSession(): Promise<AuthSession | null>
  signIn(email: string, password: string): Promise<AuthSession>
  signUp(email: string, password: string, displayName?: string): Promise<AuthSession>
  signOut(): Promise<void>
  onChange(listener: (session: AuthSession | null) => void): () => void
  /** Credentials to show on the sign-in screen, demo mode only. */
  readonly demoCredentials?: { email: string; password: string }
}

export function canWrite(session: AuthSession | null): boolean {
  return session?.role === 'admin' || session?.role === 'editor'
}

export function isOwner(session: AuthSession | null): boolean {
  return session?.role === 'admin'
}
