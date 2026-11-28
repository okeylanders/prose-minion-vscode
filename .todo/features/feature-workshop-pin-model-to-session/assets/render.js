// Renders pin-model.html to PNGs beside it.
// Run from the repository root:
//   node .todo/features/feature-workshop-pin-model-to-session/assets/render.js
//
// - One PNG per state, dark and wide (1280px): 1-unpinned.png … 8-cache-clock-and-meter.png
// - One sheet of every state per theme and width: sheet-<theme>-<width>.png
//   Widths: 1280 (wide), 880 (the rail is a strip and the header has stacked),
//   520 (the narrowest header rule).
const path = require('path');
const { chromium } = require('playwright');

const STATES = {
  s1: '1-unpinned',
  s2: '2-pinned',
  s3: '3-pinned-setting-differs',
  s4: '4-unpinning',
  s5: '5-unavailable',
  s6: '6-two-tabs',
  s7: '7-divider',
  s8: '8-cache-clock-and-meter'
};
const WIDTHS = [1280, 880, 520];
const THEMES = ['dark', 'light'];

(async () => {
  const dir = __dirname;
  const file = `file://${path.join(dir, 'pin-model.html')}`;
  const browser = await chromium.launch();
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
      await page.goto(`${file}?theme=${theme}`);
      await page.screenshot({ path: path.join(dir, `sheet-${theme}-${width}.png`), fullPage: true });
      if (theme === 'dark' && width === 1280) {
        for (const [id, name] of Object.entries(STATES)) {
          await page.locator(`#${id}`).screenshot({ path: path.join(dir, `${name}.png`) });
        }
      }
      await page.close();
    }
  }
  await browser.close();
})();
