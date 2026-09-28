import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  error: Error | null
  loading: boolean
  reload: () => void
}

/**
 * Loads data with proper loading / error / empty states (§44) and drops the
 * result of a request that has been superseded.
 */
export function useAsync<T>(
  factory: () => Promise<T>,
  deps: React.DependencyList,
  options: { skip?: boolean } = {},
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(!options.skip)
  const [nonce, setNonce] = useState(0)
  const generation = useRef(0)

  // The factory is intentionally excluded: callers pass an inline closure and
  // `deps` is the contract for when it should re-run.
  const run = useCallback(factory, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (options.skip) {
      setLoading(false)
      return
    }
    const current = ++generation.current
    setLoading(true)
    setError(null)
    run()
      .then((value) => {
        if (generation.current !== current) return
        setData(value)
      })
      .catch((cause: unknown) => {
        if (generation.current !== current) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (generation.current !== current) return
        setLoading(false)
      })
  }, [run, nonce, options.skip])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload }
}

/** Debounce a rapidly-changing value (search boxes). */
export function useDebounced<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
