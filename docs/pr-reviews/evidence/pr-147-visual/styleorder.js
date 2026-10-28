/* Prints the runtime <style> order a built bundle produces, one line per sheet. */
const path = require('path');
// Resolve Playwright from the project, then PLAYWRIGHT_MODULE, then this
// container's global install. Chromium comes from PLAYWRIGHT_BROWSERS_PATH.
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [pageFile] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(pageFile));
  await page.waitForTimeout(800);
  const order = await page.evaluate(() => Array.from(document.styleSheets).map((sheet, i) => {
    const rules = Array.from(sheet.cssRules || []);
    const firstStyle = rules.find((r) => r.selectorText);
    const marker = rules.find((r) => r.selectorText && /pm-ws|data-pm|markdown-content|app-container/.test(r.selectorText));
    const first = firstStyle ? firstStyle.selectorText.slice(0, 60) : '-';
    const mark = marker ? marker.selectorText.slice(0, 70) : '-';
    return `${i}: ${rules.length} rules | first=${first} | marker=${mark}`;
  }));
  console.log(order.join('\n'));
  await browser.close();
})();
