/**
 * UI primitives (§44).
 *
 * Squared-off, high-contrast, minimal radius — the visual language is closer to
 * a broadcast data panel than to a rounded SaaS card.
 */

import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-signal text-ink-900 hover:bg-signal-bright disabled:bg-signal-dim disabled:text-ink-700',
  secondary:
    'border border-line bg-ink-800 text-chalk hover:border-chalk-dim hover:bg-ink-700',
  ghost: 'text-chalk-dim hover:bg-ink-700 hover:text-chalk',
  danger: 'border border-fall/50 text-fall hover:bg-fall hover:text-ink-900',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-7 text-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xs font-display text-[0.95em] font-semibold uppercase tracking-[0.08em]',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

// ---------------------------------------------------------------------------
// Panel / section
// ---------------------------------------------------------------------------
export function Panel({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border border-line bg-ink-800', className)} {...rest}>
      {children}
    </div>
  )
}

export function Container({
  children,
  className,
  size = 'wide',
}: {
  children: ReactNode
  className?: string
  size?: 'wide' | 'narrow'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        size === 'wide' ? 'max-w-[1400px]' : 'max-w-4xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
  level = 2,
}: {
  eyebrow?: string
  title: ReactNode
  action?: ReactNode
  className?: string
  /** Use 1 for the page's own title so every page has exactly one <h1>. */
  level?: 1 | 2
}) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <Heading className="truncate text-2xl text-chalk sm:text-3xl">{title}</Heading>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------
const FIELD_BASE =
  'w-full rounded-xs border bg-ink-850 px-3 py-2 text-sm text-chalk placeholder:text-faint ' +
  'transition-colors focus:outline-none focus:ring-0 disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: (props: { id: string; invalid: boolean }) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="eyebrow text-[0.68rem] text-chalk-dim">
        {label}
        {required ? <span className="ml-1 text-signal">*</span> : null}
      </label>
      {children({ id, invalid: Boolean(error) })}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-fall">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        FIELD_BASE,
        invalid ? 'border-fall focus:border-fall' : 'border-line focus:border-signal',
        className,
      )}
      {...rest}
    />
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        FIELD_BASE,
        'appearance-none bg-[length:14px] bg-[right_0.6rem_center] bg-no-repeat pr-8',
        invalid ? 'border-fall' : 'border-line focus:border-signal',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%237b7b86' stroke-width='1.6'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        FIELD_BASE,
        'min-h-24 resize-y',
        invalid ? 'border-fall' : 'border-line focus:border-signal',
        className,
      )}
      {...rest}
    />
  )
})

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 border border-line bg-ink-850 p-3 text-left transition-colors hover:border-ink-500 disabled:opacity-50"
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-signal' : 'bg-ink-500',
        )}
      >
        <span
          className={cn(
            'size-4 rounded-full bg-ink-900 transition-transform duration-150',
            checked && 'translate-x-4',
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-chalk">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-faint">{hint}</span> : null}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'signal' | 'rise' | 'fall' | 'outline'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-600 text-chalk-dim',
    signal: 'bg-signal-wash text-signal',
    rise: 'bg-rise/12 text-rise',
    fall: 'bg-fall/12 text-fall',
    outline: 'border border-line text-muted',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 font-display text-[0.7rem] font-semibold uppercase tracking-[0.1em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// State displays
// ---------------------------------------------------------------------------
export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={cn('shimmer rounded-xs', className)} style={style} />
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-px">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-line px-6 py-14 text-center">
      <div className="text-faint">{icon ?? <Info className="size-6" />}</div>
      <h3 className="text-lg text-chalk-dim">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-fall/30 bg-fall/5 px-6 py-12 text-center">
      <AlertTriangle className="size-6 text-fall" />
      <h3 className="text-lg text-chalk">Something went wrong</h3>
      <p className="max-w-lg text-sm text-muted">{error.message}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-muted', className)} />
}

// ---------------------------------------------------------------------------
// Modal / confirmation
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

  return (
    <div className="scrim fixed inset-0 z-50 flex items-end justify-center bg-ink-900/80 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-rise relative max-h-[92vh] w-full overflow-y-auto border border-line bg-ink-800 shadow-2xl',
          widths[width],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-xl text-chalk">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 p-1 text-muted transition hover:text-chalk"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>
        {children ? <div className="px-5 py-4">{children}</div> : null}
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="sm">
      <p className="text-sm text-chalk-dim">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={busy}
          icon={destructive ? undefined : <Check className="size-4" />}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; count?: number }>
  className?: string
}) {
  return (
    <div className={cn('flex gap-6 overflow-x-auto border-b border-line', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'relative -mb-px shrink-0 border-b-2 pb-2.5 font-display text-sm font-semibold uppercase tracking-[0.1em] transition-colors',
            value === option.value
              ? 'border-signal text-chalk'
              : 'border-transparent text-muted hover:text-chalk-dim',
          )}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className="ml-1.5 text-xs text-faint">{option.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'neutral' | 'signal' | 'rise' | 'fall'
}) {
  const tones = {
    neutral: 'text-chalk',
    signal: 'text-signal',
    rise: 'text-rise',
    fall: 'text-fall',
  }
  return (
    <div className="border border-line bg-ink-800 px-4 py-3.5">
      <div className="eyebrow text-[0.62rem]">{label}</div>
      <div className={cn('numeral mt-1.5 text-3xl leading-none', tones[tone])}>{value}</div>
      {sub ? <div className="mt-1 truncate text-xs text-muted">{sub}</div> : null}
    </div>
  )
}
