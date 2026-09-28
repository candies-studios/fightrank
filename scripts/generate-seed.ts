/**
 * Deterministic demo-data generator (§37).
 *
 * Emits two files:
 *   supabase/migrations/0005_config_defaults.sql — the ranking-config registry
 *   supabase/seed.sql                            — fictional disciplines,
 *                                                  divisions, athletes, events
 *                                                  and bouts
 *
 * IMPORTANT: this generator writes *competitive facts only*. It never writes
 * ratings, rankings, movements or history — those are produced exclusively by
 * the ranking engine from the bouts below.
 *
 * The data is multi-discipline. One athlete is one row in `fighters` (one
 * Fighter ID) and one row per discipline in `fighter_disciplines`, so a
 * wrestler who also competes in grappling appears once in the roster with two
 * independent records. Roughly a quarter of the athletes below hold more than
 * one.
 *
 * Run with:  npm run seed:generate
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { CONFIG_REGISTRY } from '../src/ranking/config'
import {
  COUNTRIES,
  FIRST_NAMES_MEN,
  FIRST_NAMES_WOMEN,
  LAST_NAMES,
  NICKNAMES,
  TEAMS,
  VENUES,
} from './data/names'

// ---------------------------------------------------------------------------
// Deterministic PRNG — the same seed always produces the same dataset.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(0x1f19_7a2c)
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const randInt = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1))
const chance = (p: number): boolean => rand() < p

function uuid(): string {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 32; i += 1) {
    if (i === 12) out += '4'
    else if (i === 16) out += hex[(Math.floor(rand() * 16) & 0x3) | 0x8]
    else out += hex[Math.floor(rand() * 16)]
  }
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20)}`
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------
const q = (value: string | null | undefined): string =>
  value === null || value === undefined ? 'null' : `'${value.replace(/'/g, "''")}'`
const n = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(value) ? 'null' : String(value)
const bl = (value: boolean): string => (value ? 'true' : 'false')
const arr = (values: string[]): string =>
  values.length === 0 ? `'{}'` : `'{${values.map((v) => `"${v}"`).join(',')}}'`

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const MS_DAY = 86_400_000
const iso = (d: Date): string => d.toISOString().slice(0, 10)
const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * MS_DAY)

// ---------------------------------------------------------------------------
// Disciplines
//
// A discipline is a self-contained competitive world: its own divisions, its
// own ways to win, its own ratings. Nothing crosses between them except the
// athlete.
// ---------------------------------------------------------------------------
type Gender = 'men' | 'women' | 'open'

interface DivisionSpec {
  name: string
  gender: Gender
  weightLbs: number | null
  shortCode: string
  isP4P: boolean
  roster: number
  heightRange: [number, number]
}

interface MethodSpec {
  method: string
  weight: number
  isFinish: boolean
}

interface DisciplineSpec {
  slug: string
  name: string
  shortCode: string
  tagline: string
  description: string
  ruleset: string
  accent: string
  /** Numbered event series, e.g. "FIGHTRANK 137". */
  series: string
  /** Named (non-numbered) cards, e.g. "FIGHTRANK GRAPPLE: OSAKA". */
  nightSeries: string
  standardRounds: 1 | 3 | 5
  titleRounds: 1 | 3 | 5
  /** Length of one round/period in seconds — bounds the finish clock. */
  periodSeconds: number
  drawRate: number
  noContestRate: number
  /** Probability a roster slot is filled by an athlete who already has a
   *  Fighter ID in another discipline. */
  crossoverAppeal: number
  finishBonus: string
  methods: MethodSpec[]
  divisions: DivisionSpec[]
}

