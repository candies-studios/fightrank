import { Link } from 'react-router-dom'
import { CalendarPlus, Crown, FlaskConical, Plus, Swords } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { FightRow } from '@/components/FightRow'
import { MoversList } from '@/components/MoversList'
import {
  Button,
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  StatTile,
} from '@/components/ui'
import { shortDate } from '@/lib/format'

export default function Dashboard() {
  const repository = useRepository()
  const { revision, context } = useApp()

  const { data, error, loading, reload } = useAsync(
    async () => {
      const [stats, movers, recent, champions, upcoming] = await Promise.all([
        repository.dashboardStats(),
        repository.listMovers(8),
        repository.listFights({ status: 'completed', limit: 6 }),
        repository.listChampions(),
        repository.listEvents({ status: 'scheduled', pageSize: 3 }),
      ])
      return { stats, movers, recent, champions, upcoming: upcoming.rows }
    },
    [repository, revision],
  )

  if (error) return <ErrorState error={error} onRetry={reload} />

  const up = data?.movers.filter((m) => m.movement > 0) ?? []
  const down = data?.movers.filter((m) => m.movement < 0) ?? []

  return (
    <div className="mx-auto max-w-[1200px]">
      <SectionHeader
        eyebrow={context.mode === 'supabase' ? 'Supabase' : 'Local PostgreSQL'}
        title="Dashboard"
        level={1}
        action={
          <div className="flex gap-2">
            <Link to="/admin/fights/new">
              <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />}>
                Add fight
              </Button>
            </Link>
            <Link to="/admin/simulator" className="hidden sm:block">
              <Button variant="secondary" size="sm" icon={<FlaskConical className="size-3.5" />}>
                Simulator
              </Button>
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Total fighters" value={data?.stats.fighters ?? 0} />
          <StatTile label="Total fights" value={data?.stats.fights ?? 0} />
          <StatTile label="Total events" value={data?.stats.events ?? 0} />
          <StatTile label="Active champions" value={data?.stats.champions ?? 0} tone="signal" />
          <StatTile
            label="Last recalculation"
            value={data?.stats.lastRecalculation ? shortDate(data.stats.lastRecalculation) : '—'}
            sub={data?.stats.lastRecalculation ? 'engine output current' : 'never run'}
          />
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHeader
            eyebrow="From ranking_history"
            title="Top movers"
            action={
              <Link to="/admin/changes" className="text-sm text-muted transition hover:text-signal">
                All changes →
              </Link>
            }
          />
          {loading ? (
            <Skeleton className="h-64" />
          ) : (data?.movers.length ?? 0) === 0 ? (
            <EmptyState title="No ranking movement recorded yet" />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="eyebrow mb-2 text-rise">Climbing</div>
                <MoversList movers={up} showReasons={false} limit={5} />
              </div>
              <div>
                <div className="eyebrow mb-2 text-fall">Falling</div>
                <MoversList movers={down} showReasons={false} limit={5} />
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            eyebrow="Most recent"
            title="Recorded fights"
            action={
              <Link to="/admin/fights" className="text-sm text-muted transition hover:text-signal">
                Manage →
              </Link>
            }
          />
          {loading ? (
            <Skeleton className="h-64" />
          ) : (data?.recent.length ?? 0) === 0 ? (
            <EmptyState
              title="No fights recorded"
              action={
                <Link to="/admin/fights/new">
                  <Button size="sm" icon={<Swords className="size-3.5" />}>
                    Record the first fight
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="border-t border-line-soft">
              {data?.recent.map((fight) => (
                <FightRow key={fight.id} fight={fight} showEvent />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader eyebrow="Reigning" title="Champions" />
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <ul className="border-t border-line-soft">
              {data?.champions.map((row) => (
                <li
                  key={row.fighterId}
                  className="flex items-center gap-3 border-b border-line-soft py-2.5"
                >
                  <Crown className="size-4 shrink-0 text-signal" />
                  <span className="w-44 shrink-0 truncate text-xs text-muted">
                    {row.fighter.divisionName}
                  </span>
                  <Link
                    to={`/fighters/${row.fighter.slug}`}
                    className="min-w-0 flex-1 truncate text-sm text-chalk transition hover:text-signal"
                  >
                    {row.fighter.displayName}
                  </Link>
                  <span className="numeral shrink-0 text-sm text-chalk-dim">
                    {Math.round(row.rating)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader
            eyebrow="Scheduled"
            title="Upcoming cards"
            action={
              <Link to="/admin/events/new">
                <Button size="sm" icon={<CalendarPlus className="size-3.5" />}>
                  New event
                </Button>
              </Link>
            }
          />
          {loading ? (
            <Skeleton className="h-32" />
          ) : (data?.upcoming.length ?? 0) === 0 ? (
            <EmptyState title="No upcoming events" />
          ) : (
            <ul className="border-t border-line-soft">
              {data?.upcoming.map((event) => (
                <li key={event.id} className="border-b border-line-soft py-3">
                  <Link to={`/admin/events/${event.id}`} className="group block">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-display text-lg font-bold uppercase text-chalk transition group-hover:text-signal">
                        {event.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {shortDate(event.eventDate)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted">
                      {event.mainEventLabel ?? 'No bouts announced'} · {event.boutCount} bouts
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
