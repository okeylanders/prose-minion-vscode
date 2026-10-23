/*
 * The Workshop's sessions menu and session browser, before and after Lightbox
 * Slice 5A.2 made them the full tabs' shared SavedItemsMenu and
 * SavedItemBrowserModal and moved their rules from styles/workshop/shell.css
 * into styles/fulltab/savedItems.css and savedBrowser.css. Adapted from
 * ../lightbox-source-picker/harness.js, which compared the Workshop's excerpt
 * picker the same way when modal.css moved.
 *
 *   node workshop-harness.js <head webview.js> <base webview.js> <outDir>
 *
 * Renders each bundle as the Workshop (`data-pm-surface="workshop"` and
 * `data-pm-frame="fulltab"`, the two stamps webviewHtml.ts gives the editor
 * tab), answers `workshop_list_sessions` with four named sessions and the
 * current room, and drives five states at 1440, 1000 and 500 px: the menu
 * open, the browser, the browser grouped by excerpt, a row's rename field,
 * and a row's delete confirm. For each it writes a screenshot
 * (`workshop/<state>-{before,after}-<width>.png`) and records the SHA-256 of
 * the menu's or dialog's markup and of every computed style property of
 * every element in it, with its box. workshop-facts.json compares the two
 * bundles state by state; any difference in markup, computed style or box,
 * or any page error, goes to workshop-errors.txt, and the harness exits 1.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [headBundle, baseBundle, outDir] = process.argv.slice(2);
fs.mkdirSync(path.join(outDir, 'workshop'), { recursive: true });
const NOW = Date.parse('2026-10-23T15:00:00.000Z');

const page = (bundle) => `<!DOCTYPE html>
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
  <div id="root" data-pm-surface="workshop" data-pm-frame="fulltab"><span style="padding:8px">Loading the Workshop…</span></div>
  <script>
    window.__pmPosted = [];
    window.__pmVsCodeApi = {
      postMessage: (m) => {
        window.__pmPosted.push(m);
        if (m.type === 'workshop_list_sessions') {
          setTimeout(() => window.postMessage({
            type: 'workshop_sessions_data', source: 'extension.workshop', timestamp: 1,
            payload: Object.assign({}, window.__pmSessions, { requestId: m.payload.requestId })
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

const message = (type, payload, source) => ({ type, source, timestamp: 1, payload });
const chrome = [
  message('api_key_status', { hasSavedKey: true }, 'extension.configuration'),
  message('model_data', {
    options: [{ id: 'provider/model-v1', label: 'Reader model (stub)', description: '' }],
    selections: { assistant: 'provider/model-v1' }
  }, 'extension.configuration'),
  message('account_balance_data', {
    openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } }, fetchedAt: 1
  }, 'extension.account'),
  message('token_usage_update', { totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }, 'extension.handler')
];
const sessionState = message('workshop_session_state', {
  session: {
    scope: null, participantSubjectReady: true, excerptVersion: 0, replacementCount: 0, roomRevision: 1, contextRevision: 0,
    contextAttachments: [], pendingMessageAttachments: [], widgetConfigs: [], standingDirectives: [], todos: [], turns: [],
    turnRewindability: {}, totalTurns: 0, truncatedTurns: 0, roomHasMemory: false,
    participants: { host: { personaId: 'jill', hasConversation: false }, toolSidecars: [], personaGuests: [], chatTarget: { kind: 'host' } }
  },
  persistence: { available: true, degradedConversationKeys: [] }
}, 'extension.workshop');

const summary = (overrides) => ({
  sessionId: 'current-id', title: 'A room', fileName: 'current.json', kind: 'current',
  startedAt: NOW - 3_600_000, updatedAt: NOW - 600_000, timezone: 'UTC',
  hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 14, excerptWordCount: 508,
  excerptLabel: 'Drafts/alice-1.md', excerptIdentity: 'chapters:Drafts/alice-1.md', preview: 'A preview line.',
  ...overrides
});
const sessions = {
  available: true,
  current: summary({}),
  sessions: [
    summary({ sessionId: 'n1', title: 'First named', kind: 'named', fileName: 'n1.json', updatedAt: NOW - 3_000_000, hostPersonaId: 'margot', excerptLabel: 'Drafts/alice-2.md', excerptIdentity: 'chapters:Drafts/alice-2.md' }),
    summary({ sessionId: 'n2', title: 'Second named', kind: 'named', fileName: 'n2.json', updatedAt: NOW - 3 * 86_400_000, scope: 'open', preview: undefined }),
    summary({ sessionId: 'n3', title: 'Third named', kind: 'named', fileName: 'n3.json', updatedAt: NOW - 30 * 86_400_000, scope: null, excerptLabel: undefined, excerptIdentity: undefined }),
    summary({ sessionId: 'n4', title: 'Fourth named', kind: 'named', fileName: 'n4.json', updatedAt: NOW - 40 * 86_400_000, scope: 'excerpt', hostPersonaId: 'dev' })
  ]
};

const settle = (tab) => tab.waitForTimeout(500);
const openMenu = async (tab) => {
  await tab.getByTitle('Session commands and recent Workshop rooms', { exact: true }).click();
  await settle(tab);
};
const openBrowser = async (tab) => {
  await openMenu(tab);
  await tab.getByRole('menuitem', { name: 'Browse all sessions…', exact: true }).click();
  await settle(tab);
};
const rowAction = (action, title) => async (tab) => {
  await openBrowser(tab);
  await tab.locator('.pm-ws-session-browser-row', { has: tab.locator(`strong[title="${title}"]`) }).hover();
  await tab.getByRole('button', { name: `${action} ${title}`, exact: true }).click();
  await settle(tab);
};
const states = [
  { name: 'menu', root: '.pm-ws-sessions-menu-wrap', act: openMenu },
  { name: 'browser', root: '[role="dialog"]', act: openBrowser },
  {
    name: 'browser-excerpt', root: '[role="dialog"]',
    act: async (tab) => {
      await openBrowser(tab);
      await tab.locator('.pm-ws-sessions-group-control button', { hasText: 'Excerpt' }).click();
      await settle(tab);
    }
  },
  { name: 'browser-rename', root: '[role="dialog"]', act: rowAction('Rename', 'Second named') },
  { name: 'browser-delete', root: '[role="dialog"]', act: rowAction('Delete', 'Third named') }
];
const viewports = [
  { tag: '1440', width: 1440, height: 1000 },
  { tag: '1000', width: 1000, height: 1000 },
  { tag: '500', width: 500, height: 1100 }
];

/** In the page: the root's markup, and each element's computed style and box. */
const read = (selector) => {
  const root = document.querySelector(selector);
  if (!root) { return null; }
  const elements = [root, ...root.querySelectorAll('*')];
  return {
    html: root.outerHTML,
    elements: elements.map((element) => {
      const style = getComputedStyle(element);
      const properties = [];
      for (let index = 0; index < style.length; index++) {
        properties.push(`${style[index]}:${style.getPropertyValue(style[index])}`);
      }
      const box = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className : element.getAttribute('class'),
        // Sorted: Chromium lists custom properties in the order the sheets declared them, which moving a sheet changes.
        style: properties.sort().join(';'),
        box: [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 100) / 100).join(',')
      };
    }),
    offscreen: (() => {
      const box = (root.querySelector('.pm-ws-sessions-menu') ?? root.querySelector('.pm-ws-session-browser-layout') ?? root).getBoundingClientRect();
      return box.left < -0.5 || box.right > window.innerWidth + 0.5;
    })(),
    focused: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 60) ?? null
  };
};
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const bundles = { after: headBundle, before: baseBundle };
  const errors = [];
  const seen = {};
  for (const [which, bundle] of Object.entries(bundles)) {
    const html = path.resolve(outDir, `workshop-${which}.html`);
    fs.writeFileSync(html, page(bundle));
    for (const viewport of viewports) {
      for (const state of states) {
        const key = `${state.name}@${viewport.tag}`;
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, timezoneId: 'UTC', locale: 'en-US' });
        await context.clock.setFixedTime(new Date(NOW));
        const tab = await context.newPage();
        tab.on('pageerror', (e) => errors.push(`${key} ${which}: ${e.message}`));
        tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${key} ${which} console: ${m.text()}`); } });
        await tab.addInitScript((data) => { window.__pmSessions = data; }, sessions);
        await tab.goto('file://' + html);
        await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => errors.push(`${key} ${which}: .pm-ws never rendered`));
        for (const entry of [...chrome, sessionState]) {
          await tab.evaluate((m) => window.postMessage(m, '*'), entry);
        }
        await tab.waitForTimeout(500);
        try {
          await state.act(tab);
        } catch (error) {
          errors.push(`${key} ${which}: could not act: ${error.message.split('\n')[0]}`);
        }
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(400);
        let previous = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
        let stable = false;
        for (let attempt = 0; attempt < 8 && !stable; attempt++) {
          await tab.waitForTimeout(250);
          const next = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
          stable = Buffer.compare(previous, next) === 0;
          previous = next;
        }
        if (!stable) { errors.push(`${key} ${which}: never settled`); }
        fs.writeFileSync(path.join(outDir, 'workshop', `${state.name}-${which}-${viewport.tag}.png`), previous);
        const facts = await tab.evaluate(read, state.root);
        seen[key] = { ...(seen[key] ?? {}), [which]: facts };
        if (!facts) { errors.push(`${key} ${which}: ${state.root} never rendered`); }
        await context.close();
      }
    }
  }
  await browser.close();

  const report = {};
  for (const [key, { before, after }] of Object.entries(seen)) {
    if (!before || !after) { continue; }
    const differing = [];
    const count = Math.max(before.elements.length, after.elements.length);
    for (let index = 0; index < count; index++) {
      const a = before.elements[index];
      const b = after.elements[index];
      if (!a || !b) { differing.push({ index, missing: a ? 'after' : 'before' }); continue; }
      if (a.style !== b.style || a.box !== b.box || a.className !== b.className) {
        const props = (text) => new Map(text.split(';').map((entry) => [entry.slice(0, entry.indexOf(':')), entry.slice(entry.indexOf(':') + 1)]));
        const pa = props(a.style);
        const pb = props(b.style);
        const changed = [...new Set([...pa.keys(), ...pb.keys()])].filter((name) => pa.get(name) !== pb.get(name))
          .map((name) => `${name}: ${pa.get(name)} → ${pb.get(name)}`);
        differing.push({ index, element: `${b.tag}.${b.className}`, changed, box: a.box === b.box ? undefined : `${a.box} → ${b.box}` });
      }
    }
    report[key] = {
      elements: after.elements.length,
      markup: sha(before.html) === sha(after.html) ? 'identical' : 'DIFFERENT',
      markupSha256: sha(after.html),
      computedStyles: differing.length === 0 ? 'identical' : `${differing.length} elements differ`,
      styleSha256: sha(after.elements.map((element) => element.style).join('\n')),
      boxes: before.elements.every((element, index) => element.box === after.elements[index]?.box) ? 'identical' : 'DIFFERENT',
      focused: { before: before.focused, after: after.focused },
      offscreen: { before: before.offscreen, after: after.offscreen },
      ...(differing.length > 0 ? { differing: differing.slice(0, 12) } : {})
    };
    if (report[key].markup !== 'identical') { errors.push(`${key}: markup differs`); }
    if (differing.length > 0) { errors.push(`${key}: ${differing.length} elements' computed style or box differ`); }
    if (before.focused !== after.focused) { errors.push(`${key}: focus on "${after.focused}", not "${before.focused}"`); }
  }
  fs.writeFileSync(path.join(outDir, 'workshop-facts.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'workshop-errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see workshop-errors.txt)`);
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
