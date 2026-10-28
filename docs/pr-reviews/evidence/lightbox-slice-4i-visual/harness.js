/*
 * Lightbox Slice 4I visual harness, adapted from
 * ../lightbox-slice-4h-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface, replays the
 * host's messages for each state, and screenshots each state once two
 * consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/run-controls.json is real host output: the production
 * LightboxHandler, LightboxReadingHandler (with its press scope),
 * LightboxBoardsHandler, LightboxService, runner, LightboxBoardStore and
 * LightboxBoardLibrary built it over a memory file system, with only the
 * provider played, each moment pressed as the webview presses it (see
 * README.md and tools/build-run-controls.test.ts).
 *
 * What each control must say is read from the board the host posted, not
 * written here: the run line's press ("Run AI analyses" before any call ran,
 * "Finish" while one with a lens on is not back, "Re-analyze" once every one
 * landed, Stop while one runs), each widget's Analyze ("Analyzing…" while
 * the call reading its lens is in flight, "Re-analyze" once its lens has a
 * reading, "Analyze" before), every control disabled while a run is in
 * flight, the Opinion's disabled with the host's own refusal while no call
 * has landed, and each call's Run in the Lenses panel ("Running A…", "Rerun
 * A", "Run A"). Every AI-read widget in view must carry exactly one control
 * and no bare "read" badge, a counted-read one a "counted" chip, a measured
 * one none. Every control's accessible name must start with its visible
 * label ("Run A, call A: …"; PR #166 N-01), and every price must read as an
 * approximate total ("≈ $0.05" or "< $0.01", never "up to"), the Opinion's
 * name and tooltip adding "input at digest limit" (F-01). A control must be
 * reachable by the keyboard: Enter on a widget's Analyze sends that call,
 * and Enter on one that is disabled sends nothing. The read headline's
 * Re-analyze, focused and pressed, must keep the focus, the same button,
 * through the host's own moments of that rerun: in flight, landed, pressed
 * again, failed (N-02). The Opinion's Analyze held, then failed, keeps the
 * earlier Opinion drawn, said to be the earlier one, never a skeleton
 * (the writer's decision 47).
 * Nothing may be cut by its own box, run past it, overflow the page, or clip
 * a button, and above 1240 px, where the tab is a fixed frame, the page
 * itself may not scroll (a stray absolutely positioned element stretching
 * the document would scroll it, and the frame's head off the screen). A state whose page does not is written to errors.txt, and the
 * harness exits 1: it fails rather than skips.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const { headlineRerun } = require('./headline-rerun');
const { priceFaults, opinionProbe, opinionKeptFaults } = require('./checks');

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const states = JSON.parse(fs.readFileSync(path.join(__dirname, 'states', 'run-controls.json'), 'utf8'));
// The sparkle's path, read from the icon table the webview draws it from.
const SPARKLE = /sparkle: '<path d="([^"]+)"/.exec(
  fs.readFileSync(path.join(__dirname, '../../../../packages/core/src/shared/constants/iconPaths.ts'), 'utf8')
)[1];

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
    const host = (message) => setTimeout(() => window.postMessage(message, '*'), 0);
    const answer = (type, payload, requestId) => host({ type, source: 'extension.lightbox', timestamp: 1, payload: Object.assign({}, payload, { requestId }) });
    window.__pmVsCodeApi = {
      postMessage: (m) => {
        window.__pmPosted.push(m);
        const scenario = window.__pmScenario;
        if (m.type === 'lightbox_set_lenses' && scenario.estimate) {
          answer('lightbox_run_estimate', scenario.estimate, m.payload.requestId);
        }
        if (m.type === 'lightbox_request_boards') {
          const shelf = m.payload.boardId === null ? scenario.mount : (scenario.shelves || {})[m.payload.boardId];
          if (shelf) { answer('lightbox_boards', shelf, m.payload.requestId); }
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

// ---------------------------------------------------------------------------
// What the host's board says each control should be.
// ---------------------------------------------------------------------------

const { lenses, reasons } = states;
const boardOf = (state) => state.messages.find((message) => message.type === 'lightbox_board').payload.board;
const groupOf = (board, id) => board.readings.find((group) => group.group === id);
const anyRunning = (board) => board.readings.some((group) => group.status === 'running');
/** The Opinion has something to weigh: a chapter call holds a current reading that is not a spark. */
const opinionCanWeigh = (board) => board.readings.some((group) => group.group !== 'F' && group.status === 'ok' &&
  group.tiles.some((tile) => tile.kind !== 'spark' && !(group.staleLenses || []).some((mark) => mark.lens === tile.lens)));