const DISCIPLINE_SPECS: DisciplineSpec[] = [
  {
    slug: 'mixed-martial-arts',
    name: 'Mixed Martial Arts',
    shortCode: 'MMA',
    tagline: 'Every range, every finish.',
    description:
      'Striking and grappling under one ruleset. Bouts are contested over three rounds, or five when a title or a main event is on the line.',
    ruleset: 'Unified rules · 5-minute rounds · open scoring disabled',
    accent: '#e2574c',
    series: 'FIGHTRANK',
    nightSeries: 'FIGHTRANK NIGHT',
    standardRounds: 3,
    titleRounds: 5,
    periodSeconds: 300,
    drawRate: 0.028,
    noContestRate: 0.022,
    crossoverAppeal: 0,
    finishBonus: 'performance_of_the_night',
    methods: [
      { method: 'ko', weight: 0.18, isFinish: true },
      { method: 'tko', weight: 0.13, isFinish: true },
      { method: 'submission', weight: 0.2, isFinish: true },
      { method: 'decision', weight: 0.46, isFinish: false },
      { method: 'doctor_stoppage', weight: 0.03, isFinish: true },
    ],
    divisions: [
      { name: 'Heavyweight', gender: 'men', weightLbs: 265, shortCode: 'HW', isP4P: false, roster: 10, heightRange: [188, 200] },
      { name: 'Light Heavyweight', gender: 'men', weightLbs: 205, shortCode: 'LHW', isP4P: false, roster: 10, heightRange: [183, 196] },
      { name: 'Middleweight', gender: 'men', weightLbs: 185, shortCode: 'MW', isP4P: false, roster: 10, heightRange: [180, 193] },
      { name: 'Welterweight', gender: 'men', weightLbs: 170, shortCode: 'WW', isP4P: false, roster: 12, heightRange: [175, 190] },
      { name: 'Lightweight', gender: 'men', weightLbs: 155, shortCode: 'LW', isP4P: false, roster: 12, heightRange: [170, 185] },
      { name: 'Featherweight', gender: 'men', weightLbs: 145, shortCode: 'FW', isP4P: false, roster: 10, heightRange: [168, 180] },
      { name: 'Bantamweight', gender: 'men', weightLbs: 135, shortCode: 'BW', isP4P: false, roster: 8, heightRange: [165, 178] },
      { name: 'Flyweight', gender: 'men', weightLbs: 125, shortCode: 'FLW', isP4P: false, roster: 8, heightRange: [160, 173] },
      { name: "Women's Bantamweight", gender: 'women', weightLbs: 135, shortCode: 'WBW', isP4P: false, roster: 10, heightRange: [163, 178] },
      { name: "Women's Flyweight", gender: 'women', weightLbs: 125, shortCode: 'WFLW', isP4P: false, roster: 8, heightRange: [160, 173] },
      { name: "Women's Strawweight", gender: 'women', weightLbs: 115, shortCode: 'WSW', isP4P: false, roster: 8, heightRange: [155, 168] },
      { name: 'Pound-for-Pound', gender: 'open', weightLbs: null, shortCode: 'P4P', isP4P: true, roster: 0, heightRange: [170, 190] },
    ],
  },
  {
    slug: 'submission-grappling',
    name: 'Submission Grappling',
    shortCode: 'GRP',
    tagline: 'No strikes. No gi. No stalling.',
    description:
      'Submission-only and points grappling contested in a single period. A match that reaches the buzzer is decided on advantages and control time.',
    ruleset: 'No-gi · single 10-minute period · submission or referee decision',
    accent: '#3f8ea8',
    series: 'FIGHTRANK GRAPPLE',
    nightSeries: 'GRAPPLE INVITATIONAL',
    standardRounds: 1,
    titleRounds: 1,
    periodSeconds: 600,
    drawRate: 0.07,
    noContestRate: 0.004,
    crossoverAppeal: 0.34,
    finishBonus: 'submission_of_the_night',
    methods: [
      { method: 'submission', weight: 0.54, isFinish: true },
      { method: 'decision', weight: 0.4, isFinish: false },
      { method: 'technical_decision', weight: 0.05, isFinish: false },
      { method: 'dq', weight: 0.01, isFinish: true },
    ],
    divisions: [
      { name: 'Ultra Heavyweight', gender: 'men', weightLbs: 240, shortCode: 'UHW', isP4P: false, roster: 8, heightRange: [186, 200] },
      { name: 'Heavyweight', gender: 'men', weightLbs: 205, shortCode: 'HW', isP4P: false, roster: 8, heightRange: [182, 195] },
      { name: 'Middleweight', gender: 'men', weightLbs: 185, shortCode: 'MW', isP4P: false, roster: 8, heightRange: [178, 191] },
      { name: 'Welterweight', gender: 'men', weightLbs: 170, shortCode: 'WW', isP4P: false, roster: 8, heightRange: [174, 188] },
      { name: 'Lightweight', gender: 'men', weightLbs: 155, shortCode: 'LW', isP4P: false, roster: 8, heightRange: [169, 183] },
      { name: "Women's Middleweight", gender: 'women', weightLbs: 145, shortCode: 'WMW', isP4P: false, roster: 8, heightRange: [165, 178] },
      { name: "Women's Lightweight", gender: 'women', weightLbs: 130, shortCode: 'WLW', isP4P: false, roster: 8, heightRange: [158, 171] },
      { name: 'Pound-for-Pound', gender: 'open', weightLbs: null, shortCode: 'P4P', isP4P: true, roster: 0, heightRange: [170, 190] },
    ],
  },
  {
    slug: 'wrestling',
    name: 'Wrestling',
    shortCode: 'WRE',
    tagline: 'Six minutes. Two feet. One decision.',
    description:
      'Freestyle wrestling scored on takedowns, exposure and control. A ten-point lead ends the bout by technical fall; both shoulders on the mat ends it by pin.',
    ruleset: 'Freestyle · single 6-minute period · pin, technical fall or points',
    accent: '#c9922f',
    series: 'FIGHTRANK MAT CLASSIC',
    nightSeries: 'MAT CLASSIC OPEN',
    standardRounds: 1,
    titleRounds: 1,
    periodSeconds: 360,
    drawRate: 0.006,
    noContestRate: 0.004,
    crossoverAppeal: 0.36,
    finishBonus: 'technical_display',
    methods: [
      { method: 'pin', weight: 0.22, isFinish: true },
      { method: 'technical_fall', weight: 0.24, isFinish: true },
      { method: 'decision', weight: 0.52, isFinish: false },
      { method: 'dq', weight: 0.02, isFinish: true },
    ],
    divisions: [
      { name: 'Heavyweight', gender: 'men', weightLbs: 275, shortCode: 'HW', isP4P: false, roster: 8, heightRange: [185, 199] },
      { name: 'Light Heavyweight', gender: 'men', weightLbs: 213, shortCode: 'LHW', isP4P: false, roster: 8, heightRange: [180, 193] },
      { name: 'Middleweight', gender: 'men', weightLbs: 190, shortCode: 'MW', isP4P: false, roster: 8, heightRange: [176, 189] },
      { name: 'Welterweight', gender: 'men', weightLbs: 174, shortCode: 'WW', isP4P: false, roster: 8, heightRange: [172, 185] },
      { name: 'Lightweight', gender: 'men', weightLbs: 157, shortCode: 'LW', isP4P: false, roster: 8, heightRange: [167, 180] },
      { name: 'Featherweight', gender: 'men', weightLbs: 141, shortCode: 'FW', isP4P: false, roster: 8, heightRange: [162, 175] },
      { name: "Women's Welterweight", gender: 'women', weightLbs: 150, shortCode: 'WWW', isP4P: false, roster: 8, heightRange: [163, 176] },
      { name: 'Pound-for-Pound', gender: 'open', weightLbs: null, shortCode: 'P4P', isP4P: true, roster: 0, heightRange: [170, 190] },
    ],
  },
  {
    slug: 'muay-thai',
    name: 'Muay Thai',
    shortCode: 'MT',
    tagline: 'The art of eight limbs.',
    description:
      'Full Thai rules: elbows, knees and the clinch, over five three-minute rounds scored on damage and dominance rather than volume.',
    ruleset: 'Full Thai rules · five 3-minute rounds · clinch and elbows permitted',
    accent: '#a8563f',
    series: 'FIGHTRANK EIGHT LIMBS',
    nightSeries: 'EIGHT LIMBS',
    standardRounds: 5,
    titleRounds: 5,
    periodSeconds: 180,
    drawRate: 0.04,
    noContestRate: 0.008,
    crossoverAppeal: 0.3,
    finishBonus: 'knockout_of_the_night',
    methods: [
      { method: 'ko', weight: 0.2, isFinish: true },
      { method: 'tko', weight: 0.19, isFinish: true },
      { method: 'decision', weight: 0.55, isFinish: false },
      { method: 'doctor_stoppage', weight: 0.05, isFinish: true },
      { method: 'retirement', weight: 0.01, isFinish: true },
    ],
    divisions: [
      { name: 'Cruiserweight', gender: 'men', weightLbs: 200, shortCode: 'CW', isP4P: false, roster: 8, heightRange: [183, 196] },
      { name: 'Middleweight', gender: 'men', weightLbs: 160, shortCode: 'MW', isP4P: false, roster: 8, heightRange: [175, 188] },
      { name: 'Welterweight', gender: 'men', weightLbs: 147, shortCode: 'WW', isP4P: false, roster: 8, heightRange: [172, 184] },
      { name: 'Lightweight', gender: 'men', weightLbs: 135, shortCode: 'LW', isP4P: false, roster: 8, heightRange: [168, 180] },
      { name: 'Featherweight', gender: 'men', weightLbs: 126, shortCode: 'FW', isP4P: false, roster: 8, heightRange: [163, 175] },
      { name: "Women's Flyweight", gender: 'women', weightLbs: 115, shortCode: 'WFLW', isP4P: false, roster: 8, heightRange: [157, 170] },
      { name: 'Pound-for-Pound', gender: 'open', weightLbs: null, shortCode: 'P4P', isP4P: true, roster: 0, heightRange: [170, 190] },
    ],
  },
  {
    slug: 'kickboxing',
    name: 'Kickboxing',
    shortCode: 'KB',
    tagline: 'Hands, shins, and no place to hide.',
    description:
      'Three-round kickboxing on international rules: kicks above the waist, no clinch work, and an extra round if the judges cannot separate them.',
    ruleset: 'K-1 rules · three 3-minute rounds · limited clinch',
    accent: '#5f6f9c',
    series: 'FIGHTRANK STRIKE SERIES',
    nightSeries: 'STRIKE SERIES',
    standardRounds: 3,
    titleRounds: 5,
    periodSeconds: 180,
    drawRate: 0.03,
    noContestRate: 0.006,
    crossoverAppeal: 0.38,
    finishBonus: 'knockout_of_the_night',
    methods: [
      { method: 'ko', weight: 0.23, isFinish: true },
      { method: 'tko', weight: 0.21, isFinish: true },
      { method: 'decision', weight: 0.52, isFinish: false },
      { method: 'doctor_stoppage', weight: 0.04, isFinish: true },
    ],
    divisions: [
      { name: 'Heavyweight', gender: 'men', weightLbs: 209, shortCode: 'HW', isP4P: false, roster: 8, heightRange: [186, 199] },
      { name: 'Light Heavyweight', gender: 'men', weightLbs: 176, shortCode: 'LHW', isP4P: false, roster: 8, heightRange: [178, 191] },
      { name: 'Welterweight', gender: 'men', weightLbs: 154, shortCode: 'WW', isP4P: false, roster: 8, heightRange: [172, 184] },
      { name: 'Lightweight', gender: 'men', weightLbs: 143, shortCode: 'LW', isP4P: false, roster: 8, heightRange: [168, 180] },
      { name: "Women's Bantamweight", gender: 'women', weightLbs: 125, shortCode: 'WBW', isP4P: false, roster: 8, heightRange: [160, 172] },
      { name: 'Pound-for-Pound', gender: 'open', weightLbs: null, shortCode: 'P4P', isP4P: true, roster: 0, heightRange: [170, 190] },
    ],
  },
]

