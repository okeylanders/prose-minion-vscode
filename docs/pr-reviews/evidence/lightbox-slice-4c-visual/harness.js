/*
 * Lightbox Slice 4C visual harness, adapted from
 * ../lightbox-slice-4b-visual/harness.js: renders a built webview bundle in
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
 * After the PR #156 review (F-03) it also measures the ribbon's grid in each
 * Lightbox state: the paragraph lanes' and story lanes' column edges, track
 * edges and band edges, and clipped lane labels (`ribbonGrid` in
 * facts.json). Any edge more than half a pixel out of line, or a clipped
 * label, is written to errors.txt.
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
      // Groups A–C were off when the board was read; the tab restores that preference.
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
// The ribbon and its story lanes: the top of the tab, or, where the rail stacks above the board, the ribbon itself.
const toRibbon = async (tab) => {
  await toTop(tab);
  if (tab.viewportSize().width < 700) {
    await tab.evaluate(() => {
      const ribbon = document.querySelector('.pm-lb-ribbon');
      const scroller = ribbon && [...document.querySelectorAll('.pm-lb-scroll, .pm-ws')]
        .find((candidate) => candidate.scrollHeight > candidate.clientHeight + 1 && candidate.contains(ribbon));
      if (!ribbon || !scroller) { return; }
      scroller.scrollTop += ribbon.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
    });
  }
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
const TEMPLATE = '[aria-label="Template & freshness"]';
const PRESSURE = '[aria-label="Pressure"]';
const ARTIFACTS = '[aria-label="Artifacts"]';
const SUMMARY = '[aria-label="Summary & movements"]';
const post = async (tab, messages) => {
  for (const entry of messages) {
    await tab.evaluate((m) => window.postMessage(m, '*'), entry);
  }
  await tab.waitForTimeout(200);
};
// The fall: a thread planted in ¶6 that builds in ¶7 and is still open.
const pinThread = async (tab) => {
  await tab.locator(`${PRESSURE} button.pm-lb-thread`, { hasText: 'Will the fall ever end?' }).click();
};
// Movement II, "The chase".
const pinMovement = async (tab) => {
  await tab.locator(`${SUMMARY} button.pm-lb-movement`, { hasText: 'The chase' }).click();
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

const done = [...chrome, ...chapter.idle, ...chapter.done];
const staleBoard = [...done, ...chapter.bound, ...chapter.stale];

const scenarios = [
  // Before any reading: the Sections lane is measured, and says what it found.
  { name: 'sections-measured', surface: 'lightbox', messages: [...chrome, ...chapter.idle], act: toRibbon },
  { name: 'template', surface: 'lightbox', messages: done, act: scrollTo(TEMPLATE) },
  { name: 'pressure', surface: 'lightbox', messages: done, act: scrollTo(PRESSURE) },
  { name: 'artifacts', surface: 'lightbox', messages: done, act: scrollTo(ARTIFACTS) },
  { name: 'summary', surface: 'lightbox', messages: done, act: scrollTo(SUMMARY) },
  // The ribbon with its Sections, Movements, Pressure and Engagement lanes, from the top of the tab.
  { name: 'ribbon', surface: 'lightbox', messages: done, act: toRibbon },
  // A thread pinned: the inspector with its span and order checks.
  { name: 'inspector', surface: 'lightbox', messages: done, act: async (tab) => { await scrollTo(PRESSURE)(tab); await pinThread(tab); } },
  // Movement II pinned and brought; the Workshop staged it: its tray, then the answer, are replayed.
  {
    name: 'bound', surface: 'lightbox', messages: done,
    act: async (tab) => { await scrollTo(SUMMARY)(tab); await pinMovement(tab); await pressBring(tab); await post(tab, chapter.bound); await bringInView(tab); }
  },
  // The chapter changed on disk and was re-read: group E is stale, its movements moved with their boundaries,
  // the Sections lane found two scenes, and the jar's thread is withheld.
  { name: 'stale', surface: 'lightbox', messages: staleBoard, estimates: chapter.estimatesStale, act: scrollTo(SUMMARY) },
  { name: 'stale-pressure', surface: 'lightbox', messages: staleBoard, estimates: chapter.estimatesStale, act: scrollTo(PRESSURE) },
  { name: 'stale-ribbon', surface: 'lightbox', messages: staleBoard, estimates: chapter.estimatesStale, act: toRibbon },
  // The Workshop: the movement staged above the composer, as its session holds it.
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

/*
 * Where the ribbon's two parts draw their paragraph columns (PR #156 F-03),
 * measured in the page: each main column's edges against the story lanes'
 * column of the same index (the Pressure lane draws one cell per column),
 * the two column tracks' edges, every band's edges against the main
 * columns it spans, and any lane label its track clips. Rounded to 0.01 px.
 */
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

