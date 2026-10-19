/*
 * Lightbox Slice 3 visual harness, adapted from
 * ../lightbox-slice-2b-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface and as the
 * Workshop surface, replays the host's messages for each state, and
 * screenshots each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/*.json are real host output: the production LightboxService,
 * LightboxHandler, LightboxReadingHandler, runner, codec, quote verifier,
 * term counter, stale-readings carry and the Workshop's own Lexical Gravity
 * handler built them, with only the provider played (see README.md and
 * tools/build-gravity.test.ts).
 *
 * The estimate is only ever an answer to the tab's own request (PR #149
 * F-03), so it is not replayed: as in the Slice 2B harness, the stubbed API
 * answers each `lightbox_set_lenses` the tab posts with the host's recorded
 * answer for those lenses, echoing the request's id.
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
const workshop = JSON.parse(fs.readFileSync(path.join(states, 'workshop.json'), 'utf8'));
/** Everything but the estimate, which the stub answers per request. */
const replayed = (messages) => messages.filter((message) => message.type !== 'lightbox_run_estimate');

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
  <div id="root" data-pm-surface="${surface}" data-pm-frame="fulltab"><span style="padding:8px">Loading…</span></div>
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

const pages = {
  lightbox: path.resolve(outDir, 'lightbox.html'),
  workshop: path.resolve(outDir, 'workshop.html')
};
fs.writeFileSync(pages.lightbox, page('lightbox', 'Prose Minion Lightbox'));
fs.writeFileSync(pages.workshop, page('workshop', 'Prose Minion Workshop'));

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

// An open Workshop room with nothing in it, as the PR #147 harness draws it.
const room = {
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
      conversationBehavior: { responseLength: 'standard', tone: 'balanced', intensity: 'standard' }
    },
    writerProfile: { enabled: false, text: '' },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  }
};

const PINNED_FIELD = 'Telescope';
const toTop = async (tab) => {
  await tab.mouse.move(4, 4);
  await tab.evaluate(() => {
    document.querySelectorAll('.pm-ws, .pm-lb-scroll').forEach((element) => { element.scrollTop = 0; });
  });
};
// The board's own "Read" filter: readings only, so they sit under the ribbon.
const showReadings = async (tab) => {
  await tab.locator('.pm-lb-segment', { hasText: /^Read$/ }).click();
  await toTop(tab);
};
// Scroll the tile (or element) holding `selector` to just under the sticky
// ribbon, so the ribbon never covers its head. At full width the board
// scrolls inside .pm-lb-scroll; below 1240 px the whole tab scrolls.
const scrollTo = (selector, tile = false) => async (tab) => {
  await tab.evaluate(([target, wholeTile]) => {
    const found = document.querySelector(target);
    const element = (wholeTile ? found?.closest('section') : null) ?? found;
    if (!element) { return; }
    const scroller = [...document.querySelectorAll('.pm-lb-scroll, .pm-ws')]
      .find((candidate) => candidate.scrollHeight > candidate.clientHeight + 1 && candidate.contains(element));
    if (!scroller) { return; }
    const ribbon = document.querySelector('.pm-lb-ribbon');
    const inBoard = ribbon && scroller.contains(ribbon) && !element.closest('.pm-lb-inspector');
    element.scrollIntoView({ block: 'start' });
    const under = inBoard ? ribbon.getBoundingClientRect().bottom + 12 : scroller.getBoundingClientRect().top + 12;
    scroller.scrollTop -= Math.max(0, under - element.getBoundingClientRect().top);
  }, [selector, tile]);
  await tab.mouse.move(4, 4);
};
const gravityInView = scrollTo('.pm-lb-gravity', true);
const pinField = async (tab) => {
  await tab.locator('.pm-lb-segment', { hasText: /^Read$/ }).click();
  await tab.locator('.pm-lb-field', { has: tab.locator('.pm-lb-field-name', { hasText: new RegExp(`^${PINNED_FIELD}$`) }) }).click();
  await gravityInView(tab);
};
// The inspector's foot: its degree rows, its friction and "Build as a lens"
// with its note, scrolled up from the bottom of the window.
const buildInView = async (tab) => {
  await tab.evaluate(() => {
    const element = document.querySelector('.pm-lb-build-lens');
    if (!element) { return; }
    element.scrollIntoView({ block: 'end' });
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    if (scroller) { scroller.scrollTop += 24; }
  });
  await tab.mouse.move(4, 4);
};

const done = [...chrome, ...chapter.idle, ...chapter.done];
const stale = [...done, ...chapter.stale];

