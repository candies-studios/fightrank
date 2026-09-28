import type { UserRole } from '@/types/domain'
import type { AuthProvider, AuthSession } from '../auth'
import { getSupabaseClient } from './client'

interface ProfileRow {
  id: string
  email: string
  display_name: string | null
  role: UserRole
}

export function createSupabaseAuth(): AuthProvider {
  const supabase = getSupabaseClient()

  const hydrate = async (userId: string, email: string): Promise<AuthSession> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, role')
      .eq('id', userId)
      .maybeSingle<ProfileRow>()

    return {
      userId,
      email: data?.email ?? email,
      displayName: data?.display_name ?? null,
      // A missing profile row means the account exists but has no grant yet.
      role: data?.role ?? 'viewer',
    }
  }

  return {
    kind: 'supabase',

    async getSession() {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      return hydrate(user.id, user.email ?? '')
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      if (!data.user) throw new Error('Sign-in failed.')
      return hydrate(data.user.id, data.user.email ?? email)
    },

    async signUp(email, password, displayName) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName ?? email.split('@')[0] } },
      })
      if (error) throw new Error(error.message)
      if (!data.user) throw new Error('Check your inbox to confirm the account.')
      return hydrate(data.user.id, data.user.email ?? email)
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
    },

    onChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          listener(null)
          return
        }
        void hydrate(session.user.id, session.user.email ?? '').then(listener)
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
