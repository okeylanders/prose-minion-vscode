/*
 * Sentence-rule capture, cut down from
 * ../lightbox-slice-4e-visual/harness.js to its `paragraph` state: renders a
 * built webview bundle in Chromium as the Lightbox surface, replays one
 * board's host messages, pins one paragraph on the ribbon as the writer
 * would, and screenshots the inspector once two consecutive frames are
 * byte-identical.
 *
 *   node harness.js <bundle.js> <states.json> <outDir> <tag>
 *
 * Writes <outDir>/inspector-<tag>.png, facts-<tag>.json and errors-<tag>.txt.
 * The states are real host output (tools/build-states.test.ts). The stubbed
 * API answers the tab's passage request with the host's recorded answer,
 * echoing the request's id, and its estimate request with the recorded
 * estimate.
 *
 * It fails rather than skips: an inspector whose claim does not state the
 * board's own words and sentences for the paragraph, a missing well, a
 * request the recordings cannot answer, horizontal overflow, a page error or
 * a state that never settles is written to errors-<tag>.txt, and the
 * process exits 1.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, statesFile, outDir, tag] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const states = JSON.parse(fs.readFileSync(statesFile, 'utf8'));
const board = states.idle.find((message) => message.type === 'lightbox_board').payload.board;
const pinned = states.items.pinnedParagraph;
const metric = board.paragraphs[pinned - 1];

const CANONICAL = `function canonical(value) {
  if (Array.isArray(value)) { return '[' + value.map(canonical).join(',') + ']'; }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}`;

const page = `<!DOCTYPE html>
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
  <div id="root" data-pm-surface="lightbox" data-pm-frame="fulltab"><span style="padding:8px">Loading…</span></div>
  <script>
    ${CANONICAL}
    window.__pmPosted = [];
    window.__pmMissing = [];
    window.__pmEstimates = [];
    window.__pmPassages = {};
    const answer = (message) => setTimeout(() => window.postMessage(message, '*'), 0);
    window.__pmVsCodeApi = {
      postMessage: (m) => {
        window.__pmPosted.push(m);
        if (m.type === 'lightbox_set_lenses') {
          for (const estimate of window.__pmEstimates) {
            answer({ type: 'lightbox_run_estimate', source: 'extension.lightbox', timestamp: 1, payload: Object.assign({}, estimate, { requestId: m.payload.requestId }) });
          }
        }
        if (m.type === 'lightbox_request_passage') {
          const key = m.payload.boardId + ' ' + canonical(m.payload.item);
          const recorded = window.__pmPassages[key];
          if (!recorded) { window.__pmMissing.push(key); return; }
          answer({ type: 'lightbox_passage', source: 'extension.lightbox', timestamp: 1, payload: Object.assign({}, recorded, { requestId: m.payload.requestId }) });
        }
      },
      getState: () => undefined,
      setState: () => undefined
    };
    window.acquireVsCodeApi = () => window.__pmVsCodeApi;
    window.proseMinionAssets = { vhsLoadingGif: '', loadingGifs: [], loadingGifList: [], loadingGifCredits: {}, noticeShots: {} };
  </script>
  <script src="file://${path.resolve(bundle)}"></script>
</body>
</html>`;
const pageFile = path.resolve(outDir, `lightbox-${tag}.html`);
fs.writeFileSync(pageFile, page);

const chrome = [
  { type: 'api_key_status', source: 'extension.configuration', timestamp: 1, payload: { hasSavedKey: true } },
  {
    type: 'model_data', source: 'extension.configuration', timestamp: 1,
    payload: {
      options: [{ id: 'provider/reader-model', label: 'Reader model (stub)', description: '' }],
      selections: { assistant: 'provider/reader-model', widget: 'provider/reader-model' }
    }
  },
  {
    type: 'account_balance_data', source: 'extension.account', timestamp: 1,
    payload: { openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } }, fetchedAt: 1 }
  },
  { type: 'token_usage_update', source: 'extension.handler', timestamp: 1, payload: { totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } } }
];

const pageFacts = () => {
  const clean = (value) => (value == null ? null : value.trim().replace(/\s+/g, ' '));
  const inspector = document.querySelector('.pm-lb-inspector');
  const well = inspector?.querySelector('.pm-lb-passage .pm-lb-well');
  return {
    title: clean(inspector?.querySelector('.pm-lb-inspector-title')?.textContent),
    where: clean(inspector?.querySelector('.pm-lb-inspector-where')?.textContent),
    claim: clean(inspector?.querySelector('.pm-lb-inspector-claim')?.textContent),
    region: well?.getAttribute('aria-label') ?? null,
    text: well ? clean(well.textContent) : null,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    missing: window.__pmMissing
  };
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const tab = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  tab.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`console: ${m.text()}`); } });
  await tab.goto('file://' + pageFile);
  await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => errors.push('the frame never rendered'));
  await tab.evaluate(({ estimates, passages }) => {
    window.__pmEstimates = estimates;
    window.__pmPassages = passages;
  }, { estimates: states.estimates, passages: states.passages });
  for (const entry of [...chrome, ...states.idle]) {
    await tab.evaluate((m) => window.postMessage(m, '*'), entry);
  }
  await tab.waitForTimeout(250);
  try {
    const button = tab.getByRole('button', { name: `Paragraph ${pinned}`, exact: true }).first();
    await button.scrollIntoViewIfNeeded({ timeout: 5000 });
    await button.click({ timeout: 5000 });
  } catch (error) {
    errors.push(`pinning ¶${pinned}: ${error.message.split('\n')[0]}`);
  }
  await tab.mouse.move(4, 4);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(600);
  const inspector = tab.locator('.pm-lb-inspector').first();
  const shoot = () => inspector.screenshot({ animations: 'disabled', caret: 'hide' });
  let previous = await shoot();
  let stable = false;
  for (let attempt = 0; attempt < 8 && !stable; attempt++) {
    await tab.waitForTimeout(250);
    const next = await shoot();
    stable = Buffer.compare(previous, next) === 0;
    previous = next;
  }
  if (!stable) { errors.push('never settled'); }
  fs.writeFileSync(path.join(outDir, `inspector-${tag}.png`), previous);
  const facts = await tab.evaluate(pageFacts);
  const sentences = `${metric.sentences} sentence${metric.sentences === 1 ? '' : 's'}`;
  if (!facts.claim || !facts.claim.startsWith(`${metric.words} words in ${sentences}`)) {
    errors.push(`the claim reads "${facts.claim}", not ${metric.words} words in ${sentences}`);
  }
  if (facts.region !== `Text of ¶${pinned}`) { errors.push(`the well is "${facts.region}"`); }
  if (facts.missing.length > 0) { errors.push(`no recorded answer for ${facts.missing.join('; ')}`); }
  if (facts.horizontalOverflow) { errors.push('the document overflows horizontally'); }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `facts-${tag}.json`), `${JSON.stringify({ board: { paragraph: metric }, page: facts }, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, `errors-${tag}.txt`), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`${tag}: ${errors.length} errors`);
  process.exitCode = errors.length > 0 ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
