import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Building2, Radio, Users } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { Container, ErrorState, Panel, SectionHeader, Skeleton } from '@/components/ui'

const TIERS = [
  {
    icon: Building2,
    title: 'Gyms and academies',
    body:
      'Register your athletes once and their record follows them across every discipline they compete in. Team pages pull straight from the same data the rankings are built on, so a corrected result updates everywhere at once.',
  },
  {
    icon: Users,
    title: 'Promotions and event organisers',
    body:
      'Submit a card before it happens and results after it. Each bout is validated on the way in — no athlete booked twice on one night, no winner recorded on a draw — and the ranking movement it caused is published alongside the result.',
  },
  {
    icon: BarChart3,
    title: 'Data and analytics',
    body:
      'Rankings, ratings and the full score breakdown are available through the same read-only interface the site itself uses. Every figure is reproducible from the underlying results, which makes it citable.',
  },
  {
    icon: Radio,
    title: 'Media and broadcast',
    body:
      'Ranking tables, movement summaries and head-to-head comparisons are yours to publish, with the methodology documented so your audience can check the working.',
  },
]

/**
 * Partners. The academy list is read from the roster rather than typed in, so
 * it can never drift from the athletes actually registered.
 */
export default function Partners() {
  const { disciplines, revision } = useApp()
  const repository = useRepository()

  const { data, error, loading } = useAsync(
    () => repository.listFighters({ pageSize: 500 }),
    [repository, revision],
  )

  const academies = useMemo(() => {
    const counts = new Map<string, number>()
    for (const fighter of data?.rows ?? []) {
      if (!fighter.team) continue
      counts.set(fighter.team, (counts.get(fighter.team) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [data])

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader eyebrow="Work with us" title="Partners" level={1} />

      <p className="mb-10 max-w-3xl text-sm leading-relaxed text-muted">
        FIGHTRANK is only as good as the results it is given. The platform is built to be fed by the
        people closest to the sport — the gyms that train the athletes, the promoters who put on the
        cards, and the officials who record what happened. Everything submitted is published with
        its source, and everything published can be traced back to a bout.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <Panel key={tier.title} className="p-5">
            <tier.icon className="size-5 text-signal" />
            <h2 className="mt-3 font-display text-base font-semibold uppercase tracking-[0.06em] text-chalk">
              {tier.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{tier.body}</p>
          </Panel>
        ))}
      </div>

      <SectionHeader
        className="mt-12"
        eyebrow={`Across ${disciplines.length} disciplines`}
        title="Academies represented"
      />
      {error ? <ErrorState error={error} /> : null}
      {loading ? (
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {academies.map(([team, count]) => (
            <li
              key={team}
              className="flex items-center justify-between gap-3 bg-ink-800 px-4 py-3.5"
            >
              <span className="min-w-0 truncate text-sm text-chalk">{team}</span>
              <span className="numeral shrink-0 text-sm text-faint">{count}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-faint">
        Athlete counts are live from the roster. The academies listed above are part of this
        installation&rsquo;s{' '}
        <strong className="text-muted">fictional demonstration data</strong> and do not represent
        real organisations.
      </p>

      <Panel className="mt-12 p-6">
        <h2 className="text-xl text-chalk">Getting listed</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          There is no fee and no editorial deal. An organisation is listed here once its athletes
          are registered and its results are being submitted — the same standard for everyone, which
          is the only way a ranking stays worth reading. Registration is handled through the
          administration panel by whoever operates this installation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/methodology"
            className="border border-line px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-chalk-dim transition-colors hover:border-signal hover:text-signal"
          >
            Read the methodology
          </Link>
          <Link
            to="/disciplines"
            className="border border-line px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-chalk-dim transition-colors hover:border-signal hover:text-signal"
          >
            Browse the disciplines
          </Link>
        </div>
      </Panel>
    </Container>
  )
}
