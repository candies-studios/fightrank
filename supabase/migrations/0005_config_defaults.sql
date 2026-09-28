-- =============================================================================
-- FIGHTRANK - 0005_config_defaults.sql
-- GENERATED FILE - do not edit by hand.
-- Source: src/ranking/config.ts  -  Regenerate: npm run seed:generate
--
-- Seeds the ranking-configuration registry (Section 40). Existing values are left
-- untouched so re-running a migration never overwrites an administrator's
-- tuning.
-- =============================================================================

insert into public.ranking_config
  (scope, key, value, data_type, label, description, group_name, min_value, max_value, step, sort_order)
values
  ('division', 'baseRating', '1500'::jsonb, 'number', 'Base rating', 'Every fighter enters the system at this rating.', 'Elo Core', 1000, 2000, 10, 0),
  ('division', 'kFactor', '32'::jsonb, 'number', 'K factor', 'How far a single result can move a rating. Higher = more volatile.', 'Elo Core', 4, 96, 1, 1),
  ('division', 'kFactorTitleMultiplier', '1.15'::jsonb, 'number', 'Title-fight K multiplier', 'Moderate extra weight for championship bouts (Section 14). Deliberately small.', 'Elo Core', 1, 2, 0.05, 2),
  ('division', 'kFactorFiveRoundMultiplier', '1.05'::jsonb, 'number', 'Five-round K multiplier', 'Slight extra weight for scheduled five-round bouts.', 'Elo Core', 1, 1.5, 0.01, 3),
  ('division', 'drawWeight', '0.5'::jsonb, 'number', 'Draw weight', 'Scales the (already small) rating change produced by a draw.', 'Elo Core', 0, 1, 0.05, 4),
  ('division', 'lossSeverity', '1'::jsonb, 'number', 'Loss severity', 'Multiplier applied to the negative delta of a defeat.', 'Elo Core', 0.5, 2, 0.05, 5),
  ('division', 'noContestAffectsRating', 'false'::jsonb, 'boolean', 'No contest affects rating', 'Off by default - a no contest is not a competitive result.', 'Elo Core', null, null, null, 6),
  ('division', 'ratingFloor', '1100'::jsonb, 'number', 'Rating floor', 'A rating can never fall below this value.', 'Elo Core', 800, 1400, 10, 7),
  ('division', 'bonusKo', '25'::jsonb, 'number', 'KO bonus', 'Added to the winner''s rating for a knockout.', 'Method Bonus', 0, 60, 1, 8),
  ('division', 'bonusTko', '22'::jsonb, 'number', 'TKO bonus', 'Added to the winner''s rating for a technical knockout.', 'Method Bonus', 0, 60, 1, 9),
  ('division', 'bonusSubmission', '25'::jsonb, 'number', 'Submission bonus', 'Added to the winner''s rating for a submission.', 'Method Bonus', 0, 60, 1, 10),
  ('division', 'bonusDecisionUnanimous', '10'::jsonb, 'number', 'Unanimous decision bonus', 'A win is never worth less for being a decision - this is an additional modifier only.', 'Method Bonus', 0, 60, 1, 11),
  ('division', 'bonusDecisionMajority', '7'::jsonb, 'number', 'Majority decision bonus', 'Additional modifier for a majority decision win.', 'Method Bonus', 0, 60, 1, 12),
  ('division', 'bonusDecisionSplit', '6'::jsonb, 'number', 'Split decision bonus', 'Additional modifier for a split decision win.', 'Method Bonus', 0, 60, 1, 13),
  ('division', 'bonusPin', '25'::jsonb, 'number', 'Pin bonus', 'Added to the winner''s rating for a pin (wrestling).', 'Method Bonus', 0, 60, 1, 14),
  ('division', 'bonusTechnicalFall', '20'::jsonb, 'number', 'Technical fall bonus', 'Added to the winner''s rating for a technical fall (wrestling).', 'Method Bonus', 0, 60, 1, 15),
  ('division', 'bonusOther', '4'::jsonb, 'number', 'Other method bonus', 'Disqualification, doctor stoppage, retirement.', 'Method Bonus', 0, 60, 1, 16),
  ('division', 'titleWinBonus', '15'::jsonb, 'number', 'Title-fight win bonus', 'Moderate flat bonus for winning a championship bout (Section 14).', 'Method Bonus', 0, 60, 1, 17),
  ('division', 'oppMultiplierChampion', '2'::jsonb, 'number', 'vs Champion', 'Multiplier on rating gained when beating a reigning champion.', 'Opponent Quality', 0.5, 3, 0.05, 18),
  ('division', 'oppMultiplierInterim', '1.85'::jsonb, 'number', 'vs Interim champion', 'Multiplier when beating an interim champion.', 'Opponent Quality', 0.5, 3, 0.05, 19),
  ('division', 'oppMultiplierRank1', '1.8'::jsonb, 'number', 'vs #1', 'Multiplier when beating the number one contender.', 'Opponent Quality', 0.5, 3, 0.05, 20),
  ('division', 'oppMultiplierRank2to5', '1.5'::jsonb, 'number', 'vs #2-#5', 'Multiplier for a top-five contender.', 'Opponent Quality', 0.5, 3, 0.05, 21),
  ('division', 'oppMultiplierRank6to10', '1.3'::jsonb, 'number', 'vs #6-#10', 'Multiplier for a top-ten contender.', 'Opponent Quality', 0.5, 3, 0.05, 22),
  ('division', 'oppMultiplierRank11to15', '1.15'::jsonb, 'number', 'vs #11-#15', 'Multiplier for a ranked contender outside the top ten.', 'Opponent Quality', 0.5, 3, 0.05, 23),
  ('division', 'oppMultiplierUnranked', '0.85'::jsonb, 'number', 'vs Unranked', 'Beating an unranked fighter carries the least benefit.', 'Opponent Quality', 0.2, 2, 0.05, 24),
  ('division', 'opponentQualityWeight', '30'::jsonb, 'number', 'Opponent-quality weight', 'Points of ranking score per unit of average opponent quality above baseline.', 'Opponent Quality', 0, 120, 1, 25),
  ('division', 'opponentQualityWindow', '5'::jsonb, 'number', 'Opponent-quality window', 'How many recent bouts feed the opponent-quality component.', 'Opponent Quality', 1, 20, 1, 26),
  ('division', 'formWindow', '5'::jsonb, 'number', 'Recent-form window', 'Number of most recent bouts used for the form component.', 'Recent Form', 1, 20, 1, 27),
  ('division', 'formWeight', '24'::jsonb, 'number', 'Recent-form weight', 'Maximum points added (5 wins) or removed (0 wins) by recent form.', 'Recent Form', 0, 120, 1, 28),
  ('division', 'formRecencyHalfLifeDays', '540'::jsonb, 'number', 'Form half-life (days)', 'A result this old counts half as much inside the form window.', 'Recent Form', 90, 2000, 30, 29),
  ('division', 'streakMinLength', '2'::jsonb, 'number', 'Minimum streak length', 'Streak bonuses start at this many consecutive wins.', 'Win Streak', 2, 6, 1, 30),
  ('division', 'streakBonusPerWin', '6'::jsonb, 'number', 'Bonus per streak win', 'Points per win beyond the minimum streak length.', 'Win Streak', 0, 30, 1, 31),
  ('division', 'streakBonusCap', '30'::jsonb, 'number', 'Streak bonus cap', 'Hard ceiling so streaks can never overpower opponent quality (Section 12).', 'Win Streak', 0, 120, 1, 32),
  ('division', 'lossStreakPenaltyPerLoss', '5'::jsonb, 'number', 'Penalty per consecutive loss', 'Points removed per consecutive defeat.', 'Win Streak', 0, 30, 1, 33),
  ('division', 'lossStreakPenaltyCap', '25'::jsonb, 'number', 'Loss-streak penalty cap', 'Ceiling on the consecutive-defeat penalty.', 'Win Streak', 0, 120, 1, 34),
  ('division', 'finishBonusWeight', '20'::jsonb, 'number', 'Finish-rate weight', 'Maximum points from finishing every recent win inside the distance.', 'Finish Quality', 0, 80, 1, 35),
  ('division', 'finishWindow', '5'::jsonb, 'number', 'Finish-rate window', 'How many recent wins are inspected for finishes.', 'Finish Quality', 1, 20, 1, 36),
  ('division', 'decayTier1Days', '180'::jsonb, 'number', 'Tier 1 threshold (days)', 'Below this many days since the last bout there is no decay.', 'Activity', 30, 720, 15, 37),
  ('division', 'decayTier2Days', '365'::jsonb, 'number', 'Tier 2 threshold (days)', 'Upper bound of the small-decay band.', 'Activity', 60, 1080, 15, 38),
  ('division', 'decayTier3Days', '540'::jsonb, 'number', 'Tier 3 threshold (days)', 'Upper bound of the moderate-decay band.', 'Activity', 90, 1460, 15, 39),
  ('division', 'decayTier2Points', '15'::jsonb, 'number', 'Tier 2 decay (points)', 'Points removed for 181-365 days of inactivity.', 'Activity', 0, 120, 1, 40),
  ('division', 'decayTier3Points', '35'::jsonb, 'number', 'Tier 3 decay (points)', 'Points removed for 366-540 days of inactivity.', 'Activity', 0, 200, 1, 41),
  ('division', 'decayTier4Points', '70'::jsonb, 'number', 'Tier 4 decay (points)', 'Points removed beyond the tier-3 threshold.', 'Activity', 0, 300, 1, 42),
  ('division', 'activityBonusDays', '120'::jsonb, 'number', 'Activity bonus window (days)', 'A bout inside this window earns the small activity bonus.', 'Activity', 0, 365, 15, 43),
  ('division', 'activityBonusPoints', '5'::jsonb, 'number', 'Activity bonus (points)', 'Reward for having competed very recently.', 'Activity', 0, 40, 1, 44),
  ('division', 'autoRemoveInactive', 'false'::jsonb, 'boolean', 'Auto-remove inactive fighters', 'Off by default - inactive fighters stay ranked unless an admin removes them (Section 13).', 'Activity', null, null, null, 45),
  ('division', 'inactiveCutoffDays', '900'::jsonb, 'number', 'Inactivity cutoff (days)', 'Only applies when auto-removal is switched on.', 'Activity', 180, 2000, 30, 46),
  ('division', 'championBonus', '0'::jsonb, 'number', 'Champion score bonus', 'Champions are displayed above the contender list, so this defaults to zero.', 'Championship', 0, 200, 5, 47),
  ('division', 'interimChampionBonus', '0'::jsonb, 'number', 'Interim champion score bonus', 'Interim champions are listed among the contenders unless given a bonus.', 'Championship', 0, 200, 5, 48),
  ('division', 'interimRanksAtTop', 'true'::jsonb, 'boolean', 'Interim champion ranks #1', 'Place a reigning interim champion at #1 among contenders.', 'Championship', null, null, null, 49),
  ('division', 'rankedPositions', '15'::jsonb, 'number', 'Ranked contender positions', 'Contenders shown beneath the champion (Section 16).', 'Table', 5, 30, 1, 50),
  ('division', 'minFightsToRank', '1'::jsonb, 'number', 'Minimum bouts to be ranked', 'Fighters below this bout count are unranked.', 'Table', 0, 10, 1, 51),
  ('p4p', 'p4pWeightRating', '0.4'::jsonb, 'number', 'Rating weight', 'Share of the P4P score driven by overall rating.', 'P4P Weighting', 0, 1, 0.01, 52),
  ('p4p', 'p4pWeightOpponentQuality', '0.2'::jsonb, 'number', 'Opposition weight', 'Share driven by quality of opposition.', 'P4P Weighting', 0, 1, 0.01, 53),
  ('p4p', 'p4pWeightRecentForm', '0.15'::jsonb, 'number', 'Recent-form weight', 'Share driven by recent results.', 'P4P Weighting', 0, 1, 0.01, 54),
  ('p4p', 'p4pWeightDominance', '0.1'::jsonb, 'number', 'Dominance weight', 'Share driven by finishing ability.', 'P4P Weighting', 0, 1, 0.01, 55),
  ('p4p', 'p4pWeightChampionship', '0.1'::jsonb, 'number', 'Championship weight', 'Share driven by title wins and successful defences.', 'P4P Weighting', 0, 1, 0.01, 56),
  ('p4p', 'p4pWeightActivity', '0.05'::jsonb, 'number', 'Activity weight', 'Share driven by how recently the fighter competed.', 'P4P Weighting', 0, 1, 0.01, 57),
  ('p4p', 'p4pMinFights', '3'::jsonb, 'number', 'Minimum bouts for P4P', 'Fighters below this bout count are excluded from P4P.', 'P4P Weighting', 0, 20, 1, 58),
  ('p4p', 'p4pSize', '15'::jsonb, 'number', 'P4P list size', 'How many fighters appear in the pound-for-pound list.', 'P4P Weighting', 5, 30, 1, 59),
  ('p4p', 'p4pRatingReference', '1500'::jsonb, 'number', 'Rating reference point', 'Rating treated as the zero point when normalising.', 'P4P Weighting', 1000, 2000, 10, 60),
  ('p4p', 'p4pRatingSpan', '400'::jsonb, 'number', 'Rating normalisation span', 'Rating distance above the reference that scores a full 1.0.', 'P4P Weighting', 100, 800, 10, 61)
on conflict (scope, key) do update set
  label       = excluded.label,
  description = excluded.description,
  group_name  = excluded.group_name,
  data_type   = excluded.data_type,
  min_value   = excluded.min_value,
  max_value   = excluded.max_value,
  step        = excluded.step,
  sort_order  = excluded.sort_order;