interface DisciplineSeed extends DisciplineSpec {
  id: string
  sortOrder: number
}

interface DivisionSeed extends DivisionSpec {
  id: string
  slug: string
  disciplineId: string
  sortOrder: number
}

const disciplines: DisciplineSeed[] = DISCIPLINE_SPECS.map((spec, index) => ({
  ...spec,
  id: uuid(),
  sortOrder: index + 1,
}))

const divisions: DivisionSeed[] = disciplines.flatMap((discipline) =>
  discipline.divisions.map((spec, index) => ({
    ...spec,
    id: uuid(),
    // Division slugs are globally unique, so they carry the discipline.
    slug: `${discipline.slug}-${slugify(spec.name)}`,
    disciplineId: discipline.id,
    sortOrder: spec.isP4P ? 99 : index + 1,
  })),
)

const disciplineById = new Map(disciplines.map((d) => [d.id, d]))

// ---------------------------------------------------------------------------
// Athletes and their registrations
//
// One athlete = one Fighter ID = one row in `fighters`. Every discipline they
// compete in adds a row to `fighter_disciplines`, with its own division and its
// own record.
// ---------------------------------------------------------------------------
interface AthleteSeed {
  id: string
  code: string
  slug: string
  firstName: string
  lastName: string
  displayName: string
  nickname: string | null
  gender: Gender
  country: string
  countryCode: string
  dateOfBirth: string
  heightCm: number
  reachCm: number
  stance: 'orthodox' | 'southpaw' | 'switch'
  team: string
  debutDate: string
  isActive: boolean
  primaryDisciplineId: string
  /** Hidden "true ability" — drives simulated outcomes, never stored. */
  talent: number
}

