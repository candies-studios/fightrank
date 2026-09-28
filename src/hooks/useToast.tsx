import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

interface ToastApi {
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const Ctx = createContext<ToastApi | null>(null)

const TONES: Record<ToastTone, { icon: ReactNode; border: string }> = {
  success: { icon: <CheckCircle2 className="size-4 text-rise" />, border: 'border-l-rise' },
  error: { icon: <AlertTriangle className="size-4 text-fall" />, border: 'border-l-fall' },
  info: { icon: <Info className="size-4 text-signal" />, border: 'border-l-signal' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { id, tone, title, description }])
      setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'animate-rise pointer-events-auto flex items-start gap-3 border border-line border-l-2 bg-ink-800 px-4 py-3 shadow-xl',
              TONES[toast.tone].border,
            )}
          >
            <span className="mt-0.5 shrink-0">{TONES[toast.tone].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-chalk">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-mr-1 shrink-0 p-0.5 text-faint transition hover:text-chalk"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const api = useContext(Ctx)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}
