import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { DisciplineSelector } from '@/components/DisciplineSelector'
import { FighterAvatar } from '@/components/FighterAvatar'
import { Movement } from '@/components/Movement'
import {
  Container,
  EmptyState,
  ErrorState,
  SectionHeader,
  TableSkeleton,
} from '@/components/ui'
import { P4P_COMPONENT_LABELS } from '@/ranking/p4pEngine'
import { flagOf, record } from '@/lib/format'

/**
 * Pound-for-pound (§20) — its own model, not a merge of the divisional tables,
 * and one list per discipline. Ranking a grappler against a kickboxer would be
 * exactly the comparison this system exists to avoid.
 */
export default function PoundForPound() {
  const repository = useRepository()
  const { disciplines, revision } = useApp()
  const [disciplineId, setDisciplineId] = useState('')
  const active = disciplines.find((d) => d.id === disciplineId) ?? disciplines[0] ?? null

  const { data, error, loading, reload } = useAsync(
    () => (active ? repository.listP4P(20, active.id) : Promise.resolve([])),
    [repository, active?.id, revision],
  )

  return (
    <Container className="py-8 sm:py-12">
      <SectionHeader eyebrow="Best fighters, any weight" title="Pound for pound"
        level={1} />

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted">
        The pound-for-pound list is scored separately from the divisional rankings. Six normalised
        components — overall rating, quality of opposition, recent form, dominance, championship
        success and activity — are combined using weights an administrator controls independently.
        Each discipline gets its own list, because there is no honest way to score a wrestler
        against a Muay Thai fighter.
      </p>

      <DisciplineSelector
        disciplines={disciplines}
        value={active?.id ?? ''}
        onChange={setDisciplineId}
        className="mb-8"
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={10} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title={`No ${active?.name ?? ''} pound-for-pound ranking yet`}
          description="The list appears once enough bouts have been recorded in this discipline."
        />
      ) : (
        <ul className="border-t border-line">
          {data.map((row) => (
            <li key={row.fighterId} className="border-b border-line-soft">
              <Link
                to={`/fighters/${row.fighter.slug}`}
                className="group grid grid-cols-[2.5rem_auto_1fr_auto] items-center gap-3 py-3 transition-colors hover:bg-ink-800 sm:grid-cols-[3.5rem_auto_1fr_10rem_auto] sm:gap-4"
              >
                <span className="numeral text-center text-2xl text-signal sm:text-4xl">
                  {row.position}
                </span>
                <FighterAvatar
                  id={row.fighterId}
                  name={row.fighter.displayName}
                  photoUrl={row.fighter.photoUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold uppercase text-chalk transition-colors group-hover:text-signal sm:text-xl">
                    {row.fighter.displayName}
                  </div>
                  <div className="truncate text-xs text-muted sm:text-sm">
                    {flagOf(row.fighter.countryCode)} {row.fighter.divisionName ?? 'Unassigned'} ·{' '}
                    {record(row.fighter)}
                    {row.fighter.currentRank !== null
                      ? ` · ${row.fighter.currentRank === 0 ? 'champion' : `#${row.fighter.currentRank}`} in division`
                      : ''}
                  </div>
                  <ComponentBars components={row.components} className="mt-2 sm:hidden" />
                </div>
                <ComponentBars components={row.components} className="hidden sm:flex" />
                <div className="flex flex-col items-end gap-1">
                  <span className="numeral text-xl text-chalk">{row.score.toFixed(1)}</span>
                  <Movement movement={row.movement} label={row.movementLabel} size="sm" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}

function ComponentBars({
  components,
  className,
}: {
  components: Record<string, number>
  className?: string
}) {
  const keys = Object.keys(P4P_COMPONENT_LABELS)
  return (
    <div className={`flex items-end gap-1 ${className ?? ''}`}>
      {keys.map((key) => {
        const value = Math.max(0, Math.min(1, components[key] ?? 0))
        return (
          <span
            key={key}
            className="relative block h-8 w-2.5 bg-ink-600"
            title={`${P4P_COMPONENT_LABELS[key]}: ${Math.round(value * 100)}%`}
          >
            <span
              className="absolute inset-x-0 bottom-0 bg-signal"
              style={{ height: `${Math.max(4, value * 100)}%` }}
            />
          </span>
        )
      })}
    </div>
  )
}
