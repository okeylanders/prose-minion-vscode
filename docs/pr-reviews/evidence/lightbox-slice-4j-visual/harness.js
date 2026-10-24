/*
 * Lightbox Slice 4J visual harness, adapted from
 * ../lightbox-slice-4i-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface, replays the
 * host's messages for each state, and screenshots each state once two
 * consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/keep-readings.json is real host output: the production
 * LightboxHandler, LightboxReadingHandler (with its press scope),
 * LightboxBoardsHandler, LightboxService, runner, LightboxBoardStore and
 * LightboxBoardLibrary built it over a memory file system, with only the
 * provider played, each moment pressed as the webview presses it (see
 * README.md and tools/build-keep-readings.test.ts).
 *
 * What each widget and each call's note must say is worked out from the
 * board the host posted (checks.js), never written per state here: a lens
 * read again shows its earlier reading with "Analyzing… This is the earlier
 * reading until the new one lands." and no skeleton; a lens a call did not
 * replace shows its reading under "Earlier reading" with the reason, or, when
 * the reason is its call's note's, a short line pointing there; a lens with
 * nothing to keep of a call that did not land shows the short line; every
 * call that failed, was stopped or was cut off has one note under the run
 * line, and its whole message stands once on the board (decisions 49 and
 * 52). Each widget's Analyze says what the board says it should
 * ("Analyzing…" while its call reads it, "Re-analyze" while it holds a
 * reading, "Analyze" before). Nothing may be cut by its own box, run past
 * it, overflow the page, or clip a button, and above 1240 px, where the tab
 * is a fixed frame, the page itself may not scroll. A state whose page does
 * not is written to errors.txt, and the harness exits 1: it fails rather
 * than skips.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const { widgetProbe, keepFaults } = require('./checks');

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const states = JSON.parse(fs.readFileSync(path.join(__dirname, 'states', 'keep-readings.json'), 'utf8'));

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
      selections: { assistant: 'provider/model-v1', widget: 'provider/model-v1', lightbox: 'provider/model-v1' }
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

const { lenses } = states;
const boardOf = (state) => state.messages.find((message) => message.type === 'lightbox_board').payload.board;
const groupOf = (board, id) => board.readings.find((group) => group.group === id);

/** A widget's Analyze, for its lens (Slice 4I's words; Slice 4J: "Analyzing…" over an earlier reading too). */
function expectedAnalyze(board, lens) {
  const group = groupOf(board, lenses[lens].group);
  if (group.status === 'running' && (group.pending || []).includes(lens)) { return 'Analyzing…'; }
  return group.lenses.includes(lens) ? 'Re-analyze' : 'Analyze';
}

// ---------------------------------------------------------------------------
// The states.
// ---------------------------------------------------------------------------

const MOTIFS = 'section[aria-label="Motifs · where they recur"]';
const CHARACTERS = 'section[aria-label="Characters · the vibes they give"]';
const OPINION = 'section.pm-lb-opinion';
const GRID = '.pm-lb-grid';
// The board's head: the headline, the toolbar with the run line, and the call notes under it.
const HEAD = ['.pm-lb-headline-row', '.pm-lb-headline-state', '.pm-lb-toolbar', '.pm-lb-call-notes'];

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
// Scroll a part of the page into view at the top of its scroller (the board's head).
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

const { firstFailed, rerunning, stopped, opinionKept, mixed, failedKept } = states;
const TOP = showAtTop('.pm-lb-main-eyebrow');
// `within`: the parts of the page the state is about, checked for text cut or past its box (the ribbon's
// lane notes are ellipsized by design and are no part of this slice).
const scenarios = [
  // A re-run in flight over earlier readings (decision 49).
  { name: 'rerunning-top', data: rerunning, act: TOP, within: HEAD },
  { name: 'rerunning-widgets', data: rerunning, act: showUnderRibbon(CHARACTERS), within: [GRID] },
  // A failed re-run with earlier readings kept: call A's one note, its widgets pointing there (decisions 49 and 52).
  { name: 'failed-kept-top', data: failedKept, act: TOP, within: HEAD },
  { name: 'failed-kept-widgets', data: failedKept, act: showUnderRibbon(MOTIFS), within: [GRID] },
  // A mixed call: call A's motif kept with its own reason, the rest of A replaced.
  { name: 'mixed-widgets', data: mixed, act: showUnderRibbon(MOTIFS), within: [GRID] },
  // A stopped whole-board run: every reading kept; one note for every call stopped alike.
  { name: 'stopped-top', data: stopped, act: TOP, within: HEAD },
  { name: 'stopped-widgets', data: stopped, act: showUnderRibbon(CHARACTERS), within: [GRID] },
  // The Opinion kept after a failed Finish.
  { name: 'opinion-kept', data: opinionKept, act: showUnderRibbon(OPINION), within: [OPINION] },
  { name: 'opinion-kept-top', data: opinionKept, act: TOP, within: HEAD },
  // A failed call with several widgets and nothing to keep: one note, a short line in each (decision 52).
  { name: 'first-failed-top', data: firstFailed, act: TOP, within: HEAD },
  { name: 'first-failed-widgets', data: firstFailed, act: showUnderRibbon(MOTIFS), within: [GRID] }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1100 },
  { tag: '1000', width: 1000, height: 1100 },
  { tag: '500', width: 500, height: 1400 }
];

