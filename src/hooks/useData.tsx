import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getData, type DataContext as DataContextValue } from '@/data'
import type { AuthSession } from '@/data/auth'
import type { Discipline, Division } from '@/types/domain'
import { recalculate } from '@/services/recalculate'

interface AppData {
  context: DataContextValue
  /** Every active discipline, in display order. */
  disciplines: Discipline[]
  divisions: Division[]
  /** The divisions belonging to one discipline, in display order. */
  divisionsOf: (disciplineId: string | null | undefined) => Division[]
  disciplineOf: (disciplineId: string | null | undefined) => Discipline | null
  refreshTaxonomy: () => Promise<void>
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
  /** Bumped whenever rankings are rewritten, so pages can refetch. */
  revision: number
  bumpRevision: () => void
}

const Ctx = createContext<AppData | null>(null)

type BootState =
  | { status: 'loading'; message: string }
  | { status: 'error'; error: Error }
  | { status: 'ready' }

export function DataProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<BootState>({ status: 'loading', message: 'Connecting' })
  const [session, setSession] = useState<AuthSession | null>(null)
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [revision, setRevision] = useState(0)
  const [context, setContext] = useState<DataContextValue | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        setBoot({ status: 'loading', message: 'Connecting to the database' })
        const ctx = await getData()
        if (cancelled) return

        // A brand-new local database has facts but no rankings yet: the engine
        // has to run once before anything can be displayed.
        if (ctx.freshlySeeded) {
          setBoot({ status: 'loading', message: 'Running the ranking engine over the demo data' })
          await recalculate(ctx)
        }
        if (cancelled) return

        const [loadedDisciplines, loadedDivisions, loadedSession] = await Promise.all([
          ctx.repository.listDisciplines(),
          ctx.repository.listDivisions(),
          ctx.auth.getSession().catch(() => null),
        ])
        if (cancelled) return

        setContext(ctx)
        setDisciplines(loadedDisciplines)
        setDivisions(loadedDivisions)
        setSession(loadedSession)
        setBoot({ status: 'ready' })
      } catch (cause) {
        if (cancelled) return
        setBoot({
          status: 'error',
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!context) return
    return context.auth.onChange(setSession)
  }, [context])

  const value = useMemo<AppData | null>(() => {
    if (!context) return null
    return {
      context,
      disciplines,
      divisions,
      divisionsOf: (disciplineId) =>
        disciplineId ? divisions.filter((d) => d.disciplineId === disciplineId) : divisions,
      disciplineOf: (disciplineId) =>
        disciplineId ? (disciplines.find((d) => d.id === disciplineId) ?? null) : null,
      session,
      setSession,
      revision,
      bumpRevision: () => setRevision((n) => n + 1),
      refreshTaxonomy: async () => {
        const [nextDisciplines, nextDivisions] = await Promise.all([
          context.repository.listDisciplines(),
          context.repository.listDivisions(),
        ])
        setDisciplines(nextDisciplines)
        setDivisions(nextDivisions)
      },
    }
  }, [context, disciplines, divisions, session, revision])

  if (boot.status === 'error') {
    return <BootError error={boot.error} />
  }
  if (!value) {
    return <BootScreen message={boot.status === 'loading' ? boot.message : 'Starting'} />
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppData {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp must be used inside <DataProvider>')
  return value
}

export function useRepository() {
  return useApp().context.repository
}

function BootScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-900 px-6 text-center">
      <div className="numeral text-5xl tracking-tight text-chalk">
        FIGHT<span className="text-signal">RANK</span>
      </div>
      <div className="h-px w-40 overflow-hidden bg-ink-600">
        <div className="h-full w-1/2 animate-sweep bg-signal" />
      </div>
      <p className="max-w-sm text-sm text-muted">{message}…</p>
    </div>
  )
}

function BootError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-900 px-6 text-center">
      <div className="eyebrow text-fall">Startup failed</div>
      <h1 className="text-3xl text-chalk">The database could not be reached</h1>
      <p className="max-w-md text-sm text-muted">{error.message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 border border-line px-5 py-2 text-sm text-chalk transition hover:border-signal hover:text-signal"
      >
        Try again
      </button>
    </div>
  )
}
