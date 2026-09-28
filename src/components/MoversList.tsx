import { Link } from 'react-router-dom'
import type { Mover } from '@/types/domain'
import { cn } from '@/lib/cn'
import { shortDate } from '@/lib/format'
import { FighterAvatar } from './FighterAvatar'
import { EmptyState } from './ui'

/**
 * Biggest movers (§31). Every row is read from `ranking_history` — no movement
 * is ever entered by hand.
 */
export function MoversList({
  movers,
  showReasons = true,
  limit,
}: {
  movers: Mover[]
  showReasons?: boolean
  limit?: number
}) {
  const rows = limit ? movers.slice(0, limit) : movers

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No movement recorded yet"
        description="Rankings move when results are recorded. Add a fight result and the engine will fill this in."
      />
    )
  }

  return (
    <ul className="flex flex-col">
      {rows.map((mover) => (
        <li
          key={`${mover.fighter.id}-${mover.divisionId}-${mover.effectiveDate}`}
          className="border-b border-line-soft last:border-b-0"
        >
          <Link
            to={`/fighters/${mover.fighter.slug}`}
            className="group flex items-start gap-3 py-3 transition-colors hover:bg-ink-800"
          >
            <span
              className={cn(
                'numeral mt-0.5 flex h-8 w-10 shrink-0 items-center justify-center gap-0.5 rounded-xs text-base',
                mover.movement > 0 ? 'bg-rise/12 text-rise' : 'bg-fall/12 text-fall',
              )}
            >
              {mover.movement > 0 ? '▲' : '▼'}
              {Math.abs(mover.movement)}
            </span>
            <FighterAvatar
              id={mover.fighter.id}
              name={mover.fighter.displayName}
              photoUrl={mover.fighter.photoUrl}
              size="sm"
              className="hidden sm:flex"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="truncate font-medium text-chalk transition-colors group-hover:text-signal">
                  {mover.fighter.displayName}
                </span>
                <span className="numeral text-sm text-muted">
                  #{mover.previousRank ?? '—'} → #{mover.newRank ?? '—'}
                </span>
              </div>
              <div className="text-xs text-faint">
                {mover.divisionName} · {shortDate(mover.effectiveDate)}
              </div>
              {showReasons && mover.reasons.length > 0 ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                  {mover.reasons.slice(0, 3).join(' · ')}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
