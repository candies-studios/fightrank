import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { FighterAvatar } from '@/components/FighterAvatar'
import { RankPlate } from '@/components/Movement'
import { RankingChart } from '@/components/RankingChart'
import {
  Container,
  EmptyState,
  ErrorState,
  Input,
  SectionHeader,
  Skeleton,
} from '@/components/ui'
import type { FighterProfile, RankingHistoryEntry } from '@/types/domain'
import { cn } from '@/lib/cn'
import { flagOf, percent, record, relativeDays } from '@/lib/format'

interface Metric {
  label: string
  get: (f: FighterProfile) => number
  format?: (value: number) => string
  /** Lower is better (e.g. days inactive). */
  invert?: boolean
}

const METRICS: Metric[] = [
  { label: 'Ranking score', get: (f) => f.rankingScore },
  { label: 'Rating', get: (f) => f.rating },
  { label: 'Wins', get: (f) => f.wins },
  { label: 'Losses', get: (f) => f.losses, invert: true },
  { label: 'Win streak', get: (f) => f.winStreak },
  { label: 'KO / TKO wins', get: (f) => f.koWins },
  { label: 'Submission wins', get: (f) => f.subWins },
  { label: 'Decision wins', get: (f) => f.decWins },
  { label: 'Ranked wins', get: (f) => f.rankedWins },
  { label: 'Finish rate', get: (f) => f.finishRate, format: (v) => percent(v) },
  { label: 'Recent form', get: (f) => f.recentForm, format: (v) => percent(v) },
  { label: 'Strength of schedule', get: (f) => f.strengthOfSchedule },
  { label: 'Days since last bout', get: (f) => f.daysInactive ?? 9999, invert: true },
]

export default function Compare() {
  const repository = useRepository()
  const { revision } = useApp()
  const [params, setParams] = useSearchParams()
  const slugA = params.get('a') ?? ''
  const slugB = params.get('b') ?? ''

  const { data, error, loading, reload } = useAsync(
    async () => {
      const [a, b] = await Promise.all([
        slugA ? repository.getFighter(slugA) : Promise.resolve(null),
        slugB ? repository.getFighter(slugB) : Promise.resolve(null),
      ])
      const [historyA, historyB] = await Promise.all([
        a ? repository.listRankingHistory(a.id) : Promise.resolve([]),
        b ? repository.listRankingHistory(b.id) : Promise.resolve([]),
      ])
      return { a, b, historyA, historyB }
    },
    [slugA, slugB, repository, revision],
  )

  const setSlot = (slot: 'a' | 'b', slug: string) => {
    const next = new URLSearchParams(params)
    if (slug) next.set(slot, slug)
    else next.delete(slot)
    setParams(next, { replace: true })
  }

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader eyebrow="Head to head" title="Compare fighters"
        level={1} />

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FighterPicker
          slot="A"
          selected={data?.a ?? null}
          onSelect={(slug) => setSlot('a', slug)}
          onClear={() => setSlot('a', '')}
        />
        <FighterPicker
          slot="B"
          selected={data?.b ?? null}
          onSelect={(slug) => setSlot('b', slug)}
          onClear={() => setSlot('b', '')}
        />
      </div>

      {loading ? (
        <Skeleton className="mt-8 h-96 w-full" />
      ) : data?.a && data?.b ? (
        <ComparisonTable
          a={data.a}
          b={data.b}
          historyA={data.historyA}
          historyB={data.historyB}
        />
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Pick two fighters"
            description="Search above to load a head-to-head comparison of records, ratings and ranking history."
          />
        </div>
      )}
    </Container>
  )
}

