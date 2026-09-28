import { Link } from 'react-router-dom'
import { Crown, Flame, Shield } from 'lucide-react'
import type { RankingRow } from '@/types/domain'
import { cn } from '@/lib/cn'
import { flagOf, record, relativeDays, shortDate } from '@/lib/format'
import { FighterAvatar } from './FighterAvatar'
import { Movement, RankPlate } from './Movement'

/**
 * The divisional table (§27, §33).
 *
 * Two genuinely different layouts rather than one shrunken table: a dense
 * columnar table on desktop, and a stacked row built for a thumb on mobile.
 */

function OpponentQuality({ value }: { value: number }) {
  // −30…+30 mapped onto a five-segment meter.
  const filled = Math.max(0, Math.min(5, Math.round(((value + 30) / 60) * 5)))
  return (
    <span className="inline-flex items-center gap-[3px]" title={`Opponent quality ${value >= 0 ? '+' : ''}${Math.round(value)}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn('h-3 w-[3px]', i < filled ? 'bg-signal' : 'bg-ink-500')}
        />
      ))}
    </span>
  )
}

function StreakChip({ wins, losses }: { wins: number; losses: number }) {
  if (wins >= 2) {
    return (
      <span className="inline-flex items-center gap-1 text-rise" title={`${wins}-fight win streak`}>
        <Flame className="size-3.5" />
        <span className="numeral text-sm">{wins}</span>
      </span>
    )
  }
  if (losses >= 2) {
    return (
      <span className="numeral text-sm text-fall" title={`${losses}-fight losing streak`}>
        −{losses}
      </span>
    )
  }
  return <span className="text-faint">—</span>
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  const champion = rows.find((row) => row.isChampion)
  const contenders = rows.filter((row) => !row.isChampion)

  return (
    <div>
      {champion ? <ChampionRow row={champion} /> : null}

      {/* Desktop */}
      <div className="hidden lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line text-left">
              {['Rank', 'Fighter', 'Record', 'Rating', 'Move', 'Streak', 'Opposition', 'Last bout'].map(
                (heading, index) => (
                  <th
                    key={heading}
                    className={cn(
                      'eyebrow py-2.5 text-[0.62rem] font-semibold',
                      index === 0 && 'w-16 pl-3',
                      index >= 2 && 'text-right',
                      index === 1 && 'text-left',
                    )}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {contenders.map((row) => (
              <tr
                key={row.fighterId}
                className="group border-b border-line-soft transition-colors hover:bg-ink-800"
              >
                <td className="py-2.5 pl-3">
                  <RankPlate
                    position={row.position}
                    isInterim={row.isInterimChampion}
                    size="sm"
                  />
                </td>
                <td className="py-2.5">
                  <Link to={`/fighters/${row.fighter.slug}`} className="flex items-center gap-3">
                    <FighterAvatar
                      id={row.fighterId}
                      name={row.fighter.displayName}
                      photoUrl={row.fighter.photoUrl}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-chalk transition-colors group-hover:text-signal">
                          {row.fighter.displayName}
                        </span>
                        {row.isInterimChampion ? (
                          <Shield className="size-3.5 shrink-0 text-signal" aria-label="Interim champion" />
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {flagOf(row.fighter.countryCode)} {row.fighter.nickname ?? row.fighter.country ?? ''}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="numeral py-2.5 text-right text-base text-chalk-dim">
                  {record(row.fighter)}
                </td>
                <td className="numeral py-2.5 text-right text-base text-chalk">
                  {Math.round(row.rating)}
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex justify-end">
                    <Movement movement={row.movement} label={row.movementLabel} size="sm" />
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex justify-end">
                    <StreakChip wins={row.fighter.winStreak} losses={row.fighter.lossStreak} />
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex justify-end">
                    <OpponentQuality value={row.breakdown?.opponentQuality ?? 0} />
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right text-xs text-muted">
                  {shortDate(row.fighter.lastFightDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet */}
      <ul className="flex flex-col lg:hidden">
        {contenders.map((row) => (
          <li key={row.fighterId} className="border-b border-line-soft">
            <Link to={`/fighters/${row.fighter.slug}`} className="flex items-center gap-3 py-3">
              <RankPlate position={row.position} isInterim={row.isInterimChampion} size="sm" />
              <FighterAvatar
                id={row.fighterId}
                name={row.fighter.displayName}
                photoUrl={row.fighter.photoUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-chalk">{row.fighter.displayName}</span>
                  {row.isInterimChampion ? <Shield className="size-3.5 shrink-0 text-signal" /> : null}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className="numeral">{record(row.fighter)}</span>
                  <span className="text-faint">·</span>
                  <span className="numeral">{Math.round(row.rating)}</span>
                  <span className="text-faint">·</span>
                  <span className="truncate">{relativeDays(row.fighter.lastFightDate)}</span>
                </div>
              </div>
              <Movement movement={row.movement} label={row.movementLabel} size="sm" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChampionRow({ row }: { row: RankingRow }) {
  return (
    <Link
      to={`/fighters/${row.fighter.slug}`}
      className="group mb-4 flex items-center gap-4 border border-signal/35 bg-gradient-to-r from-signal-wash to-transparent px-3 py-4 transition-colors hover:border-signal/70 sm:px-5"
    >
      <FighterAvatar
        id={row.fighterId}
        name={row.fighter.displayName}
        photoUrl={row.fighter.photoUrl}
        size="lg"
        className="hidden sm:flex"
      />
      <FighterAvatar
        id={row.fighterId}
        name={row.fighter.displayName}
        photoUrl={row.fighter.photoUrl}
        size="md"
        className="sm:hidden"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-signal">
          <Crown className="size-3.5" />
          <span className="eyebrow text-[0.62rem] text-signal">Champion</span>
        </div>
        <div className="text-xl leading-tight text-chalk transition-colors group-hover:text-signal sm:text-3xl">
          <span className="font-display font-bold uppercase">{row.fighter.displayName}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted sm:text-sm">
          {flagOf(row.fighter.countryCode)}{' '}
          {row.fighter.nickname ? `“${row.fighter.nickname}” · ` : ''}
          {record(row.fighter)} · last bout {relativeDays(row.fighter.lastFightDate)}
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <div className="eyebrow text-[0.6rem]">Rating</div>
        <div className="numeral text-4xl leading-none text-chalk">{Math.round(row.rating)}</div>
      </div>
    </Link>
  )
}
