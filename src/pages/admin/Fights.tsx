import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { deleteFight } from '@/services/admin'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SectionHeader,
  Select,
  TableSkeleton,
} from '@/components/ui'
import { methodLabel, shortDate } from '@/lib/format'

export default function Fights() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()
  const [status, setStatus] = useState<'all' | 'completed' | 'scheduled'>('all')
  const [divisionId, setDivisionId] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () =>
      repository.listFights({
        status,
        divisionId: divisionId || undefined,
        limit: 200,
      }),
    [repository, status, divisionId, app.revision],
  )

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      const summary = await deleteFight(app.context, app.session, pendingDelete)
      toast.success(
        'Fight deleted',
        `${summary.divisions} division${summary.divisions === 1 ? '' : 's'} recalculated.`,
      )
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
    <div className="mx-auto max-w-[1200px]">
      <SectionHeader
        eyebrow="Source of competitive truth"
        title="Fights"
        level={1}
        action={
          <Link to="/admin/fights/new">
            <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />}>
              Add fight
            </Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[12rem_16rem]">
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label="Status"
        >
          <option value="all">All bouts</option>
          <option value="completed">Completed</option>
          <option value="scheduled">Scheduled</option>
        </Select>
        <Select
          value={divisionId}
          onChange={(event) => setDivisionId(event.target.value)}
          aria-label="Division"
        >
          <option value="">All divisions</option>
          {app.divisions
            .filter((d) => !d.isP4P)
            .map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
        </Select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={10} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No fights match"
          action={
            <Link to="/admin/fights/new">
              <Button size="sm">Add a fight</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-ink-850 text-left">
                {['Date', 'Event', 'Bout', 'Division', 'Result', ''].map((h) => (
                  <th key={h} className="eyebrow px-3 py-2 text-[0.6rem]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.map((fight) => (
                <tr key={fight.id} className="border-b border-line-soft hover:bg-ink-800">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {shortDate(fight.eventDate)}
                  </td>
                  <td className="max-w-40 truncate px-3 py-2 text-xs text-chalk-dim">
                    {fight.eventName}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {fight.isTitleFight ? (
                        <Crown className="size-3.5 shrink-0 text-signal" />
                      ) : null}
                      <span className="text-chalk">
                        {fight.fighterA.displayName}{' '}
                        <span className="text-faint">vs</span> {fight.fighterB.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {fight.divisionName}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {fight.status === 'completed' ? (
                      <span className="text-chalk-dim">
                        {fight.winnerId === fight.fighterA.id
                          ? fight.fighterA.displayName
                          : fight.winnerId === fight.fighterB.id
                            ? fight.fighterB.displayName
                            : '—'}{' '}
                        <span className="text-faint">
                          ({methodLabel(fight.method, fight.decisionType, fight.outcome)})
                        </span>
                      </span>
                    ) : (
                      <span className="text-signal">Scheduled</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/fights/${fight.id}`}>
                        <Button size="sm" variant="ghost" aria-label="Edit">
                          <Pencil className="size-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => setPendingDelete(fight.id)}
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
        title="Delete this bout?"
        description="The fight is removed and the affected divisions are recalculated from scratch. Ranking history for those divisions is rebuilt. This cannot be undone."
        confirmLabel="Delete and recalculate"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
