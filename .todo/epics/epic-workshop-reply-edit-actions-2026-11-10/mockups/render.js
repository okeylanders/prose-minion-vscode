// Renders reply-offers.html to PNGs beside it: one per frame, and the whole page.
// Run from the repository root: node .todo/epics/epic-workshop-reply-edit-actions-2026-11-10/mockups/render.js
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`file://${path.join(dir, 'reply-offers.html')}`);
  const frames = {
    f1: '1-before-and-after',
    f2: '2-chip-states',
    f3: '3-answer',
    f4: '4-narrow'
  };
  for (const [id, name] of Object.entries(frames)) {
    await page.locator(`#${id}`).screenshot({ path: path.join(dir, `${name}.png`) });
  }
  await browser.close();
})();
