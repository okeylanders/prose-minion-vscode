/*
 * Lightbox Slice 5A visual harness, adapted from
 * ../lightbox-slice-4f-visual/harness.js: renders a built webview bundle in
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
 * tools/build-boards.test.ts).
 *
 * The rail's requests are only ever answered (the 4E passage pattern), so
 * the stubbed API answers each one the tab posts with the host's recorded
 * answer, echoing the request's id: `lightbox_request_boards` with the
 * board's shelf (the mount's own answer for a request naming no board),
 * `lightbox_open_board` with the opened board and then its shelf,
 * `lightbox_refresh_source` with the re-read board and the save the host
 * pushed, and `lightbox_set_lenses` with the estimate for the board then on
 * screen. The `earlier-rule` state restores a board saved under another
 * citation rule and reads its Opinion's standing and Bring from the page.
 * The `history` states hold 23 boards of one source: the rail shows the
 * newest twenty and says so, and Show older shows the rest (PR #163 F-04).
 * A state whose page does not show what the host's answers say is
 * written to errors.txt, and the harness exits 1: it fails rather than
 * skips.
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
        if (m.type === 'lightbox_refresh_source' && scenario.refresh) {
          window.__pmEstimate = scenario.refresh.estimate;
          scenario.shelves = Object.assign({}, scenario.shelves, scenario.refresh.shelves);
          scenario.refresh.messages.forEach(host);
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

// The stub model the states were read with (see README.md).
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

// Scroll the Boards section to the top of its scroller.
const showBoards = async (tab) => {
  await tab.evaluate(() => {
    const element = document.querySelector('.pm-lb-boards');
    if (!element) { return; }
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    element.scrollIntoView({ block: 'start' });
    if (scroller) { scroller.scrollTop -= Math.max(0, scroller.getBoundingClientRect().top + 12 - element.getBoundingClientRect().top); }
    document.scrollingElement.scrollLeft = 0;
  });
  await tab.mouse.move(4, 4);
};
// Scroll the Opinion tile to the top of its scroller, under the sticky ribbon when it is in the board.
const showOpinion = async (tab) => {
  await tab.evaluate(() => {
    const element = document.querySelector('.pm-lb-opinion');
    if (!element) { return; }
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    element.scrollIntoView({ block: 'start' });
    const ribbon = document.querySelector('.pm-lb-ribbon');
    const under = ribbon && scroller && scroller.contains(ribbon) ? ribbon.getBoundingClientRect().bottom + 12 : (scroller?.getBoundingClientRect().top ?? 0) + 12;
    if (scroller) { scroller.scrollTop -= Math.max(0, under - element.getBoundingClientRect().top); }
    document.scrollingElement.scrollLeft = 0;
  });
  await tab.mouse.move(4, 4);
};
// Scroll so the element's bottom sits at the bottom of the window (the end of the Boards section).
const showEnd = (selector) => async (tab) => {
  await tab.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) { return; }
    element.scrollIntoView({ block: 'end' });
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    if (scroller) { scroller.scrollTop += 12; }
    document.scrollingElement.scrollLeft = 0;
  }, selector);
  await tab.mouse.move(4, 4);
};
const press = (name) => async (tab) => {
  await tab.getByRole('button', { name, exact: true }).click();
  await tab.waitForTimeout(400);
};
const then = (...steps) => async (tab) => { for (const step of steps) { await step(tab); } };

const OLDEST = 'Oct 22, 2026, 2:05 PM';
const SECOND = 'Oct 22, 2026, 2:06 PM';
const NEWEST = 'Oct 22, 2026, 2:07 PM';
const ROW = (when, meta, action) => `${when}${meta}${action}`;
const EARLIER_RULE = 'Saved under an earlier citation rule; read the Opinion again to bring it current.';
/**
 * The `history` source's 23 boards, newest first: 22 reads, 2:27 PM back to 2:06 PM, then the measured board at 2:05 PM.
 * Each read of every lens records $0.07, and a board's cost is what its readings recorded, so the nth read's board shows n × $0.07.
 */
const HISTORY = Array.from({ length: 23 }, (_, newest) => {
  const reads = 22 - newest;
  const when = `Oct 22, 2026, 2:${String(5 + reads).padStart(2, '0')} PM`;
  return ROW(when, reads === 0 ? 'Measured only' : `Every lens read · ≈ $${(0.07 * reads).toFixed(2)}`, newest === 0 ? 'On screen' : 'Open');
});
/** What the stand-in Opinion's Bring says when its standing allows it: it cites tiles, not quotes. */
const NO_QUOTE = 'Its observations cite no quote, and a Workshop tile carries at least one.';

