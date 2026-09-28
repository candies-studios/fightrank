import { Link } from 'react-router-dom'
import { Database, GitBranch, ScrollText, Scale } from 'lucide-react'
import { useApp } from '@/hooks/useData'
import { Container, Panel, SectionHeader } from '@/components/ui'

const PRINCIPLES = [
  {
    icon: Scale,
    title: 'A result is the only currency',
    body:
      'Nothing on this platform moves a ranking except a recorded bout. There is no promotional weighting, no fan vote, no panel of writers, and no editorial override. A win against a higher-ranked opponent is worth more than a win against a lower-ranked one, and that is the whole of the politics.',
  },
  {
    icon: GitBranch,
    title: 'Each discipline stands alone',
    body:
      'An athlete carries one Fighter ID across every sport they compete in, but each discipline is rated in isolation. A submission win never touches a kickboxing rating. The profile shows every record side by side; the engine keeps them apart.',
  },
  {
    icon: ScrollText,
    title: 'Every position is explainable',
    body:
      'Each ranking carries a breakdown: the career rating it started from, and every modifier applied to it — opponent quality, recent form, streak, finish rate, activity, title status. The components add up to the published score exactly. If a fighter moves, the reason is written down.',
  },
  {
    icon: Database,
    title: 'The record is auditable',
    body:
      'Rankings are regenerated from the full history of results every time the engine runs, so the same facts always produce the same table. Every administrative change is written to an append-only audit log that cannot be edited or deleted.',
  },
]

export default function About() {
  const { disciplines, context } = useApp()

  return (
    <Container className="py-8 sm:py-12" size="narrow">
      <SectionHeader eyebrow="What this is" title="About FIGHTRANK" level={1} />

      <p className="text-lg leading-relaxed text-chalk-dim">
        FIGHTRANK is an independent ranking platform for combat sports. It exists to answer one
        question honestly: <em className="text-chalk">after that result, who stands where?</em>
      </p>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        Most rankings in combat sports are assembled by people — a panel, a promotion, a magazine —
        and the reasoning behind a position is rarely published. FIGHTRANK takes the opposite
        approach. Positions are produced by an algorithm from the recorded results, the algorithm is
        documented in full, and every fighter&rsquo;s score can be taken apart line by line on their
        own profile.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((principle) => (
          <Panel key={principle.title} className="p-5">
            <principle.icon className="size-5 text-signal" />
            <h2 className="mt-3 font-display text-base font-semibold uppercase tracking-[0.06em] text-chalk">
              {principle.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{principle.body}</p>
          </Panel>
        ))}
      </div>

      <SectionHeader className="mt-12" eyebrow="What is ranked" title="Disciplines covered" />
      <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
        {disciplines.map((discipline) => (
          <li key={discipline.id}>
            <Link
              to={`/disciplines/${discipline.slug}`}
              className="flex h-full flex-col bg-ink-800 px-4 py-3.5 transition-colors hover:bg-ink-700"
            >
              <span className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-chalk">
                {discipline.name}
              </span>
              <span className="mt-1 text-xs text-muted">{discipline.tagline}</span>
            </Link>
          </li>
        ))}
      </ul>

      <SectionHeader className="mt-12" eyebrow="Be clear about it" title="Independence" />
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        <p>
          FIGHTRANK is not affiliated with, endorsed by, or connected to any promotion, sanctioning
          body or governing organisation. It uses no other organisation&rsquo;s branding, and its
          ranking method is its own — described openly on the{' '}
          <Link to="/methodology" className="text-signal hover:underline">
            methodology page
          </Link>{' '}
          rather than kept proprietary.
        </p>
        <p>
          The athletes, events, venues and results in this installation are{' '}
          <strong className="text-chalk">fictional demonstration data</strong>, generated to show
          the system working end to end. Any resemblance to a real competitor or promotion is
          unintentional.
        </p>
        <p className="text-xs text-faint">
          Running against{' '}
          {context.mode === 'supabase'
            ? 'a Supabase PostgreSQL database.'
            : 'a local PostgreSQL database in the browser.'}
        </p>
      </div>
    </Container>
  )
}
