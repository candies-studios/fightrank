# FIGHTRANK

**Every fight changes the ranking.**

A production-quality ranking platform for combat sports. Athletes, events and bouts are
recorded; a transparent, configurable ranking engine turns those results into divisional
standings, a pound-for-pound list, and a permanent, explainable history of every movement.

It covers **five disciplines** — mixed martial arts, submission grappling, wrestling,
Muay Thai and kickboxing — and each one is ranked as a world of its own. An athlete holds
**one Fighter ID for life** (`FR-00123`) and a separate record, division and rating in
every discipline they compete in. A wrestling result can never move a Muay Thai rating.

Nothing in this application is a mock. There is no hard-coded ranking anywhere in the
codebase — if you delete every fight, every table empties; if you add one, the affected
divisions are recalculated and the reasons are written down.

---

## Contents

1. [What it does](#1-what-it-does)
2. [Running it](#2-running-it)
3. [How the ranking engine works](#3-how-the-ranking-engine-works)
4. [Database schema](#4-database-schema)
5. [Supabase setup](#5-supabase-setup)
6. [Environment variables](#6-environment-variables)
7. [Creating an administrator](#7-creating-an-administrator)
8. [Changing the ranking configuration](#8-changing-the-ranking-configuration)
9. [Project structure](#9-project-structure)
10. [Testing](#10-testing)
11. [Deployment](#11-deployment)
12. [Demo data](#12-demo-data)

---

## 1. What it does

### Public site

| Route | What it shows |
|---|---|
| `/` | Champions, pound-for-pound, biggest movers, latest results, upcoming cards |
| `/disciplines` | The five disciplines, each with its divisions, roster and champions |
| `/disciplines/:slug` | One discipline's rules, divisions, P4P list, movers and latest results |
| `/rankings/:division` | Champion plus ranked contenders, with rating, movement, streak, opposition quality |
| `/p4p` | Pound-for-pound — one list per discipline, scored by its own weighted model |
| `/fighters` | Searchable, filterable, paginated roster |
| `/fighters/:slug` | Every record under one Fighter ID: switch discipline to switch history, chart, breakdown and "why this ranking" |
| `/events` · `/events/:slug` | Cards, results, bonuses and the ranking update the card produced |
| `/results` | Every recorded bout, grouped by card, filterable by discipline and division |
| `/compare` | Head-to-head comparison of two fighters across thirteen metrics |
| `/movers` | Every ranking movement with the reasons behind it |
| `/methodology` | The published algorithm, with the live configuration values |
| `/about` · `/partners` | What the platform is, how it stays independent, and who feeds it |

### Admin panel (`/admin`)

Dashboard · fights · events · fighters · divisions · **ranking simulator** ·
**ranking settings** · ranking changes · audit log · users.

### Ranking engine

A single deterministic function of `(fighters, fights, config, asOf)`. It has no
dependency on React, Supabase or HTTP, which is what makes it independently testable —
see [§10](#10-testing).

---

## 2. Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

**There is no configuration step.** With no Supabase project configured the app boots a
real PostgreSQL database in the browser ([PGlite](https://pglite.dev) — Postgres compiled
to WebAssembly), applies the same migrations a Supabase deployment uses, loads the
fictional demo dataset, runs the ranking engine over it and renders the result. The
database persists in IndexedDB, so your changes survive a reload.

Sign in to the admin panel with the demo credentials shown on the sign-in screen
(`admin@fightrank.demo` / `fightrank`).

To run against Supabase instead, see [§5](#5-supabase-setup).

### All scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm test` | Full test suite (78 tests) |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | oxlint |
| `npm run db:verify` | Apply every migration + seed to a throwaway Postgres and assert the safety rules bite |
| `npm run db:pipeline` | Headless end-to-end: migrations → seed → engine → persisted rankings, printed to the terminal |
| `npm run seed:generate` | Regenerate `supabase/seed.sql` and the config-defaults migration |
| `npm run smoke` | Drive the built app in a real browser, walk every route, fail on any console error |

---

## 3. How the ranking engine works

> Everything below is configurable from `/admin/ranking-settings`. The numbers quoted are
> the shipped defaults.

### 3.1 The ranking score

Every divisional table is ordered by one published formula:

```
Score = (Win% × 0.7 + Recent Form × 0.3) × √(total fights)
```

| Term | What it is |
|---|---|
| **Win %** | Career wins ÷ rated bouts × 100. A draw counts as half a win (configurable); a no contest is ignored. |
| **Recent Form** | The last 5 bouts, win = 1 · draw = ½ · loss = 0, recency-weighted (540-day half-life), × 100. |
| **√(total fights)** | Experience factor over rated bouts. Rewards a proven record with diminishing returns. |

Example — a 9-1 fighter whose recent form is 80%: `(90 × 0.7 + 80 × 0.3) × √10 = 87 × 3.162 ≈ 275.1`.

Both weights are admin-editable (`scoreWeightWinPct`, `scoreWeightRecentForm`). The
implementation is `src/ranking/score.ts`; the fighter profile's breakdown panel and
"Why this ranking?" list work the formula through with that fighter's own numbers.

**Elo is still tracked** (sections 3.2–3.4). It no longer decides the order, but it is the
first tie-breaker when two scores are equal, drives the rating chart, feeds pound-for-pound,
and records how much each individual result mattered.

### 3.2 The rating pass

Bouts are replayed in chronological order, grouped by event. Every fighter starts at
`baseRating` (1500).

For each bout:

```
E_a  = 1 / (1 + 10^((R_b − R_a) / 400))          expected score
K    = kFactor × (title ? 1.15 : 1) × (5-round ? 1.05 : 1)

win   → Δ = max(K·(1 − E), 0) × opponentQuality + methodBonus + titleBonus
loss  → Δ = K·(0 − E) × lossSeverity
draw  → Δ = K·(0.5 − E) × drawWeight
no contest → no change
```

The engine is deliberately **not** zero-sum. A fighter who loses a close split decision to
the champion should not be punished as hard as one knocked out by an unranked opponent, and
the winner's method bonus is not taken out of the loser's rating.

A win always gains rating. `max(K·(1 − E), 0)` guarantees it, so beating a much weaker
opponent is worth little but never negative.

### 3.3 Opponent quality (§8, §10)

The multiplier applied to rating **gained** from a win, based on where the opponent stood
*at the moment of the bout* — not where they stand today:

| Opponent | Multiplier |
|---|---|
| Champion | ×2.00 |
| Interim champion | ×1.85 |
| #1 | ×1.80 |
| #2–#5 | ×1.50 |
| #6–#10 | ×1.30 |
| #11–#15 | ×1.15 |
| Unranked | ×0.85 |

Opponent standings are known at each point in time because the engine re-ranks affected
divisions after every event as it replays the timeline.

### 3.4 Method of victory (§9)

Added to the winner's rating. **A win is never worth less for being a decision** — these
values only ever add.

| Method | Bonus |
|---|---|
| KO | +25 |
| Submission | +25 |
| TKO | +22 |
| Unanimous decision | +10 |
| Majority decision | +7 |
| Split decision | +6 |
| DQ / doctor stoppage / retirement | +4 |
| Title-fight win (additional) | +15 |

### 3.5 Retired modifiers

Earlier versions added streak, finish-rate, inactivity-decay and title bonuses on top of the
Elo rating. Those are no longer part of the score; migration `0007_ranking_score.sql`
removes their settings. Streaks, finish rate and activity are still shown on profiles as
information.

### 3.6 Championships (§14, §15)

- Championship status changes **only** through a title bout.
- Champion wins → retains, defence counter increments.
- Champion loses → the belt transfers, the former champion re-enters the contender list
  and is flagged `is_former_champion`.
- Title-fight draw → the champion retains.
- Interim champion beats the champion → unification, the interim title is closed as
  `promoted`/`unified`.
- Champion beats the interim champion → unification, the interim title is closed.
- The champion never occupies #1. An interim champion is placed first among the
  contenders (configurable).
- Every reign is recorded in `championships` with `won_at`, `lost_at`, `defenses` and an
  `end_reason`.

### 3.7 Pound for pound (§20)

Deliberately **not** a merge of the divisional tables — it answers a different question, so
it has its own model. Six components, each normalised to [0, 1], combined with weights an
administrator tunes independently of the divisional engine:

| Component | Default weight |
|---|---|
| Overall rating | 0.40 |
| Quality of opposition | 0.20 |
| Recent form | 0.15 |
| Dominance (finish rate) | 0.10 |
| Championship success | 0.10 |
| Activity | 0.05 |

### 3.8 Explanations (§18)

Every movement is written to `ranking_history` with a `movement_reason` array generated
**deterministically from the engine's own ledger** — no language model, no hand-written
copy. The same data always produces the same sentences.

```
Defeated #4 Pavlo Yeboah
Won by Submission (R2, 0:34)
Upset win — rated 53% underdog by rating
Extended win streak to 3
Rating +41 → 1657
```

Fighters who did not compete but moved get their own reason
(`Did not compete · Moved up 2 after results at FIGHTRANK 128`), as do positions that
shift purely because recent form was re-weighted as results aged.

### 3.9 Scoped recalculation (§43)

Recording a bout does not rebuild the world. `recalculate(context, { divisionIds })`
replays the timeline but only rewrites the divisions the bout could have disturbed, plus
the pound-for-pound table, which spans every division. Where the backend supports it
(the local database), the whole rewrite runs inside a single SQL transaction.

---

## 4. Database schema

Competitive **facts** live in `fights`. Everything else — records, ratings, rankings,
history, championships — is **derived** and rebuilt by the engine. That is the single most
important property of the schema.

```
disciplines ─┬─ divisions ─┬─ fighter_disciplines ─┬─ fighter_stats      (derived record)
             │             │   (one per athlete    ├─ rankings          (derived standings)
             │             │    per discipline)    ├─ ranking_breakdowns (derived components)
             │             │                       ├─ ranking_history    (derived ledger)
             │             │                       ├─ p4p_rankings / p4p_history
             │             │                       └─ championships      (derived reigns)
             │             └─ fights ──── events
             └─ fighters   (one row per athlete — this is the Fighter ID)
profiles · ranking_config · audit_log
```

**The Fighter ID.** `fighters` holds one row per athlete, with a permanent public code
(`fighter_code`, e.g. `FR-00123`). `fighter_disciplines` holds one row per athlete *per
discipline*: its own division, its own rating, its own championship status. The engine runs
once per discipline over that discipline's registrations, divisions and bouts, so results
never leak between them. The rating columns on `fighters` are a denormalised copy of the
athlete's **primary** discipline, kept so roster listings and search stay a single flat
read; the per-discipline truth always lives in `fighter_disciplines`.

| Table | Purpose |
|---|---|
| `profiles` | Application users, mirrors `auth.users`, carries the role |
| `disciplines` | The sports themselves — ruleset, accent, display order |
| `divisions` | Weight classes, each belonging to one discipline — **never hard-coded in the UI** |
| `fighters` | One row per athlete: the Fighter ID, identity and physical attributes |
| `fighter_disciplines` | One row per athlete per discipline — division, rating, title status |
| `fighter_stats` | Derived win/loss record, one row per athlete **per discipline** |
| `events` | Fight cards |
| `fights` | **The single source of competitive truth** |
| `rankings` | Current divisional standings (champion = position 0) |
| `ranking_breakdowns` | Transparent score decomposition |
| `ranking_history` | Every movement, ever, with its reasons |
| `p4p_rankings` / `p4p_history` | Pound-for-pound standings and movement |
| `championships` | Title reigns, undisputed and interim |
| `ranking_config` | Every engine constant, editable without a code change |
| `audit_log` | Append-only record of administrative actions |

Read models are database **views**, so the application never assembles a join by hand:
`fighter_profiles`, `fighter_discipline_profiles`, `fight_details`, `ranking_table`,
`p4p_table`, `ranking_history_details`, `event_cards`, `search_index`.

### Integrity is enforced in the database, not just the form

`npm run db:verify` applies the schema to a throwaway Postgres and proves it:

```
✓ fighter cannot fight himself — rejected
✓ a draw cannot have a winner — rejected
✓ duplicate bout on the same card — rejected
✓ two champions in one division — rejected
✓ booking an athlete in a discipline they are not registered in — rejected
✓ registering one athlete twice in the same discipline — rejected
✓ two champions in one division across the per-discipline records — rejected
```

Those come from `CHECK` constraints, partial unique indexes
(`fighters_one_champion_per_division`), an order-independent unique index on
`(event_id, least(a,b), greatest(a,b))`, and a `BEFORE INSERT OR UPDATE` trigger. The
client-side rules in `src/services/validation.ts` exist to give the administrator a clear
message — they are not the last line of defence.

---

## 5. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations, in order, in the SQL editor (or with the Supabase CLI):

   ```
   supabase/migrations/0001_schema.sql
   supabase/migrations/0002_functions.sql
   supabase/migrations/0003_rls.sql
   supabase/migrations/0004_views.sql
   supabase/migrations/0005_config_defaults.sql
   supabase/migrations/0006_fighter_identity.sql
   supabase/migrations/0007_ranking_score.sql
   ```

   With the CLI:

   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```

3. *(Optional)* load the fictional demo roster:

   ```
   supabase/seed.sql
   ```

4. Copy the project URL and **anon** key into `.env.local` ([§6](#6-environment-variables)).
5. Start the app, sign up, and grant yourself admin ([§7](#7-creating-an-administrator)).
6. Open `/admin` and press **Recalculate** once to populate the derived tables.

### Security model (§25)

- RLS is enabled on every table.
- `anon` and `authenticated` may **read** divisions, fighters, stats, events, fights,
  rankings, breakdowns, history, P4P, championships and the ranking config.
- Only `admin` and `editor` may write, enforced by the `public.is_admin()`
  `SECURITY DEFINER` helper used by every write policy.
- Only `admin` (not `editor`) may change a user's role.
- `audit_log` has a select policy and an insert policy and **no update or delete policy**,
  so the trail is append-only even for administrators.
- The **service-role key is never used**. It does not appear anywhere in `src/`, and it
  must never be placed in a `VITE_`-prefixed variable — those are compiled into the
  browser bundle.

---

## 6. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | For production | Project URL. Absent → local demo database. |
| `VITE_SUPABASE_ANON_KEY` | For production | The public anon key. Never the service-role key. |

```bash
cp .env.example .env.local
```

The backend is chosen once per session in `src/data/index.ts`. Both backends expose the
same repository, so nothing above that file knows which is running.

---

## 7. Creating an administrator

**Supabase.** The `handle_new_user` trigger creates a profile for every new account. The
*first* account ever created becomes `admin`; everyone after that is a `viewer`. To
promote someone later, either use `/admin/users` as an existing admin, or run:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

**Local demo.** `admin@fightrank.demo` / `fightrank`, shown on the sign-in screen. This is
a clearly-labelled stub for the offline demo and is never constructed when Supabase is
configured.

Roles: `admin` (everything, including user management) · `editor` (everything except user
management) · `viewer` (read-only, cannot open the admin panel).

---

## 8. Changing the ranking configuration

Open **`/admin/ranking-settings`**. Every constant the engine uses is a row in
`ranking_config`, rendered generically with a slider, a number field and its
documentation. Saving writes the new values, **recalculates every division and the
pound-for-pound table**, and records the change in the audit log with its previous value.

No code change is needed, and no restart.

### Adding a new constant

The registry in `src/ranking/config.ts` is the single source of truth. Add an entry:

```ts
f('myNewKnob', 12, 'My new knob', 'Elo Core',
  'What it does, in a sentence.', { min: 0, max: 50, step: 1 }),
```

then regenerate the migration and read it in the engine:

```bash
npm run seed:generate      # rewrites supabase/migrations/0005_config_defaults.sql
```

```ts
import { num } from './config'
const knob = num(config, 'myNewKnob')
```

The admin UI picks it up automatically — there is no form to edit. The generated migration
uses `on conflict … do update` on the metadata only, so re-running it never overwrites an
administrator's tuning.

---

## 9. Project structure

```
src/
  ranking/            The engine. No React, no database, no HTTP.
    config.ts           Registry of every constant + defaults
    elo.ts              Expected score, K factor, method bonus, rating delta
    opponentStrength.ts Quality multipliers and the opposition component
    form.ts             Recent form + finish rate
    activity.ts         Inactivity decay tiers
    streak.ts           Streak bonus and its cap
    rankingEngine.ts    The chronological replay, standings and history diffing
    rankingExplanation.ts  Deterministic reason generation
    p4pEngine.ts        The separate pound-for-pound model
    simulator.ts        Runs the engine twice and diffs the two worlds
  data/
    postgrest.ts        The narrow interface both backends implement
    repository.ts       ONE data-access implementation
    mappers.ts          Row → domain
    supabase/           Production client + auth
    pglite/             Local Postgres, the PostgREST translation shim, demo auth
  services/
    recalculate.ts      Engine output → database
    validation.ts       §23 safety rules
    admin.ts            validate → write → recalculate → audit
  components/           UI primitives and domain components
  pages/public/         The public site
  pages/admin/          The admin panel
  layouts/ hooks/ lib/ types/
supabase/
  migrations/           0001 schema · 0002 functions · 0003 RLS · 0004 views · 0005 config · 0006 identity · 0007 ranking score
  seed.sql              Generated fictional demo data
scripts/
  generate-seed.ts      Deterministic demo-data generator
  verify-schema.ts      Schema + constraint verification
  verify-pipeline.ts    Headless end-to-end run
  smoke.mjs             Real-browser route walk
tests/                  Engine, validation and full-stack integration tests
```

**The ranking engine never appears inside a React component.** Components read computed
values from the database; the engine is invoked only by `services/recalculate.ts` and by
the simulator.

---

## 10. Testing

```bash
npm test
```

78 tests in three suites.

**`tests/engine.test.ts` — the engine in isolation.** Builds a synthetic 16-deep ladder so
ranks are known exactly, then asserts:

- win / loss / draw / no contest, majority and split draws
- KO vs submission vs unanimous vs majority vs split decision ordering
- **#15 beating #3** · **#3 beating #1 being worth more than #3 beating #15**
- **#1 losing to #10** · an unranked fighter beating a ranked one and entering at `NEW`
- a brand-new fighter with no bouts being unranked
- crowning a champion · the champion never occupying #1 · successful defences
- **a champion losing to #5** and the belt transferring · a title-fight draw retaining it
- interim championships, and unification in **both** directions
- never two champions in one division
- streak bonus and its cap · recent-form window · tiered inactivity decay
- inactive fighters *not* being removed by default, and being removed when an admin opts in
- score components summing exactly to the final score
- movement, previous rank, new rank and reasons being recorded
- determinism: two runs over identical data agree exactly
- pound-for-pound ranking and its minimum-bout rule

**`tests/validation.test.ts` — the §23 safety rules** (26 tests).

**`tests/integration.test.ts` — the whole stack.** Applies the real migrations and the real
seed file to a real PostgreSQL instance, drives the real repository, runs the real engine
and asserts the product's invariants: contiguous tables, champion above the list, scores
matching breakdowns, history agreeing with standings, scoped recalculation leaving other
divisions untouched, a recorded result moving the right people, an invalid bout being
rejected, and search working.

Two more verification entry points:

```bash
npm run db:verify      # schema + constraints against real Postgres
npm run db:pipeline    # migrations → seed → engine → rankings, printed
npm run smoke          # every route in a real browser, fails on any console error
```

---

## 11. Deployment

The app is a static bundle; any static host works.

```bash
npm run build          # → dist/
```

> **The `dist/` folder is what gets deployed — never the repository root.** A static
> host cannot run `npm run build`, and a browser cannot execute the TypeScript in
> `src/`. Pointing a host at the repo root serves an `index.html` that asks for
> `/src/main.tsx`, the browser refuses to run it, and you get a blank white page.

**GitHub Pages**

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. One
setting has to be changed by hand, once:

> **Settings → Pages → Build and deployment → Source → “GitHub Actions”**
> (*not* “Deploy from a branch”.)

Three things are already handled for you:

- **Base path.** A site at `user.github.io/fightrank/` must request
  `/fightrank/assets/…`. `vite.config.ts` derives this from `GITHUB_REPOSITORY`
  during the Actions build, so it is correct automatically and needs no editing if
  you rename the repo. Override with `VITE_BASE` for any other host.
- **Deep links.** Pages has no rewrite rule, so `/fightrank/rankings` would 404.
  The build writes a copy of `index.html` to `404.html`, which Pages serves for
  unknown paths and the router then resolves. `<BrowserRouter basename>` is wired
  to `import.meta.env.BASE_URL` to match.
- **Jekyll.** A `.nojekyll` file is emitted so Pages publishes the assets verbatim.

Note that a Pages deployment with no Supabase environment variables runs in **demo
mode**: every visitor gets their own PostgreSQL database inside their own browser.
The first load takes roughly ten seconds while it downloads the WASM database,
applies the migrations, loads the demo bouts and runs the ranking engine; after
that it is cached in IndexedDB and loads in about three seconds. Admin changes stay
in that visitor's browser. For a shared, persistent installation, add the Supabase
variables as repository secrets and expose them to the build step.

**Vercel / Netlify / Cloudflare Pages**

- Build command: `npm run build`
- Output directory: `dist`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Add an SPA rewrite so deep links resolve:
  - Netlify — `_redirects`: `/*  /index.html  200`
  - Vercel — `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
  - Cloudflare Pages — a `_redirects` file with the same line

**Before going live**

1. Run the migrations against the production project, **including `0003_rls.sql`**.
2. Confirm the anon key is the one in the environment, not the service-role key.
3. Delete the demo data if you are loading real records:
   ```sql
   delete from fights using events where fights.event_id = events.id and events.is_demo;
   delete from events where is_demo;
   delete from fighters where is_demo;
   ```
4. Sign up, promote yourself to `admin`, and press **Recalculate** once.

**A note on bundle size.** The 890 kB PGlite chunk is the local demo database. It is
behind a dynamic `import()` that only runs when Supabase is *not* configured, so a
production deployment never downloads it.

---

## 12. Demo data

`supabase/seed.sql` is generated by `scripts/generate-seed.ts` from a seeded PRNG, so it is
reproducible. It contains **5 disciplines, 41 divisions, 242 athletes holding 306
discipline registrations, 81 events and 883 bouts**, with champions, interim champions,
title reigns, win streaks, upsets, draws, no contests and inactive athletes.

Roughly one athlete in five competes in more than one discipline, so the demo shows the
whole point of the model: an MMA champion who is only ranked fourth in Muay Thai, a
double champion in grappling and wrestling, a welterweight titleholder who is 1-5 in
kickboxing. Each discipline also finishes fights its own way — pins and technical falls in
wrestling, submissions in grappling, knockouts in Muay Thai and kickboxing.

> **All of it is fictional.** Every fighter, nickname, event and venue was invented for
> this project. Any resemblance to a real athlete, promotion or trademark is unintentional.
> Every row is flagged `is_demo = true` so it can be removed in three statements
> ([§11](#11-deployment)). FIGHTRANK is an independent ranking platform with its own
> identity, not affiliated with or endorsed by any real promotion.

The generator writes **competitive facts only** — no ratings, no rankings, no movements, no
history. Those are produced entirely by the engine from the bouts. Fighter photographs are
a first-class field (`fighters.photo_url`); the fictional roster has none, so the UI renders
a deterministic monogram plate rather than borrowing anyone's likeness.

Regenerate with:

```bash
npm run seed:generate
```
