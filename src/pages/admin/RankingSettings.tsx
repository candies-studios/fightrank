import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, Save, TriangleAlert } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { updateRankingConfig } from '@/services/admin'
import { CONFIG_REGISTRY, DEFAULT_CONFIG } from '@/ranking/config'
import type { RankingConfigRow } from '@/types/db'
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Input,
  Panel,
  SectionHeader,
  Skeleton,
  Tabs,
  Toggle,
} from '@/components/ui'
import { dec } from '@/data/mappers'
import { cn } from '@/lib/cn'

type Scope = 'division' | 'p4p'

/**
 * Ranking configuration (§40).
 *
 * The form is generated from the `ranking_config` registry rows, so adding a
 * new engine constant needs no UI work — add it to `src/ranking/config.ts`,
 * regenerate the migration, and it appears here.
 */
export default function RankingSettings() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()

  const [scope, setScope] = useState<Scope>('division')
  const [values, setValues] = useState<Record<string, number | boolean>>({})
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () => repository.listConfigRows(),
    [repository, app.revision],
  )

  useEffect(() => {
    if (!data) return
    const next: Record<string, number | boolean> = {}
    for (const row of data) {
      next[`${row.scope}:${row.key}`] =
        row.data_type === 'boolean' ? Boolean(row.value) : dec(row.value as number | string)
    }
    setValues(next)
  }, [data])

  const rowsByScope = useMemo(() => {
    const map = new Map<string, RankingConfigRow[]>()
    for (const row of data ?? []) {
      const key = `${row.scope}::${row.group_name}`
      map.set(key, [...(map.get(key) ?? []), row])
    }
    return map
  }, [data])

  const groups = useMemo(
    () =>
      [...new Set((data ?? []).filter((r) => r.scope === scope).map((r) => r.group_name))],
    [data, scope],
  )

  const dirty = useMemo(() => {
    if (!data) return []
    return data
      .filter((row) => {
        const key = `${row.scope}:${row.key}`
        const current =
          row.data_type === 'boolean' ? Boolean(row.value) : dec(row.value as number | string)
        return values[key] !== undefined && values[key] !== current
      })
      .map((row) => ({
        scope: row.scope,
        key: row.key,
        value: values[`${row.scope}:${row.key}`],
        previous:
          row.data_type === 'boolean' ? Boolean(row.value) : dec(row.value as number | string),
      }))
  }, [data, values])

  const save = async () => {
    setSaving(true)
    try {
      const summary = await updateRankingConfig(app.context, app.session, dirty)
      toast.success(
        'Settings saved — every division recalculated',
        `${summary.divisions} divisions · ${summary.fighters} fighters · ${summary.durationMs} ms`,
      )
      app.bumpRevision()
      reload()
    } catch (cause) {
      toast.error('Could not save', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  const restoreDefaults = () => {
    const next: Record<string, number | boolean> = { ...values }
    for (const entry of CONFIG_REGISTRY) {
      next[`${entry.scope}:${entry.key}`] = DEFAULT_CONFIG[entry.key]
    }
    setValues(next)
    toast.info('Defaults loaded', 'Nothing is saved until you apply the changes.')
  }

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <Skeleton className="h-[40rem] w-full" />

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <SectionHeader
        eyebrow="No code change required"
        title="Ranking settings"
        level={1}
        action={
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={restoreDefaults}>
            Load defaults
          </Button>
        }
      />

      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted">
        Every constant the engine uses is stored in the database. Changing anything here triggers a
        full recalculation of all divisions and the pound-for-pound table, and the change is written
        to the audit log with its previous value.
      </p>

      <Tabs
        value={scope}
        onChange={setScope}
        options={[
          { value: 'division', label: 'Divisional engine' },
          { value: 'p4p', label: 'Pound for pound' },
        ]}
        className="mb-6"
      />

      <div className="space-y-6">
        {groups.map((group) => (
          <Panel key={group} className="p-5">
            <div className="eyebrow mb-4">{group}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(rowsByScope.get(`${scope}::${group}`) ?? []).map((row) => {
                const key = `${row.scope}:${row.key}`
                const value = values[key]
                const changed = dirty.some((d) => d.key === row.key && d.scope === row.scope)

                if (row.data_type === 'boolean') {
                  return (
                    <div key={key} className={cn(changed && 'ring-1 ring-signal')}>
                      <Toggle
                        label={row.label}
                        hint={row.description ?? undefined}
                        checked={Boolean(value)}
                        onChange={(next) => setValues((c) => ({ ...c, [key]: next }))}
                      />
                    </div>
                  )
                }

                const min = row.min_value === null ? undefined : dec(row.min_value)
                const max = row.max_value === null ? undefined : dec(row.max_value)
                const step = row.step === null ? undefined : dec(row.step)

                return (
                  <div
                    key={key}
                    className={cn(
                      'border border-line bg-ink-850 p-3',
                      changed && 'border-signal',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <label
                        htmlFor={key}
                        className="eyebrow text-[0.62rem] text-chalk-dim"
                      >
                        {row.label}
                      </label>
                      <span className="numeral text-lg text-signal">{Number(value ?? 0)}</span>
                    </div>
                    <p className="mb-2 mt-0.5 text-xs leading-snug text-faint">{row.description}</p>
                    <div className="flex items-center gap-3">
                      {min !== undefined && max !== undefined ? (
                        <input
                          id={key}
                          type="range"
                          min={min}
                          max={max}
                          step={step ?? 1}
                          value={Number(value ?? 0)}
                          onChange={(e) =>
                            setValues((c) => ({ ...c, [key]: Number(e.target.value) }))
                          }
                          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-ink-500 accent-[var(--color-signal)]"
                        />
                      ) : null}
                      <Input
                        type="number"
                        min={min}
                        max={max}
                        step={step ?? 1}
                        value={Number(value ?? 0)}
                        onChange={(e) => setValues((c) => ({ ...c, [key]: Number(e.target.value) }))}
                        className="w-24 text-right"
                        aria-label={`${row.label} value`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        ))}
      </div>

      {dirty.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-signal/40 bg-ink-850/97 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 sm:px-6">
            <TriangleAlert className="size-4 shrink-0 text-signal" />
            <p className="min-w-0 flex-1 text-sm text-chalk-dim">
              <span className="numeral text-signal">{dirty.length}</span> unsaved change
              {dirty.length === 1 ? '' : 's'} — applying will recalculate every division.
            </p>
            <Button variant="ghost" size="sm" onClick={() => data && reload()}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="size-3.5" />}
              onClick={() => setConfirming(true)}
            >
              Apply
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Apply new ranking settings?"
        description={`${dirty.length} setting(s) will be written and every division plus the pound-for-pound table will be recalculated from the complete fight history. Rankings across the site will change.`}
        confirmLabel="Apply and recalculate"
        busy={saving}
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
