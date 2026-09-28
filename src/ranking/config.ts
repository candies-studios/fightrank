/**
 * Ranking configuration (§9, §10, §40).
 *
 * Every constant the engine uses lives here as a *registry entry*: default
 * value plus the metadata the admin UI needs to render an editor for it.
 * The same registry generates `supabase/migrations/0004_config_defaults.sql`,
 * so the database and the code can never drift apart.
 *
 * Nothing in the engine may reference a magic number that is not defined here.
 */

export type ConfigScope = 'division' | 'p4p'

export interface ConfigFieldDef {
  key: string
  scope: ConfigScope
  value: number | boolean
  dataType: 'number' | 'boolean'
  label: string
  description: string
  group: string
  min?: number
  max?: number
  step?: number
}

const f = (
  key: string,
  value: number | boolean,
  label: string,
  group: string,
  description: string,
  bounds: { min?: number; max?: number; step?: number } = {},
  scope: ConfigScope = 'division',
): ConfigFieldDef => ({
  key,
  scope,
  value,
  dataType: typeof value === 'boolean' ? 'boolean' : 'number',
  label,
  description,
  group,
  ...bounds,
})

export const CONFIG_REGISTRY: ConfigFieldDef[] = [
  // --- Elo core -------------------------------------------------------------
  f('baseRating', 1500, 'Base rating', 'Elo Core',
    'Every fighter enters the system at this rating.', { min: 1000, max: 2000, step: 10 }),
  f('kFactor', 32, 'K factor', 'Elo Core',
    'How far a single result can move a rating. Higher = more volatile.', { min: 4, max: 96, step: 1 }),
  f('kFactorTitleMultiplier', 1.15, 'Title-fight K multiplier', 'Elo Core',
    'Moderate extra weight for championship bouts (§14). Deliberately small.', { min: 1, max: 2, step: 0.05 }),
  f('kFactorFiveRoundMultiplier', 1.05, 'Five-round K multiplier', 'Elo Core',
    'Slight extra weight for scheduled five-round bouts.', { min: 1, max: 1.5, step: 0.01 }),
  f('drawWeight', 0.5, 'Draw weight', 'Elo Core',
    'Scales the (already small) rating change produced by a draw.', { min: 0, max: 1, step: 0.05 }),
  f('lossSeverity', 1, 'Loss severity', 'Elo Core',
    'Multiplier applied to the negative delta of a defeat.', { min: 0.5, max: 2, step: 0.05 }),
  f('noContestAffectsRating', false, 'No contest affects rating', 'Elo Core',
    'Off by default — a no contest is not a competitive result.'),
  f('ratingFloor', 1100, 'Rating floor', 'Elo Core',
    'A rating can never fall below this value.', { min: 800, max: 1400, step: 10 }),

  // --- Method bonuses (§9) --------------------------------------------------
  f('bonusKo', 25, 'KO bonus', 'Method Bonus',
    'Added to the winner\'s rating for a knockout.', { min: 0, max: 60, step: 1 }),
  f('bonusTko', 22, 'TKO bonus', 'Method Bonus',
    'Added to the winner\'s rating for a technical knockout.', { min: 0, max: 60, step: 1 }),
  f('bonusSubmission', 25, 'Submission bonus', 'Method Bonus',
    'Added to the winner\'s rating for a submission.', { min: 0, max: 60, step: 1 }),
  f('bonusDecisionUnanimous', 10, 'Unanimous decision bonus', 'Method Bonus',
    'A win is never worth less for being a decision — this is an additional modifier only.',
    { min: 0, max: 60, step: 1 }),
  f('bonusDecisionMajority', 7, 'Majority decision bonus', 'Method Bonus',
    'Additional modifier for a majority decision win.', { min: 0, max: 60, step: 1 }),
  f('bonusDecisionSplit', 6, 'Split decision bonus', 'Method Bonus',
    'Additional modifier for a split decision win.', { min: 0, max: 60, step: 1 }),
  f('bonusPin', 25, 'Pin bonus', 'Method Bonus',
    'Added to the winner\'s rating for a pin (wrestling).', { min: 0, max: 60, step: 1 }),
  f('bonusTechnicalFall', 20, 'Technical fall bonus', 'Method Bonus',
    'Added to the winner\'s rating for a technical fall (wrestling).', { min: 0, max: 60, step: 1 }),
  f('bonusOther', 4, 'Other method bonus', 'Method Bonus',
    'Disqualification, doctor stoppage, retirement.', { min: 0, max: 60, step: 1 }),
  f('titleWinBonus', 15, 'Title-fight win bonus', 'Method Bonus',
    'Moderate flat bonus for winning a championship bout (§14).', { min: 0, max: 60, step: 1 }),

  // --- Opponent quality (§10) ----------------------------------------------
  f('oppMultiplierChampion', 2, 'vs Champion', 'Opponent Quality',
    'Multiplier on rating gained when beating a reigning champion.', { min: 0.5, max: 3, step: 0.05 }),
  f('oppMultiplierInterim', 1.85, 'vs Interim champion', 'Opponent Quality',
    'Multiplier when beating an interim champion.', { min: 0.5, max: 3, step: 0.05 }),
  f('oppMultiplierRank1', 1.8, 'vs #1', 'Opponent Quality',
    'Multiplier when beating the number one contender.', { min: 0.5, max: 3, step: 0.05 }),
  f('oppMultiplierRank2to5', 1.5, 'vs #2–#5', 'Opponent Quality',
    'Multiplier for a top-five contender.', { min: 0.5, max: 3, step: 0.05 }),
  f('oppMultiplierRank6to10', 1.3, 'vs #6–#10', 'Opponent Quality',
    'Multiplier for a top-ten contender.', { min: 0.5, max: 3, step: 0.05 }),
  f('oppMultiplierRank11to15', 1.15, 'vs #11–#15', 'Opponent Quality',
    'Multiplier for a ranked contender outside the top ten.', { min: 0.5, max: 3, step: 0.05 }),
  f('oppMultiplierUnranked', 0.85, 'vs Unranked', 'Opponent Quality',
    'Beating an unranked fighter carries the least benefit.', { min: 0.2, max: 2, step: 0.05 }),
  f('opponentQualityWeight', 30, 'Opponent-quality weight', 'Opponent Quality',
    'Points of ranking score per unit of average opponent quality above baseline.',
    { min: 0, max: 120, step: 1 }),
  f('opponentQualityWindow', 5, 'Opponent-quality window', 'Opponent Quality',
    'How many recent bouts feed the opponent-quality component.', { min: 1, max: 20, step: 1 }),

  // --- Recent form (§11) ----------------------------------------------------
  f('formWindow', 5, 'Recent-form window', 'Recent Form',
    'Number of most recent bouts used for the form component.', { min: 1, max: 20, step: 1 }),
  f('formWeight', 24, 'Recent-form weight', 'Recent Form',
    'Maximum points added (5 wins) or removed (0 wins) by recent form.', { min: 0, max: 120, step: 1 }),
  f('formRecencyHalfLifeDays', 540, 'Form half-life (days)', 'Recent Form',
    'A result this old counts half as much inside the form window.', { min: 90, max: 2000, step: 30 }),

  // --- Win streak (§12) -----------------------------------------------------
  f('streakMinLength', 2, 'Minimum streak length', 'Win Streak',
    'Streak bonuses start at this many consecutive wins.', { min: 2, max: 6, step: 1 }),
  f('streakBonusPerWin', 6, 'Bonus per streak win', 'Win Streak',
    'Points per win beyond the minimum streak length.', { min: 0, max: 30, step: 1 }),
  f('streakBonusCap', 30, 'Streak bonus cap', 'Win Streak',
    'Hard ceiling so streaks can never overpower opponent quality (§12).',
    { min: 0, max: 120, step: 1 }),
  f('lossStreakPenaltyPerLoss', 5, 'Penalty per consecutive loss', 'Win Streak',
    'Points removed per consecutive defeat.', { min: 0, max: 30, step: 1 }),
  f('lossStreakPenaltyCap', 25, 'Loss-streak penalty cap', 'Win Streak',
    'Ceiling on the consecutive-defeat penalty.', { min: 0, max: 120, step: 1 }),

  // --- Finish quality -------------------------------------------------------
  f('finishBonusWeight', 20, 'Finish-rate weight', 'Finish Quality',
    'Maximum points from finishing every recent win inside the distance.',
    { min: 0, max: 80, step: 1 }),
  f('finishWindow', 5, 'Finish-rate window', 'Finish Quality',
    'How many recent wins are inspected for finishes.', { min: 1, max: 20, step: 1 }),

  // --- Activity / decay (§13) ----------------------------------------------
  f('decayTier1Days', 180, 'Tier 1 threshold (days)', 'Activity',
    'Below this many days since the last bout there is no decay.', { min: 30, max: 720, step: 15 }),
  f('decayTier2Days', 365, 'Tier 2 threshold (days)', 'Activity',
    'Upper bound of the small-decay band.', { min: 60, max: 1080, step: 15 }),
  f('decayTier3Days', 540, 'Tier 3 threshold (days)', 'Activity',
    'Upper bound of the moderate-decay band.', { min: 90, max: 1460, step: 15 }),
  f('decayTier2Points', 15, 'Tier 2 decay (points)', 'Activity',
    'Points removed for 181–365 days of inactivity.', { min: 0, max: 120, step: 1 }),
  f('decayTier3Points', 35, 'Tier 3 decay (points)', 'Activity',
    'Points removed for 366–540 days of inactivity.', { min: 0, max: 200, step: 1 }),
  f('decayTier4Points', 70, 'Tier 4 decay (points)', 'Activity',
    'Points removed beyond the tier-3 threshold.', { min: 0, max: 300, step: 1 }),
  f('activityBonusDays', 120, 'Activity bonus window (days)', 'Activity',
    'A bout inside this window earns the small activity bonus.', { min: 0, max: 365, step: 15 }),
  f('activityBonusPoints', 5, 'Activity bonus (points)', 'Activity',
    'Reward for having competed very recently.', { min: 0, max: 40, step: 1 }),
  f('autoRemoveInactive', false, 'Auto-remove inactive fighters', 'Activity',
    'Off by default — inactive fighters stay ranked unless an admin removes them (§13).'),
  f('inactiveCutoffDays', 900, 'Inactivity cutoff (days)', 'Activity',
    'Only applies when auto-removal is switched on.', { min: 180, max: 2000, step: 30 }),

  // --- Championship ---------------------------------------------------------
  f('championBonus', 0, 'Champion score bonus', 'Championship',
    'Champions are displayed above the contender list, so this defaults to zero.',
    { min: 0, max: 200, step: 5 }),
  f('interimChampionBonus', 0, 'Interim champion score bonus', 'Championship',
    'Interim champions are listed among the contenders unless given a bonus.',
    { min: 0, max: 200, step: 5 }),
  f('interimRanksAtTop', true, 'Interim champion ranks #1', 'Championship',
    'Place a reigning interim champion at #1 among contenders.'),

  // --- Table shape ----------------------------------------------------------
  f('rankedPositions', 15, 'Ranked contender positions', 'Table',
    'Contenders shown beneath the champion (§16).', { min: 5, max: 30, step: 1 }),
  f('minFightsToRank', 1, 'Minimum bouts to be ranked', 'Table',
    'Fighters below this bout count are unranked.', { min: 0, max: 10, step: 1 }),

  // --- Pound for pound (§20) ------------------------------------------------
  f('p4pWeightRating', 0.4, 'Rating weight', 'P4P Weighting',
    'Share of the P4P score driven by overall rating.', { min: 0, max: 1, step: 0.01 }, 'p4p'),
  f('p4pWeightOpponentQuality', 0.2, 'Opposition weight', 'P4P Weighting',
    'Share driven by quality of opposition.', { min: 0, max: 1, step: 0.01 }, 'p4p'),
  f('p4pWeightRecentForm', 0.15, 'Recent-form weight', 'P4P Weighting',
    'Share driven by recent results.', { min: 0, max: 1, step: 0.01 }, 'p4p'),
  f('p4pWeightDominance', 0.1, 'Dominance weight', 'P4P Weighting',
    'Share driven by finishing ability.', { min: 0, max: 1, step: 0.01 }, 'p4p'),
  f('p4pWeightChampionship', 0.1, 'Championship weight', 'P4P Weighting',
    'Share driven by title wins and successful defences.', { min: 0, max: 1, step: 0.01 }, 'p4p'),
  f('p4pWeightActivity', 0.05, 'Activity weight', 'P4P Weighting',
    'Share driven by how recently the fighter competed.', { min: 0, max: 1, step: 0.01 }, 'p4p'),
  f('p4pMinFights', 3, 'Minimum bouts for P4P', 'P4P Weighting',
    'Fighters below this bout count are excluded from P4P.', { min: 0, max: 20, step: 1 }, 'p4p'),
  f('p4pSize', 15, 'P4P list size', 'P4P Weighting',
    'How many fighters appear in the pound-for-pound list.', { min: 5, max: 30, step: 1 }, 'p4p'),
  f('p4pRatingReference', 1500, 'Rating reference point', 'P4P Weighting',
    'Rating treated as the zero point when normalising.', { min: 1000, max: 2000, step: 10 }, 'p4p'),
  f('p4pRatingSpan', 400, 'Rating normalisation span', 'P4P Weighting',
    'Rating distance above the reference that scores a full 1.0.', { min: 100, max: 800, step: 10 }, 'p4p'),
]

