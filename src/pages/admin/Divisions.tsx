import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { deleteDivision, saveDivision } from '@/services/admin'
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  Modal,
  SectionHeader,
  Select,
  TableSkeleton,
  Toggle,
} from '@/components/ui'
import type { Division } from '@/types/domain'
import { slugify } from '@/lib/format'

interface Draft {
  id?: string
  disciplineId: string
  name: string
  slug: string
  gender: 'men' | 'women' | 'open'
  weightLbs: number | null
  shortCode: string
  sortOrder: number
  isP4P: boolean
  isActive: boolean
}

const EMPTY: Draft = {
  disciplineId: '',
  name: '',
  slug: '',
  gender: 'men',
  weightLbs: null,
  shortCode: '',
  sortOrder: 50,
  isP4P: false,
  isActive: true,
}

export default function Divisions() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Division | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useAsync(
    async () => {
      const divisions = await repository.listDivisions(true)
      const counts = await Promise.all(
        divisions.map(async (division) => {
          const roster = await repository.listDisciplineRoster(division.disciplineId)
          return [
            division.id,
            roster.filter((r) => r.divisionId === division.id).length,
          ] as const
        }),
      )
      return { divisions, counts: new Map(counts) }
    },
    [repository, app.revision],
  )

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await saveDivision(app.context, app.session, {
        ...editing,
        weightKg: editing.weightLbs ? Number((editing.weightLbs * 0.453592).toFixed(2)) : null,
      })
      toast.success(editing.id ? 'Division updated' : 'Division created', editing.name)
      await app.refreshTaxonomy()
      app.bumpRevision()
      reload()
      setEditing(null)
    } catch (cause) {
      toast.error('Could not save', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusy(true)
    try {
      await deleteDivision(app.context, app.session, pendingDelete.id)
      toast.success('Division deleted', pendingDelete.name)
      await app.refreshTaxonomy()
      app.bumpRevision()
      reload()
    } catch (cause) {
      toast.error(
        'Could not delete',
        'A division that still has fighters or bouts cannot be removed.',
      )
      void cause
    } finally {
      setBusy(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <SectionHeader
        eyebrow="Stored in the database, never hard-coded"
        title="Divisions"
        level={1}
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="size-3.5" />}
            onClick={() => setEditing({ ...EMPTY, disciplineId: app.disciplines[0]?.id ?? '' })}
          >
            New division
          </Button>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-ink-850 text-left">
                {['Order', 'Discipline', 'Division', 'Gender', 'Limit', 'Fighters', 'Active', ''].map((h) => (
                  <th key={h} className="eyebrow px-3 py-2 text-[0.6rem]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.divisions.map((division) => (
                <tr key={division.id} className="border-b border-line-soft hover:bg-ink-800">
                  <td className="numeral px-3 py-2 text-muted">{division.sortOrder}</td>
                  <td className="px-3 py-2 font-display text-xs uppercase tracking-wider text-signal">
                    {app.disciplineOf(division.disciplineId)?.shortCode ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-chalk">
                    {division.name}
                    {division.isP4P ? (
                      <span className="ml-2 text-[0.65rem] uppercase tracking-wider text-signal">
                        P4P
                      </span>
                    ) : null}
                    <div className="text-xs text-faint">/{division.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-xs capitalize text-muted">{division.gender}</td>
                  <td className="numeral px-3 py-2 text-chalk-dim">
                    {division.weightLbs ? `${division.weightLbs} lb` : '—'}
                  </td>
                  <td className="numeral px-3 py-2 text-chalk-dim">
                    {data.counts.get(division.id) ?? 0}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {division.isActive ? (
                      <span className="text-rise">Yes</span>
                    ) : (
                      <span className="text-faint">No</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Edit"
                        onClick={() =>
                          setEditing({
                            id: division.id,
                            disciplineId: division.disciplineId,
                            name: division.name,
                            slug: division.slug,
                            gender: division.gender,
                            weightLbs: division.weightLbs,
                            shortCode: division.shortCode ?? '',
                            sortOrder: division.sortOrder,
                            isP4P: division.isP4P,
                            isActive: division.isActive,
                          })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => setPendingDelete(division)}
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

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit division' : 'New division'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Discipline"
              required
              hint="Divisions belong to exactly one discipline and are ranked inside it"
              className="sm:col-span-2"
            >
              {({ id }) => (
                <Select
                  id={id}
                  value={editing.disciplineId}
                  onChange={(e) => setEditing({ ...editing, disciplineId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {app.disciplines.map((discipline) => (
                    <option key={discipline.id} value={discipline.id}>
                      {discipline.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Name" required className="sm:col-span-2">
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      name: e.target.value,
                      slug: editing.id ? editing.slug : slugify(e.target.value),
                    })
                  }
                />
              )}
            </Field>
            <Field label="Slug" required>
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                />
              )}
            </Field>
            <Field label="Short code" hint="e.g. LW">
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.shortCode}
                  onChange={(e) => setEditing({ ...editing, shortCode: e.target.value })}
                />
              )}
            </Field>
            <Field label="Gender">
              {({ id }) => (
                <Select
                  id={id}
                  value={editing.gender}
                  onChange={(e) =>
                    setEditing({ ...editing, gender: e.target.value as Draft['gender'] })
                  }
                >
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="open">Open</option>
                </Select>
              )}
            </Field>
            <Field label="Weight limit (lb)">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  value={editing.weightLbs ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      weightLbs: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              )}
            </Field>
            <Field label="Sort order">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                label="Active"
                hint="Inactive divisions are hidden from the public site"
                checked={editing.isActive}
                onChange={(value) => setEditing({ ...editing, isActive: value })}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'this division'}?`}
        description="Fighters assigned to this division become unassigned. Divisions with recorded bouts cannot be deleted."
        confirmLabel="Delete division"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
