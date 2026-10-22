/*
 * Lightbox Slice 5A.1 visual harness, adapted from
 * ../lightbox-slice-5a-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface, replays the
 * host's messages for each state, acts as the writer would, and screenshots
 * each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/boards.json is real host output: the production LightboxHandler,
 * LightboxReadingHandler, LightboxBoardsHandler, LightboxService, runner,
 * LightboxBoardStore and LightboxBoardLibrary built it over a memory file
 * system, with only the provider played (see README.md and
 * tools/build-boards.test.ts). The names in it were given through the
 * production rename route, and the spark set aside through the production
 * Spark lane route, before the reload that restored it.
 *
 * The rail's requests are only ever answered (the 4E passage pattern), so
 * the stubbed API answers each one the tab posts with the host's recorded
 * answer, echoing the request's id: `lightbox_request_boards` with the
 * board's shelf (the mount's own answer for a request naming no board),
 * `lightbox_open_board` with the opened board and then its shelf, and
 * `lightbox_set_lenses` with the estimate for the board then on screen.
 * Nothing is renamed in the page: `rename-open` opens a row's field and
 * types, and leaves it open. A state whose page does not show what the
 * host's answers say is written to errors.txt, and the harness exits 1: it
 * fails rather than skips.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const states = JSON.parse(fs.readFileSync(path.join(__dirname, 'states', 'boards.json'), 'utf8'));

const pageHtml = `<!DOCTYPE html>
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
    window.__pmPosted = [];
    window.__pmSaved = [];
    const host = (message) => setTimeout(() => window.postMessage(message, '*'), 0);
    const answer = (type, payload, requestId) => host({ type, source: 'extension.lightbox', timestamp: 1, payload: Object.assign({}, payload, { requestId }) });
    window.__pmVsCodeApi = {
      postMessage: (m) => {
        window.__pmPosted.push(m);
        const scenario = window.__pmScenario;
        if (m.type === 'lightbox_set_lenses' && window.__pmEstimate) {
          answer('lightbox_run_estimate', window.__pmEstimate, m.payload.requestId);
        }
        if (m.type === 'lightbox_request_boards') {
          const shelf = m.payload.boardId === null ? scenario.mount : (scenario.shelves || {})[m.payload.boardId];
          if (shelf) { answer('lightbox_boards', shelf, m.payload.requestId); }
        }
        if (m.type === 'lightbox_open_board') {
          const opened = (scenario.opens || {})[m.payload.fileId];
          if (opened) {
            window.__pmEstimate = opened.estimate;
            opened.messages.forEach(host);
            answer('lightbox_boards', opened.answer, m.payload.requestId);
          }
        }
      },
      getState: () => undefined,
      setState: (state) => { window.__pmSaved.push(JSON.stringify(state)); }
    };
    window.acquireVsCodeApi = () => window.__pmVsCodeApi;
    window.proseMinionAssets = { vhsLoadingGif: '', loadingGifs: [], loadingGifList: [], loadingGifCredits: {}, noticeShots: {} };
  </script>
  <script src="file://${path.resolve(bundle)}"></script>
</body>
</html>`;
const pagePath = path.resolve(outDir, 'lightbox.html');
fs.writeFileSync(pagePath, pageHtml);

// The stub models the states were read with (see README.md).
const chrome = [
  { type: 'api_key_status', source: 'extension.configuration', timestamp: 1, payload: { hasSavedKey: true } },
  {
    type: 'model_data', source: 'extension.configuration', timestamp: 1,
    payload: {
      options: [{ id: 'provider/model-v1', label: 'Reader model (stub)', description: '' }],
      selections: { assistant: 'provider/model-v1', widget: 'provider/model-v1' }
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

// Scroll an element to the top of its scroller.
const showTop = (selector) => async (tab) => {
  await tab.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) { return; }
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    element.scrollIntoView({ block: 'start' });
    if (scroller) { scroller.scrollTop -= Math.max(0, scroller.getBoundingClientRect().top + 12 - element.getBoundingClientRect().top); }
    document.scrollingElement.scrollLeft = 0;
  }, selector);
  await tab.mouse.move(4, 4);
};
const showBoards = showTop('.pm-lb-boards');
// Scroll a tile of the board to the top of its scroller, under the sticky ribbon when it is in the board.
const showUnderRibbon = (selector) => async (tab) => {
  await tab.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) { return; }
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    element.scrollIntoView({ block: 'start' });
    const ribbon = document.querySelector('.pm-lb-ribbon');
    const under = ribbon && scroller && scroller.contains(ribbon) ? ribbon.getBoundingClientRect().bottom + 12 : (scroller?.getBoundingClientRect().top ?? 0) + 12;
    if (scroller) { scroller.scrollTop -= Math.max(0, under - element.getBoundingClientRect().top); }
    document.scrollingElement.scrollLeft = 0;
  }, selector);
  await tab.mouse.move(4, 4);
};
const press = (name) => async (tab) => {
  await tab.getByRole('button', { name, exact: true }).click();
  await tab.waitForTimeout(400);
};
const type = (label, text) => async (tab) => {
  await tab.getByRole('textbox', { name: label, exact: true }).fill(text);
  await tab.waitForTimeout(200);
};
const then = (...steps) => async (tab) => { for (const step of steps) { await step(tab); } };

const NAME_B = '3.2.1 - after the cut - model B';
const NAME_A = '3.2.1 - before the cut - model A';
const EDITED = '3.2.2 - before the cut - model A';
const OLDEST = 'Oct 22, 2026, 2:05 PM';
const SECOND = 'Oct 22, 2026, 2:06 PM';
const NEWEST = 'Oct 22, 2026, 2:07 PM';
/** A row as its text reads: its name (when named), when, what it holds, the models that read it, and Open or On screen. */
const ROW = (name, when, meta, models, action) => `${name ?? ''}${when}${meta}${models ?? ''}${action}`;
const ROWS = (onScreen) => [
  ROW(NAME_B, NEWEST, 'Every lens read · ≈ $0.07', 'Read by model-v1 and model-b', onScreen === 0 ? 'On screen' : 'Open'),
  ROW(NAME_A, SECOND, '8 lenses read · ≈ $0.02', 'Read by model-v1', onScreen === 1 ? 'On screen' : 'Open'),
  ROW(null, OLDEST, 'Measured only', null, onScreen === 2 ? 'On screen' : 'Open')
];
const CHANGED_NOTE = {
  text: [`Opened from the board saved ${SECOND}.`, 'The file has changed since. This board shows the text as it was saved, and holds back Bring until you read the current text.'],
  readCurrentText: true
};

