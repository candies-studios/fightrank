import { useMemo } from 'react'
import type { Division } from '@/types/domain'
import { cn } from '@/lib/cn'

/**
 * Division picker. Divisions come from the database (§3) — nothing here is
 * hard-coded, including the men/women grouping, which is read from the row.
 */
export function DivisionSelector({
  divisions,
  value,
  onChange,
  includeP4P,
  className,
}: {
  divisions: Division[]
  value: string
  onChange: (slug: string) => void
  includeP4P?: boolean
  className?: string
}) {
  const groups = useMemo(() => {
    const usable = divisions.filter((d) => includeP4P || !d.isP4P)
    const byGender = new Map<string, Division[]>()
    for (const division of usable) {
      const key = division.isP4P ? 'Pound-for-Pound' : division.gender === 'women' ? 'Women' : 'Men'
      byGender.set(key, [...(byGender.get(key) ?? []), division])
    }
    return [...byGender.entries()]
  }, [divisions, includeP4P])

  return (
    <div className={className}>
      {/* Compact control for small screens */}
      <label className="block sm:hidden">
        <span className="sr-only">Division</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border border-line bg-ink-850 px-3 py-2.5 font-display text-base font-semibold uppercase tracking-wide text-chalk"
        >
          {groups.map(([label, items]) => (
            <optgroup key={label} label={label}>
              {items.map((division) => (
                <option key={division.id} value={division.slug}>
                  {division.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* Full pill rail from tablet up */}
      <div className="hidden flex-col gap-3 sm:flex">
        {groups.map(([label, items]) => (
          <div key={label} className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <span className="eyebrow w-14 shrink-0 text-[0.6rem]">{label}</span>
            {items.map((division) => (
              <button
                key={division.id}
                type="button"
                onClick={() => onChange(division.slug)}
                className={cn(
                  'border px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.06em] transition-colors',
                  value === division.slug
                    ? 'border-signal bg-signal text-ink-900'
                    : 'border-line text-chalk-dim hover:border-chalk-dim hover:text-chalk',
                )}
              >
                {division.isP4P ? 'P4P' : division.name.replace(/^Women's\s*/, '')}
                {division.weightLbs ? (
                  <span
                    className={cn(
                      'ml-1.5 text-[0.7rem] font-normal',
                      value === division.slug ? 'text-ink-700' : 'text-faint',
                    )}
                  >
                    {division.weightLbs}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
