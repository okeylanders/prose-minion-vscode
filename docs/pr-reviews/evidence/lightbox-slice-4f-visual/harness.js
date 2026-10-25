/*
 * Lightbox Slice 4F visual harness, adapted from
 * ../lightbox-slice-4d-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface and as the
 * Workshop surface, replays the host's messages for each state, and
 * screenshots each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/*.json are real host output: the production LightboxService,
 * LightboxHandler (with its handoff route and tray), LightboxReadingHandler,
 * runner, codec, quote verifier, term counter, craft steering's measure,
 * codec, anchoring and gates, and the Workshop's own
 * WorkshopLightboxTileHandler over a real session, behind the real seed
 * delivery, built them, with only the provider played (see README.md and
 * tools/build-steering.test.ts).
 *
 * Each Lightbox state records what the craft steering tile shows (`steering`
 * in facts.json): each figure's measured counts and construction rows, its
 * reading, its notes with their stance, quote, why, nudge and example, and
 * the computed border style of the measured part, a reading and a note, so
 * "measured solid, read dashed" is read from the page, not assumed. It also
 * records the inspector, the lit paragraphs, what was posted, and the
 * ribbon's one grid, measured as the 4C and 4D harnesses measure it. A
 * missing steering tile, a figure section short of three, an example drawn
 * inside a quotation element, any edge more than half a pixel out of line,
 * a missing track, or a clipped label is written to errors.txt: it fails
 * rather than skips.
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
      // The lenses group F's worked example was read with (craft steering on); the tab restores that preference.
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

const STEERING = 'section.pm-lb-tile.is-steering';
const figureOf = (label) => `${STEERING} section.pm-lb-steer-figure[aria-label="${label}"]`;
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
// The being-verbs note that leans: its nudge and its one example ("it was too dark").
const LEANING = 'A state stands where the fall could act';
const leaningNote = (tab) => tab.locator(`${figureOf('Being verbs')} button.pm-lb-steer-note`, { hasText: LEANING });
const hoverNote = async (tab) => {
  await scrollTo(figureOf('Being verbs'))(tab);
  await tab.evaluate((label) => {
    const notes = document.querySelector(`${label} .pm-lb-steer-notes`);
    notes?.scrollIntoView({ block: 'center' });
  }, figureOf('Being verbs'));
  await leaningNote(tab).hover();
};
const pinNote = async (tab) => {
  await hoverNote(tab);
  await leaningNote(tab).click();
  await tab.mouse.move(4, 4);
};
// The inspector's Bring (not the Opinion's), scrolled up from the bottom of the window.
const bringInView = async (tab) => {
  await tab.evaluate(() => {
    const element = document.querySelector('.pm-lb-inspector .pm-lb-bring');
    if (!element) { return; }
    element.scrollIntoView({ block: 'end' });
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    if (scroller) { scroller.scrollTop += 24; }
  });
  await tab.mouse.move(4, 4);
};
const pressBring = (tab) => tab.locator('.pm-lb-inspector .pm-lb-bring button.pm-lb-button').click();
// A figure's notes, scrolled so the section's head is under the ribbon.
const showFigure = (label) => scrollTo(figureOf(label));

const measured = [...chrome, ...chapter.idle];
const done = [...measured, ...chapter.done];
const withheld = [...done, ...chapter.bound, ...chapter.withheld];
const stale = [...withheld, ...chapter.stale];

const scenarios = [
  // Before any reading: each figure's counts, constructions and runs, measured and free.
  { name: 'measured', surface: 'lightbox', messages: measured, act: scrollTo(STEERING), expect: { cells: false, bands: false } },
  // Read: each figure's section with its reading and notes.
  { name: 'being-verbs', surface: 'lightbox', messages: done, act: showFigure('Being verbs') },
  { name: 'adverbs', surface: 'lightbox', messages: done, act: showFigure('Adverbs (-ly)') },
  { name: 'intensifiers', surface: 'lightbox', messages: done, act: showFigure('Intensifiers and fillers') },
  // The note that leans, hovered: the ribbon lights its paragraph.
  { name: 'note-hover', surface: 'lightbox', messages: done, act: hoverNote },
  // The same note pinned: the inspector with its stance, nudge and example.
  { name: 'inspector', surface: 'lightbox', messages: done, act: pinNote },
  // The note brought, by its id; the Workshop staged it: its tray, then the answer, are replayed.
  {
    name: 'bound', surface: 'lightbox', messages: done,
    act: async (tab) => { await pinNote(tab); await pressBring(tab); await post(tab, chapter.bound); await bringInView(tab); }
  },
  // Craft steering read again: a note that gave an order withheld, an example on an earning note and one
  // not in its quote withheld, each with the host's reason.
  { name: 'withheld', surface: 'lightbox', messages: withheld, act: scrollTo(`${STEERING} .pm-lb-withheld-claims`) },
  { name: 'withheld-examples', surface: 'lightbox', messages: withheld, act: showFigure('Adverbs (-ly)') },
  // The chapter changed on disk and was re-read: counts measured again, readings carried over, stale.
  { name: 'stale', surface: 'lightbox', messages: stale, estimates: chapter.estimatesStale, act: scrollTo(STEERING) },
  { name: 'stale-adverbs', surface: 'lightbox', messages: stale, estimates: chapter.estimatesStale, act: showFigure('Adverbs (-ly)') },
  // The Workshop: the note staged above the composer, as its session holds it.
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

// The ribbon's one grid (PR #156 F-03, F-04), measured exactly as ../lightbox-slice-4c-visual/harness.js measures it.
/*
 * Where the ribbon's two parts draw their paragraph columns (PR #156 F-03,
 * F-04), measured in the page:
 * - each main column's edges against the story lanes' column of the same
 *   index (the Pressure lane draws one cell per column), the two column
 *   tracks' edges, and every band's edges against the main columns it spans;
 * - each part's label block beside its track (F-04): to its left, and
 *   overlapping it vertically by at least half the shorter's height, with
 *   every lane label's vertical centre inside its track;
 * - any lane label its track clips.
 * Rounded to 0.01 px. Found by class, not by DOM shape, so it measures any
 * build of the ribbon.
 */