interface RegistrationSeed {
  athlete: AthleteSeed
  disciplineId: string
  divisionId: string
  isPrimary: boolean
  isActive: boolean
  debutDate: string
  /** Ability *in this discipline*. A crossover is good, rarely elite. */
  skill: number
  // generator bookkeeping
  wins: number
  losses: number
  draws: number
  lastEventIndex: number
  isChampion: boolean
  isInterimChampion: boolean
}

const usedNames = new Set<string>()
const usedSlugs = new Set<string>()
const usedNicknames = new Set<string>()
const athletes: AthleteSeed[] = []
const registrations: RegistrationSeed[] = []
const registeredIn = new Map<string, Set<string>>()

const today = new Date()
const lastEventDate = addDays(today, -12)
let fighterNumber = 0

function newAthlete(division: DivisionSeed, disciplineId: string): AthleteSeed {
  const pool = division.gender === 'women' ? FIRST_NAMES_WOMEN : FIRST_NAMES_MEN

  let firstName = ''
  let lastName = ''
  let displayName = ''
  let attempts = 0
  do {
    firstName = pick(pool)
    lastName = pick(LAST_NAMES)
    displayName = `${firstName} ${lastName}`
    attempts += 1
  } while (usedNames.has(displayName) && attempts < 400)
  usedNames.add(displayName)

  let slug = slugify(displayName)
  let suffix = 2
  while (usedSlugs.has(slug)) {
    slug = `${slugify(displayName)}-${suffix}`
    suffix += 1
  }
  usedSlugs.add(slug)

  let nickname: string | null = null
  if (chance(0.62)) {
    for (let a = 0; a < 40; a += 1) {
      const candidate = pick(NICKNAMES)
      if (!usedNicknames.has(candidate)) {
        usedNicknames.add(candidate)
        nickname = candidate
        break
      }
    }
  }

  const country = pick(COUNTRIES)
  const height = randInt(division.heightRange[0], division.heightRange[1])
  const age = randInt(22, 37)
  const dob = addDays(today, -(age * 365 + randInt(0, 364)))

  // Talent is normally distributed so a division has a few standouts, a solid
  // middle and a tail — exactly what a ranking table should show.
  const talent = (rand() + rand() + rand() - 1.5) * 160

  fighterNumber += 1
  const athlete: AthleteSeed = {
    id: uuid(),
    code: `FR-${String(fighterNumber).padStart(5, '0')}`,
    slug,
    firstName,
    lastName,
    displayName,
    nickname,
    gender: division.gender === 'women' ? 'women' : 'men',
    country: country.name,
    countryCode: country.code,
    dateOfBirth: iso(dob),
    heightCm: height,
    reachCm: height + randInt(-3, 12),
    stance: chance(0.72) ? 'orthodox' : chance(0.85) ? 'southpaw' : 'switch',
    team: pick(TEAMS),
    debutDate: iso(addDays(lastEventDate, -randInt(1500, 3600))),
    isActive: chance(0.94),
    primaryDisciplineId: disciplineId,
    talent,
  }
  athletes.push(athlete)
  return athlete
}

function register(
  athlete: AthleteSeed,
  division: DivisionSeed,
  isPrimary: boolean,
  skill: number,
): void {
  const held = registeredIn.get(athlete.id) ?? new Set<string>()
  held.add(division.disciplineId)
  registeredIn.set(athlete.id, held)

  registrations.push({
    athlete,
    disciplineId: division.disciplineId,
    divisionId: division.id,
    isPrimary,
    isActive: athlete.isActive && (isPrimary || chance(0.9)),
    debutDate: isPrimary
      ? athlete.debutDate
      : iso(addDays(lastEventDate, -randInt(700, 2200))),
    skill,
    wins: 0,
    losses: 0,
    draws: 0,
    lastEventIndex: -99,
    isChampion: false,
    isInterimChampion: false,
  })
}

/**
 * Someone who already has a Fighter ID and could plausibly cross over: right
 * build, right gender, and not already registered in this discipline.
 */
function crossoverCandidate(division: DivisionSeed): AthleteSeed | null {
  const [low, high] = division.heightRange
  const wanted = division.gender === 'women' ? 'women' : 'men'
  const pool = athletes.filter(
    (a) =>
      a.gender === wanted &&
      a.heightCm >= low - 4 &&
      a.heightCm <= high + 4 &&
      !(registeredIn.get(a.id)?.has(division.disciplineId) ?? false) &&
      (registeredIn.get(a.id)?.size ?? 0) < 3,
  )
  return pool.length ? pick(pool) : null
}

for (const discipline of disciplines) {
  for (const division of divisions) {
    if (division.disciplineId !== discipline.id || division.isP4P) continue

    for (let slot = 0; slot < division.roster; slot += 1) {
      const crossover =
        discipline.crossoverAppeal > 0 && chance(discipline.crossoverAppeal)
          ? crossoverCandidate(division)
          : null

      if (crossover) {
        // A crossover carries their athleticism across but not their
        // specialism, so their ceiling in the new discipline is lower.
        register(crossover, division, false, crossover.talent * 0.5 + (rand() - 0.5) * 90)
      } else {
        const athlete = newAthlete(division, discipline.id)
        register(athlete, division, true, athlete.talent)
      }
    }
  }
}

