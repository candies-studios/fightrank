import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  GitCompareArrows,
  Handshake,
  Home,
  IdCard,
  Info,
  Layers,
  ListChecks,
  Menu,
  Search,
  Shield,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useApp } from '@/hooks/useData'
import { GlobalSearch, useSearchHotkey } from '@/components/GlobalSearch'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/disciplines', label: 'Disciplines', icon: Layers },
  { to: '/rankings', label: 'Rankings', icon: BarChart3 },
  { to: '/p4p', label: 'Pound for Pound', icon: Trophy },
  { to: '/fighters', label: 'Fighters', icon: Users },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/results', label: 'Results', icon: ListChecks },
]

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/disciplines', label: 'Sports', icon: Layers },
  { to: '/rankings', label: 'Rankings', icon: BarChart3 },
  { to: '/results', label: 'Results', icon: ListChecks },
  { to: '/fighters', label: 'Fighters', icon: Users },
]

export function PublicLayout() {
  const { session, context } = useApp()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useSearchHotkey(useCallback(() => setSearchOpen(true), []))

  return (
    <div className="flex min-h-screen flex-col bg-ink-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:bg-signal focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* The one light surface on a black site: a tall pale bar with dark
          uppercase links that take a red underline, and a red pill at the far
          right. */}
      <header className="sticky top-0 z-40 border-b border-bar-line bg-bar">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center gap-6 px-4 sm:px-6 lg:h-[84px]">
          <Link to="/" className="shrink-0" aria-label="FIGHTRANK home">
            <span className="numeral text-2xl tracking-tight text-bar-text sm:text-3xl">
              FIGHT<span className="text-signal">RANK</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'border-b-2 py-1.5 text-[0.92rem] font-semibold whitespace-nowrap uppercase tracking-[0.06em] transition-colors',
                    isActive
                      ? 'border-signal text-signal'
                      : 'border-transparent text-bar-text hover:border-signal hover:text-signal',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-xs border border-bar-line px-2.5 py-2 text-bar-text transition-colors hover:border-signal hover:text-signal"
              aria-label="Search"
            >
              <Search className="size-4" />
              <kbd className="hidden rounded-xs border border-bar-line px-1 text-[0.65rem] text-[#777] xl:inline">
                ⌘K
              </kbd>
            </button>

            <Link
              to={session ? '/admin' : '/admin/login'}
              className="hidden items-center gap-2 rounded-xs border border-bar-line px-2.5 py-2 text-bar-text transition-colors hover:border-signal hover:text-signal sm:flex"
              aria-label={session ? 'Admin panel' : 'Sign in'}
            >
              <Shield className="size-4" />
            </Link>

            {/* The Fighter ID is the athlete-facing half of the platform, so it
                takes the header's one call to action rather than a nav link. */}
            <Link
              to="/fighter-id"
              className="hidden items-center gap-2 rounded-full bg-signal px-5 py-3 text-[0.82rem] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-white transition-colors hover:bg-signal-dim sm:inline-flex"
            >
              <IdCard className="size-4 shrink-0" />
              <span className="hidden md:inline">Fighter ID</span>
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 text-bar-text transition hover:text-signal lg:hidden"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="animate-fade border-t border-bar-line bg-bar lg:hidden">
            <nav className="mx-auto flex max-w-[1240px] flex-col px-4 py-2 sm:px-6">
              {[
                ...NAV,
                { to: '/fighter-id', label: 'Fighter ID', icon: IdCard },
                { to: '/fighter-id/new', label: 'Create ID', icon: UserPlus },
                { to: '/about', label: 'About', icon: Info },
                { to: '/compare', label: 'Compare', icon: GitCompareArrows },
                { to: '/partners', label: 'Partners', icon: Handshake },
                { to: '/methodology', label: 'How it works', icon: BarChart3 },
              ].map(
                (item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 border-b border-bar-line py-3.5 text-[0.92rem] font-semibold uppercase tracking-[0.06em]',
                        isActive ? 'text-signal' : 'text-bar-text',
                      )
                    }
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </NavLink>
                ),
              )}
              <Link
                to={session ? '/admin' : '/admin/login'}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 py-3.5 text-[0.92rem] font-semibold uppercase tracking-[0.06em] text-[#666]"
              >
                <Shield className="size-4" />
                {session ? 'Admin panel' : 'Administrator sign in'}
              </Link>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main" key={location.pathname} className="flex-1 pb-20 lg:pb-0">
        <Outlet />
      </main>

      <Footer mode={context.mode} />

      {/* Mobile bottom navigation (§33) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-850/97 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg">
          {MOBILE_NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[0.62rem] font-semibold uppercase tracking-wider transition-colors',
                    isActive ? 'text-signal' : 'text-muted',
                  )
                }
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

/** Edit these to point at your own accounts — an empty string hides the link. */
const SOCIAL = [
  { label: 'IG', href: '', name: 'Instagram' },
  { label: 'FB', href: '', name: 'Facebook' },
  { label: 'IN', href: '', name: 'LinkedIn' },
  { label: 'YT', href: '', name: 'YouTube' },
]

const CONTACT = ['support@fightrank.com', 'press@fightrank.com']

function Footer({ mode }: { mode: 'supabase' | 'local' }) {
  return (
    <footer className="mt-16 border-t border-line pt-14 pb-8">
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <div className="mb-10 grid gap-10 md:grid-cols-[1.3fr_1fr_1.2fr]">
          <div>
            <div className="numeral text-3xl text-chalk">
              FIGHT<span className="text-signal">RANK</span>
            </div>
            <p className="mt-4 max-w-[320px] text-sm leading-relaxed text-muted">
              Every fight changes the ranking. Positions are produced by a published algorithm from
              recorded results — never by opinion, popularity or promotion.
            </p>
            <div className="mt-4 flex gap-3.5">
              {SOCIAL.filter((s) => s.href).map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.name}
                  className="flex size-[38px] items-center justify-center rounded-full border border-line text-xs text-muted transition-colors hover:border-signal hover:text-signal"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-base tracking-[0.06em] text-muted">Navigate</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                ['/disciplines', 'Disciplines'],
                ['/rankings', 'Rankings'],
                ['/p4p', 'Pound for pound'],
                ['/events', 'Events'],
                ['/results', 'Results'],
                ['/fighter-id', 'Fighter ID'],
                ['/about', 'About us'],
                ['/partners', 'Partners'],
              ].map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="text-muted transition hover:text-signal">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-base tracking-[0.06em] text-muted">Get in touch</h4>
            <ul className="flex flex-col gap-2.5 text-sm text-muted">
              {CONTACT.map((email) => (
                <li key={email}>{email}</li>
              ))}
              <li>
                <Link to="/methodology" className="transition hover:text-signal">
                  How the ranking works
                </Link>
              </li>
              <li>
                <Link to="/admin" className="transition hover:text-signal">
                  Administration
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2.5 border-t border-line pt-6 text-[0.82rem] text-muted">
          <span>
            {new Date().getFullYear()} &copy; FIGHTRANK &ndash; All Rights Reserved
          </span>
          <span className="text-faint">
            {mode === 'supabase' ? 'Supabase PostgreSQL' : 'Local PostgreSQL (demo)'}
          </span>
        </div>
      </div>
    </footer>
  )
}
