import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { DisciplineSelector } from '@/components/DisciplineSelector'
import { FighterAvatar } from '@/components/FighterAvatar'
import { RankPlate } from '@/components/Movement'
import {
  Button,
  Container,
  EmptyState,
  ErrorState,
  Input,
  SectionHeader,
  Select,
  Skeleton,
} from '@/components/ui'
import { flagOf, record, relativeDays } from '@/lib/format'

const PAGE_SIZE = 24

export default function Fighters() {
  const repository = useRepository()
  const { disciplines, divisions, revision } = useApp()
  const [search, setSearch] = useState('')
  const [disciplineId, setDisciplineId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [sort, setSort] = useState<'rank' | 'rating' | 'name' | 'recent'>('rank')
  const [page, setPage] = useState(0)
  const debounced = useDebounced(search, 250)

  const { data, error, loading, reload } = useAsync(
    () =>
      repository.listFighters({
        search: debounced,
        disciplineId: disciplineId || null,
        divisionId: divisionId || null,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [repository, debounced, disciplineId, divisionId, sort, page, revision],
  )

  const total = data?.total ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader eyebrow={`${total.toLocaleString('en-GB')} on record`} title="Fighters"
        level={1} />

      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted">
        Every athlete holds one Fighter ID for life. The rank shown here is their standing in their
        primary discipline; open a profile to see every record they hold.
      </p>

      <DisciplineSelector
        disciplines={disciplines}
        value={disciplineId}
        allLabel="All disciplines"
        onChange={(id) => {
          setDisciplineId(id)
          setDivisionId('')
          setPage(0)
        }}
        className="mb-4"
      />

      <div className="mb-6 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder="Search by name…"
            className="pl-9"
            aria-label="Search fighters"
          />
        </div>
        <Select
          value={divisionId}
          onChange={(event) => {
            setDivisionId(event.target.value)
            setPage(0)
          }}
          aria-label="Filter by division"
        >
          <option value="">All divisions</option>
          {divisions
            .filter((d) => !d.isP4P && (!disciplineId || d.disciplineId === disciplineId))
            .map((division) => (
              <option key={division.id} value={division.id}>
                {disciplines.find((disc) => disc.id === division.disciplineId)?.shortCode} ·{' '}
                {division.name}
              </option>
            ))}
        </Select>
        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          aria-label="Sort"
        >
          <option value="rank">By ranking</option>
          <option value="rating">By rating</option>
          <option value="recent">Most recently active</option>
          <option value="name">Alphabetical</option>
        </Select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          title="No fighters match"
          description="Try a different name, or clear the division filter."
          action={
            <Button
              size="sm"
              onClick={() => {
                setSearch('')
                setDisciplineId('')
                setDivisionId('')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.rows.map((fighter) => (
              <Link
                key={fighter.id}
                to={`/fighters/${fighter.slug}`}
                className="group flex items-center gap-3 border border-line bg-ink-800 p-3 transition-colors hover:border-signal/50"
              >
                <FighterAvatar
                  id={fighter.id}
                  name={fighter.displayName}
                  photoUrl={fighter.photoUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-chalk transition-colors group-hover:text-signal">
                    {fighter.displayName}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {flagOf(fighter.countryCode)}{' '}
                    {fighter.disciplineCode ? (
                      <span className="text-signal">{fighter.disciplineCode}</span>
                    ) : null}{' '}
                    {fighter.divisionName ?? 'Unassigned'}
                    {fighter.disciplineCount > 1 ? (
                      <span className="text-faint"> +{fighter.disciplineCount - 1}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-faint">
                    <span className="numeral text-chalk-dim">{record(fighter)}</span>
                    <span>·</span>
                    <span className="truncate">{relativeDays(fighter.lastFightDate)}</span>
                  </div>
                </div>
                <RankPlate
                  position={fighter.currentRank}
                  isChampion={fighter.isChampion}
                  isInterim={fighter.isInterimChampion}
                  size="sm"
                />
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
              <Button
                size="sm"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Container>
  )
}