function FighterPicker({
  slot,
  selected,
  onSelect,
  onClear,
}: {
  slot: string
  selected: FighterProfile | null
  onSelect: (slug: string) => void
  onClear: () => void
}) {
  const repository = useRepository()
  const [term, setTerm] = useState('')
  const debounced = useDebounced(term, 200)

  const { data } = useAsync(
    () =>
      debounced.trim().length >= 2
        ? repository.listFighters({ search: debounced, pageSize: 6, sort: 'rank' })
        : Promise.resolve({ rows: [], total: 0 }),
    [debounced, repository],
  )

  if (selected) {
    return (
      <div className="flex items-center gap-3 border border-line bg-ink-800 p-4">
        <FighterAvatar
          id={selected.id}
          name={selected.displayName}
          photoUrl={selected.photoUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-[0.58rem]">Fighter {slot}</div>
          <Link
            to={`/fighters/${selected.slug}`}
            className="block truncate font-display text-2xl font-bold uppercase text-chalk transition hover:text-signal"
          >
            {selected.displayName}
          </Link>
          <div className="truncate text-xs text-muted">
            {flagOf(selected.countryCode)} {selected.divisionName ?? 'Unassigned'} ·{' '}
            {record(selected)}
          </div>
        </div>
        <RankPlate
          position={selected.currentRank}
          isChampion={selected.isChampion}
          isInterim={selected.isInterimChampion}
        />
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-xs text-faint transition hover:text-fall"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="border border-dashed border-line bg-ink-850 p-4">
      <div className="eyebrow mb-2 text-[0.58rem]">Fighter {slot}</div>
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search a fighter…"
        aria-label={`Search fighter ${slot}`}
      />
      {(data?.rows.length ?? 0) > 0 ? (
        <ul className="mt-2 divide-y divide-line-soft border border-line">
          {data?.rows.map((fighter) => (
            <li key={fighter.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(fighter.slug)
                  setTerm('')
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-ink-700"
              >
                <FighterAvatar
                  id={fighter.id}
                  name={fighter.displayName}
                  photoUrl={fighter.photoUrl}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                  {fighter.displayName}
                </span>
                <span className="shrink-0 text-xs text-faint">{fighter.divisionName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ComparisonTable({
  a,
  b,
  historyA,
  historyB,
}: {
  a: FighterProfile
  b: FighterProfile
  historyA: RankingHistoryEntry[]
  historyB: RankingHistoryEntry[]
}) {
  const rows = useMemo(
    () =>
      METRICS.map((metric) => {
        const valueA = metric.get(a)
        const valueB = metric.get(b)
        const better =
          valueA === valueB
            ? null
            : metric.invert
              ? valueA < valueB
                ? 'a'
                : 'b'
              : valueA > valueB
                ? 'a'
                : 'b'
        const max = Math.max(Math.abs(valueA), Math.abs(valueB), 1)
        return { metric, valueA, valueB, better, max }
      }),
    [a, b],
  )

  const fmt = (metric: Metric, value: number) =>
    metric.format ? metric.format(value) : Math.round(value).toLocaleString('en-GB')

  return (
    <div className="mt-8 space-y-8">
      <div className="border border-line bg-ink-800">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line px-4 py-3 text-sm">
          <span className="truncate text-right font-medium text-chalk">{a.displayName}</span>
          <span className="eyebrow text-[0.58rem]">versus</span>
          <span className="truncate font-medium text-chalk">{b.displayName}</span>
        </div>
        <ul className="divide-y divide-line-soft">
          {rows.map(({ metric, valueA, valueB, better, max }) => (
            <li key={metric.label} className="px-4 py-2.5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <span
                  className={cn(
                    'numeral text-right text-lg',
                    better === 'a' ? 'text-signal' : 'text-chalk-dim',
                  )}
                >
                  {fmt(metric, valueA)}
                </span>
                <span className="w-32 text-center text-[0.7rem] uppercase tracking-wider text-faint sm:w-44">
                  {metric.label}
                </span>
                <span
                  className={cn(
                    'numeral text-lg',
                    better === 'b' ? 'text-signal' : 'text-chalk-dim',
                  )}
                >
                  {fmt(metric, valueB)}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <span className="flex justify-end">
                  <span
                    className={cn('h-1', better === 'a' ? 'bg-signal' : 'bg-ink-500')}
                    style={{ width: `${(Math.abs(valueA) / max) * 100}%` }}
                  />
                </span>
                <span className="w-32 sm:w-44" />
                <span className="flex justify-start">
                  <span
                    className={cn('h-1', better === 'b' ? 'bg-signal' : 'bg-ink-500')}
                    style={{ width: `${(Math.abs(valueB) / max) * 100}%` }}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-4 border-t border-line px-4 py-3 text-xs text-muted">
          <span className="text-right">Last bout {relativeDays(a.lastFightDate)}</span>
          <span>Last bout {relativeDays(b.lastFightDate)}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { fighter: a, history: historyA },
          { fighter: b, history: historyB },
        ].map(({ fighter, history }) => (
          <div key={fighter.id} className="border border-line bg-ink-800 p-4">
            <div className="eyebrow mb-3">{fighter.displayName} — ranking history</div>
            <RankingChart history={history} height={200} />
          </div>
        ))}
      </div>
    </div>
  )
}
