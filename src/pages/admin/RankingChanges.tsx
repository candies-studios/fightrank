import { useState } from 'react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { MoversList } from '@/components/MoversList'
import { ErrorState, SectionHeader, Select, Skeleton } from '@/components/ui'

export default function RankingChanges() {
  const repository = useRepository()
  const app = useApp()
  const [limit, setLimit] = useState(50)

  const { data, error, loading, reload } = useAsync(
    () => repository.listMovers(limit),
    [repository, limit, app.revision],
  )

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        eyebrow="Written by the engine, never by hand"
        title="Ranking changes"
        level={1}
        action={
          <Select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-32"
            aria-label="How many"
          >
            <option value="25">Last 25</option>
            <option value="50">Last 50</option>
            <option value="100">Last 100</option>
          </Select>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <MoversList movers={data ?? []} />
      )}
    </div>
  )
}
