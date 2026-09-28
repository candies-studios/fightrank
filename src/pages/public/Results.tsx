import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { DisciplineSelector } from '@/components/DisciplineSelector'
import { FightRow } from '@/components/FightRow'
import {
  Container,
  EmptyState,
  ErrorState,
  Panel,
  SectionHeader,
  Select,
  Skeleton,
} from '@/components/ui'
import { shortDate } from '@/lib/format'

const PAGE = 60

/**
 * Every recorded result, newest first, grouped by the card it was contested on.
 * Filterable by discipline and division; the ranking movement each result
 * caused is one click away on the event page.
 */
export default function Results() {
  const [params, setParams] = useSearchParams()
  const { disciplines, divisions, revision } = useApp()
  const repository = useRepository()
  const [limit, setLimit] = useState(PAGE)

  const disciplineSlug = params.get('discipline') ?? ''
  const divisionSlug = params.get('division') ?? ''

  const discipline = disciplines.find((d) => d.slug === disciplineSlug) ?? null
  const division = divisions.find((d) => d.slug === divisionSlug) ?? null
  const divisionOptions = useMemo(
    () =>
      divisions.filter((d) => !d.isP4P && (!discipline || d.disciplineId === discipline.id)),
    [divisions, discipline],
  )

  const { data, error, loading, reload } = useAsync(
    () =>
      repository.listFights({
        status: 'completed',
        disciplineId: discipline?.id,
        divisionId: division?.id,
        limit,
      }),
    [repository, discipline?.id, division?.id, limit, revision],
  )

  const byEvent = useMemo(() => {
    const groups = new Map<string, { name: string; slug: string; date: string; fights: typeof data }>()
    for (const fight of data ?? []) {
      const existing = groups.get(fight.eventId)
      if (existing) existing.fights?.push(fight)
      else
        groups.set(fight.eventId, {
          name: fight.eventName,
          slug: fight.eventSlug,
          date: fight.eventDate,
          fights: [fight],
        })
    }
    return [...groups.values()]
  }, [data])

  const setFilter = (key: 'discipline' | 'division', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // A division belongs to one discipline, so changing the sport clears it.
    if (key === 'discipline') next.delete('division')
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader eyebrow="Every recorded bout" title="Results" level={1} />

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted">
        These are the facts the rankings are built from. Every position on this site traces back to
        a row on this page — nothing is entered by hand into a ranking table.
      </p>

      <DisciplineSelector
        disciplines={disciplines}
        value={discipline?.id ?? ''}
        allLabel="All disciplines"
        onChange={(id) =>
          setFilter('discipline', disciplines.find((d) => d.id === id)?.slug ?? '')
        }
        className="mb-4"
      />

      <label className="mb-8 block max-w-xs">
        <span className="sr-only">Division</span>
        <Select
          value={division?.slug ?? ''}
          onChange={(event) => setFilter('division', event.target.value)}
        >
          <option value="">All divisions</option>
          {divisionOptions.map((d) => (
            <option key={d.id} value={d.slug}>
              {disciplines.find((disc) => disc.id === d.disciplineId)?.shortCode} · {d.name}
            </option>
          ))}
        </Select>
      </label>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : byEvent.length === 0 ? (
        <EmptyState
          title="No results match this filter"
          description="Try a different discipline or division."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {byEvent.map((event) => (
            <section key={event.slug}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  to={`/events/${event.slug}`}
                  className="font-display text-lg font-semibold uppercase tracking-[0.06em] text-chalk transition-colors hover:text-signal"
                >
                  {event.name}
                </Link>
                <span className="text-xs text-faint">{shortDate(event.date)}</span>
              </div>
              <Panel className="px-4">
                {event.fights?.map((fight) => (
                  <FightRow key={fight.id} fight={fight} />
                ))}
              </Panel>
            </section>
          ))}
        </div>
      )}

      {data && data.length >= limit ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            className="border border-line px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-chalk-dim transition-colors hover:border-signal hover:text-signal"
          >
            {loading ? 'Loading…' : 'Show earlier results'}
          </button>
        </div>
      ) : null}
    </Container>
  )
}