const scenarios = [
  {
    // Decision 33: a named row's name first, its date under it, the models that read it; the head names the board on screen.
    name: 'named', data: states.named, act: showBoards,
    expect: {
      status: '3 saved',
      head: { label: NAME_B, action: 'Rename the board on screen', note: null },
      rows: ROWS(0),
      current: [0],
      snapshot: null,
      boardNotice: null
    }
  },
  {
    // A row's Rename opens its field in place, focused, with its name to start from; the writer types.
    name: 'rename-open', data: states.named,
    act: then(press(`Rename the board saved ${SECOND}`), type(`Name for the board saved ${SECOND}`, EDITED), showBoards),
    expect: {
      status: '3 saved',
      head: { label: NAME_B, action: 'Rename the board on screen', note: null },
      rows: [ROWS(0)[0], ROW(null, SECOND, '8 lenses read · ≈ $0.02', 'Read by model-v1', ''), ROWS(0)[2]],
      current: [0],
      snapshot: null,
      boardNotice: null,
      field: { label: `Name for the board saved ${SECOND}`, value: EDITED, focused: true },
      posted: ['lightbox_request_boards'],
      renamed: false
    }
  },
  {
    // Decision 34: the changed-file notice above the board, the rail's own; here the board's column.
    name: 'changed-board', data: states.changed, act: then(press(`Open the board saved ${SECOND}`), showTop('.pm-lb-board-notice')),
    expect: {
      status: '3 saved',
      head: { label: NAME_A, action: 'Rename the board on screen', note: null },
      rows: ROWS(1),
      current: [1],
      snapshot: { tone: 'is-warn', ...CHANGED_NOTE },
      boardNotice: CHANGED_NOTE,
      posted: ['lightbox_open_board']
    }
  },
  {
    // The same state, at the rail: the same notice, the same words.
    name: 'changed-rail', data: states.changed, act: then(press(`Open the board saved ${SECOND}`), showBoards),
    expect: {
      status: '3 saved',
      head: { label: NAME_A, action: 'Rename the board on screen', note: null },
      rows: ROWS(1),
      current: [1],
      snapshot: { tone: 'is-warn', ...CHANGED_NOTE },
      boardNotice: CHANGED_NOTE,
      posted: ['lightbox_open_board']
    }
  },
  {
    // Decision 35: a spark set aside was saved at once, in place (still three files), and a reload brought it back.
    name: 'spark', data: states.spark, act: showUnderRibbon('.pm-lb-spark-lane'),
    expect: {
      status: '3 saved',
      head: { label: NAME_B, action: 'Rename the board on screen', note: null },
      rows: ROWS(0),
      current: [0],
      snapshot: { tone: 'is-quiet', text: [`Opened from the board saved ${NEWEST}.`, 'The file still holds the text it was read from.'], readCurrentText: false },
      boardNotice: null,
      setAside: /^1 spark set aside\. Undo Brings back “.+”\.$/
    }
  },
  {
    // Session-only: the in-memory board is named, and the head says the name lasts as long as the session.
    name: 'session-named', data: states.sessionNamed, act: showBoards,
    expect: {
      status: 'this session',
      head: { label: NAME_B, action: 'Rename the board on screen', note: 'A name lasts as long as this session, as the board does.' },
      rows: [],
      current: [],
      snapshot: null,
      boardNotice: null,
      note: 'Boards are kept for this session only: no folder is open. Open one folder to save them.'
    }
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1100 },
  { tag: '1000', width: 1000, height: 1100 },
  { tag: '500', width: 500, height: 1400 }
];

