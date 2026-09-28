import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, IdCard, Search } from 'lucide-react'
import { useRepository } from '@/hooks/useData'
import { FighterAvatar } from '@/components/FighterAvatar'
import { RankPlate } from '@/components/Movement'
import {
  Button,
  Container,
  EmptyState,
  ErrorState,
  Input,
  Panel,
  SectionHeader,
  Skeleton,
} from '@/components/ui'
import type { DisciplineRecord, FighterProfile } from '@/types/domain'
import { flagOf, record, shortDate } from '@/lib/format'

const CODE_PATTERN = /^\s*(?:FR[-\s]?)?(\d{1,6})\s*$/i

/** Turn anything that looks like an ID into the canonical FR-00123 form. */
function normaliseCode(input: string): string | null {
  const match = CODE_PATTERN.exec(input)
  if (!match) return null
  return `FR-${match[1].padStart(5, '0')}`
}

/**
 * Fighter ID lookup.
 *
 * One athlete, one ID, for life. Enter the code and you get every record held
 * under it — or search by name if the code has been mislaid.
 */
export default function FighterId() {
  const repository = useRepository()
  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [state, setState] = useState<{
    status: 'idle' | 'searching' | 'found' | 'missing' | 'error'
    fighter?: FighterProfile
    records?: DisciplineRecord[]
    matches?: FighterProfile[]
    error?: Error
  }>({ status: 'idle' })

  const lookup = async (raw: string) => {
    const query = raw.trim()
    if (!query) return
    setState({ status: 'searching' })
    setParams(query ? { q: query } : {}, { replace: true })

    try {
      const code = normaliseCode(query)
      const fighter = code ? await repository.getFighterByCode(code) : null

      if (fighter) {
        const records = await repository.listDisciplineRecords(fighter.id)
        setState({ status: 'found', fighter, records })
        return
      }

      // Not a code, or a code nobody holds — fall back to the name.
      const byName = await repository.listFighters({ search: query, pageSize: 12 })
      if (byName.rows.length === 1) {
        const only = byName.rows[0]
        setState({
          status: 'found',
          fighter: only,
          records: await repository.listDisciplineRecords(only.id),
        })
      } else {
        setState({ status: byName.rows.length ? 'found' : 'missing', matches: byName.rows })
      }
    } catch (cause) {
      setState({
        status: 'error',
        error: cause instanceof Error ? cause : new Error(String(cause)),
      })
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void lookup(term)
  }

  return (
    <Container className="py-8 sm:py-12" size="narrow">
      <SectionHeader eyebrow="One athlete, one ID, for life" title="Fighter ID" level={1} />

      <p className="mb-7 text-sm leading-relaxed text-muted">
        Every athlete on FIGHTRANK carries a permanent Fighter ID. It is issued once, never
        reissued, and follows them across every discipline they compete in — so a wrestler who
        later takes a grappling match keeps the same ID, with a separate record under it.
      </p>

      <Panel className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="FR-00053, or an athlete's name"
              className="pl-9"
              aria-label="Fighter ID or name"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Search className="size-4" />}
            loading={state.status === 'searching'}
          >
            Look up
          </Button>
        </form>
        <p className="mt-3 text-xs text-faint">
          The <strong className="text-muted">FR-</strong> prefix is optional — “53” finds
          FR-00053.
        </p>
      </Panel>

      {state.status === 'searching' ? <Skeleton className="mt-6 h-56 w-full" /> : null}
      {state.status === 'error' && state.error ? (
        <div className="mt-6">
          <ErrorState error={state.error} />
        </div>
      ) : null}

      {state.status === 'missing' ? (
        <div className="mt-6">
          <EmptyState
            title="No athlete holds that ID"
            description="Check the number, or search by name instead. If you have never competed on a FIGHTRANK card, you will not have an ID yet."
            action={
              <Link to="/fighter-id/new">
                <Button size="sm" variant="secondary">
                  Apply for a Fighter ID
                </Button>
              </Link>
            }
          />
        </div>
      ) : null}

      {/* A single athlete — the ID card itself. */}
      {state.status === 'found' && state.fighter && state.records ? (
        <IdentityCard fighter={state.fighter} records={state.records} />
      ) : null}

      {/* Several name matches — pick one. */}
      {state.status === 'found' && state.matches && state.matches.length > 1 ? (
        <div className="mt-6">
          <div className="eyebrow mb-3">{state.matches.length} athletes match</div>
          <ul className="flex flex-col gap-px bg-line">
            {state.matches.map((match) => (
              <li key={match.id} className="bg-ink-800">
                <button
                  type="button"
                  onClick={() => {
                    setTerm(match.fighterCode)
                    void lookup(match.fighterCode)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-700"
                >
                  <span className="numeral shrink-0 text-sm text-signal">{match.fighterCode}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                    {flagOf(match.countryCode)} {match.displayName}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {match.disciplineCode ?? '—'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Panel className="mt-10 p-5">
        <h2 className="font-display text-base font-semibold uppercase tracking-[0.06em] text-chalk">
          Haven&rsquo;t got one?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          An ID is issued when an athlete is added to the platform. If you compete and are not on
          here yet, apply — an administrator reviews each request before an ID is issued.
        </p>
        <Link
          to="/fighter-id/new"
          className="mt-4 inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-signal transition-colors hover:text-chalk"
        >
          Create a Fighter ID
          <ArrowRight className="size-4" />
        </Link>
      </Panel>
    </Container>
  )
}

function IdentityCard({
  fighter,
  records,
}: {
  fighter: FighterProfile
  records: DisciplineRecord[]
}) {
  return (
    <Panel className="mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line bg-ink-850 px-5 py-3">
        <span className="eyebrow text-[0.6rem]">FIGHTRANK identity</span>
        <span className="numeral text-lg text-signal">{fighter.fighterCode}</span>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        <FighterAvatar
          id={fighter.id}
          name={fighter.displayName}
          photoUrl={fighter.photoUrl}
          size="xl"
          square
          className="h-24 w-24 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl text-chalk sm:text-3xl">{fighter.displayName}</h2>
          <p className="mt-1 text-sm text-muted">
            {flagOf(fighter.countryCode)} {fighter.country ?? 'Unknown'}
            {fighter.team ? ` · ${fighter.team}` : ''}
          </p>
          <p className="mt-1 text-xs text-faint">
            {records.length} discipline{records.length === 1 ? '' : 's'} ·{' '}
            {fighter.careerWins}-{fighter.careerLosses} across {fighter.careerFights} career bouts
            {fighter.debutDate ? ` · debut ${shortDate(fighter.debutDate)}` : ''}
          </p>
          <Link
            to={`/fighters/${fighter.slug}`}
            className="mt-3 inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.08em] text-signal transition-colors hover:text-chalk"
          >
            Full profile
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="eyebrow px-5 pt-4">Records under this ID</div>
        <ul className="flex flex-col gap-px bg-line p-0">
          {records.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 bg-ink-800 px-5 py-3">
              <RankPlate
                position={entry.currentRank}
                isChampion={entry.isChampion}
                isInterim={entry.isInterimChampion}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-chalk">{entry.disciplineName}</span>
                <span className="block truncate text-xs text-muted">
                  {entry.divisionName ?? 'Unassigned'} · {record(entry)}
                </span>
              </span>
              <span className="numeral shrink-0 text-sm text-signal">
                {Math.round(entry.rating)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