type RegistryKeys = (typeof CONFIG_REGISTRY)[number]['key']
export type RankingConfig = Record<RegistryKeys, number | boolean> & {
  [K in string]: number | boolean
}

/** Strongly typed accessor helpers — the engine never reads raw keys. */
export const DEFAULT_CONFIG: RankingConfig = Object.fromEntries(
  CONFIG_REGISTRY.map((entry) => [entry.key, entry.value]),
) as RankingConfig

export function num(config: RankingConfig, key: string): number {
  const v = config[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const fallback = DEFAULT_CONFIG[key]
  return typeof fallback === 'number' ? fallback : 0
}

export function bool(config: RankingConfig, key: string): boolean {
  const v = config[key]
  if (typeof v === 'boolean') return v
  return Boolean(DEFAULT_CONFIG[key])
}

/** Merge partial overrides (from the database) onto the defaults. */
export function resolveConfig(overrides?: Partial<RankingConfig> | null): RankingConfig {
  if (!overrides) return { ...DEFAULT_CONFIG }
  const merged: RankingConfig = { ...DEFAULT_CONFIG }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined) continue
    if (key in DEFAULT_CONFIG) merged[key] = value as number | boolean
  }
  return merged
}

export const CONFIG_GROUPS = (scope: ConfigScope): string[] => [
  ...new Set(CONFIG_REGISTRY.filter((c) => c.scope === scope).map((c) => c.group)),
]
