import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Layers, Search, Swords, User, X } from 'lucide-react'
import { useRepository } from '@/hooks/useData'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import type { SearchResult } from '@/data/repository'
import { cn } from '@/lib/cn'
import { flagOf } from '@/lib/format'
import { Spinner } from './ui'

/** Global search with autocomplete across disciplines, fighters, events and divisions (§30). */

const ICONS: Record<SearchResult['kind'], typeof User> = {
  fighter: User,
  event: CalendarDays,
  division: Layers,
  discipline: Swords,
}

const PATHS: Record<SearchResult['kind'], (slug: string) => string> = {
  fighter: (slug) => `/fighters/${slug}`,
  event: (slug) => `/events/${slug}`,
  division: (slug) => `/rankings/${slug}`,
  discipline: (slug) => `/disciplines/${slug}`,
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const repository = useRepository()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounced = useDebounced(term, 180)

  const { data, loading } = useAsync<SearchResult[]>(
    () => (debounced.trim().length >= 2 ? repository.search(debounced) : Promise.resolve([])),
    [debounced, repository],
  )
  const results = data ?? []

  useEffect(() => {
    if (open) {
      setTerm('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => setCursor(0), [debounced])

  // The handler reads the latest results through a ref so the listener is
  // attached once per open rather than on every keystroke.
  const latest = useRef({ results, cursor })
  latest.current = { results, cursor }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const { results: rows, cursor: index } = latest.current
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setCursor((c) => Math.min(rows.length - 1, c + 1))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setCursor((c) => Math.max(0, c - 1))
      }
      if (event.key === 'Enter') {
        const target = rows[index]
        if (target) {
          navigate(PATHS[target.kind](target.slug))
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, navigate, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-ink-900/85 backdrop-blur-sm">
      <button type="button" aria-label="Close search" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="animate-rise relative mx-auto mt-[8vh] w-[min(38rem,calc(100vw-1.5rem))] border border-line bg-ink-800 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search fighters, events, divisions, disciplines…"
            className="h-14 w-full bg-transparent text-base text-chalk placeholder:text-faint focus:outline-none"
            aria-label="Search"
            autoComplete="off"
          />
          {loading ? <Spinner /> : null}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-faint transition hover:text-chalk"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {term.trim().length < 2 ? (
            <p className="px-4 py-8 text-center text-sm text-faint">
              Type at least two characters.
            </p>
          ) : results.length === 0 && !loading ? (
            <p className="px-4 py-8 text-center text-sm text-faint">
              Nothing matches “{term}”.
            </p>
          ) : (
            <ul>
              {results.map((result, index) => {
                const Icon = ICONS[result.kind]
                return (
                  <li key={`${result.kind}-${result.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => {
                        navigate(PATHS[result.kind](result.slug))
                        onClose()
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        index === cursor ? 'bg-ink-700' : 'hover:bg-ink-700',
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-chalk">
                          {flagOf(result.countryCode)} {result.label}
                        </span>
                        <span className="block truncate text-xs text-faint">{result.sublabel}</span>
                      </span>
                      <span className="eyebrow shrink-0 text-[0.58rem]">{result.kind}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Opens the palette on ⌘K / Ctrl-K. */
export function useSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onOpen])
}