/** The run line's press: its label, or `null` while a call runs (Stop is offered then). */
function expectedPress(board) {
  if (anyRunning(board)) { return null; }
  if (board.readings.every((group) => group.status === 'not-run')) { return 'Run AI analyses'; }
  return board.readings.every((group) => group.status === 'ok') ? 'Re-analyze' : 'Finish';
}

/** A widget's Analyze, for its lens. */
function expectedAnalyze(board, lens) {
  const { group: id } = lenses[lens];
  const group = groupOf(board, id);
  const inFlight = group.status === 'running' && (group.pending || []).includes(lens);
  const label = inFlight ? 'Analyzing…' : group.lenses.includes(lens) ? 'Re-analyze' : 'Analyze';
  const disabled = anyRunning(board) || (id === 'F' && !opinionCanWeigh(board));
  return { label, namePrefix: `${label}, call ${id}:`, disabled };
}

/** A call's Run in the Lenses panel. */
function expectedRun(board, id) {
  const group = groupOf(board, id);
  const label = group.status === 'running' ? `Running ${id}…` : group.lenses.length > 0 ? `Rerun ${id}` : `Run ${id}`;
  const disabled = anyRunning(board) || (id === 'F' && !opinionCanWeigh(board));
  return { label, disabled };
}

// ---------------------------------------------------------------------------
// The states.
// ---------------------------------------------------------------------------

const MOTIFS = 'section[aria-label="Motifs · where they recur"]';
const PALETTE = 'section[aria-label="Palette"]';
const CHARACTERS = 'section[aria-label="Characters · the vibes they give"]';
const OPINION = 'section.pm-lb-opinion';
const LENSES = 'section.pm-lb-lenses';
const TOOLBAR = '.pm-lb-toolbar';
const GRID = '.pm-lb-grid';

// Scroll an element to the top of its scroller, under the sticky ribbon when it is in the board.
const showUnderRibbon = (selector) => async (tab) => {
  await tab.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) { return; }
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    element.scrollIntoView({ block: 'start' });
    const ribbon = document.querySelector('.pm-lb-ribbon');
    const under = ribbon && scroller && scroller.contains(ribbon) && getComputedStyle(ribbon).position === 'sticky'
      ? ribbon.getBoundingClientRect().bottom + 12
      : (scroller?.getBoundingClientRect().top ?? 0) + 12;
    if (scroller) { scroller.scrollTop -= Math.max(0, under - element.getBoundingClientRect().top); }
    document.scrollingElement.scrollLeft = 0;
  }, selector);
  await tab.mouse.move(4, 4);
};
// Scroll a part of the page into view at the top of its scroller (the board's head, the rail).
const showAtTop = (selector) => async (tab) => {
  await tab.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) { return; }
    element.scrollIntoView({ block: 'start' });
    let scroller = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) { scroller = scroller.parentElement; }
    if (scroller) { scroller.scrollTop = Math.max(0, scroller.scrollTop - 12); }
    document.scrollingElement.scrollLeft = 0;
  }, selector);
  await tab.mouse.move(4, 4);
};

