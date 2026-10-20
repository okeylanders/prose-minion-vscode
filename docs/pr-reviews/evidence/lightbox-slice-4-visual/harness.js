/*
 * Lightbox Slice 4 visual harness, adapted from
 * ../lightbox-slice-3-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface and as the
 * Workshop surface, replays the host's messages for each state, and
 * screenshots each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/*.json are real host output: the production LightboxService,
 * LightboxHandler (with its handoff route and tray), LightboxReadingHandler,
 * runner, codec, quote verifier and term counter, and the Workshop's own
 * WorkshopLightboxTileHandler over a real session, behind the real seed
 * delivery, built them, with only the provider played (see README.md and
 * tools/build-story.test.ts).
 *
 * The estimate is only ever an answer to the tab's own request (PR #149
 * F-03), so it is not replayed: the stubbed API answers each
 * `lightbox_set_lenses` the tab posts with the host's recorded answer for
 * those lenses, echoing the request's id.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const states = path.join(__dirname, 'states');
const chapter = JSON.parse(fs.readFileSync(path.join(states, 'chapter.json'), 'utf8'));
const workshop = JSON.parse(fs.readFileSync(path.join(states, 'workshop.json'), 'utf8'));
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
        const answer = m.type === 'lightbox_set_lenses' && window.__pmEstimates[(m.payload.lensesOff || []).slice().sort().join(',')];
        if (answer) {
          setTimeout(() => window.postMessage({
            type: 'lightbox_run_estimate', source: 'extension.lightbox', timestamp: 1,
            payload: Object.assign({}, answer, { requestId: m.payload.requestId })
          }, '*'), 0);
        }
      },
      // Group A's lenses were off when the board was read; the tab restores that preference.
      getState: () => window.__pmState,
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
      selections: { assistant: 'provider/reader-model', widget: 'provider/reader-model' }
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

const toTop = async (tab) => {
  await tab.mouse.move(4, 4);
  await tab.evaluate(() => {
    document.querySelectorAll('.pm-ws, .pm-lb-scroll').forEach((element) => { element.scrollTop = 0; });
  });
};
const showReadings = async (tab) => {
  await tab.locator('.pm-lb-segment', { hasText: /^Read$/ }).click();
  await toTop(tab);
};
// Scroll `selector` to just under the sticky ribbon (or the top of its scroller).
const scrollTo = (selector) => async (tab) => {
  await tab.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) { return; }
    const scroller = [...document.querySelectorAll('.pm-lb-scroll, .pm-ws')]
      .find((candidate) => candidate.scrollHeight > candidate.clientHeight + 1 && candidate.contains(element));
    if (!scroller) { return; }
    const ribbon = document.querySelector('.pm-lb-ribbon');
    const inBoard = ribbon && scroller.contains(ribbon) && !element.closest('.pm-lb-inspector');
    element.scrollIntoView({ block: 'start' });
    const under = inBoard ? ribbon.getBoundingClientRect().bottom + 12 : scroller.getBoundingClientRect().top + 12;
    scroller.scrollTop -= Math.max(0, under - element.getBoundingClientRect().top);
  }, selector);
  await tab.mouse.move(4, 4);
};
const LINEAGE = '[aria-label="Lineage · adjacent stories"]';
const SUBTEXT = '[aria-label="Subtext · said and meant"]';
const LANE = '[aria-label="Spark lane"]';
const post = async (tab, messages) => {
  for (const entry of messages) {
    await tab.evaluate((m) => window.postMessage(m, '*'), entry);
  }
  await tab.waitForTimeout(200);
};
const pinRabbit = async (tab) => {
  await showReadings(tab);
  await tab.locator(`${SUBTEXT} button`, { hasText: 'White Rabbit' }).first().click();
};
const pinHart = async (tab) => {
  await showReadings(tab);
  await tab.locator(`${LINEAGE} button`, { hasText: 'The white hart' }).first().click();
};
// The inspector's Bring, scrolled up from the bottom of the window.
const bringInView = async (tab) => {
  await tab.evaluate(() => {
    const element = document.querySelector('.pm-lb-bring');
    if (!element) { return; }
    element.scrollIntoView({ block: 'end' });
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    if (scroller) { scroller.scrollTop += 24; }
  });
  await tab.mouse.move(4, 4);
};
const pressBring = (tab) => tab.locator('.pm-lb-bring button.pm-lb-button').click();
const jarCard = (tab) => tab.locator('.pm-lb-spark', { hasText: 'The empty jar' });

const done = [...chrome, ...chapter.idle, ...chapter.done];
const undone = [...done, ...chapter.dismissed, ...chapter.undone];

const scenarios = [
  { name: 'lineage', surface: 'lightbox', messages: done, act: async (tab) => { await showReadings(tab); await scrollTo(LINEAGE)(tab); } },
  { name: 'subtext', surface: 'lightbox', messages: done, act: async (tab) => { await showReadings(tab); await scrollTo(SUBTEXT)(tab); } },
  { name: 'spark-lane', surface: 'lightbox', messages: done, act: async (tab) => { await showReadings(tab); await scrollTo(LANE)(tab); } },
  {
    name: 'spark-dismissed', surface: 'lightbox', messages: done,
    act: async (tab) => {
      await showReadings(tab);
      await jarCard(tab).getByRole('button', { name: 'Not for me' }).click();
      await post(tab, chapter.dismissed);
      await scrollTo(LANE)(tab);
    }
  },
  {
    name: 'spark-undone', surface: 'lightbox', messages: [...done, ...chapter.dismissed],
    act: async (tab) => {
      await showReadings(tab);
      await tab.locator(`${LANE} .pm-lb-link`, { hasText: 'Undo' }).click();
      await post(tab, chapter.undone);
      await scrollTo(LANE)(tab);
    }
  },
  // The Rabbit's said/meant pair pinned: the inspector's "Bring to Workshop".
  { name: 'bring', surface: 'lightbox', messages: undone, act: async (tab) => { await pinRabbit(tab); await bringInView(tab); } },
  // Bring pressed; the Workshop staged it: its tray, then the answer, are replayed.
  {
    name: 'bound', surface: 'lightbox', messages: undone,
    act: async (tab) => { await pinRabbit(tab); await pressBring(tab); await post(tab, chapter.bound); await bringInView(tab); }
  },
  // The header: two tiles bound, from the top of the tab.
  {
    name: 'tray', surface: 'lightbox', messages: undone,
    act: async (tab) => {
      await pinRabbit(tab);
      await pressBring(tab);
      await post(tab, chapter.bound);
      await jarCard(tab).getByRole('button', { name: 'Bring as a question' }).click();
      await post(tab, chapter.sparkBound);
      await toTop(tab);
    }
  },
  // The spark lane with The empty jar bound.
  {
    name: 'spark-bound', surface: 'lightbox', messages: [...undone, ...chapter.bound],
    act: async (tab) => {
      await showReadings(tab);
      await jarCard(tab).getByRole('button', { name: 'Bring as a question' }).click();
      await post(tab, chapter.sparkBound);
      await scrollTo(LANE)(tab);
    }
  },
  // A refusal: the white hart brought while a Workshop response runs.
  {
    name: 'refused', surface: 'lightbox', messages: [...undone, ...chapter.bound, ...chapter.sparkBound],
    act: async (tab) => { await pinHart(tab); await pressBring(tab); await post(tab, chapter.refused); await bringInView(tab); }
  },
  // The Workshop: both tiles staged above the composer, as its session holds them.
  {
    name: 'composer', surface: 'workshop', messages: [...chrome, ...workshop.composer],
    act: async (tab) => {
      await tab.waitForSelector('.pm-ws-comp-attachments', { timeout: 5000 });
      await tab.evaluate(() => {
        const element = document.querySelector('.pm-ws-composer-wrap');
        element?.scrollIntoView({ block: 'end', inline: 'nearest' });
        // Scrolling a stacked column must never move the page sideways.
        document.scrollingElement.scrollLeft = 0;
        document.querySelectorAll('*').forEach((node) => { if (node.scrollLeft) { node.scrollLeft = 0; } });
      });
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
  const text = (selector) => document.querySelector(selector)?.textContent?.trim().replace(/\s+/g, ' ') ?? null;
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].map((element) => element.textContent.trim().replace(/\s+/g, ' '));
  const inspector = document.querySelector('.pm-lb-inspector');
  const bring = document.querySelector('.pm-lb-bring');
  const press = bring?.querySelector('button.pm-lb-button');
  return {
    runLine: text('.pm-lb-run'),
    lineage: all('[aria-label="Lineage · adjacent stories"] button'),
    lineageFoot: text('[aria-label="Lineage · adjacent stories"] .pm-lb-set-aside') ?? null,
    subtext: all('[aria-label="Subtext · said and meant"] button'),
    sparks: all('.pm-lb-spark').map((card) => card),
    sparkSetAside: text('.pm-lb-spark-set-aside'),
    staleNotes: all('.pm-lb-stale-note').length,
    inspectorTitle: inspector?.querySelector('.pm-lb-inspector-title')?.textContent ?? null,
    bring: bring ? {
      state: [...bring.classList].find((name) => name.startsWith('is-')) ?? null,
      label: press?.textContent.trim() ?? null,
      disabled: press?.disabled ?? null,
      note: text('#pm-lb-bring-note'),
      noteRole: document.querySelector('#pm-lb-bring-note')?.getAttribute('role') ?? null,
      openWorkshop: Boolean(bring.querySelector('.pm-lb-link'))
    } : null,
    tray: text('.pm-lb-tray'),
    sparkBring: [...document.querySelectorAll('.pm-lb-spark')].map((card) => {
      const button = [...card.querySelectorAll('button.pm-lb-button')].find((b) => !b.classList.contains('is-ghost'));
      return button ? `${button.textContent.trim()}${button.disabled ? ' (disabled)' : ''}${button.getAttribute('aria-pressed') === 'true' ? ' (pressed)' : ''}` : null;
    }),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    posted: window.__pmPosted
      .filter((m) => m.type === 'lightbox_hand_off' || m.type === 'lightbox_set_spark_dismissed' || m.type === 'lightbox_open_workshop')
      .map((m) => `${m.type} ${JSON.stringify(m.payload)}`)
  };
};

const workshopFacts = () => ({
  pills: [...document.querySelectorAll('.pm-ws-comp-attachment')].map((pill) => ({
    label: pill.querySelector('.pm-ws-comp-attachment-label')?.textContent ?? null,
    size: pill.querySelector('.pm-ws-comp-attachment-size')?.textContent ?? null,
    title: pill.getAttribute('title'),
    remove: pill.querySelector('.pm-ws-comp-attachment-remove')?.getAttribute('aria-label') ?? null
  })),
  hint: document.querySelector('.pm-ws-comp-attachment-hint')?.textContent ?? null,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  posted: window.__pmPosted.map((m) => `${m.type} ${m.source}`)
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios.filter((entry) => !entry.widths || entry.widths.includes(viewport.tag))) {
      const tab = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      tab.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await tab.addInitScript((lensesOff) => { window.__pmState = { lightboxLensesOff: lensesOff }; }, chapter.lensesOff || []);
      await tab.goto('file://' + pages[scenario.surface]);
      await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      await tab.evaluate((estimates) => { window.__pmEstimates = estimates; }, chapter.estimates || {});
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
