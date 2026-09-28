import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { DisciplineSelector } from '@/components/DisciplineSelector'
import { DivisionSelector } from '@/components/DivisionSelector'
import { RankingTable } from '@/components/RankingTable'
import {
  Container,
  EmptyState,
  ErrorState,
  SectionHeader,
  TableSkeleton,
} from '@/components/ui'
import { shortDate } from '@/lib/format'

/**
 * Divisional standings.
 *
 * Every discipline is ranked independently, so the page reads discipline first,
 * division second. The division slug in the URL already carries its discipline
 * (`wrestling-lightweight`), which keeps every ranking link unambiguous.
 */
export default function Rankings() {
  const { divisionSlug } = useParams()
  const navigate = useNavigate()
  const { disciplines, divisions, revision } = useApp()
  const repository = useRepository()

  const competitive = useMemo(() => divisions.filter((d) => !d.isP4P), [divisions])
  const active = useMemo(
    () => competitive.find((d) => d.slug === divisionSlug) ?? competitive[0],
    [competitive, divisionSlug],
  )
  const discipline = useMemo(
    () => disciplines.find((d) => d.id === active?.disciplineId) ?? disciplines[0],
    [disciplines, active],
  )
  const disciplineDivisions = useMemo(
    () => competitive.filter((d) => d.disciplineId === discipline?.id),
    [competitive, discipline],
  )

  useEffect(() => {
    if (!divisionSlug && active) navigate(`/rankings/${active.slug}`, { replace: true })
  }, [divisionSlug, active, navigate])

  const { data, error, loading, reload } = useAsync(
    () => (active ? repository.listRankings(active.id) : Promise.resolve([])),
    [active?.id, repository, revision],
  )

  const lastUpdated = data?.[0]?.fighter.createdAt ?? null

  const switchDiscipline = (disciplineId: string) => {
    const first = competitive.find((d) => d.disciplineId === disciplineId)
    if (first) navigate(`/rankings/${first.slug}`)
  }

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader
        eyebrow="Divisional standings"
        title="Rankings"
        level={1}
        action={
          <Link
            to="/methodology"
            className="hidden items-center gap-1.5 text-sm text-muted transition hover:text-signal sm:flex"
          >
            <Info className="size-4" />
            How this is calculated
          </Link>
        }
      />

      <DisciplineSelector
        disciplines={disciplines}
        value={discipline?.id ?? ''}
        onChange={switchDiscipline}
        className="mb-5"
      />

      <DivisionSelector
        divisions={disciplineDivisions}
        value={active?.slug ?? ''}
        onChange={(slug) => navigate(`/rankings/${slug}`)}
        className="mb-8"
      />

      {active ? (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="eyebrow mb-1">
              <Link to={`/disciplines/${discipline?.slug ?? ''}`} className="hover:text-signal">
                {discipline?.name}
              </Link>
            </div>
            <h2 className="text-3xl text-chalk sm:text-4xl">{active.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {active.weightLbs ? `${active.weightLbs} lb / ${active.weightKg} kg limit · ` : ''}
              Champion plus {data ? Math.max(0, data.length - 1) : 0} ranked contenders
            </p>
          </div>
          {lastUpdated ? (
            <p className="text-xs text-faint">Last computed {shortDate(lastUpdated)}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={10} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="This division has no rankings yet"
          description="Rankings appear as soon as bouts in this division have been recorded and the engine has run."
        />
      ) : (
        <RankingTable rows={data} />
      )}

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-faint">
        Positions are produced by the FIGHTRANK engine from recorded results in{' '}
        {discipline?.name ?? 'this discipline'} only — a result in another discipline never moves a
        rating here. The champion is listed above the contenders and does not occupy #1. An interim
        champion is shown with a shield and is placed first among the contenders.
      </p>
    </Container>
  )
}