/** The ribbon's alignment, as a list of what is out of line; empty when every edge coincides within half a pixel. */
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
  const labels = (selector, root = document) => [...root.querySelectorAll(selector)].map((element) => element.getAttribute('aria-label'));
  const tile = (label) => document.querySelector(`[aria-label="${label}"]`);
  const withheld = (root) => all('.pm-lb-withheld li, .pm-lb-withheld-claims li', root);
  const inspector = document.querySelector('.pm-lb-inspector');
  const bring = document.querySelector('.pm-lb-bring');
  const press = bring?.querySelector('button.pm-lb-button');
  const template = tile('Template & freshness');
  const pressure = tile('Pressure');
  const artifacts = tile('Artifacts');
  const summary = tile('Summary & movements');
  const lanes = document.querySelector('[aria-label="Sections, movements, pressure and engagement"]');
  return {
    runLine: text('.pm-lb-run'),
    template: template ? {
      register: template.getAttribute('data-register'),
      name: text('.pm-lb-template-name', template),
      beats: all('.pm-lb-craft-row', template),
      engagement: labels('.pm-lb-engagement-row', template),
      engagementNote: all('.pm-lb-craft-note', template).filter((note) => note.startsWith('Engagement') || note.startsWith('No engagement')),
      freshness: template.querySelector('.pm-lb-fresh-scale')?.getAttribute('aria-label') ?? null,
      basis: text('.pm-lb-basis', template),
      stale: Boolean(template.querySelector('.pm-lb-stale-note'))
    } : null,
    pressure: pressure ? {
      register: pressure.getAttribute('data-register'),
      threads: all('.pm-lb-thread-head', pressure),
      counts: text('.pm-lb-pressure-counts', pressure),
      withheld: withheld(pressure),
      stale: Boolean(pressure.querySelector('.pm-lb-stale-note'))
    } : null,
    artifacts: artifacts ? {
      register: artifacts.getAttribute('data-register'),
      rows: labels('.pm-lb-artifact', artifacts),
      summary: text('.pm-lb-artifacts-summary', artifacts),
      withheld: withheld(artifacts)
    } : null,
    summary: summary ? {
      register: summary.getAttribute('data-register'),
      synopsis: text('.pm-lb-synopsis-text', summary),
      movements: all('.pm-lb-movement', summary),
      sectionsNote: text('.pm-lb-sections-note', summary),
      withheld: withheld(summary),
      stale: Boolean(summary.querySelector('.pm-lb-stale-note'))
    } : null,
    lanes: lanes ? {
      labels: all('.pm-lb-lane-label', lanes),
      sections: labels('.pm-lb-band.is-section', lanes),
      movements: labels('.pm-lb-band.is-movement', lanes),
      engagement: labels('.pm-lb-band.is-engagement', lanes),
      pressure: [...lanes.querySelectorAll('.pm-lb-plot-pressure')].map((cell) => cell.getAttribute('title')),
      empty: all('.pm-lb-plot-empty', lanes)
    } : null,
    staleNotes: all('.pm-lb-stale-note').length,
    inspectorTitle: inspector?.querySelector('.pm-lb-inspector-title')?.textContent ?? null,
    inspectorDetails: inspector ? all('.pm-lb-inspector dl > div, .pm-lb-inspector-detail', inspector) : [],
    bring: bring ? {
      state: [...bring.classList].find((name) => name.startsWith('is-')) ?? null,
      label: press?.textContent.trim() ?? null,
      disabled: press?.disabled ?? null,
      note: text('#pm-lb-bring-note'),
      openWorkshop: Boolean(bring.querySelector('.pm-lb-link'))
    } : null,
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