const { fresh, oneCall, analyzing, read, opinionReading, opinionKept } = states;
const HEADLINE = '.pm-lb-headline-row';
const scenarios = [
  // The run line in each label state.
  { name: 'fresh-runline', data: fresh, act: showAtTop('.pm-lb-main-eyebrow'), within: TOOLBAR, expect: { press: true } },
  { name: 'one-call-runline', data: oneCall, act: showAtTop('.pm-lb-main-eyebrow'), within: TOOLBAR, expect: { press: true } },
  { name: 'read-runline', data: read, act: showAtTop('.pm-lb-main-eyebrow'), within: TOOLBAR, expect: { press: true } },
  // Widgets: Analyze, COUNTED + Analyze, Re-analyze, Analyzing… and disabled with the reason.
  { name: 'fresh-widgets', data: fresh, act: showUnderRibbon(CHARACTERS), within: GRID, expect: { widgets: true } },
  { name: 'one-call-widgets', data: oneCall, act: showUnderRibbon(CHARACTERS), within: GRID, expect: { widgets: true, keyboard: { lens: 'motif', sends: true } } },
  { name: 'analyzing-widgets', data: analyzing, act: showUnderRibbon(PALETTE), within: GRID, expect: { widgets: true, press: true, keyboard: { lens: 'voice', sends: false } } },
  // The Opinion's Analyze, disabled with the host's reason.
  { name: 'fresh-opinion', data: fresh, act: showUnderRibbon(OPINION), within: OPINION, expect: { widgets: true, opinionReason: reasons.opinionNothingToWeigh } },
  // The Lenses panel: Run, Rerun, and Running.
  { name: 'one-call-lenses', data: oneCall, act: showAtTop(LENSES), within: LENSES, expect: { runs: true } },
  { name: 'analyzing-lenses', data: analyzing, act: showAtTop(LENSES), within: LENSES, expect: { runs: true } },
  // The Opinion's Analyze, held, then failed: the earlier Opinion kept (decision 47).
  { name: 'opinion-reading', data: opinionReading, act: showUnderRibbon(OPINION), within: OPINION, expect: { widgets: true, opinionKept: { state: 'reading' } } },
  { name: 'opinion-kept', data: opinionKept, act: showUnderRibbon(OPINION), within: OPINION, expect: { widgets: true, opinionKept: { state: 'failed', error: reasons.unexpected } } },
  // The headline's Re-analyze, focused and pressed: the same button keeps the focus through its rerun (PR #166 N-02).
  { name: 'headline-rerun', data: read, act: showAtTop('.pm-lb-main-eyebrow'), within: HEADLINE, expect: { headlineRerun: true } }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1100 },
  { tag: '1000', width: 1000, height: 1100 },
  { tag: '500', width: 500, height: 1400 }
];

