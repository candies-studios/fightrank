import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Play, RotateCcw } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { loadEngineInput } from '@/services/recalculate'
import { simulate, type SimulationResult } from '@/ranking/simulator'
import { scopeToDiscipline } from '@/ranking/multiDiscipline'
import type { DecisionType, Method } from '@/types/domain'
import { FighterAvatar } from '@/components/FighterAvatar'
import { Movement, RankPlate } from '@/components/Movement'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Panel,
  SectionHeader,
  Select,
  Skeleton,
  Toggle,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { signed } from '@/lib/format'

const METHODS: Array<{ value: Method; label: string }> = [
  { value: 'ko', label: 'KO' },
  { value: 'tko', label: 'TKO' },
  { value: 'submission', label: 'Submission' },
  { value: 'pin', label: 'Pin' },
  { value: 'technical_fall', label: 'Technical fall' },
  { value: 'decision', label: 'Decision' },
]

const IS_DECISION = (method: Method) => method === 'decision' || method === 'technical_decision'

/**
 * Ranking simulator (§38).
 *
 * Runs the production engine twice — once over the recorded bouts and once with
 * a hypothetical bout appended — and diffs the two. Nothing is written to the
 * database, and there is no separate "estimation" maths: what you see here is
 * exactly what recording the result would produce.
 */
