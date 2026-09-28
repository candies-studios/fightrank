import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Pencil, Plus, Shield, Trash2 } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { deleteFighter } from '@/services/admin'
import { FighterAvatar } from '@/components/FighterAvatar'
import { RankPlate } from '@/components/Movement'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  SectionHeader,
  Select,
  TableSkeleton,
} from '@/components/ui'
import { record, shortDate } from '@/lib/format'

const PAGE_SIZE = 25

export default function Fighters() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [page, setPage] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const debounced = useDebounced(search, 250)

  const { data, error, loading, reload } = useAsync(
    () =>
      repository.listFighters({
        search: debounced,
        divisionId: divisionId || null,
        page,
        pageSize: PAGE_SIZE,
        sort: 'rank',
      }),
    [repository, debounced, divisionId, page, app.revision],
  )

  const pages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await deleteFighter(app.context, app.session, pendingDelete.id)
      toast.success('Fighter deleted', pendingDelete.name)
      app.bumpRevision()
      reload()
    } catch (cause) {
      toast.error(
        'Could not delete',
        cause instanceof Error
          ? `${cause.message} — a fighter with recorded bouts cannot be removed until those bouts are deleted.`
          : String(cause),
      )
    } finally {
      setBusy(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <SectionHeader
        eyebrow={`${(data?.total ?? 0).toLocaleString('en-GB')} on record`}
        title="Fighters"
        level={1}
        action={
          <Link to="/admin/fighters/new">
            <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />}>
              Add fighter
            </Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_16rem]">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search by name…"
          aria-label="Search fighters"
        />
        <Select
          value={divisionId}
          onChange={(e) => {
            setDivisionId(e.target.value)
            setPage(0)
          }}
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
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState title="No fighters match" />
      ) : (
        <>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-ink-850 text-left">
                  {['Rank', 'Fighter', 'Division', 'Record', 'Rating', 'Last bout', ''].map((h) => (
                    <th key={h} className="eyebrow px-3 py-2 text-[0.6rem]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((fighter) => (
                  <tr key={fighter.id} className="border-b border-line-soft hover:bg-ink-800">
                    <td className="px-3 py-2">
                      <RankPlate
                        position={fighter.currentRank}
                        isChampion={fighter.isChampion}
                        isInterim={fighter.isInterimChampion}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <FighterAvatar
                          id={fighter.id}
                          name={fighter.displayName}
                          photoUrl={fighter.photoUrl}
                          size="xs"
                        />
                        <Link
                          to={`/fighters/${fighter.slug}`}
                          className="text-chalk transition hover:text-signal"
                        >
                          {fighter.displayName}
                        </Link>
                        {fighter.isChampion ? <Crown className="size-3.5 text-signal" /> : null}
                        {fighter.isInterimChampion ? (
                          <Shield className="size-3.5 text-signal" />
                        ) : null}
                        {!fighter.isActive ? (
                          <span className="text-[0.65rem] uppercase tracking-wider text-faint">
                            inactive
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {fighter.divisionName ?? '—'}
                    </td>
                    <td className="numeral px-3 py-2 text-sm text-chalk-dim">{record(fighter)}</td>
                    <td className="numeral px-3 py-2 text-sm text-chalk">
                      {Math.round(fighter.rating)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                      {shortDate(fighter.lastFightDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Link to={`/admin/fighters/${fighter.id}`}>
                          <Button size="sm" variant="ghost" aria-label="Edit">
                            <Pencil className="size-3.5" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Delete"
                          onClick={() =>
                            setPendingDelete({ id: fighter.id, name: fighter.displayName })
                          }
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

          {pages > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="numeral text-sm text-muted">
                {page + 1} / {pages}
              </span>
              <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'this fighter'}?`}
        description="The fighter and their derived statistics are removed. Bouts they took part in must be deleted first — the database will refuse otherwise, to protect the integrity of the ranking history."
        confirmLabel="Delete fighter"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