const ribbonGeometry = () => {
  const round = (value) => Math.round(value * 100) / 100;
  const rect = (element) => {
    const r = element.getBoundingClientRect();
    return { left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom) };
  };
  const delta = (a, b) => round(Math.max(Math.abs(a.left - b.left), Math.abs(a.right - b.right)));
  const mainTrack = document.querySelector('.pm-lb-ribbon-cols');
  const storyTrack = document.querySelector('.pm-lb-plot-lanes');
  const storyLabels = document.querySelector('.pm-lb-ribbon-plot-labels, .pm-lb-ribbon-plot .pm-lb-ribbon-labels');
  const mainLabels = [...document.querySelectorAll('.pm-lb-ribbon-labels')].find((labels) => labels !== storyLabels);
  const missing = [
    ...(mainTrack ? [] : ['the paragraph columns']),
    ...(storyTrack ? [] : ['the story lanes']),
    ...(mainLabels ? [] : ['the paragraph lanes\' labels']),
    ...(storyLabels ? [] : ['the story lanes\' labels'])
  ];
  if (missing.length > 0) {
    return { missing };
  }
  const columns = [...mainTrack.querySelectorAll(':scope > .pm-lb-col')].map(rect);
  const cells = [...storyTrack.querySelectorAll(':scope > .pm-lb-plot-pressure')].map(rect);
  const columnDeltas = cells.length === columns.length ? columns.map((column, index) => delta(column, cells[index])) : [];
  const bandDeltas = [...storyTrack.querySelectorAll(':scope > .pm-lb-band')].map((band) => {
    const [start, end] = band.style.gridColumn.split('/').map((part) => Number.parseInt(part.trim(), 10));
    return delta(rect(band), { left: columns[start - 1].left, right: columns[end - 2].right });
  });
  const beside = (part, labels, track) => {
    const l = rect(labels);
    const t = rect(track);
    const overlap = Math.min(l.bottom, t.bottom) - Math.max(l.top, t.top);
    const shorter = Math.min(l.bottom - l.top, t.bottom - t.top);
    const outside = [...labels.querySelectorAll('.pm-lb-lane-label')]
      .filter((label) => {
        const r = label.getBoundingClientRect();
        const centre = (r.top + r.bottom) / 2;
        return centre < t.top - 0.5 || centre > t.bottom + 0.5;
      })
      .map((label) => label.textContent.trim());
    return {
      part,
      labelsRight: l.right,
      trackLeft: t.left,
      toTheLeft: l.right <= t.left + 0.5,
      verticalOverlap: round(shorter > 0 ? overlap / shorter : 0),
      labelsOutsideTrack: outside
    };
  };
  const clipped = [...document.querySelectorAll('.pm-lb-ribbon .pm-lb-lane-label')]
    .filter((label) => label.scrollWidth > label.clientWidth + 0.5)
    .map((label) => label.textContent.trim());
  return {
    columns: columns.length,
    cells: cells.length,
    labelTrack: [mainLabels, storyLabels].map((labels) => round(labels.getBoundingClientRect().width)),
    mainTrack: rect(mainTrack),
    storyTrack: rect(storyTrack),
    trackEdgeDelta: delta(rect(mainTrack), rect(storyTrack)),
    columnsCompared: columnDeltas.length,
    maxColumnEdgeDelta: columnDeltas.length > 0 ? Math.max(...columnDeltas) : null,
    bandsCompared: bandDeltas.length,
    maxBandEdgeDelta: bandDeltas.length > 0 ? Math.max(...bandDeltas) : null,
    adjacency: [beside('paragraph lanes', mainLabels, mainTrack), beside('story lanes', storyLabels, storyTrack)],
    clippedLabels: clipped
  };
};