/** What the page shows, read from the DOM. */
const facts = ({ within, sparkle }) => {
  const clean = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const area = document.querySelector(within);
  const box = area?.getBoundingClientRect();
  const elements = area ? [area, ...area.querySelectorAll('*')] : [];
  const describe = (element) => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')} (${clean(element.textContent).length} characters)`;
  const cut = elements.filter((element) => {
    const style = getComputedStyle(element);
    if (element.classList.contains('pm-lb-visually-hidden')) { return false; }
    const hides = ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY) || style.webkitLineClamp !== 'none';
    return hides && clean(element.textContent) !== '' &&
      (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
  }).map(describe);
  const escaped = [];
  if (box && area) {
    const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent.trim() === '' || node.parentElement.closest('.pm-lb-visually-hidden')) { continue; }
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some((rect) => rect.width > 0 && rect.right > box.right + 0.5)) {
        const owner = describe(node.parentElement);
        if (!escaped.includes(owner)) { escaped.push(owner); }
      }
    }
  }
  const control = (button) => ({
    label: clean(button.querySelector('.pm-lb-call-label')?.textContent),
    cost: clean(button.querySelector('.pm-lb-call-cost')?.textContent) || null,
    name: button.getAttribute('aria-label'),
    title: button.getAttribute('title'),
    disabled: button.getAttribute('aria-disabled') === 'true' || button.disabled,
    focusable: button.tabIndex >= 0 && !button.disabled,
    lens: button.getAttribute('data-lens'),
    group: button.getAttribute('data-call'),
    reason: document.getElementById(button.getAttribute('aria-describedby') || '')?.textContent ?? null,
    reasonShown: Boolean(button.parentElement.querySelector('.pm-lb-call-reason'))
  });
  // Every AI-read widget in view: its head's badges and its one control.
  const widgets = area ? [...(area.matches('section.pm-lb-tile') ? [area] : []), ...area.querySelectorAll('section.pm-lb-tile')]
    .filter((tile) => tile.getAttribute('data-register') !== 'measured')
    .map((tile) => {
      const head = tile.querySelector('.pm-lb-tile-head');
      return {
        title: tile.getAttribute('aria-label'),
        register: tile.getAttribute('data-register'),
        badges: [...head.querySelectorAll('.pm-lb-badge')].map((badge) => clean(badge.textContent)),
        controls: [...head.querySelectorAll('.pm-lb-call-button')].map(control)
      };
    }) : [];
  const measured = area ? [...area.querySelectorAll('section.pm-lb-tile[data-register="measured"]')]
    .map((tile) => ({ title: tile.getAttribute('aria-label'), controls: tile.querySelectorAll('.pm-lb-call-button').length })) : [];
  const runs = area ? [...area.querySelectorAll('.pm-lb-lens-call')].map((call) => ({
    call: call.getAttribute('aria-label'),
    controls: [...call.querySelectorAll('.pm-lb-call-button')].map(control)
  })) : [];
  // The run line's press, found by its place (the run line's button that is not Stop), not by a class this slice added.
  const runButtons = [...document.querySelectorAll('.pm-lb-run button')];
  const pressButton = runButtons.find((button) => clean(button.textContent) !== 'Stop');
  const stop = runButtons.find((button) => clean(button.textContent) === 'Stop');
  return {
    found: Boolean(area),
    width: box ? Math.round(box.width) : null,
    press: pressButton ? {
      text: clean(pressButton.textContent),
      primary: pressButton.classList.contains('pm-lb-primary'),
      sparkle: pressButton.querySelector('svg path')?.getAttribute('d') === sparkle,
      disabled: pressButton.disabled,
      background: getComputedStyle(pressButton).backgroundImage.startsWith('linear-gradient')
    } : null,
    runNote: clean(document.querySelector('.pm-lb-run-note')?.textContent),
    stop: Boolean(stop),
    widgets,
    measured,
    runs,
    cut,
    escaped,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    // Above 1240 px the tab is a fixed frame whose columns scroll on their own: the page itself never scrolls.
    pageScrolled: window.innerWidth > 1240 ? document.scrollingElement.scrollTop : 0,
    clippedButtons: [...document.querySelectorAll('button')].filter((button) => {
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) { return false; }
      let clip = button.parentElement;
      while (clip && clip !== document.body && getComputedStyle(clip).overflowX === 'visible') { clip = clip.parentElement; }
      const right = clip && clip !== document.body ? clip.getBoundingClientRect().right : window.innerWidth;
      return rect.right > right + 0.5;
    }).map((button) => clean(button.textContent))
  };
};