const registrationsOf = new Map<string, RegistrationSeed[]>()
for (const reg of registrations) {
  const list = registrationsOf.get(reg.divisionId) ?? []
  list.push(reg)
  registrationsOf.set(reg.divisionId, list)
}

// ---------------------------------------------------------------------------
// Events and bouts
// ---------------------------------------------------------------------------
interface EventSeed {
  id: string
  slug: string
  name: string
  eventNumber: number | null
  eventDate: string
  venue: string
  city: string
  country: string
  countryCode: string
  status: 'scheduled' | 'completed'
}

interface FightSeed {
  id: string
  eventId: string
  disciplineId: string
  divisionId: string
  fighterAId: string
  fighterBId: string
  boutOrder: number
  scheduledRounds: number
  status: 'scheduled' | 'completed'
  outcome: string | null
  winnerId: string | null
  loserId: string | null
  method: string | null
  decisionType: string | null
  endRound: number | null
  endTimeSeconds: number | null
  isTitleFight: boolean
  isInterimTitle: boolean
  isMainEvent: boolean
  bonuses: string[]
}

const events: EventSeed[] = []
const fights: FightSeed[] = []

const PAST_EVENTS = 78
const UPCOMING_EVENTS = 3

/**
 * Which discipline hosts each card. Mixed martial arts runs the most often;
 * the others alternate, so every discipline builds a real fight history.
 */
const HOST_ROTATION = [0, 1, 0, 2, 3, 0, 4, 1, 2, 0, 3, 4]

const championOf = new Map<string, string>()
const interimOf = new Map<string, string>()
const lastTitleEvent = new Map<string, number>()
// Event numbers are unique across the whole promotion, so every series draws
// from one sequence — "FIGHTRANK GRAPPLE 137" follows "FIGHTRANK 136".
let eventNumber = 100

/** Generator-local standing used only to choose plausible match-ups. */
function contenders(divisionId: string): RegistrationSeed[] {
  return [...(registrationsOf.get(divisionId) ?? [])]
    .filter((r) => r.isActive)
    .sort((a, b) => {
      const sa = a.wins * 3 - a.losses * 2 + a.skill / 100
      const sb = b.wins * 3 - b.losses * 2 + b.skill / 100
      return sb - sa
    })
}

function sampleMethod(discipline: DisciplineSeed, rounds: number) {
  let roll = rand()
  let chosen = discipline.methods[discipline.methods.length - 1]
  for (const candidate of discipline.methods) {
    if (roll < candidate.weight) {
      chosen = candidate
      break
    }
    roll -= candidate.weight
  }

  if (!chosen.isFinish) {
    const d = rand()
    return {
      method: chosen.method,
      decisionType: d < 0.64 ? 'unanimous' : d < 0.87 ? 'split' : 'majority',
      endRound: null as number | null,
      endTimeSeconds: null as number | null,
      isFinish: false,
    }
  }

  // Finishes cluster early, but a five-rounder can go late.
  const endRound = rounds === 1 ? 1 : chance(0.78) ? randInt(1, Math.min(3, rounds)) : randInt(1, rounds)
  return {
    method: chosen.method,
    decisionType: null as string | null,
    endRound,
    endTimeSeconds: randInt(8, discipline.periodSeconds - 1),
    isFinish: true,
  }
}

function resolveBout(
  a: RegistrationSeed,
  b: RegistrationSeed,
  event: EventSeed,
  options: { boutOrder: number; isTitleFight: boolean; isInterimTitle: boolean; isMainEvent: boolean },
): FightSeed {
  const discipline = disciplineById.get(a.disciplineId)!
  const rounds =
    options.isTitleFight || options.isMainEvent ? discipline.titleRounds : discipline.standardRounds

  const base: FightSeed = {
    id: uuid(),
    eventId: event.id,
    disciplineId: a.disciplineId,
    divisionId: a.divisionId,
    fighterAId: a.athlete.id,
    fighterBId: b.athlete.id,
    boutOrder: options.boutOrder,
    scheduledRounds: rounds,
    status: event.status,
    outcome: null,
    winnerId: null,
    loserId: null,
    method: null,
    decisionType: null,
    endRound: null,
    endTimeSeconds: null,
    isTitleFight: options.isTitleFight,
    isInterimTitle: options.isInterimTitle,
    isMainEvent: options.isMainEvent,
    bonuses: [],
  }

  if (event.status === 'scheduled') return base

  const roll = rand()
  if (roll < discipline.noContestRate) {
    return { ...base, outcome: 'no_contest', method: 'no_contest' }
  }
  if (roll < discipline.noContestRate + discipline.drawRate) {
    const kind = rand()
    return {
      ...base,
      outcome: kind < 0.4 ? 'draw' : kind < 0.75 ? 'majority_draw' : 'split_draw',
      method: 'draw',
      decisionType: kind < 0.4 ? null : kind < 0.75 ? 'majority' : 'split',
    }
  }

  const pA = 1 / (1 + 10 ** ((b.skill - a.skill) / 200))
  const aWins = rand() < pA
  const winner = aWins ? a : b
  const loser = aWins ? b : a
  const m = sampleMethod(discipline, rounds)

  winner.wins += 1
  loser.losses += 1

  return {
    ...base,
    outcome: 'win',
    winnerId: winner.athlete.id,
    loserId: loser.athlete.id,
    method: m.method,
    decisionType: m.decisionType,
    endRound: m.endRound,
    endTimeSeconds: m.endTimeSeconds,
    bonuses: m.isFinish && chance(0.2) ? [discipline.finishBonus] : [],
  }
}