/**
 * What is wrong with the ribbon's grid in a state, as a list; empty when it is
 * whole. It fails rather than skips: a missing track or label block, a
 * Pressure lane whose cells do not match the columns, or no band where the
 * state draws bands, is a fault, not a comparison left out. `expect` says
 * what the state draws (`cells`, `bands`).
 */
const ribbonFaults = (grid, expect) => {
  if (!grid) {
    return ['no ribbon measured'];
  }
  if (grid.missing) {
    return grid.missing.map((part) => `missing ${part}`);
  }
  const out = [];
  if (grid.trackEdgeDelta > 0.5) { out.push(`column tracks differ by ${grid.trackEdgeDelta}px`); }
  if (expect.cells && grid.cells !== grid.columns) { out.push(`${grid.cells} pressure cells for ${grid.columns} columns`); }
  if (!expect.cells && grid.cells !== 0) { out.push(`${grid.cells} pressure cells where none are drawn`); }
  if (grid.maxColumnEdgeDelta !== null && grid.maxColumnEdgeDelta > 0.5) { out.push(`a column's edges differ by ${grid.maxColumnEdgeDelta}px`); }
  if (expect.bands && grid.bandsCompared === 0) { out.push('no band to compare'); }
  if (grid.maxBandEdgeDelta !== null && grid.maxBandEdgeDelta > 0.5) { out.push(`a band's edges differ by ${grid.maxBandEdgeDelta}px`); }
  for (const pair of grid.adjacency) {
    if (!pair.toTheLeft) { out.push(`the ${pair.part}' labels end at ${pair.labelsRight}px, right of their track at ${pair.trackLeft}px`); }
    if (pair.verticalOverlap < 0.5) { out.push(`the ${pair.part}' labels overlap their track by ${pair.verticalOverlap} of the shorter height`); }
    if (pair.labelsOutsideTrack.length > 0) { out.push(`the ${pair.part}' labels outside their track: ${pair.labelsOutsideTrack.join(', ')}`); }
  }
  if (grid.clippedLabels.length > 0) { out.push(`clipped labels: ${grid.clippedLabels.join(', ')}`); }
  return out;
};

