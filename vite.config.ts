import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Public base path.
 *
 * A site served from `https://user.github.io/fightrank/` must build its asset
 * URLs as `/fightrank/assets/…`, not `/assets/…`. On GitHub Actions the repo
 * name is available, so this derives itself with no configuration; a
 * user/organisation page (`user.github.io`) is served from the root and needs
 * no prefix. Set `VITE_BASE` to override for any other host.
 */
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE
  if (!process.env.GITHUB_ACTIONS) return '/'
  const repo = (process.env.GITHUB_REPOSITORY ?? '').split('/')[1] ?? ''
  if (!repo || repo.endsWith('.github.io')) return '/'
  return `/${repo}/`
}

/**
 * GitHub Pages has no server-side rewrite, so a deep link such as
 * `/fightrank/rankings` would 404. Pages serves `404.html` for any unknown
 * path, so shipping a copy of `index.html` under that name makes the SPA
 * router resolve the URL instead. `.nojekyll` stops Pages running the files
 * through Jekyll, which would otherwise drop anything beginning with `_`.
 */
function githubPagesFiles(): Plugin {
  let outDir = 'dist'
  return {
    name: 'fightrank:github-pages',
    apply: 'build',
    configResolved(config) {
      // Honour --outDir, so `vite build --outDir docs` is also deployable.
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const index = path.join(outDir, 'index.html')
      if (!existsSync(index)) return
      copyFileSync(index, path.join(outDir, '404.html'))
      writeFileSync(path.join(outDir, '.nojekyll'), '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss(), githubPagesFiles()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  optimizeDeps: {
    // PGlite ships a wasm bundle that must not be pre-bundled.
    exclude: ['@electric-sql/pglite'],
  },
  build: {
    // Route-level lazy imports already split the bundle; the wasm database and
    // the chart library are dynamically imported so they never block first paint.
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Some virtual modules are named `__vite-browser-external`, and Jekyll
        // deletes anything whose name starts with an underscore — which breaks
        // a branch-based GitHub Pages deploy in a way that is very hard to
        // diagnose. Prefixing every chunk keeps the output Jekyll-safe whether
        // or not a .nojekyll file survives the upload.
        chunkFileNames: 'assets/chunk-[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
