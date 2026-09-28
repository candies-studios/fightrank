import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  FlaskConical,
  Gauge,
  IdCard,
  Layers,
  LogOut,
  Menu,
  RefreshCw,
  ScrollText,
  Settings2,
  Shapes,
  Swords,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useApp } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { canWrite } from '@/data/auth'
import { recalculateAll } from '@/services/admin'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

const SECTIONS: Array<{ heading: string; items: Array<{ to: string; label: string; icon: typeof Gauge; end?: boolean }> }> = [
  {
    heading: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: Gauge, end: true }],
  },
  {
    heading: 'Competition',
    items: [
      { to: '/admin/fights', label: 'Fights', icon: Swords },
      { to: '/admin/events', label: 'Events', icon: CalendarDays },
      { to: '/admin/fighters', label: 'Fighters', icon: Users },
      { to: '/admin/applications', label: 'Applications', icon: IdCard },
      { to: '/admin/disciplines', label: 'Disciplines', icon: Shapes },
      { to: '/admin/divisions', label: 'Divisions', icon: Layers },
    ],
  },
  {
    heading: 'Ranking engine',
    items: [
      { to: '/admin/simulator', label: 'Simulator', icon: FlaskConical },
      { to: '/admin/ranking-settings', label: 'Ranking settings', icon: Settings2 },
      { to: '/admin/changes', label: 'Ranking changes', icon: ClipboardList },
    ],
  },
  {
    heading: 'Governance',
    items: [
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
      { to: '/admin/users', label: 'Users', icon: UserCog },
    ],
  },
]

export function AdminLayout() {
  const app = useApp()
  const toast = useToast()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  if (!app.session) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }
  if (!canWrite(app.session)) {
    return <NoAccess email={app.session.email} />
  }

  const runRecalculation = async () => {
    setRecalculating(true)
    try {
      const summary = await recalculateAll(app.context, app.session)
      app.bumpRevision()
      toast.success(
        'Rankings recalculated',
        `${summary.disciplines} disciplines · ${summary.divisions} divisions · ` +
          `${summary.fighters} records · ${summary.historyRows} history rows in ${summary.durationMs} ms`,
      )
    } catch (error) {
      toast.error('Recalculation failed', error instanceof Error ? error.message : String(error))
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-900">
      <header className="sticky top-0 z-40 border-b border-line bg-ink-850">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 text-chalk-dim lg:hidden"
            aria-label="Toggle navigation"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link to="/" className="numeral text-lg tracking-tight text-chalk">
            FIGHT<span className="text-signal">RANK</span>
          </Link>
          <span className="hidden border border-line px-1.5 py-0.5 font-display text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted sm:inline">
            Admin
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={runRecalculation}
              loading={recalculating}
              icon={<RefreshCw className="size-3.5" />}
            >
              <span className="hidden sm:inline">Recalculate</span>
            </Button>
            <div className="hidden text-right sm:block">
              <div className="text-xs text-chalk">{app.session.displayName ?? app.session.email}</div>
              <div className="text-[0.68rem] uppercase tracking-wider text-faint">
                {app.session.role}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await app.context.auth.signOut()
                app.setSession(null)
              }}
              className="p-1.5 text-muted transition hover:text-fall"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            'fixed inset-y-14 left-0 z-30 w-60 overflow-y-auto border-r border-line bg-ink-850 px-3 py-4 transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {SECTIONS.map((section) => (
            <div key={section.heading} className="mb-5">
              <div className="eyebrow mb-2 px-2 text-[0.58rem]">{section.heading}</div>
              <nav className="flex flex-col">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 border-l-2 px-2.5 py-2 text-sm transition-colors',
                        isActive
                          ? 'border-signal bg-ink-800 text-chalk'
                          : 'border-transparent text-muted hover:bg-ink-800 hover:text-chalk-dim',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}

          <div className="mt-6 border-t border-line px-2 pt-4 text-xs text-faint">
            <p>
              Backend:{' '}
              <span className="text-muted">
                {app.context.mode === 'supabase' ? 'Supabase' : 'Local PostgreSQL'}
              </span>
            </p>
            <Link to="/" className="mt-2 inline-block transition hover:text-signal">
              ← Back to the public site
            </Link>
          </div>
        </aside>

        {open ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 top-14 z-20 bg-ink-900/70 lg:hidden"
            onClick={() => setOpen(false)}
          />
        ) : null}

        {/* `admin-surface` re-points the palette tokens to their light
            values for everything inside — the top bar and sidebar above are
            outside it and stay black. */}
        <main className="admin-surface min-w-0 flex-1 bg-ink-900 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NoAccess({ email }: { email: string }) {
  const app = useApp()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="eyebrow text-signal">Access required</div>
      <h1 className="text-3xl text-chalk">This account cannot administer rankings</h1>
      <p className="max-w-md text-sm text-muted">
        {email} is signed in with the <strong className="text-chalk-dim">viewer</strong> role. An
        administrator can grant editor or admin access from the Users page.
      </p>
      <div className="flex gap-2">
        <Link to="/">
          <Button variant="secondary">Back to the site</Button>
        </Link>
        <Button
          variant="ghost"
          onClick={async () => {
            await app.context.auth.signOut()
            app.setSession(null)
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}