const lightboxFacts = () => {
  const clean = (value) => value?.trim().replace(/\s+/g, ' ') ?? null;
  const text = (selector, root = document) => clean(root.querySelector(selector)?.textContent);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].map((element) => clean(element.textContent));
  const border = (element) => (element ? getComputedStyle(element).borderTopStyle : null);
  const tile = document.querySelector('section.pm-lb-tile.is-steering');
  const inspector = document.querySelector('.pm-lb-inspector');
  const bring = inspector?.querySelector('.pm-lb-bring');
  const press = bring?.querySelector('button.pm-lb-button');
  return {
    runLine: text('.pm-lb-run'),
    steering: tile ? {
      register: tile.getAttribute('data-register'),
      stale: text('.pm-lb-stale-note', tile),
      placeholder: text('.pm-lb-reading-placeholder', tile),
      figures: [...tile.querySelectorAll('section.pm-lb-steer-figure')].map((figure) => ({
        label: figure.getAttribute('aria-label'),
        head: all('.pm-lb-steer-head > span', figure),
        rows: all('.pm-lb-steer-row', figure),
        meta: all('.pm-lb-steer-measured .pm-lb-steer-meta', figure),
        measuredBorder: border(figure.querySelector('.pm-lb-steer-measured')),
        reading: text('.pm-lb-steer-reading .pm-lb-craft-note', figure),
        readingQuotes: all('.pm-lb-steer-reading q', figure),
        readingBorder: border(figure.querySelector('.pm-lb-steer-reading')),
        notes: [...figure.querySelectorAll('.pm-lb-steer-note')].map((note) => ({
          stance: text('.pm-lb-craft-tag', note),
          paragraph: text('.pm-lb-craft-para', note),
          quotes: all('q', note),
          why: text('.pm-lb-craft-note', note),
          nudge: text('.pm-lb-steer-nudge', note),
          example: note.querySelector('.pm-lb-steer-example') ? {
            label: text('.pm-lb-steer-example b', note),
            before: text('.pm-lb-steer-before', note),
            after: text('.pm-lb-steer-after', note),
            note: text('.pm-lb-steer-example i', note),
            insideQuote: Boolean(note.querySelector('q .pm-lb-steer-example, .pm-lb-steer-example q')),
            border: border(note.querySelector('.pm-lb-steer-example'))
          } : null,
          exampleWithheld: text('.pm-lb-steer-withheld', note),
          border: border(note)
        }))
      })),
      withheld: all('.pm-lb-withheld-claims > li', tile),
      footnote: text('.pm-lb-foot', tile)
    } : null,
    inspector: inspector ? {
      where: text('.pm-lb-inspector-where', inspector),
      title: text('.pm-lb-inspector-title', inspector),
      claim: text('.pm-lb-inspector-claim', inspector),
      evidence: all('.pm-lb-evidence-quote', inspector),
      details: all('dl.pm-lb-details > div', inspector),
      bring: bring ? {
        state: [...bring.classList].find((name) => name.startsWith('is-')) ?? null,
        label: press?.textContent.trim() ?? null,
        disabled: press?.disabled ?? null,
        note: text('.pm-lb-run-note', bring),
        openWorkshop: Boolean(bring.querySelector('.pm-lb-link'))
      } : null
    } : null,
    numbersSteered: all('.pm-lb-number-steered'),
    lit: [...document.querySelectorAll('.pm-lb-col')].flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : [])),
    staleNotes: all('.pm-lb-stale-note').length,
    tray: text('.pm-lb-tray'),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    posted: window.__pmPosted
      .filter((m) => m.type === 'lightbox_hand_off' || m.type === 'lightbox_open_workshop')
      .map((m) => `${m.type} ${JSON.stringify(m.payload)}`)
  };
};

/** What is wrong with the steering tile in a state, as a list; empty when it is whole. */
const steeringFaults = (steering) => {
  if (!steering) {
    return ['no craft steering tile'];
  }
  const out = [];
  if (steering.figures.length !== 3) { out.push(`${steering.figures.length} figure sections, not 3`); }
  for (const figure of steering.figures) {
    if (figure.measuredBorder !== 'solid') { out.push(`${figure.label}: the measured part is ${figure.measuredBorder}, not solid`); }
    if (figure.reading && figure.readingBorder !== 'dashed') { out.push(`${figure.label}: the reading is ${figure.readingBorder}, not dashed`); }
    for (const note of figure.notes) {
      if (note.border !== 'dashed') { out.push(`${figure.label}: a note is ${note.border}, not dashed`); }
      if (note.example?.insideQuote) { out.push(`${figure.label}: an example is drawn inside a quotation`); }
      if (note.quotes.length !== 1) { out.push(`${figure.label}: a note shows ${note.quotes.length} quotations, not its one`); }
    }
  }
  return out;
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
        // A read state has groups D and E, so the ribbon draws Pressure cells and movement bands; the measured one has neither.
        for (const problem of [...ribbonFaults(pageFacts.ribbonGrid, scenario.expect ?? { cells: true, bands: true }), ...steeringFaults(pageFacts.steering)]) {
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
  console.log(`done; ${errors.length} errors (page errors, ribbon misalignments and steering faults; see errors.txt)`);
})().catch((e) => { console.error(e); process.exit(1); });
