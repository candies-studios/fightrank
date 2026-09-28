import {
  DECISION_LABELS,
  METHOD_LABELS,
  type DecisionType,
  type FighterProfile,
  type Method,
  type MovementLabel,
  type Outcome,
} from '@/types/domain'

export function record(fighter: {
  wins: number
  losses: number
  draws: number
  noContests: number
}): string {
  const base = `${fighter.wins}-${fighter.losses}-${fighter.draws}`
  return fighter.noContests > 0 ? `${base} (${fighter.noContests} NC)` : base
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function compactDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export function yearOf(value: string | null | undefined): string {
  return value ? value.slice(0, 4) : '—'
}

export function relativeDays(value: string | null | undefined): string {
  if (!value) return 'No recorded bouts'
  const days = Math.round((Date.now() - Date.parse(`${value.slice(0, 10)}T00:00:00Z`)) / 86_400_000)
  if (days < 0) return 'Upcoming'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 45) return `${days} days ago`
  const months = Math.round(days / 30.4)
  if (months < 24) return `${months} months ago`
  return `${(days / 365.25).toFixed(1)} years ago`
}

export function age(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null
  const years = (Date.now() - Date.parse(`${dateOfBirth.slice(0, 10)}T00:00:00Z`)) / 31_557_600_000
  return years > 0 && years < 100 ? Math.floor(years) : null
}

export function clockTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function methodLabel(
  method: Method | null,
  decisionType: DecisionType | null,
  outcome?: Outcome | null,
): string {
  if (outcome === 'no_contest') return 'No Contest'
  if (outcome === 'majority_draw') return 'Majority Draw'
  if (outcome === 'split_draw') return 'Split Draw'
  if (outcome === 'draw') return 'Draw'
  if (!method) return '—'
  const base = METHOD_LABELS[method]
  if ((method === 'decision' || method === 'technical_decision') && decisionType) {
    return `${DECISION_LABELS[decisionType]} ${base}`
  }
  return base
}

export function methodShort(method: Method | null, outcome?: Outcome | null): string {
  if (outcome === 'no_contest') return 'NC'
  if (outcome && outcome !== 'win') return 'D'
  switch (method) {
    case 'ko':
      return 'KO'
    case 'tko':
      return 'TKO'
    case 'submission':
      return 'SUB'
    case 'pin':
      return 'PIN'
    case 'technical_fall':
      return 'TF'
    case 'decision':
    case 'technical_decision':
      return 'DEC'
    case 'dq':
      return 'DQ'
    default:
      return '—'
  }
}

export function finishDetail(
  endRound: number | null,
  endTimeSeconds: number | null,
  scheduledRounds: number,
): string {
  // Grappling and wrestling are contested over one period rather than rounds,
  // so "1 rounds" would be both wrong and ugly.
  if (endRound === null) {
    return scheduledRounds === 1 ? 'Full period' : `${scheduledRounds} rounds`
  }
  if (scheduledRounds === 1) return clockTime(endTimeSeconds)
  return `R${endRound} · ${clockTime(endTimeSeconds)}`
}

export function rankLabel(position: number | null | undefined, isChampion?: boolean): string {
  if (isChampion || position === 0) return 'C'
  if (position === null || position === undefined) return 'NR'
  return `#${position}`
}

export function movementText(movement: number, label: MovementLabel): string {
  if (label === 'new') return 'NEW'
  if (label === 'out') return 'OUT'
  if (movement === 0) return '—'
  return `${movement > 0 ? '+' : '−'}${Math.abs(movement)}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function heightLabel(cm: number | null): string {
  if (!cm) return '—'
  const inchesTotal = Math.round(cm / 2.54)
  return `${cm} cm · ${Math.floor(inchesTotal / 12)}′${inchesTotal % 12}″`
}

export function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function fighterSubtitle(fighter: Pick<FighterProfile, 'nickname' | 'country'>): string {
  return [fighter.nickname ? `“${fighter.nickname}”` : null, fighter.country]
    .filter(Boolean)
    .join(' · ')
}

/** ISO-2 country code → regional-indicator flag. */
export function flagOf(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ''
  const base = 0x1f1e6
  return String.fromCodePoint(
    base + (code.toUpperCase().charCodeAt(0) - 65),
    base + (code.toUpperCase().charCodeAt(1) - 65),
  )
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
