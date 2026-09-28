import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Crown, GitCompareArrows, Shield, Sparkles } from 'lucide-react'
import { useApp, useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { FighterAvatar } from '@/components/FighterAvatar'
import { Movement, RankPlate } from '@/components/Movement'
import { FightRow } from '@/components/FightRow'
import { RankingChart } from '@/components/RankingChart'
import { ScoreBreakdownPanel, WhyThisRanking } from '@/components/ScoreBreakdown'
import {
  Badge,
  Button,
  Container,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
} from '@/components/ui'
import type { DisciplineRecord } from '@/types/domain'
import {
  age,
  flagOf,
  heightLabel,
  percent,
  record,
  relativeDays,
  shortDate,
} from '@/lib/format'
import { cn } from '@/lib/cn'

type Tab = 'history' | 'ranking' | 'analysis'

/**
 * One Fighter ID, every record.
 *
 * The athlete is a single person; their standing is not. Each discipline they
 * compete in has its own division, its own rating and its own ranking, and this
 * page shows them side by side without ever mixing them.
 */
export default function FighterProfile() {
  const { fighterId = '' } = useParams()
  const repository = useRepository()
  const { revision } = useApp()
  const [tab, setTab] = useState<Tab>('history')
  const [chosenDiscipline, setChosenDiscipline] = useState<string | null>(null)

  const base = useAsync(
    async () => {
      const fighter = await repository.getFighter(fighterId)
      if (!fighter) return null
      const [records, fights] = await Promise.all([
        repository.listDisciplineRecords(fighter.id),
        repository.listFights({ fighterId: fighter.id, status: 'all' }),
      ])
      return { fighter, records, fights }
    },
    [fighterId, repository, revision],
  )

  const records = base.data?.records ?? []
  const active: DisciplineRecord | null = useMemo(
    () =>
      records.find((r) => r.disciplineId === chosenDiscipline) ??
      records.find((r) => r.isPrimary) ??
      records[0] ??
      null,
    [records, chosenDiscipline],
  )

  const scoped = useAsync(
    async () => {
      if (!base.data || !active) return null
      const [history, breakdown] = await Promise.all([
        repository.listRankingHistory(base.data.fighter.id, active.disciplineId),
        repository.getBreakdown(base.data.fighter.id, active.divisionId, active.disciplineId),
      ])
      return { history, breakdown }
    },
    [repository, base.data?.fighter.id, active?.disciplineId, active?.divisionId, revision],
  )

  if (base.error) {
    return (
      <Container className="py-16">
        <ErrorState error={base.error} onRetry={base.reload} />
      </Container>
    )
  }

  if (base.loading) {
    return (
      <Container className="py-10">
        <Skeleton className="h-64 w-full" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </Container>
    )
  }

  if (!base.data) {
    return (
      <Container className="py-20">
        <EmptyState
          title="Fighter not found"
          description="This profile does not exist, or has been removed."
          action={
            <Link to="/fighters">
              <Button size="sm">Browse fighters</Button>
            </Link>
          }
        />
      </Container>
    )
  }

  const { fighter, fights } = base.data
  const history = scoped.data?.history ?? []
  const breakdown = scoped.data?.breakdown ?? null

  // Every bout on the profile belongs to exactly one discipline, so the fight
  // history follows the selected record rather than showing a mixed timeline.
  const inDiscipline = active
    ? fights.filter((f) => f.disciplineId === active.disciplineId)
    : fights
  const completed = inDiscipline.filter((f) => f.status === 'completed')
  const upcoming = inDiscipline.filter((f) => f.status === 'scheduled')
  const explanation = (breakdown?.details.explanation as string[] | undefined) ?? []
  const titleWins = completed.filter((f) => f.winnerId === fighter.id && f.isTitleFight).length

  return (
    <>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden border-b border-line bg-ink-850">
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              'radial-gradient(60% 100% at 8% 0%, rgba(255,181,37,0.10) 0%, transparent 62%)',
          }}
        />
        <Container className="relative py-8 sm:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <FighterAvatar
              id={fighter.id}
              name={fighter.displayName}
              photoUrl={fighter.photoUrl}
              size="xl"
              square
              className="h-32 w-32 sm:h-44 sm:w-44"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {active?.isChampion ? (
                  <Badge tone="signal">
                    <Crown className="size-3" />
                    {active.disciplineCode} champion
                  </Badge>
                ) : null}
                {active?.isInterimChampion ? (
                  <Badge tone="signal">
                    <Shield className="size-3" />
                    Interim champion
                  </Badge>
                ) : null}
                {active?.isFormerChampion && !active.isChampion ? (
                  <Badge tone="outline">Former champion</Badge>
                ) : null}
                {active && !active.isActive ? <Badge tone="outline">Inactive</Badge> : null}
                {active?.p4pRank ? (
                  <Badge tone="neutral">
                    {active.disciplineCode} P4P #{active.p4pRank}
                  </Badge>
                ) : null}
                {fighter.isDemo ? <Badge tone="outline">Fictional demo profile</Badge> : null}
              </div>

              {fighter.nickname ? (
                <div className="eyebrow mb-1 text-signal">“{fighter.nickname}”</div>
              ) : null}
              <h1 className="text-[10vw] leading-[0.9] text-chalk sm:text-6xl">
                {fighter.displayName}
              </h1>
              <p className="mt-2 text-sm text-chalk-dim">
                <span className="numeral text-faint">{fighter.fighterCode}</span>
                {' · '}
                {flagOf(fighter.countryCode)} {fighter.country ?? 'Unknown'}
                {fighter.team ? ` · ${fighter.team}` : ''}
              </p>
              {records.length > 1 ? (
                <p className="mt-1 text-xs text-faint">
                  One Fighter ID · {records.length} disciplines · {fighter.careerWins}-
                  {fighter.careerLosses} across {fighter.careerFights} career bouts
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-end gap-6">
              <div className="text-center">
                <div className="eyebrow mb-1 text-[0.58rem]">
                  {active?.disciplineCode ?? ''} rank
                </div>
                <RankPlate
                  position={active?.currentRank ?? null}
                  isChampion={active?.isChampion ?? false}
                  isInterim={active?.isInterimChampion ?? false}
                  size="lg"
                />
                <div className="mt-1.5 flex justify-center">
                  <Movement
                    movement={active?.rankMovement ?? 0}
                    label={active?.rankMovementLabel ?? 'none'}
                    size="sm"
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="eyebrow mb-1 text-[0.58rem]">Rating</div>
                <div className="numeral text-5xl leading-none text-chalk">
                  {Math.round(active?.rating ?? fighter.rating)}
                </div>
              </div>
            </div>
          </div>

          {/* Discipline switcher — the whole page follows this control. */}
          {records.length > 1 ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {records.map((entry) => {
                const selected = entry.disciplineId === active?.disciplineId
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setChosenDiscipline(entry.disciplineId)}
                    className={cn(
                      'flex items-baseline gap-2 border px-3.5 py-2 transition-colors',
                      selected
                        ? 'border-signal bg-signal text-ink-900'
                        : 'border-line text-chalk-dim hover:border-chalk-dim hover:text-chalk',
                    )}
                  >
                    <span className="font-display text-sm font-semibold uppercase tracking-[0.06em]">
                      {entry.disciplineName}
                    </span>
                    <span
                      className={cn('numeral text-xs', selected ? 'text-ink-900/70' : 'text-faint')}
                    >
                      {entry.isChampion ? 'C' : entry.currentRank !== null ? `#${entry.currentRank}` : 'NR'}
                      {' · '}
                      {entry.wins}-{entry.losses}-{entry.draws}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}

          <p className="mt-4 text-sm text-chalk-dim">
            {active?.divisionSlug ? (
              <>
                Competing at{' '}
                <Link
                  to={`/rankings/${active.divisionSlug}`}
                  className="transition hover:text-signal"
                >
                  {active.divisionName}
                </Link>{' '}
                in{' '}
                <Link
                  to={`/disciplines/${active.disciplineSlug}`}
                  className="transition hover:text-signal"
                >
                  {active.disciplineName}
                </Link>
              </>
            ) : (
              'Unassigned'
            )}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Record" value={active ? record(active) : record(fighter)} />
            <Stat
              label="Win streak"
              value={(active?.winStreak ?? 0) > 0 ? active!.winStreak : '—'}
            />
            <Stat label="KO / TKO" value={active?.koWins ?? 0} />
            <Stat label="Submission" value={active?.subWins ?? 0} />
            <Stat label="Decision" value={active?.decWins ?? 0} />
            <Stat label="Finish rate" value={percent(active?.finishRate ?? 0)} />
            <Stat label="Ranked wins" value={active?.rankedWins ?? 0} />
          </dl>
          {records.length > 1 ? (
            <p className="mt-2 text-xs text-faint">
              These figures cover {active?.disciplineName} only. A result in one discipline never
              affects a rating in another.
            </p>
          ) : null}
        </Container>
      </section>

      <Container className="py-8 sm:py-10">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
          <div className="min-w-0">
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: 'history', label: 'Fight history', count: completed.length },
                { value: 'ranking', label: 'Ranking history', count: history.length },
                { value: 'analysis', label: 'Why this ranking' },
              ]}
              className="mb-5"
            />

            {tab === 'history' ? (
              <>
                {upcoming.length > 0 ? (
                  <div className="mb-8">
                    <div className="eyebrow mb-2 text-signal">Next bout</div>
                    <div className="border border-signal/30 bg-signal-wash/40 px-3">
                      {upcoming.map((fight) => (
                        <FightRow
                          key={fight.id}
                          fight={fight}
                          showEvent
                          highlightFighterId={fighter.id}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {completed.length === 0 ? (
                  <EmptyState
                    title="No recorded bouts"
                    description={`This athlete has no ${active?.disciplineName ?? ''} results in the database yet.`}
                  />
                ) : (
                  <div className="border-t border-line-soft">
                    {completed.map((fight) => (
                      <FightRow
                        key={fight.id}
                        fight={fight}
                        showEvent
                        highlightFighterId={fighter.id}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {tab === 'ranking' ? (
              <>
                <div className="mb-6 border border-line bg-ink-800 p-4">
                  <div className="eyebrow mb-3">
                    Position over time · {active?.disciplineName}
                  </div>
                  {scoped.loading ? (
                    <Skeleton className="h-[240px] w-full" />
                  ) : (
                    <RankingChart history={history} height={240} />
                  )}
                </div>
                {history.length === 0 ? (
                  <EmptyState title="No ranking movement recorded" />
                ) : (
                  <ol className="border-t border-line-soft">
                    {[...history].reverse().map((entry) => (
                      <li key={entry.id} className="flex gap-4 border-b border-line-soft py-3">
                        <div className="w-24 shrink-0">
                          <div className="numeral text-sm text-chalk">
                            {entry.previousRank === null
                              ? 'NEW'
                              : `#${entry.previousRank === 0 ? 'C' : entry.previousRank}`}
                            <span className="mx-1 text-faint">→</span>
                            {entry.newRank === null
                              ? 'OUT'
                              : entry.newRank === 0
                                ? 'C'
                                : `#${entry.newRank}`}
                          </div>
                          <div className="text-xs text-faint">{shortDate(entry.effectiveDate)}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <ul className="space-y-0.5">
                            {entry.movementReason.map((reason) => (
                              <li key={reason} className="text-sm leading-snug text-chalk-dim">
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Movement
                          movement={entry.movement}
                          label={entry.movementLabel}
                          size="sm"
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : null}

            {tab === 'analysis' ? (
              <div className="space-y-8">
                {scoped.loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : explanation.length > 0 ? (
                  <div className="border border-line bg-ink-800 p-5">
                    <div className="eyebrow mb-4 flex items-center gap-2 text-signal">
                      <Sparkles className="size-3.5" />
                      Why am I ranked here in {active?.disciplineName}?
                    </div>
                    <WhyThisRanking lines={explanation} />
                    <p className="mt-5 border-t border-line pt-3 text-xs leading-relaxed text-faint">
                      These sentences are generated deterministically from the same numbers the
                      engine used. Nothing here is written by hand or by a language model — the same
                      data always produces the same explanation.
                    </p>
                  </div>
                ) : (
                  <EmptyState title="No breakdown available" description="Run a recalculation to generate one." />
                )}

                <div>
                  <div className="eyebrow mb-3">Recent opposition</div>
                  {completed.slice(0, 5).length === 0 ? (
                    <EmptyState title="No opposition recorded" />
                  ) : (
                    <ul className="border-t border-line-soft">
                      {completed.slice(0, 5).map((fight) => {
                        const opponent =
                          fight.fighterA.id === fighter.id ? fight.fighterB : fight.fighterA
                        const won = fight.winnerId === fighter.id
                        return (
                          <li
                            key={fight.id}
                            className="flex items-center gap-3 border-b border-line-soft py-2.5"
                          >
                            <span
                              className={`numeral w-6 text-center text-sm ${
                                won ? 'text-rise' : fight.winnerId ? 'text-fall' : 'text-muted'
                              }`}
                            >
                              {won ? 'W' : fight.winnerId ? 'L' : fight.outcome === 'no_contest' ? 'NC' : 'D'}
                            </span>
                            <Link
                              to={`/fighters/${opponent.slug}`}
                              className="min-w-0 flex-1 truncate text-sm text-chalk transition hover:text-signal"
                            >
                              {opponent.displayName}
                            </Link>
                            <span className="shrink-0 text-xs text-muted">
                              {shortDate(fight.eventDate)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* ---- Sidebar ---- */}
          <aside className="min-w-0 space-y-8">
            {records.length > 1 ? (
              <div className="border border-line bg-ink-800 p-5">
                <div className="eyebrow mb-4">Records under this Fighter ID</div>
                <ul className="flex flex-col gap-px bg-line">
                  {records.map((entry) => (
                    <li key={entry.id} className="bg-ink-800 py-2.5">
                      <button
                        type="button"
                        onClick={() => setChosenDiscipline(entry.disciplineId)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="numeral w-9 shrink-0 text-center text-sm text-chalk-dim">
                          {entry.isChampion
                            ? 'C'
                            : entry.currentRank !== null
                              ? `#${entry.currentRank}`
                              : 'NR'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-chalk">
                            {entry.disciplineName}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {entry.divisionName ?? 'Unassigned'} · {record(entry)}
                          </span>
                        </span>
                        <span className="numeral shrink-0 text-sm text-signal">
                          {Math.round(entry.rating)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-faint">
                  Each rating is built only from bouts contested under that discipline&rsquo;s
                  rules. They are never averaged or combined.
                </p>
              </div>
            ) : null}

            {breakdown ? (
              <div className="border border-line bg-ink-800 p-5">
                <div className="eyebrow mb-4">
                  Ranking score breakdown · {active?.disciplineCode}
                </div>
                <ScoreBreakdownPanel breakdown={breakdown} />
              </div>
            ) : null}

            <div className="border border-line bg-ink-800 p-5">
              <div className="eyebrow mb-4">Profile</div>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <Detail label="Fighter ID" value={fighter.fighterCode} />
                <Detail label="Age" value={age(fighter.dateOfBirth) ?? '—'} />
                <Detail label="Height" value={heightLabel(fighter.heightCm)} />
                <Detail label="Reach" value={fighter.reachCm ? `${fighter.reachCm} cm` : '—'} />
                <Detail label="Stance" value={fighter.stance ?? '—'} className="capitalize" />
                <Detail label="Debut" value={shortDate(active?.debutDate ?? fighter.debutDate)} />
                <Detail label="Last bout" value={relativeDays(active?.lastFightDate ?? null)} />
                <Detail
                  label="Strength of schedule"
                  value={Math.round(active?.strengthOfSchedule ?? 0)}
                />
                <Detail label="Title fights won" value={titleWins} />
                <Detail label="Title defences" value={active?.titleDefenses ?? 0} />
              </dl>
            </div>

            <Link to={`/compare?a=${fighter.slug}`} className="block">
              <Button
                variant="secondary"
                className="w-full"
                icon={<GitCompareArrows className="size-4" />}
              >
                Compare with another fighter
              </Button>
            </Link>
          </aside>
        </div>
      </Container>
    </>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-ink-850 px-3 py-3">
      <dt className="eyebrow text-[0.56rem]">{label}</dt>
      <dd className="numeral mt-1 text-2xl leading-none text-chalk">{value}</dd>
    </div>
  )
}

function Detail({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className={`text-chalk-dim ${className ?? ''}`}>{value}</dd>
    </div>
  )
}