/** What the page shows, read from the DOM: each widget's control, and whatever is cut, past its box, or clipped. */
const facts = ({ within }) => {
  const clean = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const areas = within.map((selector) => document.querySelector(selector)).filter(Boolean);
  const describe = (element) => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')} (${clean(element.textContent).length} characters)`;
  const cut = [];
  const escaped = [];
  for (const area of areas) {
    const box = area.getBoundingClientRect();
    for (const element of [area, ...area.querySelectorAll('*')]) {
      const style = getComputedStyle(element);
      if (element.classList.contains('pm-lb-visually-hidden')) { continue; }
      const hides = ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY) || style.webkitLineClamp !== 'none';
      if (hides && clean(element.textContent) !== '' &&
        (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)) {
        cut.push(describe(element));
      }
    }
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
  const controls = [...document.querySelectorAll('.pm-lb-call-button[data-lens]')].map((button) => ({
    lens: button.getAttribute('data-lens'),
    label: clean(button.querySelector('.pm-lb-call-label')?.textContent),
    name: button.getAttribute('aria-label'),
    disabled: button.getAttribute('aria-disabled') === 'true' || button.disabled
  }));
  return {
    found: within.filter((selector) => !selector.endsWith('-state') && !selector.endsWith('-notes')).every((selector) => document.querySelector(selector)),
    controls,
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

/** What is wrong with a state's page, as a list; empty when it says what the host's board says. */
const faults = (seen, probe, scenario) => {
  const board = boardOf(scenario.data);
  if (!seen.found) { return [`a part of the page the state is about is not there: ${JSON.stringify(scenario.within)}`]; }
  const out = [];
  if (probe.frames.length === 0) { out.push('no AI-read widget on the board'); }
  const running = board.readings.some((group) => group.status === 'running');
  out.push(...keepFaults({ ...probe, runNote: running ? '' : probe.runNote }, board, lenses)
    .filter((fault) => !(running && fault.startsWith('the run note'))));
  for (const control of seen.controls) {
    const want = expectedAnalyze(board, control.lens);
    if (control.label !== want) { out.push(`${control.lens}: its Analyze says "${control.label}", not "${want}"`); }
    if (!control.name || !control.name.startsWith(`${want}, call ${lenses[control.lens].group}`)) { out.push(`${control.lens}: its Analyze is named "${control.name}"`); }
  }
  if (seen.cut.length > 0) { out.push(`text cut by its box: ${JSON.stringify(seen.cut)}`); }
  if (seen.escaped.length > 0) { out.push(`text past its box: ${JSON.stringify(seen.escaped)}`); }
  if (seen.horizontalOverflow) { out.push('horizontal overflow'); }
  if (seen.pageScrolled > 0) { out.push(`the page itself scrolled by ${seen.pageScrolled} px: something stretches the document past the frame`); }
  if (seen.clippedButtons.length > 0) { out.push(`clipped buttons: ${JSON.stringify(seen.clippedButtons)}`); }
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
      const seen = await tab.evaluate(facts, { within: scenario.within });
      const probe = await tab.evaluate(widgetProbe);
      for (const problem of faults(seen, probe, scenario)) {
        errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
      }
      const { body: _body, frames, ...shown } = probe;
      all[`${scenario.name}@${viewport.tag}`] = { ...seen, ...shown, frames: frames.map(({ text: _text, ...frame }) => frame) };
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(all, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see errors.txt)`);
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
