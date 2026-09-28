import { Link } from 'react-router-dom'
import { Award, Crown } from 'lucide-react'
import type { FighterRef, FightWithContext } from '@/types/domain'
import { cn } from '@/lib/cn'
import { finishDetail, flagOf, methodLabel, methodShort, shortDate } from '@/lib/format'
import { FighterAvatar } from './FighterAvatar'
import { Badge } from './ui'

const BONUS_LABELS: Record<string, string> = {
  fight_of_the_night: 'Fight of the Night',
  performance_of_the_night: 'Performance of the Night',
  submission_of_the_night: 'Submission of the Night',
  knockout_of_the_night: 'Knockout of the Night',
  technical_display: 'Technical Display',
  match_of_the_night: 'Match of the Night',
}

/** One side of a bout. Declared at module level so it is never re-created. */
function FighterSide({
  fighter,
  mirrored,
  won,
  lost,
  highlighted,
}: {
  fighter: FighterRef
  mirrored: boolean
  won: boolean
  lost: boolean
  highlighted: boolean
}) {
  return (
    <Link
      to={`/fighters/${fighter.slug}`}
      className={cn(
        'group flex min-w-0 flex-1 items-center gap-2.5',
        mirrored && 'flex-row-reverse text-right',
      )}
    >
      <FighterAvatar
        id={fighter.id}
        name={fighter.displayName}
        photoUrl={fighter.photoUrl}
        size="sm"
        className={cn(won && 'ring-1 ring-signal')}
      />
      <span className="min-w-0">
        <span
          className={cn(
            'block truncate text-sm font-medium transition-colors group-hover:text-signal',
            lost ? 'text-muted' : 'text-chalk',
            highlighted && 'text-signal',
          )}
        >
          {fighter.displayName}
        </span>
        <span className="block truncate text-xs text-faint">
          {flagOf(fighter.countryCode)} {fighter.nickname ?? ''}
        </span>
      </span>
    </Link>
  )
}

/** One bout on a card, with the winner clearly resolved. */
export function FightRow({
  fight,
  showEvent = false,
  highlightFighterId,
}: {
  fight: FightWithContext
  showEvent?: boolean
  highlightFighterId?: string
}) {
  const isCompleted = fight.status === 'completed'
  const winnerId = fight.winnerId
  const sideProps = (fighter: FighterRef, mirrored: boolean) => ({
    fighter,
    mirrored,
    won: isCompleted && winnerId === fighter.id,
    lost: isCompleted && winnerId !== null && winnerId !== fighter.id,
    highlighted: highlightFighterId === fighter.id,
  })

  return (
    <div className="border-b border-line-soft py-3 last:border-b-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {fight.isTitleFight ? (
          <Badge tone="signal">
            <Crown className="size-3" />
            {fight.isInterimTitle ? 'Interim title' : 'Title'}
          </Badge>
        ) : null}
        {fight.isMainEvent ? <Badge tone="outline">Main event</Badge> : null}
        <span className="text-xs text-faint">{fight.divisionName}</span>
        {showEvent ? (
          <>
            <span className="text-faint">·</span>
            <Link
              to={`/events/${fight.eventSlug}`}
              className="truncate text-xs text-muted transition-colors hover:text-signal"
            >
              {fight.eventName}
            </Link>
            <span className="text-xs text-faint">{shortDate(fight.eventDate)}</span>
          </>
        ) : null}
        {(fight.bonuses ?? []).map((bonus) => (
          <Badge key={bonus} tone="neutral">
            <Award className="size-3" />
            {BONUS_LABELS[bonus] ?? bonus}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <FighterSide {...sideProps(fight.fighterA, false)} />
        <div className="w-20 shrink-0 text-center sm:w-28">
          {isCompleted ? (
            <>
              <div className="numeral text-sm text-chalk">
                {methodShort(fight.method, fight.outcome)}
              </div>
              <div className="text-[0.68rem] leading-tight text-faint">
                {finishDetail(fight.endRound, fight.endTimeSeconds, fight.scheduledRounds)}
              </div>
            </>
          ) : (
            <div className="numeral text-xs uppercase tracking-widest text-muted">
              {fight.scheduledRounds} rds
            </div>
          )}
        </div>
        <FighterSide {...sideProps(fight.fighterB, true)} />
      </div>

      {isCompleted ? (
        <p className="mt-1.5 text-center text-xs text-muted">
          {fight.outcome === 'win'
            ? `${
                fight.winnerId === fight.fighterA.id
                  ? fight.fighterA.displayName
                  : fight.fighterB.displayName
              } def. ${
                fight.winnerId === fight.fighterA.id
                  ? fight.fighterB.displayName
                  : fight.fighterA.displayName
              } — ${methodLabel(fight.method, fight.decisionType, fight.outcome)}`
            : methodLabel(fight.method, fight.decisionType, fight.outcome)}
        </p>
      ) : null}
    </div>
  )
}
