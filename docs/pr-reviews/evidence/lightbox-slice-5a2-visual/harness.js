/*
 * Lightbox Slice 5A.2 visual harness, adapted from
 * ../lightbox-slice-5a1-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface, replays the
 * host's messages for each state, acts as the writer would, and screenshots
 * each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/boards.json is real host output: the production LightboxHandler,
 * LightboxReadingHandler, LightboxBoardsHandler, LightboxService, runner,
 * LightboxBoardStore and LightboxBoardLibrary built it over a memory file
 * system, across six working sessions, with only the provider played (see
 * README.md and tools/build-boards.test.ts). The two names in it were given
 * through the production rename route.
 *
 * The Boards menu's and browser's requests are only ever answered (the 4E
 * passage pattern), so the stubbed API answers each one the tab posts with
 * the host's recorded answer, echoing the request's id:
 * `lightbox_request_boards` with the board's shelf (the mount's own answer
 * for a request naming no board), `lightbox_open_board` and
 * `lightbox_open_board_file` with the opened board and then the host's
 * answer, and `lightbox_set_lenses` with the estimate for the board then on
 * screen. Nothing is renamed or deleted in the page: `browser-rename` opens
 * a row's field and types, `browser-delete` asks, and both leave it there.
 * The page's clock is pinned to 3:00 PM UTC on Oct 23, 2026, so "Today",
 * "Yesterday" and "This week" are the same on every run. A state whose page
 * does not show what the host's answers say is written to errors.txt, and
 * the harness exits 1: it fails rather than skips.
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
const NOW = new Date('2026-10-23T15:00:00.000Z');

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
    const play = (opened, requestId) => {
      window.__pmEstimate = opened.estimate;
      opened.messages.forEach(host);
      answer('lightbox_boards', opened.answer, requestId);
    };
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
          if (opened) { play(opened, m.payload.requestId); }
        }
        if (m.type === 'lightbox_open_board_file' && scenario.files) {
          play(scenario.files, m.payload.requestId);
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

const settle = (tab) => tab.waitForTimeout(400);
const openMenu = async (tab) => {
  await tab.getByTitle('Board commands and recent saved boards', { exact: true }).click();
  await settle(tab);
};
const choose = (name) => async (tab) => {
  await tab.getByRole('menuitem', { name, exact: true }).click();
  await settle(tab);
};
const press = (name) => async (tab) => {
  await tab.getByRole('button', { name, exact: true }).click();
  await settle(tab);
};
const type = (label, text, role = 'textbox') => async (tab) => {
  await tab.getByRole(role, { name: label, exact: true }).fill(text);
  await tab.waitForTimeout(300);
};
const search = (text) => type('Search board names and chapters', text, 'searchbox');
// A row's Rename and Delete show while the row is hovered (or focused within), as the Workshop's do: hover it first.
const rowAction = (action, name) => async (tab) => {
  await tab.locator('.pm-ws-session-browser-row', { has: tab.locator(`strong[title="${name}"]`) }).hover();
  await press(`${action} ${name}`)(tab);
};
const groupBy = (label) => async (tab) => {
  await tab.locator('.pm-ws-sessions-group-control button', { hasText: label }).click();
  await settle(tab);
};
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
};
const then = (...steps) => async (tab) => { for (const step of steps) { await step(tab); } };
const openBrowser = then(openMenu, choose('Open prior board…'));

// The rows, as the host's shelf says: name, chapter, when (UTC), lenses, stale, cost, models.
const ON_SCREEN = 'alice-1 - 10/23/2026 9:08 AM';
const BOARD = {
  F: { name: ON_SCREEN, chapter: 'Drafts/alice-1.md', when: 'Oct 23, 2026, 9:08 AM', lenses: 'Every lens read', cost: '≈ $0.07', models: 'Read by model-v1' },
  E: { name: 'alice-3 - 10/22/2026 1:15 PM', chapter: 'Drafts/alice-3.md', when: 'Oct 22, 2026, 1:15 PM', lenses: '7 lenses read', cost: '≈ $0.02', models: 'Read by model-v1' },
  D: { name: 'alice-2 - 10/21/2026 11:20 AM', chapter: 'Drafts/alice-2.md', when: 'Oct 21, 2026, 11:20 AM', lenses: '18 lenses read', stale: '18 stale', cost: '≈ $0.07', models: 'Read by model-b' },
  C: { name: 'alice-2 - second pass', chapter: 'Drafts/alice-2.md', when: 'Oct 19, 2026, 4:41 PM', lenses: '18 lenses read', cost: '≈ $0.07', models: 'Read by model-b' },
  B: { name: 'alice-3 - 10/14/2026 10:00 AM', chapter: 'Drafts/alice-3.md', when: 'Oct 14, 2026, 10:00 AM', lenses: 'Measured only' },
  A: { name: 'alice-1 - first pass', chapter: 'Drafts/alice-1.md', when: 'Oct 12, 2026, 2:06 PM', lenses: '8 lenses read', cost: '≈ $0.02', models: 'Read by model-v1' }
};
/** A browser row as the page reads: its title, its meta line, its models, its badge, and its Open. */
const ROW = (key, onScreen = 'F') => {
  const board = BOARD[key];
  const here = key === onScreen;
  return {
    title: board.name,
    meta: [board.chapter, board.when, board.lenses, board.stale, board.cost].filter(Boolean).join('·'),
    models: board.models ?? null,
    badge: here ? 'On screen' : null,
    open: here ? 'Open (disabled)' : 'Open'
  };
};
const GROUP = (label, keys, onScreen) => ({ label: `${label} ${keys.length}`, rows: keys.map((key) => ROW(key, onScreen)) });
const BY_DATE = [GROUP('Today', ['F']), GROUP('This week', ['E', 'D', 'C']), GROUP('Earlier', ['B', 'A'])];
const BY_CHAPTER = [GROUP('Drafts/alice-1.md', ['F', 'A']), GROUP('Drafts/alice-3.md', ['E', 'B']), GROUP('Drafts/alice-2.md', ['D', 'C'])];
const SAVED_CAPTION = 'Saved in prose-minion/boards, one file per board. "Read the current text" starts a new one. Nothing is deleted unless you delete it. Open a board file…';
const SESSION_NOTE = 'Boards are kept for this session only: no folder is open. Open one folder to save them.';
/** The menu, line by line: `# heading`, an item, `title — meta` for a recent board, `—` for a rule, `~ note`. */
const MENU = (recent, note) => [
  '# Board',
  ...(note ? [`~ ${note}`] : []),
  'Rename board…',
  'Board another chapter…',
  '—',
  'Open prior board…',
  '# Recent',
  ...recent,
  '—',
  'Browse all boards…'
];
const LIBRARY_RECENT = [
  `${BOARD.F.name} — Drafts/alice-1.md · on screen (disabled)`,
  `${BOARD.E.name} — Drafts/alice-3.md · Yesterday · 1:15 PM`,
  `${BOARD.D.name} — Drafts/alice-2.md · Wed · Oct 21`,
  `${BOARD.C.name} — Drafts/alice-2.md · Mon · Oct 19`,
  `${BOARD.B.name} — Drafts/alice-3.md · Oct 14`
];
const BROWSER = (overrides) => ({
  title: 'Open a prior board',
  notes: [],
  grouping: 'Date',
  search: '',
  groups: BY_DATE,
  empty: null,
  footer: SAVED_CAPTION,
  ...overrides
});
const CHANGED_NOTE = {
  tone: 'is-warn',
  text: ['Opened from the board saved Oct 12, 2026, 2:06 PM.', 'The file has changed since. This board shows the text as it was saved, and holds back Bring until you read the current text.'],
  readCurrentText: true
};
const OUTSIDE_NOTE = {
  tone: 'is-quiet',
  text: ['Opened from a board file outside the boards folder, saved Oct 12, 2026, 2:06 PM. Its next save writes it there, as a file of its own.', 'The file still holds the text it was read from.'],
  readCurrentText: false
};
const LIBRARY_HEAD = { trigger: ON_SCREEN, status: 'Saved', subtitle: 'Drafts/alice-1.md · 508 words' };

