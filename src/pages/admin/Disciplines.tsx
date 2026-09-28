import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { deleteDiscipline, saveDiscipline } from '@/services/admin'
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  Modal,
  SectionHeader,
  TableSkeleton,
  Textarea,
  Toggle,
} from '@/components/ui'
import type { Discipline } from '@/types/domain'
import { slugify } from '@/lib/format'

interface Draft {
  id?: string
  name: string
  slug: string
  shortCode: string
  tagline: string
  description: string
  ruleset: string
  accent: string
  sortOrder: number
  isActive: boolean
}

const EMPTY: Draft = {
  name: '',
  slug: '',
  shortCode: '',
  tagline: '',
  description: '',
  ruleset: '',
  accent: '#e2574c',
  sortOrder: 50,
  isActive: true,
}

/**
 * Disciplines are the top level of the model: each one is ranked in isolation,
 * owns its own divisions, and gives every athlete registered in it a separate
 * record under their single Fighter ID.
 */
export default function Disciplines() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Discipline | null>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, reload } = useAsync(
    async () => {
      const disciplines = await repository.listDisciplines(true)
      const divisions = await repository.listDivisions(true)
      const rosters = await Promise.all(
        disciplines.map(async (discipline) => {
          const roster = await repository.listDisciplineRoster(discipline.id)
          return [discipline.id, roster.length] as const
        }),
      )
      return { disciplines, divisions, rosters: new Map(rosters) }
    },
    [repository, app.revision],
  )

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await saveDiscipline(app.context, app.session, editing)
      toast.success(editing.id ? 'Discipline updated' : 'Discipline created', editing.name)
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
      await deleteDiscipline(app.context, app.session, pendingDelete.id)
      toast.success('Discipline deleted', pendingDelete.name)
      await app.refreshTaxonomy()
      app.bumpRevision()
      reload()
    } catch (cause) {
      toast.error(
        'Could not delete',
        'A discipline with recorded bouts cannot be removed.',
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
        eyebrow="Each is ranked independently"
        title="Disciplines"
        level={1}
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="size-3.5" />}
            onClick={() => setEditing({ ...EMPTY })}
          >
            New discipline
          </Button>
        }
      />

      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted">
        A discipline is a self-contained competitive world. The engine runs once per discipline, so
        a result recorded here can never move a rating in another one. Deleting a discipline removes
        its divisions, registrations and rankings with it.
      </p>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-ink-850 text-left">
                {['Order', 'Discipline', 'Code', 'Divisions', 'Athletes', 'Active', ''].map((h) => (
                  <th key={h} className="eyebrow px-3 py-2 text-[0.6rem]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.disciplines.map((discipline) => (
                <tr key={discipline.id} className="border-b border-line-soft hover:bg-ink-800">
                  <td className="numeral px-3 py-2 text-muted">{discipline.sortOrder}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0"
                        style={{ backgroundColor: discipline.accent ?? 'var(--color-signal)' }}
                        aria-hidden
                      />
                      <span className="text-chalk">{discipline.name}</span>
                    </div>
                    <div className="text-xs text-faint">/{discipline.slug}</div>
                  </td>
                  <td className="px-3 py-2 font-display text-xs uppercase tracking-wider text-signal">
                    {discipline.shortCode}
                  </td>
                  <td className="numeral px-3 py-2 text-chalk-dim">
                    {data.divisions.filter((d) => d.disciplineId === discipline.id).length}
                  </td>
                  <td className="numeral px-3 py-2 text-chalk-dim">
                    {data.rosters.get(discipline.id) ?? 0}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {discipline.isActive ? (
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
                            id: discipline.id,
                            name: discipline.name,
                            slug: discipline.slug,
                            shortCode: discipline.shortCode,
                            tagline: discipline.tagline ?? '',
                            description: discipline.description ?? '',
                            ruleset: discipline.ruleset ?? '',
                            accent: discipline.accent ?? '#e2574c',
                            sortOrder: discipline.sortOrder,
                            isActive: discipline.isActive,
                          })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => setPendingDelete(discipline)}
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
        title={editing?.id ? 'Edit discipline' : 'New discipline'}
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
            <Field label="Short code" required hint="Labels every bout, e.g. MMA">
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.shortCode}
                  onChange={(e) =>
                    setEditing({ ...editing, shortCode: e.target.value.toUpperCase() })
                  }
                />
              )}
            </Field>
            <Field label="Tagline" className="sm:col-span-2">
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.tagline}
                  onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                />
              )}
            </Field>
            <Field label="Description" className="sm:col-span-2">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              )}
            </Field>
            <Field label="Ruleset" hint="Shown under the description" className="sm:col-span-2">
              {({ id }) => (
                <Input
                  id={id}
                  value={editing.ruleset}
                  onChange={(e) => setEditing({ ...editing, ruleset: e.target.value })}
                />
              )}
            </Field>
            <Field label="Accent colour">
              {({ id }) => (
                <Input
                  id={id}
                  type="color"
                  value={editing.accent}
                  onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
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
                hint="Inactive disciplines are hidden from the public site"
                checked={editing.isActive}
                onChange={(value) => setEditing({ ...editing, isActive: value })}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'this discipline'}?`}
        description="Every division, registration and ranking belonging to this discipline is removed with it. Athletes keep their Fighter ID and their records in other disciplines."
        confirmLabel="Delete discipline"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
