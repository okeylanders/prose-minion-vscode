/*
 * Lightbox Slice 1 visual harness: renders a built webview bundle in Chromium
 * the way webviewHtml.ts would, drives a few Workshop states through window
 * messages, and screenshots each. Usage:
 *   node harness.js <bundle.js> <outDir> [rootAttrs]
 */
const path = require('path');
const fs = require('fs');
// Resolve Playwright from the project, then PLAYWRIGHT_MODULE, then this
// container's global install. Chromium comes from PLAYWRIGHT_BROWSERS_PATH.
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir, rootAttrsArg] = process.argv.slice(2);
const rootAttrs = rootAttrsArg || 'data-pm-surface="workshop"';
fs.mkdirSync(outDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prose Minion Workshop</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body { background: #1e1e1e; --vscode-font-family: sans-serif; --vscode-foreground: #ccc; }
    #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root" ${rootAttrs}><span style="padding:8px">Loading the Workshop…</span></div>
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

const session = (overrides) => ({
  type: 'workshop_session_state',
  source: 'extension.workshop',
  timestamp: 1,
  payload: {
    session: {
      scope: 'open',
      participantSubjectReady: true,
      excerptVersion: 0,
      replacementCount: 0,
      roomRevision: 1,
      contextRevision: 0,
      contextAttachments: [],
      pendingMessageAttachments: [],
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
      turns: [],
      turnRewindability: {},
      totalTurns: 0,
      truncatedTurns: 0,
      roomHasMemory: false,
      participants: {
        host: { personaId: 'jill', hasConversation: false },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      },
      conversationBehavior: {
        responseLength: 'standard', tone: 'balanced', intensity: 'standard'
      },
      ...overrides
    },
    writerProfile: { enabled: false, text: '' },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  }
});

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
    payload: { totals: { promptTokens: 1200, completionTokens: 345, totalTokens: 1545 }, lastRequestCostUsd: 0.0123 }
  }
];

const scenarios = [
  { name: 'initial', messages: [] },
  { name: 'empty', messages: [...chrome, session({ scope: null })] },
  {
    name: 'excerpt',
    messages: [...chrome, session({
      scope: 'excerpt',
      excerptVersion: 1,
      excerpt: {
        text: 'It was a bright cold day in April, and the clocks were striking thirteen.\n\nHe walked on.',
        version: 1,
        source: { kind: 'file', relativePath: 'Drafts/chapter-1.md' },
        pinnedAt: 1
      }
    })]
  },
  {
    name: 'paused',
    messages: [
      ...chrome.slice(1),
      { type: 'api_key_status', source: 'extension.configuration', timestamp: 2, payload: { hasSavedKey: false } },
      session({ scope: null })
    ]
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 900 },
  { tag: '1000', width: 1000, height: 800 },
  { tag: '500', width: 500, height: 800 }
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await page.goto('file://' + pagePath);
      await page.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      for (const message of scenario.messages) {
        await page.evaluate((m) => window.postMessage(m, '*'), message);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const file = path.join(outDir, `${scenario.name}-${viewport.tag}.png`);
      // Settle: keep shooting until two consecutive frames are byte-identical.
      let previous = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      let stable = false;
      for (let attempt = 0; attempt < 8 && !stable; attempt++) {
        await page.waitForTimeout(250);
        const next = await page.screenshot({ animations: 'disabled', caret: 'hide' });
        stable = Buffer.compare(previous, next) === 0;
        previous = next;
      }
      if (!stable) { errors.push(`${scenario.name}@${viewport.tag}: never settled`); }
      fs.writeFileSync(file, previous);
      if (viewport.tag === '1440') {
        const dom = await page.evaluate(() => document.getElementById('root').outerHTML);
        fs.writeFileSync(path.join(outDir, `${scenario.name}-${viewport.tag}.html`), dom);
        const posted = await page.evaluate(() => window.__pmPosted.map((m) => `${m.type} ${m.source}`));
        fs.writeFileSync(path.join(outDir, `${scenario.name}-${viewport.tag}.posted.txt`), posted.join('\n'));
      }
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n'));
  console.log(`done; ${errors.length} page errors`);
})().catch((e) => { console.error(e); process.exit(1); });