const scenarios = [
  {
    // Decision 41: the Boards menu in the header, as the Workshop's sessions menu: the five newest boards of every chapter.
    name: 'menu', data: states.library, act: openMenu,
    expect: { ...LIBRARY_HEAD, menu: MENU(LIBRARY_RECENT), browser: null, focused: 'Rename board…' }
  },
  {
    // The browser, every chapter's boards grouped by date (the Workshop's buckets); the shelf asked for again as it opens.
    name: 'browser-date', data: states.library, act: openBrowser,
    expect: { ...LIBRARY_HEAD, menu: null, browser: BROWSER({}), focused: 'Search board names and chapters', posted: ['lightbox_request_boards'] }
  },
  {
    // Grouped by chapter: each chapter once, in the order of its newest board.
    name: 'browser-chapter', data: states.library, act: then(openBrowser, groupBy('Chapter')),
    expect: { ...LIBRARY_HEAD, menu: null, browser: BROWSER({ grouping: 'Chapter', groups: BY_CHAPTER }) }
  },
  {
    // Search over names and chapter paths: "pass" finds the two named boards, of two chapters.
    name: 'browser-search', data: states.library, act: then(openBrowser, search('pass')),
    expect: { ...LIBRARY_HEAD, menu: null, browser: BROWSER({ search: 'pass', groups: [GROUP('This week', ['C']), GROUP('Earlier', ['A'])] }) }
  },
  {
    // Inline rename: the Oct 21 row's field, focused, holding what the writer typed; nothing is sent until Enter.
    name: 'browser-rename', data: states.library,
    act: then(openBrowser, rowAction('Rename', BOARD.D.name), type('Rename board', 'alice-2 - after the change')),
    expect: {
      ...LIBRARY_HEAD, menu: null,
      browser: BROWSER({ groups: [GROUP('Today', ['F']), { ...GROUP('This week', ['E', 'D', 'C']), rows: [ROW('E'), { ...ROW('D'), title: 'alice-2 - after the change' }, ROW('C')] }, GROUP('Earlier', ['B', 'A'])] }),
      field: { label: 'Rename board', value: 'alice-2 - after the change', focused: true, error: null },
      focused: 'Rename board',
      notPosted: ['lightbox_rename_board']
    }
  },
  {
    // Delete asks first: Confirm and Keep in the row, and focus on Keep, the safe answer; nothing is sent.
    name: 'browser-delete', data: states.library, act: then(openBrowser, rowAction('Delete', BOARD.B.name)),
    expect: {
      ...LIBRARY_HEAD, menu: null, browser: BROWSER({}),
      confirm: { buttons: [`Confirm delete ${BOARD.B.name}`, `Keep ${BOARD.B.name}`] },
      focused: `Keep ${BOARD.B.name}`,
      notPosted: ['lightbox_delete_board']
    }
  },
  {
    // Session-only: the menu says boards are kept for this session, and why.
    name: 'session-menu', data: states.session, act: openMenu,
    expect: { trigger: 'alice-1', status: 'This session only', subtitle: 'Drafts/alice-1.md · 508 words', menu: MENU(['~ No saved boards yet.'], SESSION_NOTE), browser: null, focused: 'Rename board…' }
  },
  {
    // Session-only: so does the browser, with nothing to open; "Open a board file…" still opens one from anywhere.
    name: 'session-browser', data: states.session, act: openBrowser,
    expect: {
      trigger: 'alice-1', status: 'This session only', subtitle: 'Drafts/alice-1.md · 508 words', menu: null,
      browser: BROWSER({
        notes: [SESSION_NOTE], groups: [], empty: 'Boards are kept for this session only, so there are none to open here.',
        footer: 'Open one folder, and boards save themselves there. Open a board file…'
      })
    }
  },
  {
    // Decision 34, kept: the Oct 12 board opened from the browser over a chapter changed since; the notice is above the board.
    name: 'changed', data: states.changed, act: then(openBrowser, press(`Open ${BOARD.A.name}`), showTop('.pm-lb-board-notice')),
    expect: { trigger: BOARD.A.name, status: 'Saved', subtitle: 'Drafts/alice-1.md · 508 words', menu: null, browser: null, boardNotice: CHANGED_NOTE, posted: ['lightbox_open_board'] }
  },
  {
    // "Open a board file…": a copy kept outside the boards folder opens as a snapshot; no file holds it yet.
    name: 'outside', data: states.outside, act: then(openBrowser, press('Open a board file…'), showTop('.pm-lb-board-notice')),
    expect: { trigger: BOARD.A.name, status: 'Not saved yet', subtitle: 'Drafts/alice-1.md · 508 words', menu: null, browser: null, boardNotice: OUTSIDE_NOTE, posted: ['lightbox_open_board_file'] }
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1000 },
  { tag: '1000', width: 1000, height: 1000 },
  { tag: '500', width: 500, height: 1100 }
];