/** What is wrong with a state's page, as a list; empty when every control says what the host's board says. */
const faults = (seen, scenario) => {
  const out = [];
  const board = boardOf(scenario.data);
  if (!seen.found) { return ['the part of the page the state is about is not there']; }
  if (scenario.expect.press) {
    const label = expectedPress(board);
    if (label === null) {
      if (!seen.stop) { out.push('no Stop while a call runs'); }
      if (seen.press) { out.push(`a press "${seen.press.text}" while a call runs`); }
      if (!/^Analyzing… \d+ of \d+ calls? back$/.test(seen.runNote)) { out.push(`the run note says "${seen.runNote}"`); }
    } else if (!seen.press) {
      out.push(`no run press; expected "${label}"`);
    } else {
      if (!seen.press.text.startsWith(label)) { out.push(`the run press says "${seen.press.text}", not "${label}"`); }
      if (!seen.press.primary || !seen.press.background) { out.push(`the run press "${label}" is not in the primary style`); }
      if (!seen.press.sparkle) { out.push(`the run press "${label}" has no sparkle`); }
      if (seen.press.disabled) { out.push(`the run press "${label}" is disabled`); }
      if (!/\d+ calls? · est\. \$/.test(label === 'Run AI analyses' ? seen.runNote : seen.press.text)) { out.push('the run press states no cost'); }
    }
  }
  if (scenario.expect.widgets) {
    if (seen.widgets.length === 0) { out.push('no AI-read widget in view'); }
    for (const widget of seen.widgets) {
      if (widget.controls.length !== 1) { out.push(`${widget.title}: ${widget.controls.length} controls, not 1`); continue; }
      const [control] = widget.controls;
      const want = expectedAnalyze(board, control.lens);
      if (lenses[control.lens].group !== control.group) { out.push(`${widget.title}: its control runs call ${control.group}`); }
      if (control.label !== want.label) { out.push(`${widget.title}: says "${control.label}", not "${want.label}"`); }
      if (!control.name || !control.name.startsWith(want.namePrefix)) { out.push(`${widget.title}: named "${control.name}", not "${want.namePrefix} …"`); }
      out.push(...priceFaults(control, widget.title));
      if (control.disabled !== want.disabled) { out.push(`${widget.title}: ${control.disabled ? 'disabled' : 'enabled'}, not ${want.disabled ? 'disabled' : 'enabled'}`); }
      if (control.disabled && !control.reason) { out.push(`${widget.title}: disabled with no reason`); }
      if (!control.focusable) { out.push(`${widget.title}: its control is not reachable by the keyboard`); }
      if (widget.badges.some((badge) => badge === 'read' || badge === 'counted · read')) { out.push(`${widget.title}: still carries the bare register badge ${JSON.stringify(widget.badges)}`); }
      if (widget.register === 'counted-read' && !widget.badges.includes('counted')) { out.push(`${widget.title}: a counted-read widget with no "counted" chip`); }
    }
    for (const tile of seen.measured) {
      if (tile.controls > 0) { out.push(`${tile.title}: a measured tile with a control`); }
    }
  }
  if (scenario.expect.opinionReason) {
    const opinion = seen.widgets.find((widget) => widget.controls[0]?.group === 'F');
    const control = opinion?.controls[0];
    if (!control || control.reason !== scenario.expect.opinionReason || !control.reasonShown) {
      out.push(`the Opinion's Analyze does not show the host's reason: ${JSON.stringify(control)}`);
    }
  }
  if (scenario.expect.runs) {
    const groups = board.readings.map((group) => group.group);
    const shown = seen.runs.map((entry) => entry.call);
    if (JSON.stringify(shown) !== JSON.stringify(groups.map((id) => `Call ${id}`))) { out.push(`the calls listed are ${JSON.stringify(shown)}`); }
    for (const entry of seen.runs) {
      const id = entry.call.replace('Call ', '');
      const want = expectedRun(board, id);
      const control = entry.controls[0];
      if (entry.controls.length !== 1) { out.push(`${entry.call}: ${entry.controls.length} Run controls, not 1`); continue; }
      if (control.label !== want.label) { out.push(`${entry.call}: says "${control.label}", not "${want.label}"`); }
      if (control.disabled !== want.disabled) { out.push(`${entry.call}: ${control.disabled ? 'disabled' : 'enabled'}, not ${want.disabled ? 'disabled' : 'enabled'}`); }
      if (!control.name || !control.name.startsWith(`${want.label}, call ${id}`)) { out.push(`${entry.call}: named "${control.name}", not "${want.label}, call ${id} …"`); }
      out.push(...priceFaults(control, entry.call));
      if (!control.focusable) { out.push(`${entry.call}: its Run is not reachable by the keyboard`); }
    }
  }
  if (seen.cut.length > 0) { out.push(`text cut by its box: ${JSON.stringify(seen.cut)}`); }
  if (seen.escaped.length > 0) { out.push(`text past its box: ${JSON.stringify(seen.escaped)}`); }
  if (seen.horizontalOverflow) { out.push('horizontal overflow'); }
  if (seen.pageScrolled > 0) { out.push(`the page itself scrolled by ${seen.pageScrolled} px: something stretches the document past the frame`); }
  if (seen.clippedButtons.length > 0) { out.push(`clipped buttons: ${JSON.stringify(seen.clippedButtons)}`); }
  return out;
};

