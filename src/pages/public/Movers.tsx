import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { MoversList } from '@/components/MoversList'
import { Container, ErrorState, SectionHeader, Skeleton } from '@/components/ui'

export default function Movers() {
  const repository = useRepository()
  const { revision } = useApp()
  const { data, error, loading, reload } = useAsync(
    () => repository.listMovers(40),
    [repository, revision],
  )

  return (
    <Container className="py-8 sm:py-12" size="narrow">
      <SectionHeader eyebrow="Straight from the ledger" title="Biggest movers"
        level={1} />
      <p className="mb-6 text-sm leading-relaxed text-muted">
        Every row below is read from <code className="text-chalk-dim">ranking_history</code>, which
        the engine writes after each event. Nothing is entered by hand, and every movement carries
        the reasons that produced it.
      </p>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-px">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <MoversList movers={data ?? []} />
      )}
    </Container>
  )
}
