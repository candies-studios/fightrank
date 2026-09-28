import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { Container, ErrorState, Panel, SectionHeader, Skeleton } from '@/components/ui'

/**
 * The disciplines index.
 *
 * Each discipline is ranked in isolation, so this page is the honest entry
 * point: pick the sport, then the division. The counts underneath each card are
 * read from the database rather than written into the copy.
 */
export default function Disciplines() {
  const { disciplines, divisions, revision } = useApp()
  const repository = useRepository()

  const { data, error, loading } = useAsync(async () => {
    const [champions, rosters] = await Promise.all([
      repository.listChampions(),
      Promise.all(
        disciplines.map(async (discipline) => ({
          id: discipline.id,
          athletes: (await repository.listDisciplineRoster(discipline.id)).length,
        })),
      ),
    ])
    return {
      championsBy: champions.reduce<Record<string, number>>((acc, row) => {
        acc[row.disciplineId] = (acc[row.disciplineId] ?? 0) + 1
        return acc
      }, {}),
      rosterBy: Object.fromEntries(rosters.map((r) => [r.id, r.athletes])),
    }
  }, [repository, disciplines, revision])

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader eyebrow="One platform, five sports" title="Disciplines" level={1} />

      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted">
        FIGHTRANK ranks each discipline as a world of its own. An athlete carries one Fighter ID
        across all of them, but their rating in each is built only from results contested under
        that discipline&rsquo;s rules — beating a national-level wrestler says nothing about how
        you strike, so it never moves your Muay Thai rating.
      </p>

      {error ? <ErrorState error={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {disciplines.map((discipline) => {
          const divisionCount = divisions.filter(
            (d) => d.disciplineId === discipline.id && !d.isP4P,
          ).length
          return (
            <Panel key={discipline.id} className="group relative overflow-hidden">
              <div
                className="h-1 w-full"
                style={{ backgroundColor: discipline.accent ?? 'var(--color-signal)' }}
              />
              <div className="p-6">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-2xl text-chalk">{discipline.name}</h2>
                  <span className="eyebrow text-[0.62rem]">{discipline.shortCode}</span>
                </div>
                {discipline.tagline ? (
                  <p className="mt-1 text-sm text-signal">{discipline.tagline}</p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-muted">{discipline.description}</p>
                {discipline.ruleset ? (
                  <p className="mt-3 border-l-2 border-line pl-3 text-xs leading-relaxed text-faint">
                    {discipline.ruleset}
                  </p>
                ) : null}

                <dl className="mt-5 grid grid-cols-3 gap-px border border-line bg-line">
                  {[
                    { label: 'Divisions', value: divisionCount },
                    {
                      label: 'Athletes',
                      value: loading ? null : (data?.rosterBy[discipline.id] ?? 0),
                    },
                    {
                      label: 'Champions',
                      value: loading ? null : (data?.championsBy[discipline.id] ?? 0),
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-ink-800 px-3 py-2.5">
                      <dt className="eyebrow text-[0.58rem]">{stat.label}</dt>
                      <dd className="numeral mt-1 text-2xl leading-none text-chalk">
                        {stat.value === null ? <Skeleton className="h-6 w-10" /> : stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <Link
                  to={`/disciplines/${discipline.slug}`}
                  className="mt-5 inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-chalk transition-colors hover:text-signal"
                >
                  Enter {discipline.shortCode}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Panel>
          )
        })}
      </div>
    </Container>
  )
}