export default function Simulator() {
  const repository = useRepository()
  const app = useApp()
  const toast = useToast()

  const [divisionId, setDivisionId] = useState('')
  const [fighterAId, setFighterAId] = useState('')
  const [fighterBId, setFighterBId] = useState('')
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [method, setMethod] = useState<Method>('ko')
  const [decisionType, setDecisionType] = useState<DecisionType>('unanimous')
  const [isTitleFight, setIsTitleFight] = useState(false)
  const [isInterimTitle, setIsInterimTitle] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [running, setRunning] = useState(false)

  const { data, error, loading } = useAsync(
    async () => {
      const [input, fighters] = await Promise.all([
        loadEngineInput(app.context),
        repository.listFighters({ pageSize: 1000, sort: 'rank' }),
      ])
      return { input, fighters: fighters.rows }
    },
    [app.context, repository, app.revision],
  )

  /**
   * A fighter's division is per discipline, so the roster comes from the
   * registrations rather than the denormalised primary division on the profile.
   */
  const roster = useMemo(() => {
    if (!data) return []
    if (!divisionId) return data.fighters
    const registered = new Set(
      data.input.registrations.filter((r) => r.divisionId === divisionId).map((r) => r.fighterId),
    )
    return data.fighters.filter((f) => registered.has(f.id))
  }, [data, divisionId])

  const disciplineIdOf = (division: string) =>
    data?.input.divisions.find((d) => d.id === division)?.disciplineId ?? null
  const nameOf = (id: string) =>
    data?.fighters.find((f) => f.id === id)?.displayName ?? 'Unknown fighter'
  const fighterOf = (id: string) => data?.fighters.find((f) => f.id === id)

  const run = () => {
    if (!data) return
    if (!divisionId || !fighterAId || !fighterBId) {
      toast.error('Incomplete', 'Pick a division and two fighters.')
      return
    }
    if (fighterAId === fighterBId) {
      toast.error('Invalid match-up', 'A fighter cannot face himself.')
      return
    }
    const disciplineId = disciplineIdOf(divisionId)
    if (!disciplineId) {
      toast.error('Unknown division', 'That division is not attached to a discipline.')
      return
    }
    setRunning(true)
    try {
      // One discipline is one self-contained world: the simulation runs over
      // that discipline's athletes and bouts only.
      const output = simulate({
        base: scopeToDiscipline(data.input, disciplineId),
        divisionId,
        fighterAId,
        fighterBId,
        winnerId,
        method,
        decisionType: IS_DECISION(method) ? decisionType : null,
        endRound: IS_DECISION(method) ? null : 2,
        endTimeSeconds: IS_DECISION(method) ? null : 143,
        isTitleFight,
        isInterimTitle,
        scheduledRounds: isTitleFight ? 5 : 3,
      })
      setResult(output)
    } catch (cause) {
      toast.error('Simulation failed', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRunning(false)
    }
  }

  if (error) return <ErrorState error={error} />
  if (loading) return <Skeleton className="h-[36rem] w-full" />

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        eyebrow="Nothing is written to the database"
        title="Ranking simulator"
        level={1}
        action={
          result ? (
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setResult(null)}>
              Reset
            </Button>
          ) : null
        }
      />

      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted">
        The simulator runs the production ranking engine twice — once over the recorded bouts, once
        with your hypothetical result appended — and shows the difference. There is no separate
        estimation logic, so what appears below is exactly what recording the result would produce.
      </p>

      <Panel className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Division" required>
            {({ id }) => (
              <Select
                id={id}
                value={divisionId}
                onChange={(e) => {
                  setDivisionId(e.target.value)
                  setFighterAId('')
                  setFighterBId('')
                  setWinnerId(null)
                  setResult(null)
                }}
              >
                <option value="">Select…</option>
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

          <Field label="Fighter A" required>
            {({ id }) => (
              <Select
                id={id}
                value={fighterAId}
                onChange={(e) => {
                  setFighterAId(e.target.value)
                  setWinnerId(e.target.value)
                  setResult(null)
                }}
              >
                <option value="">Select…</option>
                {roster.map((fighter) => (
                  <option key={fighter.id} value={fighter.id}>
                    {fighter.isChampion ? 'C' : fighter.currentRank !== null ? `#${fighter.currentRank}` : 'NR'}{' '}
                    {fighter.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Fighter B" required>
            {({ id }) => (
              <Select
                id={id}
                value={fighterBId}
                onChange={(e) => {
                  setFighterBId(e.target.value)
                  setResult(null)
                }}
              >
                <option value="">Select…</option>
                {roster.map((fighter) => (
                  <option key={fighter.id} value={fighter.id}>
                    {fighter.isChampion ? 'C' : fighter.currentRank !== null ? `#${fighter.currentRank}` : 'NR'}{' '}
                    {fighter.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Expected winner">
            {({ id }) => (
              <Select
                id={id}
                value={winnerId ?? ''}
                onChange={(e) => setWinnerId(e.target.value || null)}
              >
                <option value="">Draw</option>
                {fighterAId ? <option value={fighterAId}>{nameOf(fighterAId)}</option> : null}
                {fighterBId ? <option value={fighterBId}>{nameOf(fighterBId)}</option> : null}
              </Select>
            )}
          </Field>

          <Field label="Method">
            {({ id }) => (
              <Select
                id={id}
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
                disabled={!winnerId}
              >
                {METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {method === 'decision' ? (
            <Field label="Decision">
              {({ id }) => (
                <Select
                  id={id}
                  value={decisionType}
                  onChange={(e) => setDecisionType(e.target.value as DecisionType)}
                >
                  <option value="unanimous">Unanimous</option>
                  <option value="split">Split</option>
                  <option value="majority">Majority</option>
                </Select>
              )}
            </Field>
          ) : (
            <div />
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="Title fight"
            checked={isTitleFight}
            onChange={(value) => {
              setIsTitleFight(value)
              if (!value) setIsInterimTitle(false)
            }}
          />
          <Toggle
            label="Interim title"
            checked={isInterimTitle}
            disabled={!isTitleFight}
            onChange={setIsInterimTitle}
          />
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={run}
          loading={running}
          icon={<Play className="size-4" />}
        >
          Simulate
        </Button>
      </Panel>

      {result ? (
        <div className="mt-8 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {result.fighters.map((entry) => {
              const fighter = fighterOf(entry.fighterId)
              const isWinner = entry.fighterId === winnerId
              return (
                <div
                  key={entry.fighterId}
                  className={cn(
                    'border p-4',
                    isWinner ? 'border-signal/50 bg-signal-wash/30' : 'border-line bg-ink-800',
                  )}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <FighterAvatar
                      id={entry.fighterId}
                      name={nameOf(entry.fighterId)}
                      photoUrl={fighter?.photoUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="eyebrow text-[0.58rem]">
                        {winnerId === null ? 'Draw' : isWinner ? 'Winner' : 'Loser'}
                      </div>
                      <div className="truncate font-display text-xl font-bold uppercase text-chalk">
                        {nameOf(entry.fighterId)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-y border-line py-3 text-center">
                    <div>
                      <div className="eyebrow text-[0.55rem]">Before</div>
                      <div className="mt-1 flex justify-center">
                        <RankPlate
                          position={entry.before.rank}
                          isChampion={entry.before.isChampion}
                          size="sm"
                        />
                      </div>
                      <div className="numeral mt-1 text-sm text-muted">
                        {Math.round(entry.before.rating)}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <Movement
                        movement={entry.rankChange}
                        label={
                          entry.before.rank === null
                            ? 'new'
                            : entry.after.rank === null
                              ? 'out'
                              : entry.rankChange > 0
                                ? 'up'
                                : entry.rankChange < 0
                                  ? 'down'
                                  : 'none'
                        }
                        size="lg"
                      />
                      <div
                        className={cn(
                          'numeral mt-1 text-sm',
                          entry.ratingChange >= 0 ? 'text-rise' : 'text-fall',
                        )}
                      >
                        {signed(entry.ratingChange)}
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow text-[0.55rem]">After</div>
                      <div className="mt-1 flex justify-center">
                        <RankPlate
                          position={entry.after.rank}
                          isChampion={entry.after.isChampion}
                          size="sm"
                        />
                      </div>
                      <div className="numeral mt-1 text-sm text-chalk">
                        {Math.round(entry.after.rating)}
                      </div>
                    </div>
                  </div>

                  {entry.explanation.length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {entry.explanation.map((line) => (
                        <li key={line} className="text-xs leading-snug text-chalk-dim">
                          · {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div>
            <div className="eyebrow mb-2">Knock-on effects in the division</div>
            {result.collateral.length === 0 ? (
              <EmptyState title="No other fighter would move" />
            ) : (
              <ul className="border-t border-line-soft">
                {result.collateral.map((row) => (
                  <li
                    key={row.fighterId}
                    className="flex items-center gap-3 border-b border-line-soft py-2"
                  >
                    <Movement
                      movement={row.movement}
                      label={
                        row.before === null
                          ? 'new'
                          : row.after === null
                            ? 'out'
                            : row.movement > 0
                              ? 'up'
                              : row.movement < 0
                                ? 'down'
                                : 'none'
                      }
                      size="sm"
                    />
                    <Link
                      to={`/fighters/${fighterOf(row.fighterId)?.slug ?? ''}`}
                      className="min-w-0 flex-1 truncate text-sm text-chalk transition hover:text-signal"
                    >
                      {nameOf(row.fighterId)}
                    </Link>
                    <span className="numeral shrink-0 text-sm text-muted">
                      #{row.before ?? '—'} → #{row.after ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-2 border border-line bg-ink-850 p-3 text-xs leading-relaxed text-faint">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-signal" />
            This simulation was not saved. To make it real, record the bout from{' '}
            <Link to="/admin/fights/new" className="text-signal underline">
              Add fight
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  )
}
