// Drive the Catatan Keuangan demo build in headless Chrome.
//
//   node .claude/skills/run-catatan-keuangan/driver.mjs [page ...]
//
// Logs in through the demo "Masuk dengan Google" button, then clicks each
// sidebar entry given (Dashboard, Transaksi, Cari, Laporan, "Split Bill",
// Chat, Feed - default: all) and screenshots it. Exits 1 on page/console
// errors. Env: APP_URL (default http://localhost:5173/), SHOTS_DIR,
// CHROME_PATH (default: system Google Chrome via channel 'chrome').
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.APP_URL ?? 'http://localhost:5173/';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/catatan-shots';
const ALL = ['Dashboard', 'Transaksi', 'Cari', 'Laporan', 'Split Bill', 'Chat', 'Feed'];
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

const shot = async (name) => {
  const file = `${SHOTS}/${name.toLowerCase().replace(/\s+/g, '-')}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`shot ${file}`);
};

try {
  await page.goto(URL);
  // Demo state lives in localStorage; a fresh context always starts logged out.
  await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
  await page.locator('a.nav-link').first().waitFor();

  for (const label of pages) {
    // MemoryRouter in demo mode: URLs never change, navigate by clicking the sidebar.
    await page.locator('a.nav-link', { hasText: label }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // lazy route + recharts animation (pie needs ~1.5s)
    await shot(label);
  }
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok');
