/*
 * Lightbox Slice 4D visual harness, adapted from
 * ../lightbox-slice-4c-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface and as the
 * Workshop surface, replays the host's messages for each state, and
 * screenshots each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/*.json are real host output: the production LightboxService,
 * LightboxHandler (with its handoff route and tray), LightboxReadingHandler,
 * runner, codec, quote verifier, term counter, the Opinion's digest and
 * gates, and the Workshop's own WorkshopLightboxTileHandler over a real
 * session, behind the real seed delivery, built them, with only the provider
 * played (see README.md and tools/build-opinion.test.ts).
 *
 * Each Lightbox state also records the ribbon's one grid (PR #156 F-03), as
 * the 4C harness does: column and band edges against the story lanes, and
 * clipped lane labels (`ribbonGrid` in facts.json). Any edge more than half
 * a pixel out of line, or a clipped label, is written to errors.txt.
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
      // The lenses group F's worked example was read with; the tab restores that preference.
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

const OPINION = 'section.pm-lb-opinion';
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
const post = async (tab, messages) => {
  for (const entry of messages) {
    await tab.evaluate((m) => window.postMessage(m, '*'), entry);
  }
  await tab.waitForTimeout(200);
};
const choose = (label) => async (tab) => {
  await scrollTo(OPINION)(tab);
  await tab.locator(`${OPINION} .pm-lb-op-tab`, { hasText: label }).click();
  await tab.mouse.move(4, 4);
};
// Hover O2, the long sentences: the ribbon lights the paragraphs its cited items touch.
const hoverObservation = async (tab) => {
  await scrollTo(OPINION)(tab);
  await tab.evaluate((target) => {
    const element = document.querySelector(`${target} .pm-lb-op-obs`);
    element?.scrollIntoView({ block: 'center' });
  }, OPINION);
  await tab.locator(`${OPINION} .pm-lb-op-o`, { hasText: 'O2' }).hover();
};
// The Opinion's actions, scrolled up from the bottom of the window.
const actionsInView = async (tab) => {
  await tab.evaluate((target) => {
    const element = document.querySelector(`${target} .pm-lb-op-actions`);
    if (!element) { return; }
    element.scrollIntoView({ block: 'end' });
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    if (scroller) { scroller.scrollTop += 24; }
  }, OPINION);
  await tab.mouse.move(4, 4);
};

const done = [...chrome, ...chapter.idle, ...chapter.done];
const withheld = [...done, ...chapter.bound, ...chapter.withheld];
const stale = [...withheld, ...chapter.stale];

const scenarios = [
  // The Opinion on the board it weighed: Neutral by default, then each other view.
  { name: 'neutral', surface: 'lightbox', messages: done, act: scrollTo(OPINION) },
  { name: 'enthusiastic', surface: 'lightbox', messages: done, act: choose('Enthusiastic') },
  { name: 'blunt', surface: 'lightbox', messages: done, act: choose('Blunt') },
  // An observation hovered: the ribbon lights its cited items' paragraphs.
  { name: 'observation-hover', surface: 'lightbox', messages: done, act: hoverObservation },
  // The Blunt view brought, by name; the Workshop staged it: its tray, then the answer, are replayed.
  {
    name: 'bound', surface: 'lightbox', messages: done,
    act: async (tab) => {
      await choose('Blunt')(tab);
      await tab.locator(`${OPINION} .pm-lb-bring button.pm-lb-button`).click();
      await post(tab, chapter.bound);
      await actionsInView(tab);
    }
  },
  // The Opinion read again: its Blunt view prescribed, so code withheld it; the tab says why.
  { name: 'withheld', surface: 'lightbox', messages: withheld, act: choose('Blunt') },
  // Stock & signature read again: the tiles O1 and O6 cite have new ids, so the Opinion is stale.
  { name: 'stale', surface: 'lightbox', messages: stale, act: scrollTo(OPINION) },
  // The Workshop: the Blunt view staged above the composer, as its session holds it.
  {
    name: 'composer', surface: 'workshop', messages: [...chrome, ...workshop.composer],
    act: async (tab) => {
      await tab.waitForSelector('.pm-ws-comp-attachments', { timeout: 5000 });
      await tab.evaluate(() => {
        const element = document.querySelector('.pm-ws-composer-wrap');
        element?.scrollIntoView({ block: 'end', inline: 'nearest' });
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

// The ribbon's one grid (PR #156 F-03), measured as ../lightbox-slice-4c-visual/harness.js measures it:
// the paragraph columns against the story lanes' cells and bands, and clipped lane labels.
const ribbonGeometry = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return { left: round(rect.left), right: round(rect.right) };
  };
  const delta = (a, b) => round(Math.max(Math.abs(a.left - b.left), Math.abs(a.right - b.right)));
  const mainTrack = document.querySelector('.pm-lb-ribbon-cols');
  const storyTrack = document.querySelector('.pm-lb-plot-lanes');
  if (!mainTrack || !storyTrack) {
    return null;
  }
  const columns = [...mainTrack.querySelectorAll(':scope > .pm-lb-col')].map(box);
  const cells = [...storyTrack.querySelectorAll(':scope > .pm-lb-plot-pressure')].map(box);
  const columnDeltas = cells.length === columns.length ? columns.map((column, index) => delta(column, cells[index])) : [];
  const bandDeltas = [...storyTrack.querySelectorAll(':scope > .pm-lb-band')].map((band) => {
    const [start, end] = band.style.gridColumn.split('/').map((part) => Number.parseInt(part.trim(), 10));
    return { band: band.getAttribute('aria-label'), delta: delta(box(band), { left: columns[start - 1].left, right: columns[end - 2].right }) };
  });
  const clipped = [...document.querySelectorAll('.pm-lb-ribbon-grid .pm-lb-lane-label')]
    .filter((label) => label.scrollWidth > label.clientWidth + 0.5)
    .map((label) => label.textContent.trim());
  return {
    columns: columns.length,
    labelTrack: [...document.querySelectorAll('.pm-lb-ribbon-grid .pm-lb-ribbon-labels')].map((labels) => round(labels.getBoundingClientRect().width)),
    mainTrack: box(mainTrack),
    storyTrack: box(storyTrack),
    trackEdgeDelta: delta(box(mainTrack), box(storyTrack)),
    columnsCompared: columnDeltas.length,
    maxColumnEdgeDelta: columnDeltas.length > 0 ? Math.max(...columnDeltas) : null,
    maxBandEdgeDelta: bandDeltas.length > 0 ? Math.max(...bandDeltas.map((entry) => entry.delta)) : null,
    bandsCompared: bandDeltas.length,
    clippedLabels: clipped
  };
};
const misaligned = (grid) => {
  if (!grid) {
    return [];
  }
  const out = [];
  if (grid.trackEdgeDelta > 0.5) { out.push(`column tracks differ by ${grid.trackEdgeDelta}px`); }
  if (grid.maxColumnEdgeDelta !== null && grid.maxColumnEdgeDelta > 0.5) { out.push(`a column's edges differ by ${grid.maxColumnEdgeDelta}px`); }
  if (grid.maxBandEdgeDelta !== null && grid.maxBandEdgeDelta > 0.5) { out.push(`a band's edges differ by ${grid.maxBandEdgeDelta}px`); }
  if (grid.clippedLabels.length > 0) { out.push(`clipped labels: ${grid.clippedLabels.join(', ')}`); }
  return out;
};

const lightboxFacts = () => {
  const clean = (value) => value?.trim().replace(/\s+/g, ' ') ?? null;
  const text = (selector, root = document) => clean(root.querySelector(selector)?.textContent);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].map((element) => clean(element.textContent));
  const opinion = document.querySelector('section.pm-lb-opinion');
  const bring = opinion?.querySelector('.pm-lb-bring');
  const press = bring?.querySelector('button.pm-lb-button');
  const reread = [...(opinion?.querySelectorAll('.pm-lb-op-action') ?? [])]
    .find((element) => element.querySelector('button')?.textContent.trim() === 'Re-read the Opinion');
  const tiles = [...document.querySelectorAll('section.pm-lb-tile')];
  const lane = document.querySelector('[aria-label="Spark lane"]');
  return {
    runLine: text('.pm-lb-run'),
    opinion: opinion ? {
      last: tiles.at(-1) === opinion,
      // Null when there is no Spark lane (the Spark lens is off in this evidence).
      afterSparkLane: lane ? Boolean(lane.compareDocumentPosition(opinion) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
      register: opinion.getAttribute('data-register'),
      chip: text('.pm-lb-op-chip', opinion),
      rule: text('.pm-lb-op-rule', opinion),
      tabs: [...opinion.querySelectorAll('.pm-lb-op-tab')].map((tab) => `${clean(tab.textContent)} [aria-pressed=${tab.getAttribute('aria-pressed')}]`),
      headline: text('.pm-lb-op-head', opinion),
      body: text('.pm-lb-op-text', opinion),
      why: all('.pm-lb-op-w', opinion),
      withheldView: text('.pm-lb-op-body .pm-lb-withheld-block', opinion),
      stale: text('.pm-lb-stale-note', opinion),
      observations: [...opinion.querySelectorAll('.pm-lb-op-o')].map((row) => ({
        id: clean(row.querySelector('.pm-lb-op-oid')?.textContent),
        cites: all('.pm-lb-op-cite', row)
      })),
      digest: text('.pm-lb-op-digest', opinion),
      reread: reread ? clean(reread.textContent) : null,
      bring: bring ? {
        state: [...bring.classList].find((name) => name.startsWith('is-')) ?? null,
        label: press?.textContent.trim() ?? null,
        disabled: press?.disabled ?? null,
        title: press?.getAttribute('title') ?? null,
        note: text('.pm-lb-run-note', bring),
        openWorkshop: Boolean(bring.querySelector('.pm-lb-link'))
      } : null,
      footnote: text('.pm-lb-foot', opinion)
    } : null,
    lit: [...document.querySelectorAll('.pm-lb-col')].flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : [])),
    staleNotes: all('.pm-lb-stale-note').length,
    tray: text('.pm-lb-tray'),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    posted: window.__pmPosted
      .filter((m) => m.type === 'lightbox_hand_off' || m.type === 'lightbox_open_workshop')
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
    for (const scenario of scenarios) {
      const tab = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      tab.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await tab.addInitScript((lensesOff) => { window.__pmState = { lightboxLensesOff: lensesOff }; }, chapter.lensesOff || []);
      await tab.goto('file://' + pages[scenario.surface]);
      await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      await tab.evaluate((estimates) => { window.__pmEstimates = estimates; }, scenario.estimates || chapter.estimates || {});
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
      const pageFacts = await tab.evaluate(scenario.surface === 'lightbox' ? lightboxFacts : workshopFacts);
      if (scenario.surface === 'lightbox') {
        // Measured on its own: evaluate sends one function's source to the page.
        pageFacts.ribbonGrid = await tab.evaluate(ribbonGeometry);
        for (const problem of misaligned(pageFacts.ribbonGrid)) {
          errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
        }
      }
      facts[`${scenario.surface}-${scenario.name}@${viewport.tag}`] = pageFacts;
      await tab.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), JSON.stringify(facts, null, 2));
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n'));
  console.log(`done; ${errors.length} errors (page errors and ribbon misalignments; see errors.txt)`);
})().catch((e) => { console.error(e); process.exit(1); });