const scenarios = [
  {
    name: 'rail', data: states.rail, act: showBoards,
    expect: {
      status: '3 saved',
      rows: [ROW(NEWEST, 'Every lens read · ≈ $0.07', 'On screen'), ROW(SECOND, '8 lenses read · ≈ $0.02', 'Open'), ROW(OLDEST, 'Measured only', 'Open')],
      current: [0],
      snapshot: null,
      opinion: { staleNote: null, bringDisabled: true, bringNote: NO_QUOTE }
    }
  },
  {
    name: 'opened', data: states.opened, act: then(press(`Open the board saved ${OLDEST}`), showBoards),
    expect: {
      status: '3 saved',
      rows: [ROW(NEWEST, 'Every lens read · ≈ $0.07', 'Open'), ROW(SECOND, '8 lenses read · ≈ $0.02', 'Open'), ROW(OLDEST, 'Measured only', 'On screen')],
      current: [2],
      snapshot: { tone: 'is-quiet', text: [`Opened from the board saved ${OLDEST}.`, 'The file still holds the text it was read from.'], readCurrentText: false },
      posted: ['lightbox_open_board']
    }
  },
  {
    name: 'changed', data: states.changed, act: then(press(`Open the board saved ${SECOND}`), showBoards),
    expect: {
      status: '3 saved',
      rows: [ROW(NEWEST, 'Every lens read · ≈ $0.07', 'Open'), ROW(SECOND, '8 lenses read · ≈ $0.02', 'On screen'), ROW(OLDEST, 'Measured only', 'Open')],
      current: [1],
      snapshot: {
        tone: 'is-warn',
        text: [`Opened from the board saved ${SECOND}.`, 'The file has changed since. This board shows the text as it was saved, and holds back Bring until you read the current text.'],
        readCurrentText: true
      },
      posted: ['lightbox_open_board']
    }
  },
  {
    name: 'read-current', data: states.changed,
    act: then(press(`Open the board saved ${SECOND}`), press('Read the current text'), showBoards),
    expect: {
      status: '4 saved',
      rows: [
        ROW('Oct 22, 2026, 2:08 PM', '8 lenses read · 8 stale · ≈ $0.02', 'On screen'),
        ROW(NEWEST, 'Every lens read · ≈ $0.07', 'Open'),
        ROW(SECOND, '8 lenses read · ≈ $0.02', 'Open'),
        ROW(OLDEST, 'Measured only', 'Open')
      ],
      current: [0],
      snapshot: null,
      subtitle: 'Drafts/alice-1.md · 519 words',
      posted: ['lightbox_open_board', 'lightbox_refresh_source']
    }
  },
  {
    name: 'delete-confirm', data: states.rail, act: then(press(`Delete the board saved ${OLDEST}`), showBoards),
    expect: {
      status: '3 saved',
      rows: [ROW(NEWEST, 'Every lens read · ≈ $0.07', 'On screen'), ROW(SECOND, '8 lenses read · ≈ $0.02', 'Open'), ROW(OLDEST, 'Measured only', 'Delete this file?DeleteKeep')],
      current: [0],
      snapshot: null,
      confirm: `Delete the board saved ${OLDEST}?`,
      focused: 'Keep'
    }
  },
  {
    name: 'session-only', data: states.sessionOnly, act: showBoards,
    expect: {
      status: 'this session',
      rows: [],
      current: [],
      snapshot: null,
      note: 'Boards are kept for this session only: no folder is open. Open one folder to save them.'
    }
  },
  {
    // The writer-data rule: a file saved under another citation rule, restored after a reload, opens whole.
    name: 'earlier-rule', data: states.earlierRule, act: showOpinion,
    expect: {
      status: '2 saved',
      rows: [ROW(SECOND, 'Every lens read · ≈ $0.07', 'On screen'), ROW(OLDEST, 'Measured only', 'Open')],
      current: [0],
      snapshot: { tone: 'is-quiet', text: [`Opened from the board saved ${SECOND}.`, 'The file still holds the text it was read from.'], readCurrentText: false },
      opinion: { staleNote: `Stale ${EARLIER_RULE}`, bringDisabled: true, bringNote: EARLIER_RULE }
    }
  },
  {
    // PR #163 F-04: every board is listed; the rail shows the newest twenty and says how many there are.
    name: 'history', data: states.history, act: showEnd('.pm-lb-boards .pm-lb-caption'),
    expect: {
      status: '23 saved',
      rows: HISTORY.slice(0, 20),
      current: [0],
      snapshot: null,
      page: { note: 'Showing the newest 20 of 23.', more: 'Show 3 older' }
    }
  },
  {
    name: 'history-older', data: states.history, act: then(press('Show 3 older'), showEnd('.pm-lb-boards .pm-lb-caption')),
    expect: { status: '23 saved', rows: HISTORY, current: [0], snapshot: null }
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
  const rows = [...(panel?.querySelectorAll('.pm-lb-saved-board') ?? [])];
  return {
    subtitle: clean(document.querySelector('.pm-ws-subtitle')?.textContent),
    status: clean(panel?.querySelector('.pm-ws-block-head .pm-lb-meta')?.textContent),
    rows: rows.map((row) => row.textContent),
    current: rows.flatMap((row, index) => (row.getAttribute('aria-current') === 'true' ? [index] : [])),
    snapshot: snapshot ? {
      tone: [...snapshot.classList].find((name) => name.startsWith('is-')) ?? null,
      text: [...snapshot.querySelectorAll('.pm-lb-snapshot-body > p')].map((p) => clean(p.textContent)),
      readCurrentText: Boolean([...snapshot.querySelectorAll('button')].find((button) => clean(button.textContent) === 'Read the current text'))
    } : null,
    note: clean(panel?.querySelector('.pm-lb-boards-note')?.textContent),
    page: (() => {
      const page = panel?.querySelector('.pm-lb-boards-page');
      return page ? { note: clean(page.querySelector('[role="status"]')?.textContent), more: clean(page.querySelector('button')?.textContent) } : null;
    })(),
    notice: clean(panel?.querySelector('.pm-lb-boards-notice')?.textContent),
    caption: clean(panel?.querySelector('.pm-lb-caption')?.textContent),
    confirm: panel?.querySelector('[role="group"]')?.getAttribute('aria-label') ?? null,
    focused: document.activeElement && document.activeElement !== document.body
      ? document.activeElement.getAttribute('aria-label') || clean(document.activeElement.textContent)
      : null,
    staleNotes: document.querySelectorAll('.pm-lb-stale-note').length,
    opinion: (() => {
      const tile = document.querySelector('.pm-lb-opinion');
      const bring = tile?.querySelector('.pm-lb-op-action.pm-lb-bring');
      return tile ? {
        staleNote: clean(tile.querySelector('.pm-lb-stale-note')?.textContent),
        bringDisabled: bring?.querySelector('button')?.disabled ?? null,
        bringNote: clean(bring?.querySelector('.pm-lb-run-note')?.textContent)
      } : null;
    })(),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    posted: window.__pmPosted
      .filter((m) => ['lightbox_request_boards', 'lightbox_open_board', 'lightbox_delete_board', 'lightbox_refresh_source'].includes(m.type))
      .map((m) => `${m.type} ${JSON.stringify(m.payload)}`),
    savedStates: window.__pmSaved.length,
    savedStateNamesAFile: window.__pmSaved.some((state) => state.includes('.board.json'))
  };
};

/** What is wrong with a state's page, as a list; empty when it shows what the host's answers say. */
const faults = (seen, expect) => {
  const out = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (seen.status !== expect.status) { out.push(`status "${seen.status}", not "${expect.status}"`); }
  if (!same(seen.rows, expect.rows)) { out.push(`rows ${JSON.stringify(seen.rows)}, not ${JSON.stringify(expect.rows)}`); }
  if (!same(seen.current, expect.current)) { out.push(`on screen ${JSON.stringify(seen.current)}, not ${JSON.stringify(expect.current)}`); }
  if (!same(seen.snapshot, expect.snapshot)) { out.push(`snapshot ${JSON.stringify(seen.snapshot)}, not ${JSON.stringify(expect.snapshot)}`); }
  if (expect.note && seen.note !== expect.note) { out.push(`note "${seen.note}", not "${expect.note}"`); }
  if (!same(seen.page, expect.page ?? null)) { out.push(`page ${JSON.stringify(seen.page)}, not ${JSON.stringify(expect.page ?? null)}`); }
  if (expect.opinion && !same(seen.opinion, expect.opinion)) { out.push(`the Opinion ${JSON.stringify(seen.opinion)}, not ${JSON.stringify(expect.opinion)}`); }
  if (expect.confirm && seen.confirm !== expect.confirm) { out.push(`confirm "${seen.confirm}", not "${expect.confirm}"`); }
  if (expect.focused && seen.focused !== expect.focused) { out.push(`focus on "${seen.focused}", not "${expect.focused}"`); }
  if (seen.subtitle !== (expect.subtitle ?? 'Drafts/alice-1.md · 508 words')) { out.push(`subtitle "${seen.subtitle}", not "${expect.subtitle ?? 'Drafts/alice-1.md · 508 words'}"`); }
  for (const type of expect.posted ?? []) {
    if (!seen.posted.some((line) => line.startsWith(`${type} `))) { out.push(`never posted ${type}`); }
  }
  if (!seen.posted.some((line) => line.startsWith('lightbox_request_boards '))) { out.push('never asked for its shelf'); }
  if (seen.notice) { out.push(`a notice: "${seen.notice}"`); }
  if (seen.horizontalOverflow) { out.push('horizontal overflow'); }
  if (seen.savedStateNamesAFile) { out.push('a saved webview state names a board file'); }
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
