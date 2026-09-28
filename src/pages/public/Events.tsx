import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import {
  Button,
  Container,
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
  Tabs,
} from '@/components/ui'
import { shortDate } from '@/lib/format'

type Filter = 'scheduled' | 'completed' | 'all'

export default function Events() {
  const repository = useRepository()
  const { revision } = useApp()
  const [filter, setFilter] = useState<Filter>('completed')
  const [page, setPage] = useState(0)

  const { data, error, loading, reload } = useAsync(
    () => repository.listEvents({ status: filter, page, pageSize: 12 }),
    [repository, filter, page, revision],
  )

  const pages = Math.ceil((data?.total ?? 0) / 12)

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader eyebrow="Cards and results" title="Events"
        level={1} />

      <Tabs
        value={filter}
        onChange={(value) => {
          setFilter(value)
          setPage(0)
        }}
        options={[
          { value: 'completed', label: 'Results' },
          { value: 'scheduled', label: 'Upcoming' },
          { value: 'all', label: 'All' },
        ]}
        className="mb-6"
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState title="No events" description="Nothing matches this filter yet." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.rows.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.slug}`}
                className="group flex flex-col border border-line bg-ink-800 p-5 transition-colors hover:border-signal/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="eyebrow text-[0.6rem] text-signal">
                    {shortDate(event.eventDate)}
                  </span>
                  {event.status === 'scheduled' ? (
                    <span className="border border-signal/40 px-1.5 py-0.5 font-display text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-signal">
                      Upcoming
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-2xl leading-tight text-chalk transition-colors group-hover:text-signal">
                  {event.name}
                </h3>
                {event.mainEventLabel ? (
                  <p className="mt-1.5 text-sm text-chalk-dim">{event.mainEventLabel}</p>
                ) : null}
                <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-muted">
                  <MapPin className="size-3.5 shrink-0" />
                  {[event.venue, event.city, event.country].filter(Boolean).join(', ') ||
                    'Venue to be confirmed'}
                </p>
                <p className="mt-1 text-xs text-faint">
                  {event.boutCount} bouts
                  {event.status === 'completed' ? ` · ${event.completedCount} results` : ''}
                </p>
              </Link>
            ))}
          </div>

          {pages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="numeral text-sm text-muted">
                {page + 1} / {pages}
              </span>
              <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Container>
  )
}
