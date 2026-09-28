import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { RankingHistoryEntry } from '@/types/domain'
import { shortDate } from '@/lib/format'
import { EmptyState } from './ui'

/**
 * Ranking history (§19).
 *
 * One series, so no legend — the heading names it. The y-axis is reversed
 * because #1 is the top of the sport; position 0 is the championship and is
 * labelled "C" rather than a number.
 */

interface Point {
  date: string
  rank: number
  rating: number | null
  reasons: string[]
  isChampion: boolean
}

// Recharts writes these straight onto SVG attributes, where `var(--token)`
// is not resolved — so the palette is mirrored here by hand. Keep in step
// with `--color-signal` / `--color-line-soft` / `--color-faint`.
const LINE = '#D7272A'
const GRID = '#171717'
const AXIS = '#6F6F6F'
const SURFACE = '#0A0A0A'
const CURSOR = '#2A2A2A'

export function RankingChart({
  history,
  height = 220,
}: {
  history: RankingHistoryEntry[]
  height?: number
}) {
  const points = useMemo<Point[]>(
    () =>
      history
        .filter((entry) => entry.newRank !== null)
        .map((entry) => ({
          date: entry.effectiveDate,
          rank: entry.newRank as number,
          rating: entry.newRating,
          reasons: entry.movementReason,
          isChampion: entry.newRank === 0,
        })),
    [history],
  )

  if (points.length < 2) {
    return (
      <EmptyState
        title="Not enough history yet"
        description="A ranking chart appears once a fighter has moved at least twice."
      />
    )
  }

  const ranks = points.map((p) => p.rank)
  const maxRank = Math.max(...ranks)
  const minRank = Math.min(...ranks)
  const domain: [number, number] = [Math.max(0, minRank - 1), maxRank + 1]

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => value.slice(0, 7)}
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            reversed
            domain={domain}
            allowDecimals={false}
            tick={{ fill: AXIS, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(value: number) => (value === 0 ? 'C' : `#${value}`)}
          />
          <Tooltip
            cursor={{ stroke: CURSOR, strokeWidth: 1 }}
            content={<RankTooltip />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Line
            type="stepAfter"
            dataKey="rank"
            stroke={LINE}
            strokeWidth={2}
            dot={{ r: 3, fill: SURFACE, stroke: LINE, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RankTooltip({ active, payload }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as Point
  return (
    <div className="max-w-72 border border-line bg-ink-850 px-3 py-2 shadow-xl">
      <div className="flex items-baseline justify-between gap-4">
        <span className="numeral text-lg text-chalk">
          {point.isChampion ? 'Champion' : `#${point.rank}`}
        </span>
        <span className="text-xs text-muted">{shortDate(point.date)}</span>
      </div>
      {point.rating !== null ? (
        <div className="mt-0.5 text-xs text-muted">Rating {Math.round(point.rating)}</div>
      ) : null}
      {point.reasons.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5">
          {point.reasons.slice(0, 4).map((reason) => (
            <li key={reason} className="text-xs leading-snug text-chalk-dim">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** A compact rating sparkline, used on comparison and profile headers. */
export function RatingSparkline({
  history,
  height = 56,
}: {
  history: RankingHistoryEntry[]
  height?: number
}) {
  const points = history
    .filter((entry) => entry.newRating !== null)
    .map((entry) => ({ date: entry.effectiveDate, rating: entry.newRating as number }))

  if (points.length < 2) return null

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <YAxis hide domain={['dataMin - 20', 'dataMax + 20']} />
          <Tooltip
            cursor={{ stroke: CURSOR, strokeWidth: 1 }}
            content={<RatingTooltip />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Line
            type="monotone"
            dataKey="rating"
            stroke={LINE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: LINE }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RatingTooltip({ active, payload }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as { date: string; rating: number }
  return (
    <div className="border border-line bg-ink-850 px-2 py-1 text-xs">
      <span className="numeral text-chalk">{Math.round(point.rating)}</span>
      <span className="ml-2 text-muted">{shortDate(point.date)}</span>
    </div>
  )
}
