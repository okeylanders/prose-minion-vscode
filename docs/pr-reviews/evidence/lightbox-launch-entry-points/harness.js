/*
 * Lightbox launch entry points visual harness, adapted from
 * ../lightbox-slice-2a-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the sidebar (an unstamped #root)
 * and as the Lightbox surface, and screenshots each state once two
 * consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * The sidebar is shot on the Analysis tab, then its Lightbox button is
 * pressed and what the page posted is recorded in facts.json. The Lightbox
 * is shot with nothing boarded (`lightbox_board` with a null board, the
 * host's answer before any source). The model is the Slice 3 harness's stub,
 * so no real model's name is drawn; nothing is sent to a provider.
 */
const path = require('path');
const fs = require('fs');
// Resolve Playwright from the project, then PLAYWRIGHT_MODULE, then this
// container's global install. Chromium comes from CHROMIUM_PATH or the
// container's /opt/pw-browsers/chromium.
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

/** The host's document for a surface: the sidebar's #root is unstamped; a full tab stamps its surface and frame. */
const page = (surface, title) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body { background: #1e1e1e; --vscode-font-family: sans-serif; --vscode-foreground: #ccc; }
    #root { height: 100%; }
  </style>
</head>
<body>
  ${surface === 'sidebar'
    ? '<div id="root"><span style="padding:8px">Loading…</span></div>'
    : `<div id="root" data-pm-surface="${surface}" data-pm-frame="fulltab"><span style="padding:8px">Loading…</span></div>`}
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

const pages = {
  sidebar: path.resolve(outDir, 'sidebar.html'),
  lightbox: path.resolve(outDir, 'lightbox.html')
};
fs.writeFileSync(pages.sidebar, page('sidebar', 'Prose Minion'));
fs.writeFileSync(pages.lightbox, page('lightbox', 'Prose Minion Lightbox'));

const STUB_MODEL = 'provider/reader-model';
const chrome = [
  { type: 'api_key_status', source: 'extension.configuration', timestamp: 1, payload: { hasSavedKey: true } },
  {
    type: 'model_data', source: 'extension.configuration', timestamp: 1,
    payload: {
      options: [{ id: STUB_MODEL, label: 'Reader model (stub)', description: '' }],
      selections: { assistant: STUB_MODEL, dictionary: STUB_MODEL, context: STUB_MODEL, category: STUB_MODEL, widget: STUB_MODEL }
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

const shots = [
  // The sidebar at the design's sidebar width (430 px), wider (560 px) and narrow (320 px).
  { name: 'sidebar-analysis', surface: 'sidebar', ready: '.assistant-title-row', messages: chrome, pressLightbox: true, viewports: [
    { tag: '430', width: 430, height: 820 },
    { tag: '560', width: 560, height: 820 },
    { tag: '320', width: 320, height: 820 }
  ] },
  {
    name: 'lightbox-empty', surface: 'lightbox', ready: '.pm-ws',
    messages: [...chrome, { type: 'lightbox_board', source: 'extension.lightbox', timestamp: 1, payload: { board: null, refusal: null } }],
    viewports: [
      { tag: '1440', width: 1440, height: 1100 },
      { tag: '1000', width: 1000, height: 1100 },
      { tag: '500', width: 500, height: 1400 }
    ]
  }
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  for (const shot of shots) {
    for (const viewport of shot.viewports) {
      const key = `${shot.name}@${viewport.tag}`;
      const tab = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      tab.on('pageerror', (e) => errors.push(`${key}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${key} console: ${m.text()}`); } });
      await tab.goto('file://' + pages[shot.surface]);
      await tab.waitForSelector(shot.ready, { timeout: 10000 }).catch(() => errors.push(`${key}: ${shot.ready} never rendered`));
      for (const entry of shot.messages) {
        await tab.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await tab.waitForTimeout(300);
      await tab.mouse.move(4, 4);
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(600);
      let previous = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
      let stable = false;
      for (let attempt = 0; attempt < 8 && !stable; attempt++) {
        await tab.waitForTimeout(250);
        const next = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
        stable = Buffer.compare(previous, next) === 0;
        previous = next;
      }
      if (!stable) { errors.push(`${key}: never settled`); }
      fs.writeFileSync(path.join(outDir, `${shot.name}-${viewport.tag}.png`), previous);

      const seen = await tab.evaluate(() => {
        const rect = (element) => {
          if (!element) { return null; }
          const box = element.getBoundingClientRect();
          return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
        };
        const squash = (text) => (text || '').replace(/\s+/g, ' ').trim();
        const launchers = [...document.querySelectorAll('.surface-launch-button')];
        return {
          title: rect(document.querySelector('.assistant-title-row > h2')),
          launchers: launchers.map((button) => ({ label: squash(button.textContent), title: button.title, box: rect(button) })),
          sourceEmpty: squash(document.querySelector('.pm-lb-source-empty')?.textContent) || null,
          welcome: squash(document.querySelector('.pm-lb-sub')?.textContent) || null,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });
      facts[key] = seen;

      if (shot.pressLightbox) {
        const before = await tab.evaluate(() => window.__pmPosted.length);
        await tab.click('.surface-launch-button[title="Open the Lightbox editor tab"]');
        facts[key].postedOnLightboxPress = await tab.evaluate(
          (from) => window.__pmPosted.slice(from).map((m) => ({ type: m.type, source: m.source, payload: m.payload })),
          before
        );
      }
      await tab.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), JSON.stringify(facts, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n') + (errors.length ? '\n' : ''));
  console.log(`done; ${errors.length} page errors`);
})().catch((e) => { console.error(e); process.exit(1); });