let cursor = addDays(lastEventDate, -PAST_EVENTS * 13)

for (let index = 0; index < PAST_EVENTS + UPCOMING_EVENTS; index += 1) {
  const isFuture = index >= PAST_EVENTS
  cursor = addDays(cursor, randInt(10, 16))

  const host = disciplines[HOST_ROTATION[index % HOST_ROTATION.length]]
  const date = isFuture ? addDays(lastEventDate, 14 + (index - PAST_EVENTS) * 21) : cursor
  const place = pick(VENUES)

  const numbered = index % 3 !== 1
  if (numbered) eventNumber += 1
  const name = numbered
    ? `${host.series} ${eventNumber}`
    : `${host.nightSeries}: ${place.city.toUpperCase()}`

  let slug = slugify(name)
  let dedupe = 2
  while (events.some((e) => e.slug === slug)) {
    slug = `${slugify(name)}-${dedupe}`
    dedupe += 1
  }

  const event: EventSeed = {
    id: uuid(),
    slug,
    name,
    eventNumber: numbered ? eventNumber : null,
    eventDate: iso(date),
    venue: place.venue,
    city: place.city,
    country: place.country,
    countryCode: place.code,
    status: isFuture ? 'scheduled' : 'completed',
  }
  events.push(event)

  const hostDivisions = divisions.filter((d) => d.disciplineId === host.id && !d.isP4P)
  const featured = [0, 1, 2, 3].map(
    (offset) => hostDivisions[(index * 3 + offset) % hostDivisions.length],
  )

  // Roughly one card in six shares the bill with a second discipline — which is
  // how an athlete ends up with two records under one Fighter ID.
  if (chance(0.17)) {
    const guest = pick(disciplines.filter((d) => d.id !== host.id))
    const guestDivisions = divisions.filter((d) => d.disciplineId === guest.id && !d.isP4P)
    featured.push(guestDivisions[index % guestDivisions.length])
  }

  const cardFights: FightSeed[] = []
  const busy = new Set<string>()

  for (const division of featured) {
    if (!division) continue
    const ranked = contenders(division.id).filter((r) => !busy.has(r.athlete.id))
    if (ranked.length < 4) continue

    const champId = championOf.get(division.id)
    const interimId = interimOf.get(division.id)
    const sinceTitle = index - (lastTitleEvent.get(division.id) ?? -99)
    const byAthlete = (id: string) =>
      (registrationsOf.get(division.id) ?? []).find((r) => r.athlete.id === id)

    // --- title bout ---------------------------------------------------------
    let titleFight: FightSeed | null = null
    if (!isFuture) {
      if (!champId && index >= 10 && sinceTitle > 8 && chance(0.5)) {
        const [a, b] = ranked
        titleFight = resolveBout(a, b, event, {
          boutOrder: 0,
          isTitleFight: true,
          isInterimTitle: false,
          isMainEvent: true,
        })
        if (titleFight.winnerId) {
          championOf.set(division.id, titleFight.winnerId)
          lastTitleEvent.set(division.id, index)
        }
        busy.add(a.athlete.id)
        busy.add(b.athlete.id)
      } else if (champId && sinceTitle >= 9) {
        const champ = byAthlete(champId)
        const challenger = ranked.find((r) => r.athlete.id !== champId && r.athlete.id !== interimId)
        if (champ && challenger && champ.isActive) {
          titleFight = resolveBout(champ, challenger, event, {
            boutOrder: 0,
            isTitleFight: true,
            isInterimTitle: false,
            isMainEvent: true,
          })
          if (titleFight.winnerId && titleFight.winnerId !== champId) {
            championOf.set(division.id, titleFight.winnerId)
          }
          lastTitleEvent.set(division.id, index)
          busy.add(champ.athlete.id)
          busy.add(challenger.athlete.id)
        }
      } else if (champId && !interimId && sinceTitle >= 6 && chance(0.1)) {
        // Interim storyline: the champion is unavailable, two contenders meet.
        const pool = ranked.filter((r) => r.athlete.id !== champId)
        if (pool.length >= 2) {
          titleFight = resolveBout(pool[0], pool[1], event, {
            boutOrder: 0,
            isTitleFight: true,
            isInterimTitle: true,
            isMainEvent: true,
          })
          if (titleFight.winnerId) interimOf.set(division.id, titleFight.winnerId)
          busy.add(pool[0].athlete.id)
          busy.add(pool[1].athlete.id)
        }
      }
    }
    if (titleFight) cardFights.push(titleFight)

    // --- undercard ----------------------------------------------------------
    // Selection is by rest, not by record: everyone on the roster gets booked,
    // which is what gives the ranking engine a realistic spread to work with.
    const rested = (registrationsOf.get(division.id) ?? [])
      .filter((r) => r.isActive && !busy.has(r.athlete.id))
      .sort((a, b) => a.lastEventIndex - b.lastEventIndex || (rand() < 0.5 ? -1 : 1))

    const boutCount = Math.min(Math.floor(rested.length / 2), division.roster >= 10 ? 3 : 2)
    // Pair athletes of similar standing so match-ups stay plausible.
    const available = rested
      .slice(0, boutCount * 2)
      .sort((a, b) => b.wins * 3 - b.losses * 2 - (a.wins * 3 - a.losses * 2))

    for (let i = 0; i < boutCount; i += 1) {
      const a = available[i * 2]
      const b = available[i * 2 + 1]
      if (!a || !b || a.athlete.id === b.athlete.id) continue
      if (busy.has(a.athlete.id) || busy.has(b.athlete.id)) continue
      busy.add(a.athlete.id)
      busy.add(b.athlete.id)
      cardFights.push(
        resolveBout(a, b, event, {
          boutOrder: cardFights.length + 1,
          isTitleFight: false,
          isInterimTitle: false,
          isMainEvent: false,
        }),
      )
    }
  }

  if (cardFights.length === 0) {
    events.pop()
    if (numbered) eventNumber -= 1
    continue
  }

  // Headline the card and hand out a Fight of the Night bonus.
  if (!cardFights.some((f) => f.isMainEvent)) {
    const headline = cardFights[0]
    headline.isMainEvent = true
    headline.scheduledRounds = disciplineById.get(headline.disciplineId)!.titleRounds
  }
  if (!isFuture) {
    const fotn = cardFights[randInt(0, cardFights.length - 1)]
    if (fotn.outcome === 'win') {
      const label =
        disciplineById.get(fotn.disciplineId)!.standardRounds === 1
          ? 'match_of_the_night'
          : 'fight_of_the_night'
      fotn.bonuses = [...new Set([...fotn.bonuses, label])]
    }
  }

  cardFights.forEach((fight, order) => {
    fight.boutOrder = fight.isMainEvent ? 0 : order + 1
    fights.push(fight)
  })

  for (const fight of cardFights) {
    for (const id of [fight.fighterAId, fight.fighterBId]) {
      const reg = (registrationsOf.get(fight.divisionId) ?? []).find((r) => r.athlete.id === id)
      if (reg) reg.lastEventIndex = index
    }
  }
}

