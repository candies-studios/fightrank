import { ArrowDown, ArrowUp, Minus, Sparkles } from 'lucide-react'
import type { MovementLabel } from '@/types/domain'
import { cn } from '@/lib/cn'

/**
 * Ranking movement (§17). Colour is used only here and in the score
 * breakdown — everywhere else the palette stays neutral.
 */
export function Movement({
  movement,
  label,
  size = 'md',
  showZero = true,
}: {
  movement: number
  label: MovementLabel
  size?: 'sm' | 'md' | 'lg'
  showZero?: boolean
}) {
  const text = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
  const icon = size === 'sm' ? 'size-3' : size === 'lg' ? 'size-4' : 'size-3.5'

  if (label === 'new') {
    return (
      <span className={cn('inline-flex items-center gap-1 font-display font-semibold tracking-[0.1em] text-signal', text)}>
        <Sparkles className={icon} />
        NEW
      </span>
    )
  }
  if (label === 'out') {
    return (
      <span className={cn('inline-flex items-center gap-1 font-display font-semibold tracking-[0.1em] text-faint', text)}>
        OUT
      </span>
    )
  }
  if (movement === 0) {
    if (!showZero) return null
    return (
      <span className={cn('inline-flex items-center text-flat', text)} title="No change">
        <Minus className={icon} />
      </span>
    )
  }

  const up = movement > 0
  return (
    <span
      className={cn(
        'numeral inline-flex items-center gap-0.5 tabular-nums',
        up ? 'text-rise' : 'text-fall',
        text,
      )}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(movement)} ${Math.abs(movement) === 1 ? 'place' : 'places'}`}
    >
      {up ? <ArrowUp className={icon} /> : <ArrowDown className={icon} />}
      {Math.abs(movement)}
    </span>
  )
}

export function RankPlate({
  position,
  isChampion,
  isInterim,
  size = 'md',
}: {
  position: number | null
  isChampion?: boolean
  isInterim?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const box =
    size === 'sm' ? 'h-7 min-w-7 text-sm' : size === 'lg' ? 'h-14 min-w-14 text-2xl' : 'h-10 min-w-10 text-lg'

  if (isChampion) {
    return (
      <span
        className={cn(
          'numeral inline-flex items-center justify-center rounded-xs bg-signal px-1.5 text-ink-900',
          box,
        )}
        title="Champion"
      >
        C
      </span>
    )
  }
  if (position === null) {
    return (
      <span
        className={cn(
          'numeral inline-flex items-center justify-center rounded-xs border border-line px-1.5 text-faint',
          box,
        )}
        title="Unranked"
      >
        NR
      </span>
    )
  }
  return (
    <span
      className={cn(
        'numeral inline-flex items-center justify-center rounded-xs px-1.5',
        isInterim ? 'bg-signal-wash text-signal' : 'bg-ink-600 text-chalk',
        box,
      )}
      title={isInterim ? 'Interim champion' : `Ranked #${position}`}
    >
      {position}
    </span>
  )
}