/** Focus a widget's control by keyboard focus and press Enter: what the webview then sends. */
async function keyboard(tab, { lens, sends }) {
  const before = await tab.evaluate(() => window.__pmPosted.filter((message) => message.type === 'lightbox_run').length);
  const button = tab.locator(`.pm-lb-call-button[data-lens="${lens}"]`).first();
  if (await button.count() === 0) {
    return { focused: false, sent: [], problems: [`no control for the ${lens} widget to press`] };
  }
  await button.focus();
  const focused = await tab.evaluate((lens) => document.activeElement?.getAttribute('data-lens') === lens, lens);
  await tab.keyboard.press('Enter');
  await tab.waitForTimeout(100);
  const runs = await tab.evaluate(() => window.__pmPosted.filter((message) => message.type === 'lightbox_run').map((message) => message.payload.scope));
  const sent = runs.slice(before);
  const want = { mode: 'group', group: lenses[lens].group, lens };
  const problems = [];
  if (!focused) { problems.push(`the ${lens} control cannot take keyboard focus`); }
  if (sends && (sent.length !== 1 || JSON.stringify(sent[0]) !== JSON.stringify(want))) { problems.push(`Enter on the ${lens} control sent ${JSON.stringify(sent)}, not ${JSON.stringify(want)}`); }
  if (!sends && sent.length > 0) { problems.push(`Enter on the disabled ${lens} control sent ${JSON.stringify(sent)}`); }
  return { focused, sent, problems };
}

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
      await tab.addInitScript((data) => { window.__pmScenario = JSON.parse(JSON.stringify(data)); }, scenario.data);
      await tab.goto('file://' + pagePath);
      await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      for (const entry of [...chrome, ...scenario.data.messages]) {
        await tab.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await tab.waitForTimeout(400);
      // Fonts first, so the scroll the state sets is measured on the final layout (two renders then agree).
      await tab.evaluate(() => document.fonts.ready);
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
      const seen = await tab.evaluate(facts, { within: scenario.within, sparkle: SPARKLE });
      if (scenario.expect.opinionKept) { seen.opinion = await tab.evaluate(opinionProbe); }
      for (const problem of [...faults(seen, scenario), ...(scenario.expect.opinionKept ? opinionKeptFaults(seen.opinion, scenario.expect.opinionKept) : [])]) {
        errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
      }
      // The keyboard, after the screenshot: Enter on a control the state names.
      let keys;
      if (scenario.expect.keyboard) {
        keys = await keyboard(tab, scenario.expect.keyboard);
        for (const problem of keys.problems) {
          errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
        }
      }
      // The headline's rerun, after the screenshot of the read headline, each step captured once it settles.
      let rerun;
      if (scenario.expect.headlineRerun) {
        const capture = async (step) => {
          await tab.mouse.move(4, 4);
          await tab.waitForTimeout(300);
          fs.writeFileSync(path.join(outDir, `lightbox-${scenario.name}-${step}-${viewport.tag}.png`), await tab.screenshot({ animations: 'disabled', caret: 'hide' }));
        };
        rerun = await headlineRerun(tab, capture, { states, selector: HEADLINE });
        for (const problem of rerun.problems) {
          errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
        }
      }
      const extra = { ...(keys ? { keyboard: { focused: keys.focused, sent: keys.sent } } : {}), ...(rerun ? { rerun: { steps: rerun.steps, sent: rerun.sent } } : {}) };
      all[`${scenario.name}@${viewport.tag}`] = { ...seen, ...extra };
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(all, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see errors.txt)`);
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
