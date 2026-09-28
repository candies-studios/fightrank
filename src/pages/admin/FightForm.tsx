import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { saveFight, ValidationError, type SaveFightResult } from '@/services/admin'
import { issuesByField, type FightDraft } from '@/services/validation'
import { MoversList } from '@/components/MoversList'
import {
  Button,
  ErrorState,
  Field,
  Input,
  Modal,
  Panel,
  SectionHeader,
  Select,
  Skeleton,
  Toggle,
} from '@/components/ui'
import type { DecisionType, Method, Outcome } from '@/types/domain'
import { clockTime } from '@/lib/format'

const OUTCOMES: Array<{ value: Outcome; label: string }> = [
  { value: 'win', label: 'Win' },
  { value: 'draw', label: 'Draw' },
  { value: 'majority_draw', label: 'Majority draw' },
  { value: 'split_draw', label: 'Split draw' },
  { value: 'no_contest', label: 'No contest' },
]

const METHODS: Array<{ value: Method; label: string }> = [
  { value: 'ko', label: 'KO' },
  { value: 'tko', label: 'TKO' },
  { value: 'submission', label: 'Submission' },
  { value: 'decision', label: 'Decision' },
  { value: 'technical_decision', label: 'Technical decision' },
  { value: 'dq', label: 'Disqualification' },
  { value: 'doctor_stoppage', label: 'Doctor stoppage' },
  { value: 'retirement', label: 'Retirement' },
]

const FINISH_METHODS: Method[] = ['ko', 'tko', 'submission', 'dq', 'doctor_stoppage', 'retirement']

const EMPTY: FightDraft = {
  eventId: '',
  divisionId: '',
  fighterAId: '',
  fighterBId: '',
  status: 'completed',
  outcome: 'win',
  winnerId: null,
  method: 'decision',
  decisionType: 'unanimous',
  endRound: null,
  endTimeSeconds: null,
  scheduledRounds: 3,
  isTitleFight: false,
  isInterimTitle: false,
  isMainEvent: false,
  fightType: 'standard',
}

