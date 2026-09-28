/**
 * Supabase client.
 *
 * Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are read. The anon key
 * is designed to be public — every table it can reach is protected by the RLS
 * policies in `supabase/migrations/0003_rls.sql`. The service-role key must
 * never appear in frontend code and is not referenced anywhere in this project.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestLike } from '../postgrest'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  client ??= createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { headers: { 'x-application-name': 'fightrank' } },
  })
  return client
}

/**
 * supabase-js already implements the PostgREST surface the repository needs,
 * so this is a straight structural cast rather than an adapter.
 */
export function getSupabasePostgrest(): PostgrestLike {
  return getSupabaseClient() as unknown as PostgrestLike
}