// Champion / interim flags are *seeded* so a fresh install renders correctly,
// but the engine recomputes and overwrites them on the first recalculation —
// they are never the source of truth.
for (const [divisionId, athleteId] of championOf) {
  const reg = (registrationsOf.get(divisionId) ?? []).find((r) => r.athlete.id === athleteId)
  if (reg) reg.isChampion = true
}
for (const [divisionId, athleteId] of interimOf) {
  const reg = (registrationsOf.get(divisionId) ?? []).find((r) => r.athlete.id === athleteId)
  if (reg && !reg.isChampion) reg.isInterimChampion = true
}

// ---------------------------------------------------------------------------
// Emit SQL
// ---------------------------------------------------------------------------
const root = path.resolve(import.meta.dirname, '..')
mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true })

// --- 0005_config_defaults.sql ----------------------------------------------
const configRows = CONFIG_REGISTRY.map(
  (c, i) =>
    `  (${q(c.scope)}, ${q(c.key)}, ${q(JSON.stringify(c.value))}::jsonb, ${q(c.dataType)}, ${q(c.label)}, ${q(c.description)}, ${q(c.group)}, ${n(c.min ?? null)}, ${n(c.max ?? null)}, ${n(c.step ?? null)}, ${i})`,
).join(',\n')

const configSql = `-- =============================================================================
-- FIGHTRANK — 0005_config_defaults.sql
-- GENERATED FILE — do not edit by hand.
-- Source: src/ranking/config.ts  ·  Regenerate: npm run seed:generate
--
-- Seeds the ranking-configuration registry (§40). Existing values are left
-- untouched so re-running a migration never overwrites an administrator's
-- tuning.
-- =============================================================================

insert into public.ranking_config
  (scope, key, value, data_type, label, description, group_name, min_value, max_value, step, sort_order)
values
${configRows}
on conflict (scope, key) do update set
  label       = excluded.label,
  description = excluded.description,
  group_name  = excluded.group_name,
  data_type   = excluded.data_type,
  min_value   = excluded.min_value,
  max_value   = excluded.max_value,
  step        = excluded.step,
  sort_order  = excluded.sort_order;
`

writeFileSync(path.join(root, 'supabase', 'migrations', '0005_config_defaults.sql'), configSql)

// --- seed.sql ---------------------------------------------------------------
const disciplineValues = disciplines
  .map(
    (d) =>
      `  (${q(d.id)}, ${q(d.slug)}, ${q(d.name)}, ${q(d.shortCode)}, ${q(d.tagline)}, ${q(
        d.description,
      )}, ${q(d.ruleset)}, ${q(d.accent)}, ${d.sortOrder}, true)`,
  )
  .join(',\n')

const divisionValues = divisions
  .map(
    (d) =>
      `  (${q(d.id)}, ${q(d.disciplineId)}, ${q(d.slug)}, ${q(d.name)}, ${q(d.gender)}, ${n(
        d.weightLbs,
      )}, ${n(d.weightLbs ? Number((d.weightLbs * 0.453592).toFixed(2)) : null)}, ${q(
        d.shortCode,
      )}, ${d.sortOrder}, ${bl(d.isP4P)}, true)`,
  )
  .join(',\n')

const primaryOf = new Map(
  registrations.filter((r) => r.isPrimary).map((r) => [r.athlete.id, r]),
)

const fighterValues = athletes
  .map((a) => {
    const primary = primaryOf.get(a.id)
    return `  (${q(a.id)}, ${q(a.code)}, ${q(a.primaryDisciplineId)}, ${q(a.slug)}, ${q(
      a.firstName,
    )}, ${q(a.lastName)}, ${q(a.displayName)}, ${q(a.nickname)}, ${q(a.country)}, ${q(
      a.countryCode,
    )}, ${q(a.dateOfBirth)}, ${a.heightCm}, ${a.reachCm}, ${q(a.stance)}, ${q(
      primary?.divisionId ?? null,
    )}, ${q(a.team)}, ${q(a.debutDate)}, ${bl(a.isActive)}, ${bl(
      primary?.isChampion ?? false,
    )}, ${bl(primary?.isInterimChampion ?? false)}, true)`
  })
  .join(',\n')