export default function FightForm() {
  const { fightId } = useParams()
  const isEdit = Boolean(fightId)
  const app = useApp()
  const repository = useRepository()
  const toast = useToast()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<FightDraft>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SaveFightResult | null>(null)

  const { data, error, loading } = useAsync(
    async () => {
      const [events, fighters, registrations, existing] = await Promise.all([
        repository.listEvents({ status: 'all', pageSize: 200 }),
        repository.listFighters({ pageSize: 1000, sort: 'name' }),
        repository.loadRegistrations(),
        fightId ? repository.getFight(fightId) : Promise.resolve(null),
      ])
      return { events: events.rows, fighters: fighters.rows, registrations, existing }
    },
    [repository, fightId],
  )

  useEffect(() => {
    if (!data?.existing) return
    const f = data.existing
    setDraft({
      id: f.id,
      eventId: f.eventId,
      divisionId: f.divisionId,
      fighterAId: f.fighterAId,
      fighterBId: f.fighterBId,
      status: f.status,
      outcome: f.outcome,
      winnerId: f.winnerId,
      method: f.method,
      decisionType: f.decisionType,
      endRound: f.endRound,
      endTimeSeconds: f.endTimeSeconds,
      scheduledRounds: f.scheduledRounds,
      isTitleFight: f.isTitleFight,
      isInterimTitle: f.isInterimTitle,
      isMainEvent: f.isMainEvent,
      fightType: f.fightType,
    })
  }, [data?.existing])

  const set = <K extends keyof FightDraft>(key: K, value: FightDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  /**
   * Who can be booked in this division. An athlete competes in a different
   * division in each discipline, so eligibility comes from their registrations
   * — the same rule the database trigger enforces — not from the denormalised
   * division on their profile.
   */
  const divisionFighters = useMemo(() => {
    if (!data) return []
    if (!draft.divisionId) return data.fighters
    const discipline = app.divisions.find((d) => d.id === draft.divisionId)?.disciplineId
    const eligible = new Set(
      data.registrations
        .filter((r) =>
          draft.fightType === 'catchweight'
            ? r.discipline_id === discipline
            : r.division_id === draft.divisionId,
        )
        .map((r) => r.fighter_id),
    )
    return data.fighters.filter((f) => eligible.has(f.id))
  }, [data, app.divisions, draft.divisionId, draft.fightType])

  const fighterA = data?.fighters.find((f) => f.id === draft.fighterAId)
  const fighterB = data?.fighters.find((f) => f.id === draft.fighterBId)
  const needsFinishDetail = draft.method !== null && FINISH_METHODS.includes(draft.method)
  const isDecision = draft.method === 'decision' || draft.method === 'technical_decision'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const saved = await saveFight(app.context, app.session, draft)
      app.bumpRevision()
      setResult(saved)
      toast.success(
        isEdit ? 'Fight updated' : 'Fight recorded',
        `${saved.summary.divisions} division${saved.summary.divisions === 1 ? '' : 's'} recalculated in ${saved.summary.durationMs} ms.`,
      )
    } catch (cause) {
      if (cause instanceof ValidationError) {
        setErrors(issuesByField(cause.issues))
        toast.error('Check the form', `${cause.issues.length} problem(s) need attention.`)
      } else {
        toast.error('Could not save', cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState error={error} />
  if (loading) return <Skeleton className="h-[36rem] w-full" />

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/admin/fights"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-signal"
      >
        <ArrowLeft className="size-4" />
        Back to fights
      </Link>

      <SectionHeader
        eyebrow={isEdit ? 'Correcting the record' : 'Recording a result'}
        title={isEdit ? 'Edit fight' : 'Add fight'}
        level={1}
      />

      <form onSubmit={submit} className="space-y-6">
        <Panel className="space-y-4 p-5">
          <div className="eyebrow">The bout</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event" required error={errors.eventId}>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={draft.eventId}
                  onChange={(e) => set('eventId', e.target.value)}
                >
                  <option value="">Select an event…</option>
                  {data?.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} — {event.eventDate}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Division" required error={errors.divisionId}>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={draft.divisionId}
                  onChange={(e) => set('divisionId', e.target.value)}
                >
                  <option value="">Select a division…</option>
                  {app.disciplines.map((discipline) => (
                    <optgroup key={discipline.id} label={discipline.name}>
                      {app
                        .divisionsOf(discipline.id)
                        .filter((d) => !d.isP4P)
                        .map((division) => (
                          <option key={division.id} value={division.id}>
                            {division.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Fighter A" required error={errors.fighterAId}>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={draft.fighterAId}
                  onChange={(e) => set('fighterAId', e.target.value)}
                >
                  <option value="">Select…</option>
                  {divisionFighters.map((fighter) => (
                    <option key={fighter.id} value={fighter.id}>
                      {fighter.displayName}
                      {fighter.currentRank !== null
                        ? ` (${fighter.isChampion ? 'C' : `#${fighter.currentRank}`})`
                        : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Fighter B" required error={errors.fighterBId}>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={draft.fighterBId}
                  onChange={(e) => set('fighterBId', e.target.value)}
                >
                  <option value="">Select…</option>
                  {divisionFighters.map((fighter) => (
                    <option key={fighter.id} value={fighter.id}>
                      {fighter.displayName}
                      {fighter.currentRank !== null
                        ? ` (${fighter.isChampion ? 'C' : `#${fighter.currentRank}`})`
                        : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Scheduled rounds" error={errors.scheduledRounds}>
              {({ id }) => (
                <Select
                  id={id}
                  value={String(draft.scheduledRounds)}
                  onChange={(e) => set('scheduledRounds', Number(e.target.value))}
                >
                  <option value="1">1 round</option>
                  <option value="3">3 rounds</option>
                  <option value="5">5 rounds</option>
                </Select>
              )}
            </Field>

            <Field label="Bout type">
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.fightType}
                  onChange={(e) => set('fightType', e.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="catchweight">Catchweight</option>
                  <option value="tournament">Tournament</option>
                  <option value="exhibition">Exhibition</option>
                </Select>
              )}
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Toggle
              label="Title fight"
              hint="Applies the title K-factor and can transfer the belt"
              checked={draft.isTitleFight}
              onChange={(value) =>
                setDraft((c) => ({
                  ...c,
                  isTitleFight: value,
                  isInterimTitle: value ? c.isInterimTitle : false,
                  scheduledRounds: value ? 5 : c.scheduledRounds,
                }))
              }
            />
            <Toggle
              label="Interim title"
              hint="Creates or defends an interim championship"
              checked={draft.isInterimTitle}
              disabled={!draft.isTitleFight}
              onChange={(value) => set('isInterimTitle', value)}
            />
            <Toggle
              label="Main event"
              hint="Headlines the card"
              checked={draft.isMainEvent}
              onChange={(value) => set('isMainEvent', value)}
            />
          </div>
          {errors.isInterimTitle ? (
            <p className="text-xs text-fall">{errors.isInterimTitle}</p>
          ) : null}
        </Panel>

        <Panel className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow">The result</div>
            <Select
              value={draft.status}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  status: e.target.value as FightDraft['status'],
                  ...(e.target.value === 'scheduled'
                    ? { outcome: null, winnerId: null, method: null, decisionType: null, endRound: null, endTimeSeconds: null }
                    : { outcome: c.outcome ?? 'win', method: c.method ?? 'decision' }),
                }))
              }
              className="w-40"
              aria-label="Bout status"
            >
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          {draft.status === 'completed' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Outcome" required error={errors.outcome}>
                  {({ id, invalid }) => (
                    <Select
                      id={id}
                      invalid={invalid}
                      value={draft.outcome ?? ''}
                      onChange={(e) => {
                        const outcome = e.target.value as Outcome
                        setDraft((c) => ({
                          ...c,
                          outcome,
                          winnerId: outcome === 'win' ? c.winnerId : null,
                          method:
                            outcome === 'no_contest'
                              ? 'no_contest'
                              : outcome === 'win'
                                ? (c.method ?? 'decision')
                                : 'draw',
                        }))
                      }}
                    >
                      {OUTCOMES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field
                  label="Winner"
                  required={draft.outcome === 'win'}
                  error={errors.winnerId}
                  hint={draft.outcome !== 'win' ? 'Not applicable to this outcome' : undefined}
                >
                  {({ id, invalid }) => (
                    <Select
                      id={id}
                      invalid={invalid}
                      value={draft.winnerId ?? ''}
                      disabled={draft.outcome !== 'win'}
                      onChange={(e) => set('winnerId', e.target.value || null)}
                    >
                      <option value="">Select the winner…</option>
                      {fighterA ? <option value={fighterA.id}>{fighterA.displayName}</option> : null}
                      {fighterB ? <option value={fighterB.id}>{fighterB.displayName}</option> : null}
                    </Select>
                  )}
                </Field>
              </div>

              {draft.outcome === 'win' ? (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label="Method" required error={errors.method} className="sm:col-span-2">
                    {({ id, invalid }) => (
                      <Select
                        id={id}
                        invalid={invalid}
                        value={draft.method ?? ''}
                        onChange={(e) => {
                          const method = e.target.value as Method
                          setDraft((c) => ({
                            ...c,
                            method,
                            decisionType:
                              method === 'decision' || method === 'technical_decision'
                                ? (c.decisionType ?? 'unanimous')
                                : null,
                            endRound: FINISH_METHODS.includes(method) ? c.endRound : null,
                            endTimeSeconds: FINISH_METHODS.includes(method)
                              ? c.endTimeSeconds
                              : null,
                          }))
                        }}
                      >
                        {METHODS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  {isDecision ? (
                    <Field label="Decision" required error={errors.decisionType} className="sm:col-span-2">
                      {({ id, invalid }) => (
                        <Select
                          id={id}
                          invalid={invalid}
                          value={draft.decisionType ?? ''}
                          onChange={(e) => set('decisionType', e.target.value as DecisionType)}
                        >
                          <option value="unanimous">Unanimous</option>
                          <option value="split">Split</option>
                          <option value="majority">Majority</option>
                        </Select>
                      )}
                    </Field>
                  ) : null}

                  {needsFinishDetail ? (
                    <>
                      <Field label="Round" required error={errors.endRound}>
                        {({ id, invalid }) => (
                          <Input
                            id={id}
                            invalid={invalid}
                            type="number"
                            min={1}
                            max={draft.scheduledRounds}
                            value={draft.endRound ?? ''}
                            onChange={(e) =>
                              set('endRound', e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        )}
                      </Field>
                      <Field
                        label="Time"
                        required
                        error={errors.endTimeSeconds}
                        hint={
                          draft.endTimeSeconds !== null
                            ? clockTime(draft.endTimeSeconds)
                            : 'Seconds into the round'
                        }
                      >
                        {({ id, invalid }) => (
                          <Input
                            id={id}
                            invalid={invalid}
                            type="number"
                            min={0}
                            max={300}
                            placeholder="e.g. 143"
                            value={draft.endTimeSeconds ?? ''}
                            onChange={(e) =>
                              set(
                                'endTimeSeconds',
                                e.target.value === '' ? null : Number(e.target.value),
                              )
                            }
                          />
                        )}
                      </Field>
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">
              A scheduled bout carries no result. The engine ignores it until it is marked
              completed.
            </p>
          )}
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={busy} icon={<Save className="size-4" />}>
            {isEdit ? 'Save and recalculate' : 'Record and recalculate'}
          </Button>
          <Link to="/admin/fights">
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </Link>
          <p className="text-xs text-faint">
            Saving validates the bout, updates records, re-runs the engine for the affected
            divisions and writes the ranking history.
          </p>
        </div>
      </form>

      <Modal
        open={result !== null}
        onClose={() => {
          setResult(null)
          navigate('/admin/fights')
        }}
        title="Ranking update"
        description={
          result
            ? `${result.summary.divisions} division(s) · ${result.summary.fighters} fighters · ${result.summary.historyRows} history rows · ${result.summary.durationMs} ms`
            : undefined
        }
        width="md"
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setResult(null)
              navigate('/admin/fights')
            }}
          >
            Done
          </Button>
        }
      >
        {result && result.changes.filter((c) => c.movement !== 0).length > 0 ? (
          <MoversList movers={result.changes.filter((c) => c.movement !== 0)} />
        ) : (
          <p className="text-sm text-muted">
            No position changed as a result of this card — every result confirmed the existing
            order. Ratings still moved; open a fighter profile to see the new numbers.
          </p>
        )}
      </Modal>
    </div>
  )
}
