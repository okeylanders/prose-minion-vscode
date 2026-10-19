/*
 * Lightbox Slice 2B visual harness, adapted from
 * ../lightbox-slice-2a-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would for the Lightbox surface, replays the
 * host's messages for each reading state, and screenshots each state once two
 * consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/*.json are real host output: the production LightboxService,
 * LightboxReadingHandler, runner, codec and quote verifier built them, with
 * only the provider played (see README.md and tools/build-readings.test.ts).
 *
 * The estimate is only ever an answer to the tab's own request (PR #149
 * F-03), so it is not replayed: the stubbed API answers each
 * `lightbox_set_lenses` the tab posts with the host's recorded answer for
 * those lenses (`estimates` in the state file), echoing the request's id.
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
const states = path.join(__dirname, 'states');
const chapter = JSON.parse(fs.readFileSync(path.join(states, 'chapter.json'), 'utf8'));
const withheld = JSON.parse(fs.readFileSync(path.join(states, 'withheld.json'), 'utf8'));
const book = JSON.parse(fs.readFileSync(path.join(states, 'book.json'), 'utf8'));
/** Everything but the estimate, which the stub answers per request. */
const replayed = (messages) => messages.filter((message) => message.type !== 'lightbox_run_estimate');

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
    window.__pmEstimates = {};
    window.__pmVsCodeApi = {
      postMessage: (m) => {
        window.__pmPosted.push(m);
        // The host answers an estimate request for these lenses, echoing its id.
        const answer = m.type === 'lightbox_set_lenses' && window.__pmEstimates[(m.payload.lensesOff || []).slice().sort().join(',')];
        if (answer) {
          setTimeout(() => window.postMessage({
            type: 'lightbox_run_estimate', source: 'extension.lightbox', timestamp: 1,
            payload: Object.assign({}, answer, { requestId: m.payload.requestId })
          }, '*'), 0);
        }
      },
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

// The stub model the states were estimated against (see README.md).
const chrome = [
  { type: 'api_key_status', source: 'extension.configuration', timestamp: 1, payload: { hasSavedKey: true } },
  {
    type: 'model_data', source: 'extension.configuration', timestamp: 1,
    payload: {
      options: [{ id: 'provider/reader-model', label: 'Reader model (stub)', description: '' }],
      selections: { assistant: 'provider/reader-model' }
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

const PINNED_MOTIF = 'Going down';
const MOTIF_LENS = 'Theme & motif';
const toTop = async (page) => {
  await page.mouse.move(4, 4);
  await page.evaluate(() => {
    document.querySelectorAll('.pm-ws, .pm-lb-scroll').forEach((element) => { element.scrollTop = 0; });
  });
};
// The board's own "Read" filter: readings only, so they sit under the ribbon.
const showReadings = async (page) => {
  await page.locator('.pm-lb-segment', { hasText: /^Read$/ }).click();
  await toTop(page);
};
const pinMotif = async (page) => {
  await page.locator('.pm-lb-segment', { hasText: /^Read$/ }).click();
  await page.locator('.pm-lb-motif-title', { hasText: PINNED_MOTIF }).first().click();
  await toTop(page);
};

const read = [...chapter.idle, ...chapter.running, ...chapter.done];
const scenarios = [
  // The tab is open on Chapter I: lenses synced, the estimate on the press,
  // one context file added.
  { name: 'idle', estimates: chapter.estimates, messages: [...chrome, ...chapter.idle], act: toTop },
  // Read pressed; group A is back, B and C are still reading. Shown with
  // the board's "Read" filter, so the readings sit under the ribbon.
  { name: 'running', estimates: chapter.estimates, messages: [...chrome, ...chapter.idle, ...chapter.running], act: showReadings },
  // Every group back; "Read" filter, the motif "Going down" pinned. The
  // board, then (where the inspector stacks under the board) the inspector
  // scrolled into view; at 1440 it already sits beside the board.
  { name: 'done', estimates: chapter.estimates, messages: [...chrome, ...read], act: pinMotif },
  {
    name: 'done-inspector',
    widths: ['1000', '500'],
    estimates: chapter.estimates,
    messages: [...chrome, ...read],
    act: async (page) => {
      await pinMotif(page);
      await page.evaluate(() => document.querySelector('.pm-lb-inspector')?.scrollIntoView({ block: 'start' }));
    }
  },
  // PR #149 F-04: the chapter read with group A's headline quoting nowhere
  // in it. The plain heading stays; the withheld headline sits under it.
  { name: 'headline-withheld', estimates: withheld.estimates, messages: [...chrome, ...withheld['headline-withheld']], act: showReadings },
  // PR #149 F-08: "Going down" pinned, then the motif lens turned off. The
  // tile's re-read is disabled with the reason; the inspector scrolled into view.
  {
    name: 'reread-off',
    estimates: chapter.estimates,
    messages: [...chrome, ...read],
    act: async (page) => {
      await pinMotif(page);
      await page.locator('.pm-lb-lens-row', { hasText: MOTIF_LENS }).locator('input').click();
      await page.waitForTimeout(200);
      await toTop(page);
      await page.evaluate(() => document.querySelector('.pm-lb-inspector-actions')?.scrollIntoView({ block: 'center' }));
    }
  },
  // The whole book against a 32,768-token window: no call fits.
  { name: 'too-large', estimates: book.estimates, messages: [...chrome, ...book['too-large']], act: toTop }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1600 },
  { tag: '1000', width: 1000, height: 1600 },
  { tag: '500', width: 500, height: 1800 }
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios.filter((entry) => !entry.widths || entry.widths.includes(viewport.tag))) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await page.goto('file://' + pagePath);
      await page.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      await page.evaluate((estimates) => { window.__pmEstimates = estimates; }, scenario.estimates);
      for (const entry of replayed(scenario.messages)) {
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
        const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
        const all = (selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent.trim());
        const rect = (selector) => {
          const element = document.querySelector(selector);
          if (!element) { return null; }
          const box = element.getBoundingClientRect();
          return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) };
        };
        const press = [...document.querySelectorAll('.pm-lb-run button')].find((button) => !/Stop/.test(button.textContent));
        const inspector = document.querySelector('.pm-lb-inspector');
        const reread = inspector?.querySelector('.pm-lb-inspector-actions button');
        return {
          runLine: text('.pm-lb-run'),
          press: press ? { label: press.textContent.trim(), disabled: press.disabled, describedBy: press.getAttribute('aria-describedby') } : null,
          reason: text('#pm-lb-run-reason'),
          warning: text('.pm-lb-run-warning'),
          lensCost: text('[aria-label="Lenses"] .pm-lb-meta'),
          contextFiles: all('.pm-lb-context-path'),
          skeletons: document.querySelectorAll('.pm-lb-skeleton').length,
          headline: text('.pm-lb-headline'),
          headlineState: text('[aria-label="Headline reading"]'),
          motifs: all('.pm-lb-motif-title'),
          tensionCells: document.querySelectorAll('.pm-lb-col-tension i').length,
          tensionNote: all('.pm-lb-ribbon-note').find((note) => note.startsWith('Tension')) ?? null,
          inspectorTitle: inspector?.querySelector('.pm-lb-inspector-title')?.textContent ?? null,
          evidence: [...(inspector?.querySelectorAll('.pm-lb-evidence') ?? [])].map((element) => element.textContent.trim()),
          withheld: [...(inspector?.querySelectorAll('.pm-lb-withheld-quote-card') ?? [])].map((element) => element.textContent.trim()),
          friction: inspector?.querySelector('.pm-lb-friction')?.textContent?.trim() ?? null,
          reread: reread ? {
            disabled: reread.disabled,
            note: inspector.querySelector('.pm-lb-inspector-actions .pm-lb-run-note')?.textContent ?? null
          } : null,
          inspector: rect('.pm-lb-inspector'),
          rail: rect('.pm-ws-rail'),
          main: rect('.pm-ws-main'),
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
