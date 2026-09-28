import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

/**
 * Fighter imagery.
 *
 * `photo_url` is a first-class field, so a real deployment shows real
 * photography. The demo roster is fictional and therefore has no photographs —
 * rather than borrow anyone's likeness it renders a deterministic monogram
 * plate derived from the fighter's id, which keeps the rankings legible and
 * gives each fighter a stable visual identity.
 */

const SIZES = {
  xs: 'size-7 text-[0.6rem]',
  sm: 'size-10 text-xs',
  md: 'size-14 text-sm',
  lg: 'size-20 text-lg',
  xl: 'size-32 text-3xl',
  hero: 'size-full text-6xl',
} as const

function hueFrom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return hash
}

export function FighterAvatar({
  name,
  id,
  photoUrl,
  size = 'md',
  className,
  square,
}: {
  name: string
  id: string
  photoUrl?: string | null
  size?: keyof typeof SIZES
  className?: string
  square?: boolean
}) {
  const hue = hueFrom(id || name)

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className={cn(
          'shrink-0 border border-line object-cover',
          square ? 'rounded-none' : 'rounded-xs',
          SIZES[size],
          className,
        )}
      />
    )
  }

  return (
    <div
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden border border-line',
        square ? 'rounded-none' : 'rounded-xs',
        SIZES[size],
        className,
      )}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 22% 16%) 0%, hsl(${(hue + 40) % 360} 18% 9%) 100%)`,
      }}
    >
      <span
        className="numeral leading-none"
        style={{ color: `hsl(${hue} 45% 72%)` }}
      >
        {initials(name)}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: `hsl(${hue} 55% 45%)` }}
      />
    </div>
  )
}
