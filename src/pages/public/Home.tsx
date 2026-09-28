import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Crown, TrendingUp } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import type { EventCard } from '@/data/mappers'
import type { DashboardStats } from '@/data/repository'
import type { RankingRow } from '@/types/domain'
import { flagOf, record, shortDate } from '@/lib/format'

/**
 * Home page.
 *
 * Laid out the way the Warriors Dream Series site is: a video hero, one
 * featured card, a filterable grid of past events, champion cards, and the
 * season schedule. Every section reads from the database — nothing on this
 * page is written by hand, so an empty install shows honest empty states
 * rather than invented fighters.
 */

/**
 * YouTube id for the looping hero background. Set to an empty string to drop
 * the video and fall back to the still gradient.
 */
const HERO_VIDEO_ID = 'F2Uu6WP3tu0'

/** Shared width — WDS runs a 1240px column rather than the app's wider 1400. */
const WRAP = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6'

export default function Home() {
  const repository = useRepository()
  const { revision, disciplines } = useApp()
  const [filter, setFilter] = useState<string>('all')

  const { data, error, loading, reload } = useAsync(
    async () => {
      const [scheduled, completed, champions, stats] = await Promise.all([
        repository.listEvents({ status: 'scheduled', pageSize: 6 }),
        repository.listEvents({ status: 'completed', pageSize: 12 }),
        repository.listChampions(),
        repository.dashboardStats(),
      ])
      return {
        scheduled: scheduled.rows,
        completed: completed.rows,
        champions,
        stats,
      }
    },
    [repository, revision],
  )

  // The card at the top is whatever matters most right now: the next scheduled
  // event if one exists, otherwise the most recent completed one.
  const featured = data?.scheduled[0] ?? data?.completed[0] ?? null

  const past = useMemo(() => {
    const rows = data?.completed ?? []
    if (filter === 'all') return rows.slice(0, 6)
    return rows.filter((event) => event.disciplineCodes.includes(filter)).slice(0, 6)
  }, [data?.completed, filter])

  const schedule = useMemo(() => {
    const rows = [...(data?.scheduled ?? []), ...(data?.completed ?? [])]
    return rows
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
      .slice(0, 6)
  }, [data?.scheduled, data?.completed])

  if (error) {
    return (
      <div className={`${WRAP} py-16`}>
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  }

  return (
    <>
      <Hero stats={data?.stats ?? null} />

      <FeaturedEvent event={featured} loading={loading} />

      {/* ---------- Past events ---------- */}
      <section className="py-[70px]">
        <div className={WRAP}>
          <SectionHead eyebrow="The season so far" title="Past events" />

          {disciplines.length > 1 ? (
            <div className="mb-9 flex flex-wrap justify-center gap-3.5">
              {[{ shortCode: 'all', name: 'All' }, ...disciplines].map((discipline) => {
                const value = discipline.shortCode
                const active = filter === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={
                      'rounded-xs border px-5 py-2.5 text-[0.82rem] font-semibold uppercase tracking-[0.08em] transition-colors ' +
                      (active
                        ? 'border-signal bg-signal text-white'
                        : 'border-line text-muted hover:border-signal hover:bg-signal hover:text-white')
                    }
                  >
                    {discipline.name}
                  </button>
                )
              })}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[300px]" />
              ))}
            </div>
          ) : past.length === 0 ? (
            <EmptyState
              title="No completed events yet"
              description="Cards appear here the moment their results are recorded in the admin panel."
            />
          ) : (
            <>
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <EventTile key={event.id} event={event} />
                ))}
              </div>
              <div className="mt-9 text-center">
                <Link to="/events">
                  <Button variant="secondary" size="lg">
                    Show all events
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ---------- Champions ---------- */}
      <section className="bg-ink-800 py-[70px]">
        <div className={WRAP}>
          <SectionHead eyebrow="The best of FIGHTRANK" title="Fighter rankings" />
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : (data?.champions.length ?? 0) === 0 ? (
            <EmptyState
              title="No champions yet"
              description="A belt is awarded the moment a title-fight result is recorded — never by hand."
            />
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data?.champions.slice(0, 6).map((row) => (
                  <ChampionCard key={row.fighterId} row={row} />
                ))}
              </div>
              <div className="mt-9 text-center">
                <Link to="/rankings">
                  <Button variant="secondary" size="lg" icon={<ArrowRight className="size-4" />}>
                    Every division
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ---------- Schedule ---------- */}
      <section className="py-[70px]">
        <div className={WRAP}>
          <SectionHead eyebrow="Mark your calendar" title="Season schedule" />
          {loading ? (
            <div className="flex flex-col gap-3.5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
          ) : schedule.length === 0 ? (
            <EmptyState
              title="Nothing on the calendar"
              description="Add an event in the admin panel and it appears here straight away."
            />
          ) : (
            <div className="flex flex-col gap-3.5">
              {schedule.map((event) => (
                <ScheduleRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      <MethodologyStrip />
    </>
  )
}

/* ------------------------------------------------------------------ pieces */

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-11 text-center">
      <span className="eyebrow mb-2.5 inline-block">{eyebrow}</span>
      <h2 className="text-[clamp(2rem,4vw,2.8rem)] text-chalk">{title}</h2>
    </div>
  )
}

function Hero({ stats }: { stats: DashboardStats | null }) {
  const tiles = [
    { label: 'Disciplines', value: stats?.disciplines },
    { label: 'Ranked athletes', value: stats?.fighters },
    { label: 'Recorded bouts', value: stats?.fights },
    // One division per discipline is the pound-for-pound list, not a weight class.
    { label: 'Divisions', value: stats ? stats.divisions - stats.disciplines : undefined },
    { label: 'Champions', value: stats?.champions },
  ]

  return (
    <section className="relative flex min-h-[560px] items-center overflow-hidden bg-ink-900 py-[120px] sm:min-h-[640px] sm:py-[150px]">
      {/* The lit gradient sits under the video so the hero still reads right
          if YouTube is blocked, slow, or switched off above. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(70% 90% at 15% 0%, rgba(215,39,42,0.18) 0%, transparent 60%), #050505',
        }}
      />
      {HERO_VIDEO_ID ? (
        <div className="hero-video" aria-hidden>
          <iframe
            src={`https://www.youtube.com/embed/${HERO_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${HERO_VIDEO_ID}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1`}
            title="FIGHTRANK background video"
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      <div className="hero-scrim" aria-hidden />

      <div className={`relative z-[2] ${WRAP}`}>
        <div className="max-w-[860px] text-center lg:ml-auto lg:text-right">
          <span className="eyebrow animate-fade mb-2.5 inline-block">
            Transparent competitive rankings
          </span>
          <h1 className="animate-rise text-[clamp(2.4rem,4.6vw,4.2rem)] leading-[1.02] text-chalk">
            Every Fight Changes
            <br />
            <span className="text-signal">The Ranking</span>
          </h1>
          <p className="animate-fade mx-auto mt-4.5 max-w-[620px] text-[1.05rem] leading-relaxed text-muted lg:mr-0">
            Rankings across mixed martial arts, grappling, wrestling, Muay Thai and kickboxing —
            calculated from recorded results, with every movement published alongside its reasons.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-end">
            <Link to="/rankings">
              <Button variant="primary" size="lg" icon={<ArrowRight className="size-4" />}>
                View rankings
              </Button>
            </Link>
            <Link to="/fighter-id">
              <Button variant="secondary" size="lg">
                Fighter ID lookup
              </Button>
            </Link>
          </div>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5">
          {tiles.map((stat) => (
            <div key={stat.label} className="bg-ink-900/85 px-4 py-5 backdrop-blur-sm">
              <dd className="numeral text-4xl leading-none text-chalk sm:text-5xl">
                {stat.value === undefined ? (
                  <span className="text-ink-500">&mdash;</span>
                ) : (
                  stat.value.toLocaleString('en-GB')
                )}
              </dd>
              <dt className="mt-2 text-[0.62rem] font-semibold tracking-[0.18em] text-muted uppercase">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/** The offset white card over a wide event image — the WDS showcase block. */
function FeaturedEvent({ event, loading }: { event: EventCard | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="py-[70px]">
        <div className={WRAP}>
          <Skeleton className="h-[380px]" />
        </div>
      </section>
    )
  }
  if (!event) return null

  const ended = event.status === 'completed'

  return (
    <section className="py-[70px]">
      <div className={`${WRAP} flex flex-col items-center md:flex-row`}>
        <div className="relative w-full md:w-[58%]">
          <span className="absolute -top-3.5 left-7 z-[1] rounded-xs border border-ink-500 bg-ink-600 px-4 py-2 text-[0.78rem] font-bold tracking-[0.15em] text-chalk-dim uppercase">
            {ended ? 'Event ended' : 'Upcoming'}
          </span>
          {event.posterUrl ? (
            <img
              src={event.posterUrl}
              alt={event.name}
              className="w-full rounded-md shadow-[0_30px_60px_rgba(0,0,0,0.7)]"
            />
          ) : (
            <div
              className="flex aspect-[16/10] w-full items-center justify-center rounded-md shadow-[0_30px_60px_rgba(0,0,0,0.7)]"
              style={{
                background:
                  'linear-gradient(135deg, #1a0405 0%, #0d0d0d 55%), radial-gradient(60% 80% at 20% 10%, rgba(215,39,42,0.35), transparent 70%)',
              }}
            >
              {/* The white card overlaps the right edge of this tile on
                  desktop, so the placeholder title keeps clear of it. */}
              <span className="numeral px-6 text-center text-[clamp(2rem,5vw,3.4rem)] text-signal md:pr-[22%] md:text-left">
                {event.name}
              </span>
            </div>
          )}
        </div>

        <div className="relative z-[2] -mt-10 w-full rounded-sm bg-white px-6 py-9 text-[#111] shadow-[-20px_20px_60px_rgba(0,0,0,0.6)] md:-mt-0 md:-ml-[8%] md:w-[46%] md:px-12 md:py-11">
          <span className="eyebrow mb-2.5 inline-block">
            {event.disciplineCodes.join(' · ') || 'Championship series'}
          </span>
          <h2 className="text-[2.2rem] text-black md:text-[2.6rem]">{event.name}</h2>
          {event.mainEventLabel ? (
            <p className="text-[#555]">{event.mainEventLabel}</p>
          ) : null}

          <div className="my-5 grid grid-cols-2 gap-4.5 border-y border-[#eee] py-5.5">
            <div>
              <strong className="mb-1 block text-[0.72rem] tracking-[0.12em] text-[#999] uppercase">
                Date
              </strong>
              <span className="text-base font-semibold">{shortDate(event.eventDate)}</span>
            </div>
            <div>
              <strong className="mb-1 block text-[0.72rem] tracking-[0.12em] text-[#999] uppercase">
                Bouts
              </strong>
              <span className="text-base font-semibold">
                {event.completedCount}/{event.boutCount} recorded
              </span>
            </div>
            {event.venue || event.city ? (
              <div className="col-span-2">
                <strong className="mb-1 block text-[0.72rem] tracking-[0.12em] text-[#999] uppercase">
                  Venue
                </strong>
                <span className="text-base font-semibold">
                  {[event.venue, event.city, event.country].filter(Boolean).join(', ')}
                </span>
              </div>
            ) : null}
          </div>

          <Link
            to={`/events/${event.slug}`}
            className="inline-flex items-center gap-2.5 rounded-xs bg-signal px-7 py-3.5 text-sm font-semibold tracking-[0.08em] text-white uppercase transition-colors hover:bg-black"
          >
            {ended ? 'View results' : 'View card'}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function EventTile({ event }: { event: EventCard }) {
  return (
    <Link
      to={`/events/${event.slug}`}
      className="lift group flex flex-col overflow-hidden rounded-md border border-line bg-ink-800"
    >
      <div className="aspect-[16/10] overflow-hidden bg-black">
        {event.posterUrl ? (
          <img
            src={event.posterUrl}
            alt={event.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center"
            style={{
              background:
                'linear-gradient(135deg, #160304 0%, #0a0a0a 60%), radial-gradient(60% 80% at 25% 15%, rgba(215,39,42,0.3), transparent 70%)',
            }}
          >
            <span className="numeral px-4 text-center text-3xl text-signal/80">{event.name}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="text-[0.7rem] font-bold tracking-[0.15em] text-signal uppercase">
          {event.disciplineCodes.join(' · ') || 'Event'}
        </span>
        <h3 className="my-2 text-2xl text-chalk transition-colors group-hover:text-signal">
          {event.name}
        </h3>
        <div className="mb-3.5 text-[0.82rem] text-muted uppercase">
          {[event.venue, event.city].filter(Boolean).join(' · ') || 'Venue to be confirmed'}
        </div>
        <div className="mt-auto border-b border-line pb-3.5 text-[0.82rem] font-semibold text-chalk-dim">
          {shortDate(event.eventDate)}
        </div>
        <span className="mt-3.5 rounded-xs bg-ink-600 px-2.5 py-2.5 text-center text-[0.72rem] font-bold tracking-[0.1em] text-muted uppercase">
          {event.completedCount}/{event.boutCount} bouts recorded
        </span>
      </div>
    </Link>
  )
}

function ChampionCard({ row }: { row: RankingRow }) {
  return (
    <Link
      to={`/fighters/${row.fighter.slug}`}
      className="lift group block rounded-md border border-line bg-ink-900 px-7 py-8 text-center"
    >
      <div className="font-semibold tracking-[0.06em] text-signal">{record(row.fighter)}</div>
      <div className="my-2 text-[0.8rem] tracking-[0.15em] text-muted uppercase">
        {row.fighter.divisionName ?? 'Unassigned'}
        {row.isInterimChampion ? ' · Interim champion' : ' champion'}
      </div>
      <h3 className="text-[1.9rem] text-chalk transition-colors group-hover:text-signal">
        {flagOf(row.fighter.countryCode)} {row.fighter.displayName}
      </h3>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[0.85rem] text-muted">
        <Crown className="size-3.5 text-signal" />
        {row.fighter.disciplineCode} · rating {Math.round(row.rating)}
      </div>
    </Link>
  )
}

function ScheduleRow({ event }: { event: EventCard }) {
  const ended = event.status === 'completed'
  return (
    <Link
      to={`/events/${event.slug}`}
      className="grid items-center gap-4.5 rounded-md border border-line bg-ink-800 px-6 py-4.5 transition-colors hover:border-signal sm:grid-cols-[120px_1fr_1fr_auto]"
    >
      <span
        className={
          'rounded-xs px-2.5 py-1.5 text-center text-[0.68rem] font-bold tracking-[0.1em] uppercase ' +
          (ended ? 'bg-ink-600 text-muted' : 'bg-signal text-white')
        }
      >
        {ended ? 'Ended' : 'Scheduled'}
      </span>
      <div>
        <span className="block text-[0.68rem] font-bold tracking-[0.15em] text-signal uppercase">
          {event.disciplineCodes.join(' · ') || 'Event'}
        </span>
        <h4 className="text-[1.25rem] text-chalk">{event.name}</h4>
      </div>
      <div className="text-[0.85rem] text-muted">
        {[event.venue, event.city].filter(Boolean).join(', ') || '—'}
      </div>
      <div className="text-[0.9rem] font-semibold whitespace-nowrap text-chalk-dim">
        {shortDate(event.eventDate)}
      </div>
    </Link>
  )
}

function MethodologyStrip() {
  const steps = [
    {
      n: '01',
      title: 'Who you beat',
      body: 'Every result is an Elo adjustment against the opponent’s actual rating — beating a better fighter is worth more, always.',
    },
    {
      n: '02',
      title: 'How strong they were',
      body: 'An opponent-quality multiplier scales the reward by where that opponent stood on the night, from champion down to unranked.',
    },
    {
      n: '03',
      title: 'How you won',
      body: 'Finishes carry a bonus. A decision win is never worth less than no win — the bonus only ever adds.',
    },
    {
      n: '04',
      title: 'Form, streaks, activity',
      body: 'Recent results, sustained winning and time since the last bout adjust the standing — each capped so none can dominate.',
    },
  ]

  return (
    <section className="border-t border-line bg-ink-800 py-[70px]">
      <div className={WRAP}>
        <SectionHead eyebrow="No opinion. No votes. No promotion." title="How a position is earned" />
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.n} className="bg-ink-800 p-6">
              <div className="numeral text-3xl text-signal">{step.n}</div>
              <h3 className="mt-3 text-xl text-chalk">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-9 text-center">
          <Link to="/methodology">
            <Button variant="secondary" size="lg" icon={<TrendingUp className="size-4" />}>
              Full methodology
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
