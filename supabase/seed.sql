-- =============================================================================
-- FIGHTRANK - seed.sql
--
-- STRUCTURE ONLY. The fictional demonstration roster has been removed: there
-- are no athletes, no events and no bouts in this file.
--
-- What remains is the competitive structure the platform needs to exist at
-- all - the five disciplines and their weight classes. Everything else is
-- entered through the admin panel, and every Fighter ID is issued by the
-- database as each athlete is added.
--
-- Until results are recorded, every ranking table is legitimately empty. That
-- is the system working: positions are produced from recorded bouts only, so
-- with no bouts there is nothing to rank.
--
-- To restore the demo roster, run:  npm run seed:generate
-- =============================================================================

insert into public.disciplines
  (id, slug, name, short_code, tagline, description, ruleset, accent, sort_order, is_active)
values
  ('3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts', 'Mixed Martial Arts', 'MMA', 'Every range, every finish.', 'Striking and grappling under one ruleset. Bouts are contested over three rounds, or five when a title or a main event is on the line.', 'Unified rules - 5-minute rounds - open scoring disabled', '#e2574c', 1, true),
  ('943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling', 'Submission Grappling', 'GRP', 'No strikes. No gi. No stalling.', 'Submission-only and points grappling contested in a single period. A match that reaches the buzzer is decided on advantages and control time.', 'No-gi - single 10-minute period - submission or referee decision', '#3f8ea8', 2, true),
  ('72d24897-997a-4bf6-aae5-16260d470315', 'wrestling', 'Wrestling', 'WRE', 'Six minutes. Two feet. One decision.', 'Freestyle wrestling scored on takedowns, exposure and control. A ten-point lead ends the bout by technical fall; both shoulders on the mat ends it by pin.', 'Freestyle - single 6-minute period - pin, technical fall or points', '#c9922f', 3, true),
  ('d09ba047-e100-4538-9383-62914c589b72', 'muay-thai', 'Muay Thai', 'MT', 'The art of eight limbs.', 'Full Thai rules: elbows, knees and the clinch, over five three-minute rounds scored on damage and dominance rather than volume.', 'Full Thai rules - five 3-minute rounds - clinch and elbows permitted', '#a8563f', 4, true),
  ('ec4427f4-a644-411c-bc0f-224b632c17fd', 'kickboxing', 'Kickboxing', 'KB', 'Hands, shins, and no place to hide.', 'Three-round kickboxing on international rules: kicks above the waist, no clinch work, and an extra round if the judges cannot separate them.', 'K-1 rules - three 3-minute rounds - limited clinch', '#5f6f9c', 5, true)
on conflict (slug) do nothing;

insert into public.divisions
  (id, discipline_id, slug, name, gender, weight_lbs, weight_kg, short_code, sort_order, is_p4p, is_active)