const facts = () => {
  const clean = (value) => value?.trim().replace(/\s+/g, ' ') ?? null;
  const trigger = document.querySelector('.pm-ws-sessions-trigger');
  const menu = document.querySelector('#pm-lb-boards-menu');
  const dialog = document.querySelector('[role="dialog"]');
  const notice = document.querySelector('.pm-lb-board-notice');
  const field = dialog?.querySelector('.pm-ws-session-browser-row input');
  const confirm = dialog?.querySelector('.pm-ws-session-delete-confirm')?.parentElement;
  const box = (element) => element && (({ left, right, top, bottom }) => ({ left, right, top, bottom }))(element.getBoundingClientRect());
  const outside = (element) => {
    const edge = box(element);
    return Boolean(edge) && (edge.left < -0.5 || edge.right > window.innerWidth + 0.5 || edge.top < -0.5);
  };
  const menuLine = (child) => {
    if (child.classList.contains('pm-ws-sessions-menu-heading')) { return `# ${clean(child.textContent)}`; }
    if (child.classList.contains('pm-ws-sessions-menu-rule')) { return '—'; }
    if (child.classList.contains('pm-ws-sessions-menu-empty')) { return `~ ${clean(child.textContent)}`; }
    const off = child.disabled ? ' (disabled)' : '';
    if (child.classList.contains('pm-ws-sessions-menu-recent')) {
      return `${clean(child.querySelector('strong')?.textContent)} — ${clean(child.querySelector('span')?.textContent)}${off}`;
    }
    return `${clean(child.textContent)}${off}`;
  };
  const rowOf = (row) => {
    const input = row.querySelector('.pm-ws-session-row-title input');
    const open = row.querySelector('.pm-ws-session-row-actions button');
    return {
      title: input ? input.value : clean(row.querySelector('.pm-ws-session-row-title strong')?.textContent),
      meta: row.querySelector('.pm-ws-session-row-meta')?.textContent ?? null,
      models: clean(row.querySelector('.pm-lb-board-models')?.textContent),
      badge: clean(row.querySelector('.pm-ws-session-badge')?.textContent),
      open: open ? `${clean(open.textContent)}${open.disabled ? ' (disabled)' : ''}` : null
    };
  };
  const active = document.activeElement;
  return {
    subtitle: clean(document.querySelector('.pm-ws-subtitle')?.textContent),
    trigger: clean(trigger?.querySelector('.pm-ws-sessions-trigger-label')?.textContent),
    status: clean(document.querySelector('.pm-ws-sessions-menu-wrap .pm-ws-named-save-state')?.textContent),
    menu: menu ? [...menu.children].map(menuLine) : null,
    browser: dialog ? {
      title: clean(dialog.querySelector('h2, h3')?.textContent),
      notes: [...dialog.querySelectorAll('.pm-ws-session-browser-status > *')].map((note) => clean(note.textContent)),
      grouping: clean(dialog.querySelector('.pm-ws-session-group-active')?.textContent),
      search: dialog.querySelector('.pm-ws-sessions-search input')?.value ?? null,
      groups: [...dialog.querySelectorAll('.pm-ws-session-browser-group')].map((group) => ({
        label: clean(group.querySelector('.pm-ws-sessions-group-label')?.textContent),
        rows: [...group.querySelectorAll('.pm-ws-session-browser-row')].map(rowOf)
      })),
      empty: clean(dialog.querySelector('.pm-ws-sessions-empty')?.textContent),
      footer: clean(dialog.querySelector('.pm-ws-session-browser-foot')?.textContent)
    } : null,
    field: field ? {
      label: field.getAttribute('aria-label'), value: field.value, focused: active === field,
      error: clean(dialog.querySelector('.pm-ws-session-rename-error')?.textContent)
    } : null,
    confirm: confirm ? { buttons: [...confirm.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')) } : null,
    focused: active?.getAttribute('aria-label') ?? clean(active?.textContent) ?? null,
    boardNotice: notice ? {
      tone: [...notice.classList].find((name) => name.startsWith('is-')) ?? null,
      text: [...notice.querySelectorAll('.pm-lb-snapshot-body > p')].map((p) => clean(p.textContent)),
      readCurrentText: Boolean([...notice.querySelectorAll('button')].find((button) => clean(button.textContent) === 'Read the current text'))
    } : null,
    boardNoticeFirst: notice ? notice.parentElement?.firstElementChild === notice : null,
    boardsPanel: Boolean(document.querySelector('.pm-lb-boards')),
    // The menu and the browser stay on screen: neither runs past the window's left or right edge, or above it.
    offscreen: [['menu', menu], ['browser', dialog?.querySelector('.pm-ws-session-browser-layout') ?? dialog]]
      .filter(([, element]) => outside(element)).map(([name]) => name),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    // A button whose right edge runs past the box that clips it (PR #164 review).
    clippedButtons: [...document.querySelectorAll('button')].filter((button) => {
      const edge = button.getBoundingClientRect();
      if (edge.width === 0 || edge.height === 0) { return false; }
      let clip = button.parentElement;
      while (clip && clip !== document.body && getComputedStyle(clip).overflowX === 'visible') { clip = clip.parentElement; }
      const right = clip && clip !== document.body ? clip.getBoundingClientRect().right : window.innerWidth;
      return edge.right > right + 0.5;
    }).map((button) => button.getAttribute('aria-label') ?? clean(button.textContent)),
    posted: window.__pmPosted
      .filter((m) => /^lightbox_(request_boards|open_board|open_board_file|rename_board|delete_board|refresh_source)$/.test(m.type))
      .map((m) => `${m.type} ${JSON.stringify(m.payload)}`),
    savedStates: window.__pmSaved.length,
    savedStateNamesAFile: window.__pmSaved.some((state) => state.includes('.board.json')),
    savedStateHoldsAName: window.__pmSaved.some((state) => /first pass|second pass|after the change|\d+\/\d+\/2026/.test(state))
  };
};

/** What is wrong with a state's page, as a list; empty when it shows what the host's answers say. */
const faults = (seen, expect) => {
  const out = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const key of ['trigger', 'status', 'subtitle', 'menu', 'browser']) {
    if (!same(seen[key], expect[key])) { out.push(`${key} ${JSON.stringify(seen[key])}, not ${JSON.stringify(expect[key])}`); }
  }
  if (!same(seen.field, expect.field ?? null)) { out.push(`field ${JSON.stringify(seen.field)}, not ${JSON.stringify(expect.field ?? null)}`); }
  if (!same(seen.confirm, expect.confirm ?? null)) { out.push(`confirm ${JSON.stringify(seen.confirm)}, not ${JSON.stringify(expect.confirm ?? null)}`); }
  if (expect.focused && seen.focused !== expect.focused) { out.push(`focus on "${seen.focused}", not "${expect.focused}"`); }
  if (!same(seen.boardNotice, expect.boardNotice ?? null)) { out.push(`the notice above the board ${JSON.stringify(seen.boardNotice)}, not ${JSON.stringify(expect.boardNotice ?? null)}`); }
  if (expect.boardNotice && seen.boardNoticeFirst !== true) { out.push('the notice is not the first thing in the board\'s column'); }
  if (seen.boardsPanel) { out.push('the Boards side panel is still there'); }
  for (const type of expect.posted ?? []) {
    if (!seen.posted.some((line) => line.startsWith(`${type} `))) { out.push(`never posted ${type}`); }
  }
  for (const type of expect.notPosted ?? []) {
    if (seen.posted.some((line) => line.startsWith(`${type} `))) { out.push(`posted ${type}`); }
  }
  if (!seen.posted.some((line) => line.startsWith('lightbox_request_boards '))) { out.push('never asked for its shelf'); }
  if (seen.offscreen.length > 0) { out.push(`off screen: ${JSON.stringify(seen.offscreen)}`); }
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
      await context.clock.setFixedTime(NOW);
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
