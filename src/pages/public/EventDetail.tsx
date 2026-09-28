import { Link, useParams } from 'react-router-dom'
import { Award, CalendarDays, MapPin } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { FightRow } from '@/components/FightRow'
import { MoversList } from '@/components/MoversList'
import {
  Button,
  Container,
  EmptyState,
  ErrorState,
  SectionHeader,
  Skeleton,
} from '@/components/ui'
import { shortDate } from '@/lib/format'

export default function EventDetail() {
  const { eventSlug = '' } = useParams()
  const repository = useRepository()
  const { revision } = useApp()

  const { data, error, loading, reload } = useAsync(
    async () => {
      const event = await repository.getEvent(eventSlug)
      if (!event) return null
      const [fights, changes] = await Promise.all([
        repository.listFights({ eventId: event.id, status: 'all' }),
        repository.listEventRankingChanges(event.id),
      ])
      return { event, fights, changes }
    },
    [eventSlug, repository, revision],
  )

  if (error) {
    return (
      <Container className="py-16">
        <ErrorState error={error} onRetry={reload} />
      </Container>
    )
  }

  if (loading) {
    return (
      <Container className="py-10">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="mt-6 h-96 w-full" />
      </Container>
    )
  }

  if (!data) {
    return (
      <Container className="py-20">
        <EmptyState
          title="Event not found"
          action={
            <Link to="/events">
              <Button size="sm">All events</Button>
            </Link>
          }
        />
      </Container>
    )
  }

  const { event, fights, changes } = data
  const ordered = [...fights].sort((a, b) => {
    if (a.isMainEvent !== b.isMainEvent) return a.isMainEvent ? -1 : 1
    return a.boutOrder - b.boutOrder
  })
  const mainEvent = ordered[0]
  const bonusWinners = fights.filter((f) => (f.bonuses ?? []).length > 0)
  const movers = changes.filter((c) => c.movement !== 0)

  return (
    <>
      <section className="border-b border-line bg-ink-850">
        <Container className="py-8 sm:py-12">
          <div className="eyebrow mb-2 flex items-center gap-2 text-signal">
            <CalendarDays className="size-3.5" />
            {shortDate(event.eventDate)}
            {event.status === 'scheduled' ? ' · Upcoming' : ''}
          </div>
          <h1 className="text-[11vw] leading-[0.9] text-chalk sm:text-6xl">{event.name}</h1>
          {mainEvent ? (
            <p className="mt-3 text-lg text-chalk-dim">
              {mainEvent.fighterA.displayName} vs {mainEvent.fighterB.displayName}
              <span className="ml-2 text-sm text-muted">{mainEvent.divisionName}</span>
            </p>
          ) : null}
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <MapPin className="size-4" />
            {[event.venue, event.city, event.country].filter(Boolean).join(', ') || 'Venue TBC'}
            <span className="text-faint">·</span>
            {event.boutCount} bouts
            {event.status === 'completed' ? (
              <>
                <span className="text-faint">·</span>
                {event.completedCount} results
              </>
            ) : null}
          </p>
        </Container>
      </section>

      <Container className="py-8 sm:py-10">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
          <div className="min-w-0">
            <SectionHeader eyebrow="Full card" title="Bouts" />
            {ordered.length === 0 ? (
              <EmptyState title="No bouts on this card yet" />
            ) : (
              <div className="border-t border-line-soft">
                {ordered.map((fight) => (
                  <FightRow key={fight.id} fight={fight} />
                ))}
              </div>
            )}
          </div>

          <aside className="min-w-0 space-y-10">
            <section>
              <SectionHeader eyebrow="Generated after this card" title="Ranking update" />
              {movers.length === 0 ? (
                <EmptyState
                  title="No positions changed"
                  description={
                    event.status === 'scheduled'
                      ? 'This card has not happened yet.'
                      : 'Every result confirmed the existing order.'
                  }
                />
              ) : (
                <MoversList movers={movers} />
              )}
            </section>

            {bonusWinners.length > 0 ? (
              <section>
                <SectionHeader eyebrow="Awarded on the night" title="Performance bonuses" />
                <ul className="border-t border-line-soft">
                  {bonusWinners.map((fight) => (
                    <li key={fight.id} className="border-b border-line-soft py-2.5">
                      <div className="flex items-start gap-2">
                        <Award className="mt-0.5 size-4 shrink-0 text-signal" />
                        <div className="min-w-0">
                          <div className="text-sm text-chalk">
                            {fight.fighterA.displayName} vs {fight.fighterB.displayName}
                          </div>
                          <div className="text-xs text-muted">
                            {(fight.bonuses ?? [])
                              .map((b) => b.replace(/_/g, ' '))
                              .join(' · ')}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </Container>
    </>
  )
}
