/*
 * Lightbox Slice 2A visual harness, adapted from ../pr-147-visual/harness.js:
 * renders a built webview bundle in Chromium the way webviewHtml.ts would for
 * the Lightbox surface, drives the board's states through window messages,
 * and screenshots each once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * The board and the refusal are real host output: boards/*.json were built by
 * LightboxService from public-domain text (see README.md).
 */
const path = require('path');
const fs = require('fs');
// Resolve Playwright from the project, then PLAYWRIGHT_MODULE, then this
// container's global install. Chromium comes from PLAYWRIGHT_BROWSERS_PATH.
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const boards = path.join(__dirname, 'boards');
const built = JSON.parse(fs.readFileSync(path.join(boards, 'board.json'), 'utf8'));
const refused = JSON.parse(fs.readFileSync(path.join(boards, 'refused.json'), 'utf8'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prose Minion Lightbox</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body { background: #1e1e1e; --vscode-font-family: sans-serif; --vscode-foreground: #ccc; }
    #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root" data-pm-surface="lightbox" data-pm-frame="fulltab"><span style="padding:8px">Loading the Lightbox…</span></div>
  <script>
    window.__pmPosted = [];
    window.__pmVsCodeApi = {
      postMessage: (m) => { window.__pmPosted.push(m); },
      getState: () => undefined,
      setState: () => {}
    };
    window.acquireVsCodeApi = () => window.__pmVsCodeApi;
    window.proseMinionAssets = { vhsLoadingGif: '', loadingGifs: [], loadingGifList: [], loadingGifCredits: {}, noticeShots: {} };
  </script>
  <script src="file://${path.resolve(bundle)}"></script>
</body>
</html>`;

const pagePath = path.resolve(outDir, 'page.html');
fs.writeFileSync(pagePath, html);

const message = (type, payload) => ({ type, source: 'extension.lightbox', timestamp: 1, payload });
const chrome = [
  { type: 'api_key_status', source: 'extension.configuration', timestamp: 1, payload: { hasSavedKey: true } },
  {
    type: 'model_data', source: 'extension.configuration', timestamp: 1,
    payload: {
      options: [{ id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', description: '' }],
      selections: { assistant: 'anthropic/claude-sonnet-5' }
    }
  },
  {
    type: 'account_balance_data', source: 'extension.account', timestamp: 1,
    payload: {
      openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } },
      fetchedAt: 1
    }
  },
  {
    type: 'token_usage_update', source: 'extension.handler', timestamp: 1,
    payload: { totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }
  }
];

const PINNED_WORD = 'alice';
const scenarios = [
  { name: 'empty', messages: [...chrome, message('lightbox_board', { board: null })] },
  {
    name: 'board',
    messages: [...chrome, message('lightbox_board', { board: built.board })],
    // Pin one word, park the pointer on the header so nothing else is hovered,
    // and scroll back to the top (the click scrolled the word into view).
    act: async (page) => {
      const term = built.board.measured.topWords.find((word) => word.term === PINNED_WORD);
      await page.click(`button[title="${term.term} ×${term.count}"]`);
      await page.mouse.move(4, 4);
      await page.evaluate(() => {
        document.querySelectorAll('.pm-ws, .pm-lb-scroll').forEach((element) => { element.scrollTop = 0; });
      });
    }
  },
  {
    name: 'refused',
    messages: [...chrome, message('lightbox_board', { board: null }), message('lightbox_source_refused', { refusal: refused.refusal })]
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1100 },
  { tag: '1000', width: 1000, height: 1100 },
  { tag: '500', width: 500, height: 1400 }
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await page.goto('file://' + pagePath);
      await page.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      for (const entry of scenario.messages) {
        await page.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await page.waitForTimeout(300);
      if (scenario.act) {
        await scenario.act(page);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      let previous = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      let stable = false;
      for (let attempt = 0; attempt < 8 && !stable; attempt++) {
        await page.waitForTimeout(250);
        const next = await page.screenshot({ animations: 'disabled', caret: 'hide' });
        stable = Buffer.compare(previous, next) === 0;
        previous = next;
      }
      if (!stable) { errors.push(`${scenario.name}@${viewport.tag}: never settled`); }
      fs.writeFileSync(path.join(outDir, `lightbox-${scenario.name}-${viewport.tag}.png`), previous);
      facts[`${scenario.name}@${viewport.tag}`] = await page.evaluate(() => {
        const columns = [...document.querySelectorAll('.pm-lb-col')];
        const rect = (selector) => {
          const element = document.querySelector(selector);
          if (!element) { return null; }
          const box = element.getBoundingClientRect();
          return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) };
        };
        return {
          columns: columns.length,
          litColumns: columns.flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : [])),
          focusLine: document.querySelector('.pm-lb-ribbon-focus')?.textContent ?? null,
          inspectorTitle: document.querySelector('.pm-lb-inspector-title')?.textContent ?? null,
          readButtonDisabled: document.querySelector('.pm-lb-run .pm-lb-primary')?.disabled ?? null,
          rail: rect('.pm-ws-rail'),
          main: rect('.pm-ws-main'),
          aside: rect('.pm-ws-aside'),
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          posted: window.__pmPosted.map((m) => `${m.type} ${m.source}`)
        };
      });
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), JSON.stringify(facts, null, 2));
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n'));
  console.log(`done; ${errors.length} page errors`);
})().catch((e) => { console.error(e); process.exit(1); });
