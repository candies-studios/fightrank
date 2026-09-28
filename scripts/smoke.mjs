/**
 * Browser smoke test: boots the built app, walks the main routes, fails on any
 * console error or unhandled rejection, and writes screenshots for review.
 *
 * Run with: npm run smoke
 */

import { createRequire } from 'node:module'

// Playwright is provided by the environment rather than the project.
const require_ = createRequire(import.meta.url)
const { chromium } = require_(
  process.env.PLAYWRIGHT_PACKAGE ?? '/home/claude/.npm-global/lib/node_modules/playwright/index.js',
)
import { mkdirSync } from 'node:fs'
import path from 'node:path'

// Normalised without a trailing slash; routes are appended as `/x`, and the
// site root is requested as `${BASE}/` so a subpath deploy resolves correctly.
const BASE = (process.env.SMOKE_BASE ?? 'http://localhost:4173').replace(/\/$/, '')
// Path prefix the app is served under ('' at the root, '/fightrank' on Pages).
// In-app links carry it, so link selectors have to as well.
const PREFIX = new URL(`${BASE}/`).pathname.replace(/\/$/, '')

const OUT = path.resolve(import.meta.dirname, '..', '.smoke')
mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['home', '/', 1400, 1500],
  ['disciplines', '/disciplines', 1400, 1500],
  ['discipline-mma', '/disciplines/mixed-martial-arts', 1400, 1800],
  ['discipline-wrestling', '/disciplines/wrestling', 1400, 1800],
  ['rankings', '/rankings', 1400, 1400],
  ['p4p', '/p4p', 1400, 1200],
  ['fighters', '/fighters', 1400, 1100],
  ['events', '/events', 1400, 1100],
  ['compare', '/compare', 1400, 900],
  ['results', '/results', 1400, 1400],
  ['movers', '/movers', 1400, 1100],
  ['about', '/about', 1400, 1400],
  ['partners', '/partners', 1400, 1400],
  ['methodology', '/methodology', 1400, 1400],
  ['mobile-home', '/', 402, 1400],
  ['mobile-rankings', '/rankings', 402, 1400],
  ['mobile-disciplines', '/disciplines', 402, 1400],
]

const IGNORE = [
  /Download the React DevTools/i,
  /favicon/i,
  /\[vite\]/i,
  // Web fonts are deliberately blocked above; the CSS fallback stack covers them.
  /net::ERR_FAILED/i,
]

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--no-sandbox',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
  ],
})
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await context.newPage()

// The sandbox has no outbound network access, so external font requests would
// hang forever and `networkidle` would never settle.
await context.route('**://fonts.googleapis.com/**', (route) => route.abort())
await context.route('**://fonts.gstatic.com/**', (route) => route.abort())

const problems = []
page.on('console', (message) => {
  if (message.type() !== 'error' && message.type() !== 'warning') return
  const text = message.text()
  if (IGNORE.some((re) => re.test(text))) return
  problems.push(`[${message.type()}] ${text}`)
})
page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`))

// The demo database is created and the engine runs on first load, so give the
// very first navigation extra room.
console.log(`Booting ${BASE} …`)
await page.goto(`${BASE}/`, { waitUntil: 'load' })
await page.waitForSelector('h1', { timeout: 120_000 })
console.log('Booted.')

for (const [name, route, width, height] of ROUTES) {
  await page.setViewportSize({ width, height: Math.min(height, 1200) })
  await page.goto(`${BASE}${route}`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const heading = await page.textContent('h1').catch(() => null)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
  console.log(`· ${name.padEnd(18)} ${route.padEnd(16)} h1="${(heading ?? '').slice(0, 40)}"`)
}

// Drill into a fighter profile from the rankings table.
await page.setViewportSize({ width: 1400, height: 1200 })
await page.goto(`${BASE}/rankings`, { waitUntil: 'load' })
await page.waitForTimeout(600)
const firstFighter = page.locator(`a[href^="${PREFIX}/fighters/"]`).first()
await firstFighter.waitFor({ state: 'visible', timeout: 20_000 })
await firstFighter.click()
await page.waitForTimeout(1200)
console.log(`· fighter profile     ${page.url().replace(BASE, '')}`)
await page.screenshot({ path: path.join(OUT, 'fighter.png'), fullPage: true })

// Ranking history tab + why-this-ranking tab.
for (const tab of ['Ranking history', 'Why this ranking']) {
  const button = page.getByRole('button', { name: new RegExp(tab, 'i') }).first()
  if (await button.count()) {
    await button.click()
    await page.waitForTimeout(700)
    await page.screenshot({
      path: path.join(OUT, `fighter-${tab.split(' ')[0].toLowerCase()}.png`),
      fullPage: true,
    })
    console.log(`· fighter tab         ${tab}`)
  }
}

// An event page.
await page.goto(`${BASE}/events`, { waitUntil: 'load' })
const firstEvent = page.locator(`a[href^="${PREFIX}/events/"]`).first()
await firstEvent.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
if (await firstEvent.count()) {
  await firstEvent.click()
  await page.waitForTimeout(1000)
  console.log(`· event page          ${page.url().replace(BASE, '')}`)
  await page.screenshot({ path: path.join(OUT, 'event.png'), fullPage: true })
}

// Admin: sign in with the demo stub and open the dashboard + simulator.
await page.goto(`${BASE}/admin/login`, { waitUntil: 'load' })
await page.waitForTimeout(500)
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForTimeout(2500)
console.log(`· admin               ${page.url().replace(BASE, '')}`)
await page.screenshot({ path: path.join(OUT, 'admin-dashboard.png'), fullPage: true })

for (const [name, route] of [
  ['admin-fights', '/admin/fights'],
  ['admin-fight-form', '/admin/fights/new'],
  ['admin-simulator', '/admin/simulator'],
  ['admin-settings', '/admin/ranking-settings'],
  ['admin-audit', '/admin/audit'],
  ['admin-fighters', '/admin/fighters'],
  ['admin-disciplines', '/admin/disciplines'],
  ['admin-divisions', '/admin/divisions'],
  ['admin-users', '/admin/users'],
]) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
  console.log(`· ${name.padEnd(18)} ${route}`)
}

// Actually run a simulation (§38) rather than just rendering the form.
await page.goto(`${BASE}/admin/simulator`, { waitUntil: 'load' })
await page.waitForSelector('select', { timeout: 60_000 })
await page.waitForTimeout(4000)
{
  const selects = page.locator('select')
  await selects.nth(0).selectOption({ index: 1 })
  await page.waitForTimeout(400)
  await selects.nth(1).selectOption({ index: 8 })
  await page.waitForTimeout(300)
  await selects.nth(2).selectOption({ index: 2 })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /^simulate$/i }).click()
  await page.waitForTimeout(3000)
  const ran = await page.getByText(/knock-on effects/i).count()
  console.log(`· simulation ran       ${ran > 0 ? 'yes' : 'NO RESULT'}`)
  if (ran === 0) problems.push('[smoke] simulator produced no result')
  await page.screenshot({ path: path.join(OUT, 'admin-simulator-result.png'), fullPage: true })
}

await browser.close()

if (problems.length > 0) {
  console.error(`\n${problems.length} console problem(s):`)
  for (const problem of [...new Set(problems)].slice(0, 30)) console.error('  ' + problem)
  process.exitCode = 1
} else {
  console.log('\nNo console errors. Screenshots in .smoke/')
}
