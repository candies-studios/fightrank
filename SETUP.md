# Setting up the new repository

Everything in this archive goes into the repository. Nothing is missing and
nothing needs generating first.

---

## 1. Create the repository

On GitHub: **New repository** → name it, leave it **empty** (no README, no
`.gitignore`, no licence — those are already here).

If you name it anything other than `fightrank`, read step 4 before deploying.

---

## 2. Push the files

**Use git, not the browser uploader.** The drag-and-drop uploader silently
skips files and folders whose names begin with a dot, and five of them here
matter:

```
.github/workflows/deploy.yml    the build-and-deploy workflow
.gitignore                      keeps node_modules out
.nojekyll  ·  docs/.nojekyll    stops GitHub Pages mangling the build
.env.example                    the Supabase settings template
.oxlintrc.json                  linter configuration
```

From Terminal, in the unzipped folder:

```bash
git init -b main
git add -A
git commit -m "FIGHTRANK"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

GitHub will ask for your username and a **personal access token** — your
account password will not work. Create one at **github.com/settings/tokens**
with the `repo` scope.

To confirm everything arrived, check that `.github/workflows/deploy.yml` is
visible in the repository. If it isn't, the workflow will never run.

---

## 3. Turn on Pages

**Settings → Pages → Build and deployment → Source → GitHub Actions.**

Not "Deploy from a branch". The included workflow installs dependencies, runs
the test suite, builds the site and publishes it, on every push to `main`.

The first run takes two or three minutes. Watch it under the **Actions** tab.

---

## 4. If your repository is not named `fightrank`

The build works out the URL prefix from the repository name by itself, so
**with GitHub Actions there is nothing to change** — rename freely.

The one thing that will not follow you is the pre-built `docs/` folder, which
is compiled for `/fightrank/`. It exists only as a fallback for deploying
without Actions. If your repository has a different name and you want to use
that route, rebuild it first:

```bash
VITE_BASE=/<your-repo-name>/ npm run build -- --outDir docs
```

---

## 5. Signing in

The admin panel is at `/admin`.

```
admin@fightrank.demo
fightrank
```

This is a demo stand-in that lives entirely in your browser — fine for a
public demo, not for real accounts. `README.md` §5 covers connecting a real
Supabase project, which gives you proper authentication, roles and a database
that is shared between visitors rather than per-browser.

---

## 6. The site starts empty — that is deliberate

There are no athletes, events or bouts. The five disciplines and their 41
weight classes are there, and nothing else.

Every ranking page will say it has nothing to show. That is the system being
honest: positions are computed from recorded results, so with no results there
is nothing to rank.

To fill it:

1. **Admin → Fighters → Add fighter.** Each athlete is issued a permanent
   Fighter ID (`FR-00001`, `FR-00002`, …) by the database as you add them.
2. **Admin → Events → New event.** The card.
3. **Admin → Fights → New fight.** Record each bout and its result.

The rankings recalculate themselves as results go in, and every movement is
written to the history with its reasons.

### Want the demo data back?

`supabase/seed.demo.sql` holds the original fictional roster — 242 athletes,
81 events, 883 bouts. To ship it as the live data, replace the seed:

```bash
cp supabase/seed.demo.sql supabase/seed.sql
```

Then bump `SCHEMA_VERSION` in `src/data/pglite/client.ts` (any change forces
existing visitors' browsers to rebuild) and push. Everything in that file is
invented — no real athlete appears in it.

---

## 7. Checking your work locally

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 92 tests — the same gate the workflow uses
npm run db:verify    # applies the schema and proves the safety rules bite
npm run db:pipeline  # migrations → seed → engine → rankings, end to end
```

`npm test` is worth running before you push. The workflow fails the deploy if
it fails, which is deliberate — it stops a broken build reaching the live site
— but it does mean a red test leaves the site on its previous version.