const scenarios = [
  // Every group back; "Read" filter, scrolled to the lexical gravity tile.
  { name: 'done', surface: 'lightbox', messages: done, estimates: chapter.estimates, act: async (tab) => { await showReadings(tab); await gravityInView(tab); } },
  // The same board, scrolled to the palette: diction clusters and swatches.
  {
    name: 'palette', surface: 'lightbox', messages: done, estimates: chapter.estimates,
    act: async (tab) => { await showReadings(tab); await scrollTo('.pm-lb-cluster', true)(tab); }
  },
  // The Telescope field pinned: the inspector's degree rows and "Build as a
  // lens". At 1440 the inspector sits beside the board; at 1000 and 500 it
  // stacks, so `field-inspector` scrolls its foot into view.
  { name: 'field', surface: 'lightbox', widths: ['1440'], messages: done, estimates: chapter.estimates, act: pinField },
  {
    name: 'field-inspector', surface: 'lightbox', messages: done, estimates: chapter.estimates,
    act: async (tab) => { await pinField(tab); await buildInView(tab); }
  },
  // Build pressed: the webview posts the request, and the host's answer (the
  // real handler's) is replayed.
  {
    name: 'sent', surface: 'lightbox', widths: ['1440', '500'], messages: done, estimates: chapter.estimates,
    act: async (tab) => {
      await pinField(tab);
      await tab.locator('.pm-lb-build-lens button').click();
      for (const entry of chapter.sent) {
        await tab.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await tab.waitForTimeout(200);
      await buildInView(tab);
    }
  },
  // The writer revised ¶15 and re-read the file: every lens stale, the
  // Telescope quote from ¶15 withheld, the field recounted, Build disabled.
  { name: 'stale', surface: 'lightbox', messages: stale, estimates: chapter.staleEstimates, act: async (tab) => { await showReadings(tab); await gravityInView(tab); } },
  {
    name: 'stale-inspector', surface: 'lightbox', messages: stale, estimates: chapter.staleEstimates,
    act: async (tab) => { await pinField(tab); await buildInView(tab); }
  },
  // The Workshop after the handoff: Build lens open, prefilled, nothing built.
  {
    name: 'build', surface: 'workshop',
    messages: [...chrome, room, ...workshop.build],
    act: async (tab) => {
      await tab.waitForSelector('.pm-ws-lexical-gravity-modal', { timeout: 5000 });
      // Answer the sheet's library request with what the Workshop's handler posted.
      const asked = await tab.evaluate(() => window.__pmPosted.some((m) => m.type === 'workshop_request_lexical_gravity_lenses'));
      if (asked) {
        for (const entry of workshop.lenses) {
          await tab.evaluate((m) => window.postMessage(m, '*'), entry);
        }
      }
      await tab.mouse.move(4, 4);
    }
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1600 },
  { tag: '1000', width: 1000, height: 1600 },
  { tag: '500', width: 500, height: 1800 }
];

const lightboxFacts = () => {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].map((element) => element.textContent.trim().replace(/\s+/g, ' '));
  const inspector = document.querySelector('.pm-lb-inspector');
  const build = document.querySelector('.pm-lb-build-lens button');
  return {
    runLine: text('.pm-lb-run'),
    orbit: [...document.querySelectorAll('.pm-lb-orbit-body')].map((element) => element.getAttribute('aria-label')),
    fields: all('.pm-lb-field'),
    belowLine: all('.pm-lb-field.is-below .pm-lb-field-name'),
    collisions: all('.pm-lb-collision'),
    literals: all('.pm-lb-literal'),
    clusters: all('.pm-lb-cluster'),
    swatches: all('.pm-lb-swatch'),
    staleNotes: all('.pm-lb-stale-note').length,
    staleNoteText: all('.pm-lb-stale-note')[0] ?? null,
    inspectorTitle: inspector?.querySelector('.pm-lb-inspector-title')?.textContent ?? null,
    inspectorStale: inspector ? all('.pm-lb-stale-note', inspector) : [],
    degreeRows: inspector ? all('.pm-lb-degree-row', inspector) : [],
    evidence: inspector ? all('.pm-lb-evidence', inspector) : [],
    withheld: inspector ? all('.pm-lb-withheld-quote-card', inspector) : [],
    build: build ? {
      label: build.textContent.trim(),
      disabled: build.disabled,
      describedBy: build.getAttribute('aria-describedby'),
      note: text('#pm-lb-build-lens-note'),
      noteRole: document.querySelector('#pm-lb-build-lens-note')?.getAttribute('role') ?? null
    } : null,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    posted: window.__pmPosted.map((m) => `${m.type} ${m.source}${m.type === 'lightbox_hand_off' ? ` ${JSON.stringify(m.payload)}` : ''}`)
  };
};

const workshopFacts = () => {
  const modal = document.querySelector('.pm-ws-lexical-gravity-modal');
  const input = modal?.querySelector('.pm-ws-lg-lookup input');
  const press = modal?.querySelector('.pm-ws-lg-lookup button');
  return {
    title: modal?.querySelector('#pm-ws-lexical-gravity-title')?.textContent?.trim() ?? null,
    selectedTab: modal?.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? null,
    banner: modal?.querySelector('.pm-ws-lg-build-seed')?.textContent?.trim().replace(/\s+/g, ' ') ?? null,
    subject: input ? input.value : null,
    press: press ? { label: press.textContent.trim(), disabled: press.disabled } : null,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    posted: window.__pmPosted.map((m) => `${m.type} ${m.source}`)
  };
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios.filter((entry) => !entry.widths || entry.widths.includes(viewport.tag))) {
      const tab = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      tab.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await tab.goto('file://' + pages[scenario.surface]);
      await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      await tab.evaluate((estimates) => { window.__pmEstimates = estimates; }, scenario.estimates || {});
      for (const entry of replayed(scenario.messages)) {
        await tab.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await tab.waitForTimeout(300);
      if (scenario.act) {
        await scenario.act(tab);
      }
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
      if (!stable) { errors.push(`${scenario.name}@${viewport.tag}: never settled`); }
      fs.writeFileSync(path.join(outDir, `${scenario.surface}-${scenario.name}-${viewport.tag}.png`), previous);
      facts[`${scenario.surface}-${scenario.name}@${viewport.tag}`] = await tab.evaluate(scenario.surface === 'lightbox' ? lightboxFacts : workshopFacts);
      await tab.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), JSON.stringify(facts, null, 2));
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n'));
  console.log(`done; ${errors.length} page errors`);
})().catch((e) => { console.error(e); process.exit(1); });
