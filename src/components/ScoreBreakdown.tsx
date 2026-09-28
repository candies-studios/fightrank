import type { ScoreBreakdown as Breakdown } from '@/types/domain'
import { cn } from '@/lib/cn'
import { signed } from '@/lib/format'

/**
 * Ranking score breakdown (§42).
 *
 * Every number on this panel comes from `ranking_breakdowns`, written by the
 * engine. The components are guaranteed to sum to the final score — the engine
 * has a test that asserts exactly that.
 *
 * Direction is carried by the sign, the bar's side of the axis AND the colour,
 * so it never depends on colour alone.
 */

interface Component {
  key: keyof Breakdown & string
  label: string
  explain: string
}

const COMPONENTS: Component[] = [
  { key: 'opponentQuality', label: 'Opponent quality', explain: 'Strength of recent opposition (§10)' },
  { key: 'recentForm', label: 'Recent form', explain: 'Results in the recent-form window (§11)' },
  { key: 'winStreak', label: 'Win streak', explain: 'Consecutive wins, capped (§12)' },
  { key: 'finishBonus', label: 'Finish rate', explain: 'Share of recent wins ending inside the distance' },
  { key: 'activity', label: 'Activity', explain: 'Inactivity decay or recent-bout bonus (§13)' },
  { key: 'titleBonus', label: 'Championship', explain: 'Title-status modifier (§14)' },
]

export function ScoreBreakdownPanel({
  breakdown,
  className,
}: {
  breakdown: Breakdown
  className?: string
}) {
  const rows = COMPONENTS.map((component) => ({
    ...component,
    value: Number(breakdown[component.key] ?? 0),
  }))
  const scale = Math.max(12, ...rows.map((row) => Math.abs(row.value)))

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-baseline justify-between border-b border-line pb-2.5">
        <div>
          <div className="eyebrow text-[0.62rem]">Base rating</div>
          <p className="mt-0.5 text-xs text-faint">Cumulative Elo across every rated bout</p>
        </div>
        <span className="numeral text-3xl text-chalk">{Math.round(breakdown.baseRating)}</span>
      </div>

      <ul className="flex flex-col divide-y divide-line-soft">
        {rows.map((row) => {
          const width = `${(Math.abs(row.value) / scale) * 50}%`
          const positive = row.value > 0
          const zero = Math.abs(row.value) < 0.5
          return (
            <li key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm text-chalk-dim">{row.label}</div>
                <div className="truncate text-xs text-faint">{row.explain}</div>
              </div>
              <span
                className={cn(
                  'numeral w-14 text-right text-base tabular-nums',
                  zero ? 'text-faint' : positive ? 'text-rise' : 'text-fall',
                )}
              >
                {zero ? '0' : signed(row.value)}
              </span>
              {/* Diverging bar: centre line is zero, right is positive. */}
              <div className="col-span-2 mt-1.5 flex h-1.5 w-full items-stretch">
                <div className="flex w-1/2 justify-end">
                  {!positive && !zero ? (
                    <span className="bg-fall" style={{ width }} aria-hidden />
                  ) : null}
                </div>
                <span className="w-px bg-ink-500" aria-hidden />
                <div className="flex w-1/2 justify-start">
                  {positive && !zero ? (
                    <span className="bg-rise" style={{ width }} aria-hidden />
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-1 flex items-baseline justify-between border-t-2 border-signal pt-2.5">
        <div className="eyebrow text-[0.62rem] text-signal">Final ranking score</div>
        <span className="numeral text-4xl leading-none text-signal">
          {Math.round(breakdown.finalScore)}
        </span>
      </div>
    </div>
  )
}

/** Plain-language reading of the same numbers (§18). */
export function WhyThisRanking({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <ol className="flex flex-col gap-2.5">
      {lines.map((line, index) => (
        <li key={line} className="flex gap-3">
          <span className="numeral mt-0.5 w-5 shrink-0 text-sm text-signal">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-sm leading-relaxed text-chalk-dim">{line}</span>
        </li>
      ))}
    </ol>
  )
}
