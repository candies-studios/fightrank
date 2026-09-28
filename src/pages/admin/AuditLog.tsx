import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { EmptyState, ErrorState, SectionHeader, TableSkeleton } from '@/components/ui'
import { cn } from '@/lib/cn'

const ACTION_TONES: Record<string, string> = {
  created: 'text-rise',
  updated: 'text-signal',
  deleted: 'text-fall',
  recalculated: 'text-chalk-dim',
  role_changed: 'text-signal',
}

function toneFor(action: string): string {
  const suffix = action.split('.').pop() ?? ''
  return ACTION_TONES[suffix] ?? 'text-chalk-dim'
}

export default function AuditLog() {
  const repository = useRepository()
  const app = useApp()
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data, error, loading, reload } = useAsync(
    () => repository.listAudit(200),
    [repository, app.revision],
  )

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader eyebrow="Append-only" title="Audit log"
        level={1} />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted">
        Every administrative action is recorded with the user, the entity, the previous value and
        the new value. The table has no update or delete policy — entries cannot be altered or
        removed, including by an administrator.
      </p>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={10} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No actions recorded yet"
          description="Administrative changes will appear here as they happen."
        />
      ) : (
        <ul className="border border-line">
          {data?.map((entry) => {
            const open = expanded === entry.id
            return (
              <li key={entry.id} className="border-b border-line-soft last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : entry.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-ink-800"
                >
                  {open ? (
                    <ChevronDown className="size-4 shrink-0 text-faint" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-faint" />
                  )}
                  <span
                    className={cn(
                      'w-44 shrink-0 font-display text-xs font-semibold uppercase tracking-[0.08em]',
                      toneFor(entry.action),
                    )}
                  >
                    {entry.action}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                    {entry.entityLabel ?? entry.entityId ?? entry.entity}
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted sm:inline">
                    {entry.userEmail ?? 'system'}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {new Date(entry.createdAt).toLocaleString('en-GB')}
                  </span>
                </button>
                {open ? (
                  <div className="grid gap-3 border-t border-line-soft bg-ink-850 p-3 sm:grid-cols-2">
                    <div>
                      <div className="eyebrow mb-1 text-[0.58rem]">Previous value</div>
                      <pre className="max-h-56 overflow-auto border border-line bg-ink-900 p-2 text-[0.7rem] leading-relaxed text-muted">
                        {JSON.stringify(entry.previousValue ?? null, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="eyebrow mb-1 text-[0.58rem]">New value</div>
                      <pre className="max-h-56 overflow-auto border border-line bg-ink-900 p-2 text-[0.7rem] leading-relaxed text-chalk-dim">
                        {JSON.stringify(entry.newValue ?? null, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