const facts = () => {
  const clean = (value) => value?.trim().replace(/\s+/g, ' ') ?? null;
  const panel = document.querySelector('.pm-lb-boards');
  const snapshot = panel?.querySelector('.pm-lb-snapshot');
  const notice = document.querySelector('.pm-lb-board-notice');
  const head = panel?.querySelector('.pm-lb-board-name');
  const field = panel?.querySelector('.pm-lb-name-input');
  const rows = [...(panel?.querySelectorAll('.pm-lb-saved-board') ?? [])];
  const noteOf = (element) => element ? {
    text: [...element.querySelectorAll('.pm-lb-snapshot-body > p')].map((p) => clean(p.textContent)),
    readCurrentText: Boolean([...element.querySelectorAll('button')].find((button) => clean(button.textContent) === 'Read the current text'))
  } : null;
  return {
    subtitle: clean(document.querySelector('.pm-ws-subtitle')?.textContent),
    status: clean(panel?.querySelector('.pm-ws-block-head .pm-lb-meta')?.textContent),
    head: head ? {
      label: clean(head.querySelector('.pm-lb-board-name-label')?.textContent),
      action: head.querySelector('button')?.getAttribute('aria-label') ?? null,
      note: clean(head.querySelector('.pm-lb-board-name-note')?.textContent)
    } : null,
    rows: rows.map((row) => row.textContent),
    rowModelTitles: rows.map((row) => row.querySelector('.pm-lb-saved-board-models')?.getAttribute('title') ?? null),
    current: rows.flatMap((row, index) => (row.getAttribute('aria-current') === 'true' ? [index] : [])),
    snapshot: snapshot ? { tone: [...snapshot.classList].find((name) => name.startsWith('is-')) ?? null, ...noteOf(snapshot) } : null,
    boardNotice: noteOf(notice),
    boardNoticeFirst: notice ? notice.parentElement?.firstElementChild === notice : null,
    field: field ? { label: field.getAttribute('aria-label'), value: field.value, focused: document.activeElement === field } : null,
    note: clean(panel?.querySelector('.pm-lb-boards-note')?.textContent),
    notice: clean(panel?.querySelector('.pm-lb-boards-notice')?.textContent),
    setAside: clean(document.querySelector('.pm-lb-spark-set-aside')?.textContent),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    // A button whose right edge runs past the box that clips it (PR #164 review: the press's cost at 500 px).
    clippedButtons: [...document.querySelectorAll('button')].filter((button) => {
      const box = button.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) { return false; }
      let clip = button.parentElement;
      while (clip && clip !== document.body && getComputedStyle(clip).overflowX === 'visible') { clip = clip.parentElement; }
      const right = clip && clip !== document.body ? clip.getBoundingClientRect().right : window.innerWidth;
      return box.right > right + 0.5;
    }).map((button) => clean(button.textContent)),
    posted: window.__pmPosted
      .filter((m) => ['lightbox_request_boards', 'lightbox_open_board', 'lightbox_rename_board', 'lightbox_refresh_source'].includes(m.type))
      .map((m) => `${m.type} ${JSON.stringify(m.payload)}`),
    savedStates: window.__pmSaved.length,
    savedStateNamesAFile: window.__pmSaved.some((state) => state.includes('.board.json')),
    savedStateHoldsAName: window.__pmSaved.some((state) => state.includes('the cut'))
  };
};