values
  ('fd3f8855-e0ec-4af8-b569-76c03ceef9e1', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-heavyweight', 'Heavyweight', 'men', 265, 120.2, 'HW', 1, false, true),
  ('e97a98a5-ffc1-4ef9-9bed-bf96b221333e', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-light-heavyweight', 'Light Heavyweight', 'men', 205, 92.99, 'LHW', 2, false, true),
  ('e0ca2ec4-52af-44eb-bb5e-50ddfab4d6fb', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-middleweight', 'Middleweight', 'men', 185, 83.91, 'MW', 3, false, true),
  ('38683573-b5be-4660-ae5e-0e42a21cdb94', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-welterweight', 'Welterweight', 'men', 170, 77.11, 'WW', 4, false, true),
  ('9c1e5702-2003-4b01-95fc-6054a200a891', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-lightweight', 'Lightweight', 'men', 155, 70.31, 'LW', 5, false, true),
  ('b74b1e9e-89bf-4b39-8e6b-4b7f3ea57162', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-featherweight', 'Featherweight', 'men', 145, 65.77, 'FW', 6, false, true),
  ('9870dabc-03b3-4c1c-bdf9-f2e4b7e0499b', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-bantamweight', 'Bantamweight', 'men', 135, 61.23, 'BW', 7, false, true),
  ('e4d3fb0c-cdab-4ebf-b9be-4c43329d50c3', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-flyweight', 'Flyweight', 'men', 125, 56.7, 'FLW', 8, false, true),
  ('aac473b7-2a75-46ea-bc41-1cf5966680c3', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-women-s-bantamweight', 'Women''s Bantamweight', 'women', 135, 61.23, 'WBW', 9, false, true),
  ('f32024e5-aa8d-49f0-b5ba-55f3e1472a1c', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-women-s-flyweight', 'Women''s Flyweight', 'women', 125, 56.7, 'WFLW', 10, false, true),
  ('bc2ab390-30ec-4e83-b947-bde9a336c6e6', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-women-s-strawweight', 'Women''s Strawweight', 'women', 115, 52.16, 'WSW', 11, false, true),
  ('5730948d-cfac-4e34-894c-2c87bf850dc5', '3ce28679-0a04-4c31-9649-a4a4d9e502d8', 'mixed-martial-arts-pound-for-pound', 'Pound-for-Pound', 'open', null, null, 'P4P', 99, true, true),
  ('9f841ca2-a55f-42fd-8548-bd2542a5fa29', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-ultra-heavyweight', 'Ultra Heavyweight', 'men', 240, 108.86, 'UHW', 1, false, true),
  ('cce79b09-1d0f-43f2-a4da-d01a339c2623', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-heavyweight', 'Heavyweight', 'men', 205, 92.99, 'HW', 2, false, true),
  ('412c68eb-252e-4ca9-8b4d-14de1096d1cc', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-middleweight', 'Middleweight', 'men', 185, 83.91, 'MW', 3, false, true),
  ('2d876413-2401-445f-b380-2e2ad008a5fe', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-welterweight', 'Welterweight', 'men', 170, 77.11, 'WW', 4, false, true),
  ('4a3dd4d9-ec8a-46b3-af9d-decf4e782e8c', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-lightweight', 'Lightweight', 'men', 155, 70.31, 'LW', 5, false, true),
  ('4fefc6d7-25c7-4641-b08b-da2e0708251f', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-women-s-middleweight', 'Women''s Middleweight', 'women', 145, 65.77, 'WMW', 6, false, true),
  ('59c0df37-055c-4c16-bc4f-142b582fa75d', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-women-s-lightweight', 'Women''s Lightweight', 'women', 130, 58.97, 'WLW', 7, false, true),
  ('6328791c-f8e6-4737-b810-bb5d9466826e', '943518ba-0993-4458-8b67-e5b1ec5bbb64', 'submission-grappling-pound-for-pound', 'Pound-for-Pound', 'open', null, null, 'P4P', 99, true, true),
  ('1592ba7f-02f6-49eb-8ee1-85996d0a880f', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-heavyweight', 'Heavyweight', 'men', 275, 124.74, 'HW', 1, false, true),
  ('51fc5e9f-3ff2-4ada-a95a-4dff487787fe', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-light-heavyweight', 'Light Heavyweight', 'men', 213, 96.62, 'LHW', 2, false, true),
  ('45ae2650-224b-44ed-9a01-79b9200c306f', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-middleweight', 'Middleweight', 'men', 190, 86.18, 'MW', 3, false, true),
  ('cf9e4c43-3136-40fc-ae64-f1d1f3e21894', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-welterweight', 'Welterweight', 'men', 174, 78.93, 'WW', 4, false, true),
  ('e3ebf93d-cc98-47cd-904d-6827bcc632ff', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-lightweight', 'Lightweight', 'men', 157, 71.21, 'LW', 5, false, true),
  ('67176283-4981-4eb3-b19a-2d406835cc6d', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-featherweight', 'Featherweight', 'men', 141, 63.96, 'FW', 6, false, true),
  ('644f2d4e-52d8-4ee9-b4be-a031576881e8', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-women-s-welterweight', 'Women''s Welterweight', 'women', 150, 68.04, 'WWW', 7, false, true),
  ('ecb353a1-2960-4266-ae2f-3b61a162f243', '72d24897-997a-4bf6-aae5-16260d470315', 'wrestling-pound-for-pound', 'Pound-for-Pound', 'open', null, null, 'P4P', 99, true, true),
  ('d7475dd1-1a28-4663-ad25-013a4d5e793f', 'd09ba047-e100-4538-9383-62914c589b72', 'muay-thai-cruiserweight', 'Cruiserweight', 'men', 200, 90.72, 'CW', 1, false, true),
  ('0f501bb3-ff98-4191-95ce-4008b5894023', 'd09ba047-e100-4538-9383-62914c589b72', 'muay-thai-middleweight', 'Middleweight', 'men', 160, 72.57, 'MW', 2, false, true),
  ('830e2a8f-3928-434d-b31b-8cbf840d21de', 'd09ba047-e100-4538-9383-62914c589b72', 'muay-thai-welterweight', 'Welterweight', 'men', 147, 66.68, 'WW', 3, false, true),
  ('69805bc6-c05b-47a4-8afa-635fad8f3b75', 'd09ba047-e100-4538-9383-62914c589b72', 'muay-thai-lightweight', 'Lightweight', 'men', 135, 61.23, 'LW', 4, false, true),
  ('98088af3-8760-4f32-acc7-99c96858e915', 'd09ba047-e100-4538-9383-62914c589b72', 'muay-thai-featherweight', 'Featherweight', 'men', 126, 57.15, 'FW', 5, false, true),
  ('f24eaf9a-649c-44d8-9a5c-7065bd4ef8d3', 'd09ba047-e100-4538-9383-62914c589b72', 'muay-thai-women-s-flyweight', 'Women''s Flyweight', 'women', 115, 52.16, 'WFLW', 6, false, true),
  ('663e4321-adc4-400d-9bfb-5d00d874d794', 'd09ba047-e100-4538-9383-62914c589b72', 'muay-thai-pound-for-pound', 'Pound-for-Pound', 'open', null, null, 'P4P', 99, true, true),
  ('977c1155-c499-4177-978d-5026a71b4bcd', 'ec4427f4-a644-411c-bc0f-224b632c17fd', 'kickboxing-heavyweight', 'Heavyweight', 'men', 209, 94.8, 'HW', 1, false, true),
  ('31e4d0a1-1300-490f-a017-0ad2f0acefb0', 'ec4427f4-a644-411c-bc0f-224b632c17fd', 'kickboxing-light-heavyweight', 'Light Heavyweight', 'men', 176, 79.83, 'LHW', 2, false, true),
  ('e045de71-699e-4234-a519-0cb474e6575d', 'ec4427f4-a644-411c-bc0f-224b632c17fd', 'kickboxing-welterweight', 'Welterweight', 'men', 154, 69.85, 'WW', 3, false, true),
  ('a84e7a3a-41e6-4eba-acbb-013583120e99', 'ec4427f4-a644-411c-bc0f-224b632c17fd', 'kickboxing-lightweight', 'Lightweight', 'men', 143, 64.86, 'LW', 4, false, true),
  ('c9740fd1-71d1-47be-9087-eb6754faa7d3', 'ec4427f4-a644-411c-bc0f-224b632c17fd', 'kickboxing-women-s-bantamweight', 'Women''s Bantamweight', 'women', 125, 56.7, 'WBW', 5, false, true),
  ('4e2a36af-6cfd-4f5a-9362-dfdc5707909a', 'ec4427f4-a644-411c-bc0f-224b632c17fd', 'kickboxing-pound-for-pound', 'Pound-for-Pound', 'open', null, null, 'P4P', 99, true, true)
on conflict (slug) do nothing;

-- One row per athlete. This is the Fighter ID.

-- No athletes are seeded, so the Fighter ID sequence starts clean at FR-00001.
-- (The original seed ended by calling public.align_fighter_code_seq(), which is
--  defined in migration 0006. That call is removed here so this file runs on its
--  own; step-06 aligns the sequence itself when you run it, and step-08 issues
--  its own Fighter IDs either way.)
