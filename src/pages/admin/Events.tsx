import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { deleteEvent } from '@/services/admin'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SectionHeader,
  TableSkeleton,
} from '@/components/ui'
import { shortDate } from '@/lib/format'

export default function Events() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () => repository.listEvents({ status: 'all', pageSize: 200 }),
    [repository, app.revision],
  )

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await deleteEvent(app.context, app.session, pendingDelete)
      toast.success('Event deleted', 'Its bouts were removed and affected divisions recalculated.')
      app.bumpRevision()
      reload()
    } catch (cause) {
      toast.error('Could not delete', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <SectionHeader
        eyebrow="Cards"
        title="Events"
        level={1}
        action={
          <Link to="/admin/events/new">
            <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />}>
              New event
            </Button>
          </Link>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={8} />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState title="No events yet" />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-ink-850 text-left">
                {['Date', 'Event', 'Venue', 'Bouts', 'Status', ''].map((h) => (
                  <th key={h} className="eyebrow px-3 py-2 text-[0.6rem]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((event) => (
                <tr key={event.id} className="border-b border-line-soft hover:bg-ink-800">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {shortDate(event.eventDate)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/events/${event.slug}`}
                      className="text-chalk transition hover:text-signal"
                    >
                      {event.name}
                    </Link>
                    {event.mainEventLabel ? (
                      <div className="truncate text-xs text-faint">{event.mainEventLabel}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {[event.venue, event.city].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="numeral px-3 py-2 text-sm text-chalk-dim">
                    {event.completedCount}/{event.boutCount}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={
                        event.status === 'completed'
                          ? 'text-muted'
                          : event.status === 'cancelled'
                            ? 'text-fall'
                            : 'text-signal'
                      }
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/events/${event.id}`}>
                        <Button size="sm" variant="ghost" aria-label="Edit">
                          <Pencil className="size-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => setPendingDelete(event.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this event?"
        description="Every bout on the card is deleted with it and the affected divisions are recalculated. This cannot be undone."
        confirmLabel="Delete event"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
