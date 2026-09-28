import { useRepository } from '@/hooks/useData'
import { useAsync } from '@/hooks/useAsync'
import { Container, ErrorState, SectionHeader, Skeleton } from '@/components/ui'
import { CONFIG_REGISTRY } from '@/ranking/config'

/**
 * Public methodology (§42, §41).
 *
 * The values shown here are read live from `ranking_config`, so the page can
 * never drift from the numbers the engine is actually using.
 */
export default function Methodology() {
  const repository = useRepository()
  const { data, error, loading, reload } = useAsync(
    () => repository.listConfigRows(),
    [repository],
  )

  const groups = new Map<string, typeof CONFIG_REGISTRY>()
  for (const entry of CONFIG_REGISTRY) {
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry])
  }

  const liveValue = (key: string): string => {
    const row = data?.find((r) => r.key === key)
    if (!row) return '—'
    if (row.data_type === 'boolean') return row.value ? 'On' : 'Off'
    return String(row.value)
  }

  return (
    <Container className="py-8 sm:py-12" size="narrow">
      <SectionHeader eyebrow="No votes. No panels. No promotion." title="How the ranking works"
        level={1} />

      <div className="space-y-10 text-sm leading-relaxed text-chalk-dim">
        <section>
          <p>
            FIGHTRANK positions are produced by a single deterministic function of the recorded
            results. Given the same fights and the same settings, the engine returns the same
            rankings every time. There is no editorial adjustment, no fan vote, and no input from
            ticket sales, social media or promotional priority.
          </p>
        </section>

        <Step
          n="01"
          title="Every fighter starts at 1500"
          body="A new fighter enters at the base rating and moves only through results. No debutant is ever ranked ahead of an established fighter on reputation."
        />

        <Step
          n="02"
          title="Each bout is an Elo adjustment"
          body="The expected result is computed from both fighters' ratings. Beating someone rated far above you moves your rating a long way; beating someone far below barely moves it. Losing works the same way in reverse."
        />

        <Step
          n="03"
          title="Opponent quality scales the reward"
          body="On top of the ratings, the reward is multiplied by where the opponent stood on the night — champion, #1, top five, top ten, top fifteen or unranked. Beating the champion is worth substantially more than beating an unranked opponent."
        />

        <Step
          n="04"
          title="Method of victory adds a bonus"
          body="A finish carries a bonus. Crucially, the bonus only ever adds — a decision win is never worth less than no win at all, and a fighter is never punished for going the distance."
        />

        <Step
          n="05"
          title="Form, streaks, finishes and activity adjust the standing"
          body="The career rating is then modified by a recency window: recent results, sustained winning (hard-capped so a run against weak opposition cannot outweigh quality), finish rate, and time since the last bout. Every one of these is capped."
        />

        <Step
          n="06"
          title="The champion sits above the list"
          body="A champion is not #1 — they are the champion, shown above fifteen ranked contenders. Championship status changes only through a title bout. An interim champion is placed first among the contenders."
        />

        <Step
          n="07"
          title="Every movement is explained"
          body="After every event the engine writes the previous rank, the new rank and the reasons to a permanent ledger. Those reasons are what you see on a fighter's profile — generated from the ranking data itself."
        />

        <section>
          <h2 className="mb-3 text-2xl text-chalk">What can never affect a ranking</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              'Popularity or fan voting',
              'Social media following',
              'Ticket or pay-per-view sales',
              'Promotional priority',
              'Editorial or panel opinion',
              'Nationality or team affiliation',
            ].map((item) => (
              <li key={item} className="border border-line bg-ink-800 px-3 py-2 text-sm text-muted">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-2xl text-chalk">Live settings</h2>
          <p className="mb-4 text-sm text-muted">
            These are the exact values the engine is running with right now, read from the database.
          </p>

          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="space-y-6">
              {[...groups.entries()].map(([group, entries]) => (
                <div key={group}>
                  <div className="eyebrow mb-2">{group}</div>
                  <dl className="border border-line">
                    {entries.map((entry) => (
                      <div
                        key={`${entry.scope}-${entry.key}`}
                        className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-line-soft px-3 py-2 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <dt className="text-sm text-chalk-dim">{entry.label}</dt>
                          <dd className="text-xs text-faint">{entry.description}</dd>
                        </div>
                        <span className="numeral shrink-0 text-lg text-signal">
                          {liveValue(entry.key)}
                        </span>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Container>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <section className="flex gap-4">
      <div className="numeral shrink-0 text-3xl text-signal">{n}</div>
      <div>
        <h2 className="text-xl text-chalk">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </section>
  )
}