/** What is wrong with a state's page, as a list; empty when it shows what the host's answers say. */
const faults = (seen, expect) => {
  const out = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (seen.status !== expect.status) { out.push(`status "${seen.status}", not "${expect.status}"`); }
  if (!same(seen.head, expect.head)) { out.push(`head ${JSON.stringify(seen.head)}, not ${JSON.stringify(expect.head)}`); }
  if (!same(seen.rows, expect.rows)) { out.push(`rows ${JSON.stringify(seen.rows)}, not ${JSON.stringify(expect.rows)}`); }
  if (!same(seen.current, expect.current)) { out.push(`on screen ${JSON.stringify(seen.current)}, not ${JSON.stringify(expect.current)}`); }
  if (!same(seen.snapshot, expect.snapshot)) { out.push(`snapshot ${JSON.stringify(seen.snapshot)}, not ${JSON.stringify(expect.snapshot)}`); }
  if (!same(seen.boardNotice, expect.boardNotice)) { out.push(`the notice above the board ${JSON.stringify(seen.boardNotice)}, not ${JSON.stringify(expect.boardNotice)}`); }
  if (expect.boardNotice && seen.boardNoticeFirst !== true) { out.push('the notice is not the first thing in the board\'s column'); }
  // One source of truth: the notice above the board says exactly what the rail's says.
  if (seen.boardNotice && seen.snapshot && !same(seen.boardNotice.text, seen.snapshot.text)) { out.push('the two notices say different things'); }
  if (!same(seen.field, expect.field ?? null)) { out.push(`field ${JSON.stringify(seen.field)}, not ${JSON.stringify(expect.field ?? null)}`); }
  if (expect.note && seen.note !== expect.note) { out.push(`note "${seen.note}", not "${expect.note}"`); }
  if (expect.setAside && !expect.setAside.test(seen.setAside ?? '')) { out.push(`set aside "${seen.setAside}", not ${expect.setAside}`); }
  if (seen.subtitle !== 'Drafts/alice-1.md · 508 words') { out.push(`subtitle "${seen.subtitle}"`); }
  for (const type of expect.posted ?? []) {
    if (!seen.posted.some((line) => line.startsWith(`${type} `))) { out.push(`never posted ${type}`); }
  }
  if (expect.renamed === false && seen.posted.some((line) => line.startsWith('lightbox_rename_board '))) { out.push('renamed with the field still open'); }
  if (!seen.posted.some((line) => line.startsWith('lightbox_request_boards '))) { out.push('never asked for its shelf'); }
  if (seen.notice) { out.push(`a notice: "${seen.notice}"`); }
  if (seen.horizontalOverflow) { out.push('horizontal overflow'); }
  if (seen.clippedButtons.length > 0) { out.push(`clipped buttons: ${JSON.stringify(seen.clippedButtons)}`); }
  if (seen.savedStateNamesAFile) { out.push('a saved webview state names a board file'); }
  if (seen.savedStateHoldsAName) { out.push('a saved webview state holds a board\'s name'); }
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const all = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, timezoneId: 'UTC', locale: 'en-US' });
      const tab = await context.newPage();
      tab.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await tab.addInitScript((data) => {
        window.__pmScenario = JSON.parse(JSON.stringify(data));
        window.__pmEstimate = data.estimate;
      }, scenario.data);
      await tab.goto('file://' + pagePath);
      await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      for (const entry of [...chrome, ...scenario.data.messages]) {
        await tab.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await tab.waitForTimeout(400);
      try {
        await scenario.act(tab);
      } catch (error) {
        errors.push(`${scenario.name}@${viewport.tag}: could not act: ${error.message.split('\n')[0]}`);
      }
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(500);
      let previous = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
      let stable = false;
      for (let attempt = 0; attempt < 8 && !stable; attempt++) {
        await tab.waitForTimeout(250);
        const next = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
        stable = Buffer.compare(previous, next) === 0;
        previous = next;
      }
      if (!stable) { errors.push(`${scenario.name}@${viewport.tag}: never settled`); }
      fs.writeFileSync(path.join(outDir, `lightbox-${scenario.name}-${viewport.tag}.png`), previous);
      const seen = await tab.evaluate(facts);
      for (const problem of faults(seen, scenario.expect)) {
        errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
      }
      all[`${scenario.name}@${viewport.tag}`] = seen;
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(all, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see errors.txt)`);
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
