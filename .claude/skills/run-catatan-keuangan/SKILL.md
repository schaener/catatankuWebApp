---
name: run-catatan-keuangan
description: Build, run, and drive the Catatan Keuangan finance web app (React + Vite + Firebase). Use when asked to run/start the app, launch the dev server, take a screenshot of a page (Dashboard, Transaksi, Laporan, Split Bill, Chat, Feed), run its tests, or check that a UI change works.
---

Start the Vite dev server in **demo mode** (Firebase swapped for an in-browser fake with seed data, no credentials needed), then drive it with `.claude/skills/run-catatan-keuangan/driver.mjs` - a Playwright script on the system Google Chrome that logs in, clicks through sidebar pages and screenshots each one.

All paths are relative to the repo root. Verified on macOS (arm64) with Node 22 via nvm.

## Prerequisites

Node **≥ 20.19 or ≥ 22.12** (Vite 8 / rolldown). Node 21 does NOT work.

```bash
source ~/.nvm/nvm.sh && nvm install 22
```

Google Chrome installed at `/Applications/Google Chrome.app` (the driver uses `channel: 'chrome'`; no Playwright browser download). Elsewhere, set `CHROME_PATH=/path/to/chrome`.

## Setup

```bash
source ~/.nvm/nvm.sh
nvm exec 22 npm install
# lockfile lacks the macOS native binding (npm optional-deps bug) - add it without touching package.json/lockfile:
nvm exec 22 npm install --no-save @rolldown/binding-darwin-arm64@$(node -p "require('./node_modules/rolldown/package.json').version")
# driver dependency, installed inside the skill dir only (gitignored):
nvm exec 22 npm install --prefix .claude/skills/run-catatan-keuangan
```

## Run (agent path)

```bash
source ~/.nvm/nvm.sh
nvm exec 22 npm run dev:demo > /tmp/catatan-dev.log 2>&1 &
for i in $(seq 30); do curl -sf http://localhost:5173/ >/dev/null && break; sleep 1; done   # macOS has no `timeout`
nvm exec 22 node .claude/skills/run-catatan-keuangan/driver.mjs              # all pages
nvm exec 22 node .claude/skills/run-catatan-keuangan/driver.mjs Dashboard "Split Bill"   # selected pages
```

Output: one `shot /tmp/catatan-shots/<page>.png` line per page, then `ok`. Exits 1 and prints `pageerror:`/`console:` lines if the page threw or logged errors. **Read the PNGs** before calling it done.

| arg / env | meaning |
|---|---|
| page args | sidebar labels: `Dashboard` `Transaksi` `Cari` `Laporan` `"Split Bill"` `Chat` `Feed` (default: all) |
| `APP_URL` | default `http://localhost:5173/` |
| `SHOTS_DIR` | default `/tmp/catatan-shots` |
| `CHROME_PATH` | Chrome binary if not the standard macOS install |

For a new flow (fill a form, open a detail page), copy the driver's login + `a.nav-link` click pattern and add steps before `shot()`.

Stop the server:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs kill
```

## Run (human path)

```bash
nvm use 22 && npm run dev:demo   # open http://localhost:5173, click "Masuk dengan Google". Ctrl-C to stop.
```

`npm run dev` (real Firebase) needs `.env.local` copied from `.env.example` and filled in; without it the app renders the "SetupRequired" page.

## Test

```bash
nvm exec 22 npm test   # vitest: 1 file, 7 tests pass
```

## Gotchas

- **Demo mode uses `MemoryRouter`** (`src/App.jsx`): the URL never changes, so `goto('/split')` lands on the Dashboard. Navigate by clicking `a.nav-link` in the sidebar.
- **Login button in demo** is still labelled "Masuk dengan Google", but it signs in as the seeded user "Dimas Demo". Each new browser context starts logged out because the demo state lives in localStorage.
- **Recharts animates**: the Dashboard pie chart is only partly drawn ~500ms after navigating. The driver waits 1.5s per page.
- **Full-page screenshots** show the sidebar ending at viewport height (900px) while the Dashboard content runs to ~1050px. That's how the app's layout behaves, not a driver bug.
- **`nvm exec 22 npm run dev:demo &`**: killing `$!` doesn't free the port. Use the `lsof` kill above.

## Troubleshooting

- **`Error: Cannot find native binding ... Cannot find module '@rolldown/binding-darwin-arm64'`**: the native binding is missing after `npm install`. Run the `--no-save` install from Setup.
- **`TypeError [ERR_INVALID_ARG_VALUE]: The argument 'format' must be one of ... Received [ 'underline', 'gray' ]`** from `node:util styleText`: you're on Node 21 (the nvm default here). Use `nvm exec 22`.
