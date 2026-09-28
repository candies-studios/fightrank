import type { Discipline } from '@/types/domain'
import { cn } from '@/lib/cn'

/**
 * Discipline picker.
 *
 * A discipline is a self-contained competitive world, so this sits *above* the
 * division rail: pick the sport first, then the weight class inside it.
 * Disciplines come from the database — nothing here is hard-coded.
 */
export function DisciplineSelector({
  disciplines,
  value,
  onChange,
  allLabel,
  className,
}: {
  disciplines: Discipline[]
  /** Discipline id, or '' when `allLabel` is given and "all" is selected. */
  value: string
  onChange: (disciplineId: string) => void
  /** When set, adds a leading "everything" option. */
  allLabel?: string
  className?: string
}) {
  const options = [
    ...(allLabel ? [{ id: '', name: allLabel, shortCode: 'ALL', accent: null }] : []),
    ...disciplines,
  ]

  return (
    <div className={className}>
      <label className="block sm:hidden">
        <span className="sr-only">Discipline</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border border-line bg-ink-850 px-3 py-2.5 font-display text-base font-semibold uppercase tracking-wide text-chalk"
        >
          {options.map((discipline) => (
            <option key={discipline.id || 'all'} value={discipline.id}>
              {discipline.name}
            </option>
          ))}
        </select>
      </label>

      <div className="hidden flex-wrap gap-2 sm:flex">
        {options.map((discipline) => {
          const selected = value === discipline.id
          return (
            <button
              key={discipline.id || 'all'}
              type="button"
              onClick={() => onChange(discipline.id)}
              style={
                selected && discipline.accent
                  ? { backgroundColor: discipline.accent, borderColor: discipline.accent }
                  : undefined
              }
              className={cn(
                'flex items-center gap-2 border px-3.5 py-2 font-display text-sm font-semibold uppercase tracking-[0.06em] transition-colors',
                selected
                  ? 'border-signal bg-signal text-ink-900'
                  : 'border-line text-chalk-dim hover:border-chalk-dim hover:text-chalk',
              )}
            >
              {discipline.name}
              <span
                className={cn(
                  'text-[0.7rem] font-normal',
                  selected ? 'text-ink-900/70' : 'text-faint',
                )}
              >
                {discipline.shortCode}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
