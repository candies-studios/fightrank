# Getting FIGHTRANK live on GitHub Pages

The site at `https://vchandanshive34.github.io/fightrank/` was blank because the repository
contained the **source code**, and GitHub Pages is a static host — it cannot run
`npm run build`, and it cannot execute TypeScript. It needs the compiled output.

There are two ways to fix that. Pick one.

---

## Option A — publish the pre-built folder (no Actions, works immediately)

A compiled copy of the site is already in this repository at `docs/`, built for the path
`/fightrank/`. Nothing needs to run.

1. Commit and push everything in this repository, `docs/` included.
2. On GitHub: **Settings → Pages → Build and deployment**
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`, folder **`/docs`**
3. Save. The site is live in a minute or two.

Rebuild `docs/` yourself whenever you change the code:

```bash
VITE_BASE=/fightrank/ npm run build -- --outDir docs
```

---

## Option B — let GitHub build it on every push (recommended)

`.github/workflows/deploy.yml` is in this repository. It installs dependencies, runs the
test suite, builds the site and publishes it — on every push to `main`.

1. Commit and push, making sure `.github/workflows/deploy.yml` is included. (It is easy to
   miss: some upload tools silently skip dot-directories.)
2. On GitHub: **Settings → Pages → Build and deployment**
   - **Source**: **`GitHub Actions`** — *not* "Deploy from a branch"
3. Push anything to `main`, or run the workflow by hand from the **Actions** tab.

The workflow derives the `/fightrank/` base path from the repository name itself, so
renaming the repository does not break it.

---

## Checking it worked

Open the site and view source. The first `<script src="...">` should read
`/fightrank/assets/index-*.js`. If it reads `/assets/index-*.js`, the build used the wrong
base path and every asset will 404 — that is the blank page.

Three files make deep links work and must survive the deploy; the build writes all three
automatically:

| File | Why it matters |
|---|---|
| `404.html` | A copy of `index.html`. Pages serves it for unknown paths, so `/fightrank/rankings` reaches the app instead of a 404. |
| `.nojekyll` | Stops Pages running the output through Jekyll, which deletes files beginning with `_`. |
| `assets/chunk-*.js` | Named with a `chunk-` prefix for the same reason. |

## First load takes a few seconds

The demo runs a real PostgreSQL database in the browser. On a visitor's first load it
creates the database, applies the schema, loads 883 bouts and runs the ranking engine once
per discipline — about **8 seconds**, with a progress message on screen saying so. Every
load after that is roughly **2 seconds**, because the database persists in the browser.

Pointing the app at a Supabase project instead (see §5 of `README.md`) removes that
entirely.
