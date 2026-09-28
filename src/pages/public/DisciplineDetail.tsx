import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Trophy } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { FighterAvatar } from '@/components/FighterAvatar'
import { FightRow } from '@/components/FightRow'
import { MoversList } from '@/components/MoversList'
import {
  Container,
  EmptyState,
  ErrorState,
  Panel,
  SectionHeader,
  Skeleton,
  StatTile,
} from '@/components/ui'
import { flagOf, record } from '@/lib/format'
import NotFound from './NotFound'

/**
 * One discipline's front page: its rules, its divisions, its champions, its
 * own pound-for-pound list and its most recent results. Everything here is
 * scoped to this discipline — nothing leaks in from the others.
 */
export default function DisciplineDetail() {
  const { disciplineSlug } = useParams()
  const { disciplines, divisions, revision } = useApp()
  const repository = useRepository()

  const discipline = useMemo(
    () => disciplines.find((d) => d.slug === disciplineSlug),
    [disciplines, disciplineSlug],
  )
  const ownDivisions = useMemo(
    () => divisions.filter((d) => d.disciplineId === discipline?.id && !d.isP4P),
    [divisions, discipline],
  )

  const { data, error, loading } = useAsync(async () => {
    if (!discipline) return null
    const [champions, p4p, roster, movers, results] = await Promise.all([
      repository.listChampions(discipline.id),
      repository.listP4P(8, discipline.id),
      repository.listDisciplineRoster(discipline.id),
      repository.listMovers(5, discipline.id),
      repository.listFights({ disciplineId: discipline.id, status: 'completed', limit: 8 }),
    ])
    return { champions, p4p, roster, movers, results }
  }, [repository, discipline?.id, revision])

  // Every bout is counted by both of its participants, so halving the roster's
  // total gives the discipline's real bout count without a second query.
  const boutCount = Math.round(
    (data?.roster ?? []).reduce((sum, entry) => sum + entry.totalFights, 0) / 2,
  )

  if (disciplines.length > 0 && !discipline) return <NotFound />

  return (
    <div>
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: discipline?.accent ?? 'var(--color-signal)' }}
      />

      <Container className="py-8 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <div className="eyebrow mb-2">
            <Link to="/disciplines" className="hover:text-signal">
              Disciplines
            </Link>
            <span className="mx-2 text-faint">/</span>
            {discipline?.shortCode}
          </div>
          <h1 className="text-4xl text-chalk sm:text-5xl">{discipline?.name}</h1>
          {discipline?.tagline ? (
            <p className="mt-2 text-lg text-signal">{discipline.tagline}</p>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-muted">{discipline?.description}</p>
          {discipline?.ruleset ? (
            <p className="mt-4 border-l-2 border-line pl-3 text-xs leading-relaxed text-faint">
              {discipline.ruleset}
            </p>
          ) : null}
        </div>

        {error ? <ErrorState error={error} /> : null}

        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Divisions" value={ownDivisions.length} />
          <StatTile label="Athletes" value={loading ? '—' : (data?.roster.length ?? 0)} />
          <StatTile
            label="Champions"
            value={loading ? '—' : (data?.champions.length ?? 0)}
            tone="signal"
          />
          <StatTile label="Recorded bouts" value={loading ? '—' : boutCount} />
        </div>

        {/* Divisions ---------------------------------------------------- */}
        <SectionHeader eyebrow="Weight classes" title="Divisions" />
        <div className="mb-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {ownDivisions.map((division) => {
            const champion = data?.champions.find((c) => c.divisionId === division.id)
            return (
              <Link
                key={division.id}
                to={`/rankings/${division.slug}`}
                className="group flex items-center justify-between gap-3 bg-ink-800 px-4 py-3.5 transition-colors hover:bg-ink-700"
              >
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-chalk">
                    {division.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {loading ? (
                      <Skeleton className="h-3 w-24" />
                    ) : champion ? (
                      <>
                        <Trophy className="mr-1 inline size-3 text-signal" />
                        {champion.fighter.displayName}
                      </>
                    ) : (
                      'Vacant'
                    )}
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-signal" />
              </Link>
            )
          })}
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          {/* Pound for pound ------------------------------------------- */}
          <section>
            <SectionHeader
              eyebrow={`${discipline?.shortCode} only`}
              title="Pound for pound"
              action={
                <Link to="/p4p" className="text-sm text-muted transition hover:text-signal">
                  All lists
                </Link>
              }
            />
            <Panel className="px-4">
              {loading ? (
                <div className="flex flex-col gap-2 py-4">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !data?.p4p.length ? (
                <div className="py-6">
                  <EmptyState
                    title="No pound-for-pound list yet"
                    description="The list appears once enough bouts have been recorded in this discipline."
                  />
                </div>
              ) : (
                <ul>
                  {data.p4p.map((row) => (
                    <li key={row.fighterId} className="border-b border-line-soft last:border-b-0">
                      <Link
                        to={`/fighters/${row.fighter.slug}`}
                        className="flex items-center gap-3 py-2.5 transition-colors hover:bg-ink-700"
                      >
                        <span className="numeral w-7 shrink-0 text-center text-lg text-chalk-dim">
                          {row.position}
                        </span>
                        <FighterAvatar
                          id={row.fighter.id}
                          name={row.fighter.displayName}
                          photoUrl={row.fighter.photoUrl}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-chalk">
                            {flagOf(row.fighter.countryCode)} {row.fighter.displayName}
                          </div>
                          <div className="truncate text-xs text-muted">
                            {row.fighter.divisionName} · {record(row.fighter)}
                          </div>
                        </div>
                        <span className="numeral shrink-0 text-sm text-signal">
                          {row.score.toFixed(1)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          {/* Movement --------------------------------------------------- */}
          <section>
            <SectionHeader eyebrow="Since the last card" title="Biggest movers" />
            <Panel className="px-4">
              {loading ? (
                <div className="flex flex-col gap-2 py-4">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <MoversList movers={data?.movers ?? []} showReasons />
              )}
            </Panel>
          </section>
        </div>

        {/* Recent results ------------------------------------------------ */}
        <section className="mt-12">
          <SectionHeader
            eyebrow="Most recent first"
            title="Latest results"
            action={
              <Link to="/results" className="text-sm text-muted transition hover:text-signal">
                All results
              </Link>
            }
          />
          <Panel className="px-4">
            {loading ? (
              <div className="flex flex-col gap-2 py-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !data?.results.length ? (
              <div className="py-6">
                <EmptyState
                  title="No results recorded yet"
                  description="Completed bouts in this discipline will appear here."
                />
              </div>
            ) : (
              data.results.map((fight) => (
                <FightRow key={fight.id} fight={fight} showEvent />
              ))
            )}
          </Panel>
        </section>
      </Container>
    </div>
  )
}