const registrationValues = registrations
  .map(
    (r) =>
      `  (${q(r.athlete.id)}, ${q(r.disciplineId)}, ${q(r.divisionId)}, ${bl(r.isPrimary)}, ${bl(
        r.isActive,
      )}, ${q(r.debutDate)}, ${bl(r.isChampion)}, ${bl(r.isInterimChampion)})`,
  )
  .join(',\n')

const eventValues = events
  .map(
    (e) =>
      `  (${q(e.id)}, ${q(e.slug)}, ${q(e.name)}, ${n(e.eventNumber)}, ${q(e.eventDate)}, ${q(
        e.venue,
      )}, ${q(e.city)}, ${q(e.country)}, ${q(e.countryCode)}, ${q(e.status)}, true)`,
  )
  .join(',\n')

const fightValues = fights
  .map(
    (f) =>
      `  (${q(f.id)}, ${q(f.eventId)}, ${q(f.disciplineId)}, ${q(f.divisionId)}, ${q(
        f.fighterAId,
      )}, ${q(f.fighterBId)}, ${f.boutOrder}, ${f.scheduledRounds}, ${q(f.status)}, ${q(
        f.outcome,
      )}, ${q(f.winnerId)}, ${q(f.loserId)}, ${q(f.method)}, ${q(f.decisionType)}, ${n(
        f.endRound,
      )}, ${n(f.endTimeSeconds)}, ${bl(f.isTitleFight)}, ${bl(f.isInterimTitle)}, ${bl(
        f.isMainEvent,
      )}, ${arr(f.bonuses)})`,
  )
  .join(',\n')

const completed = fights.filter((f) => f.status === 'completed').length
const multiDiscipline = [...registeredIn.values()].filter((set) => set.size > 1).length

const seedSql = `-- =============================================================================
-- FIGHTRANK — seed.sql
-- GENERATED FILE — do not edit by hand.
-- Regenerate: npm run seed:generate
--
-- ⚠ ALL DATA BELOW IS FICTIONAL.
-- Every athlete, nickname, event and venue in this file was invented for this
-- demo. Any resemblance to a real competitor, promotion or trademark is
-- unintentional. Rows are flagged is_demo = true so they can be removed with:
--     delete from fights  using events  where fights.event_id = events.id and events.is_demo;
--     delete from events   where is_demo;
--     delete from fighters where is_demo;   -- cascades to fighter_disciplines
--
-- Contents: ${disciplines.length} disciplines · ${divisions.length} divisions ·
--           ${athletes.length} athletes (${multiDiscipline} in more than one discipline) ·
--           ${registrations.length} discipline registrations ·
--           ${events.length} events · ${fights.length} bouts (${completed} completed)
--
-- NOTE: this file contains competitive FACTS only. No ratings, rankings,
-- movements or history are seeded — those are produced entirely by the ranking
-- engine from the bouts below.
-- =============================================================================

insert into public.disciplines
  (id, slug, name, short_code, tagline, description, ruleset, accent, sort_order, is_active)
values
${disciplineValues}
on conflict (slug) do nothing;

insert into public.divisions
  (id, discipline_id, slug, name, gender, weight_lbs, weight_kg, short_code, sort_order, is_p4p, is_active)
values
${divisionValues}
on conflict (slug) do nothing;

-- One row per athlete. This is the Fighter ID.
insert into public.fighters
  (id, fighter_code, primary_discipline_id, slug, first_name, last_name, display_name, nickname,
   country, country_code, date_of_birth, height_cm, reach_cm, stance, division_id, team,
   debut_date, is_active, is_champion, is_interim_champion, is_demo)
values
${fighterValues}
on conflict (slug) do nothing;

-- One row per athlete per discipline. This is where the per-discipline record
-- lives; the columns on \`fighters\` above are the primary discipline's copy.
insert into public.fighter_disciplines
  (fighter_id, discipline_id, division_id, is_primary, is_active, debut_date,
   is_champion, is_interim_champion)
values
${registrationValues}
on conflict (fighter_id, discipline_id) do nothing;

insert into public.fighter_stats (fighter_id, discipline_id)
select fighter_id, discipline_id from public.fighter_disciplines
on conflict (fighter_id, discipline_id) do nothing;

insert into public.events
  (id, slug, name, event_number, event_date, venue, city, country, country_code, status, is_demo)
values
${eventValues}
on conflict (slug) do nothing;

insert into public.fights
  (id, event_id, discipline_id, division_id, fighter_a_id, fighter_b_id, bout_order,
   scheduled_rounds, status, outcome, winner_id, loser_id, method, decision_type,
   end_round, end_time_seconds, is_title_fight, is_interim_title, is_main_event, bonuses)
values
${fightValues}
on conflict (id) do nothing;

-- The athletes above carry explicit Fighter IDs, so move the sequence past
-- them: the next ID issued must never collide with one already in use.
select public.align_fighter_code_seq();
`

writeFileSync(path.join(root, 'supabase', 'seed.sql'), seedSql)

console.log(
  `Generated:\n  supabase/migrations/0005_config_defaults.sql (${CONFIG_REGISTRY.length} settings)\n` +
    `  supabase/seed.sql (${disciplines.length} disciplines, ${divisions.length} divisions, ` +
    `${athletes.length} athletes, ${registrations.length} registrations, ` +
    `${events.length} events, ${fights.length} bouts)`,
)
