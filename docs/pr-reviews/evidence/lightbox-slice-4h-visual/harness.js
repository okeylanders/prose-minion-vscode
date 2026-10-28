/*
 * Lightbox Slice 4H visual harness, adapted from
 * ../lightbox-slice-5a1-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface, replays the
 * host's messages for each state, acts as the writer would, and screenshots
 * each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/tolerance.json is real host output: the production LightboxHandler,
 * LightboxReadingHandler, LightboxBoardsHandler, LightboxService, runner
 * (its codec, the shared model-JSON parser, the quote verifier and the term
 * counter), LightboxBoardStore, LightboxBoardLibrary and
 * RejectedModelResponseRecoveryStore built it over a memory file system,
 * with only the provider played (see README.md and
 * tools/build-tolerance.test.ts).
 *
 * What each state must show is read from the board the host posted, not
 * written here: every reading text the state is about (a motif's title and
 * gist, the pinned motif's claim and every quote, the template's claim and
 * freshness note and every beat, every spark's question, the withheld
 * block's reason) must be in the page whole, in the part of the page the
 * state is about, and no element there may be cut by its own box or run past
 * it. With the summary block withheld, the ribbon's Movements lane must say
 * the block was withheld, not that the movements failed to tile. A state whose page does not is written to errors.txt, and the harness
 * exits 1: it fails rather than skips.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const states = JSON.parse(fs.readFileSync(path.join(__dirname, 'states', 'tolerance.json'), 'utf8'));

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

/** The board each state's host posted, and its reading tiles by kind. */
const boardOf = (state) => state.messages.find((message) => message.type === 'lightbox_board').payload.board;
const tilesOf = (state, kind) => boardOf(state).readings.flatMap((group) => group.tiles).filter((tile) => tile.kind === kind);
const withheldOf = (state) => boardOf(state).readings.flatMap((group) => group.withheldBlocks);

const section = (label) => `section[aria-label="${label}"]`;
const MOTIFS = section('Motifs · where they recur');
const TEMPLATE = section('Template & freshness');
const SUMMARY = section('Summary & movements');
const SPARKS = '.pm-lb-spark-lane';
const INSPECTOR = '.pm-lb-inspector';

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
const then = (...steps) => async (tab) => { for (const step of steps) { await step(tab); } };
/** Pin the motif card that shows `title`, as a click does. */
const pinMotif = (title) => async (tab) => {
  await tab.locator('.pm-lb-motif').filter({ has: tab.locator('.pm-lb-motif-title', { hasText: title }) }).first().click();
  await tab.waitForTimeout(400);
};

const overrun = states.overrun;
const salvaged = states.salvaged;
const motifs = tilesOf(overrun, 'motif');
const mostQuoted = motifs.reduce((best, tile) => (tile.evidence.length > best.evidence.length ? tile : best));
const template = tilesOf(overrun, 'template')[0];
const sparks = tilesOf(overrun, 'spark');
const salvagedTemplate = tilesOf(salvaged, 'template')[0];

const scenarios = [
  {
    // Decision 37: six motifs where four are asked, titles and gists past their asks, and one gist clipped at the safety ceiling.
    name: 'overrun-motifs', data: overrun, act: showUnderRibbon(MOTIFS), within: MOTIFS,
    expect: {
      shows: motifs.flatMap((tile) => [tile.title, tile.gist]),
      count: { selector: '.pm-lb-motif', n: motifs.length },
      clippedAtCeiling: motifs.filter((tile) => tile.gist.endsWith('…')).map((tile) => tile.title)
    }
  },
  {
    // The motif with six quotes, where three are asked, pinned: its claim past its ask and every quote, whole.
    name: 'overrun-pinned', data: overrun, act: then(showUnderRibbon(MOTIFS), pinMotif(mostQuoted.title), showUnderRibbon(INSPECTOR)), within: INSPECTOR,
    expect: {
      shows: [mostQuoted.title, mostQuoted.claim, ...mostQuoted.evidence.map((quote) => quote.text)],
      quotes: mostQuoted.evidence.length
    }
  },
  {
    // The writer's case: a freshness note well past its ask, a long description, and eight beats where six are asked.
    name: 'overrun-template', data: overrun, act: showUnderRibbon(TEMPLATE), within: TEMPLATE,
    expect: {
      shows: [template.title, template.claim, template.freshness.note, ...tilesOf(overrun, 'template-beat').map((beat) => beat.claim)]
    }
  },
  {
    // Five sparks where four are asked, one question past its ask.
    name: 'overrun-sparks', data: overrun, act: showUnderRibbon(SPARKS), within: SPARKS,
    expect: {
      shows: sparks.flatMap((tile) => [tile.title, tile.claim]),
      count: { selector: '.pm-lb-spark', n: sparks.length }
    }
  },
  {
    // Decision 40: group E cut off inside its summary block; the block withheld with the host's reason and where the reply was saved.
    name: 'salvaged-summary', data: salvaged, act: showUnderRibbon(SUMMARY), within: SUMMARY,
    expect: {
      shows: withheldOf(salvaged).map((block) => block.reason),
      withheld: withheldOf(salvaged).map((block) => `Withheld ${block.reason}`),
      // The ribbon's Movements lane says the block was withheld, not that the movements failed to tile.
      plotNote: 'The movements were withheld: Summary & movements says why.',
      elsewhere: { selector: TEMPLATE, shows: [salvagedTemplate.claim] }
    }
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1100 },
  { tag: '1000', width: 1000, height: 1100 },
  { tag: '500', width: 500, height: 1400 }
];

const facts = ({ within, count, elsewhere }) => {
  const clean = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const area = document.querySelector(within);
  const box = area?.getBoundingClientRect();
  const elements = area ? [area, ...area.querySelectorAll('*')] : [];
  const hasText = (element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
  const describe = (element) => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')} (${clean(element.textContent).length} characters)`;
  // Text an element's own box cuts: overflow hidden or clipped, or a line clamp, with more inside than it shows.
  const cut = elements.filter((element) => {
    const style = getComputedStyle(element);
    const hides = ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY) || style.webkitLineClamp !== 'none';
    return hides && clean(element.textContent) !== '' &&
      (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
  }).map(describe);
  // Text that runs past the right edge of the part of the page it belongs to, measured on its own lines (a block's
  // box does not grow with text that overflows it, so the text's line boxes are measured, not the element's).
  const escaped = [];
  if (box && area) {
    const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent.trim() === '') { continue; }
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some((rect) => rect.width > 0 && rect.right > box.right + 0.5)) {
        const owner = describe(node.parentElement);
        if (!escaped.includes(owner)) { escaped.push(owner); }
      }
    }
  }
  const other = elsewhere ? document.querySelector(elsewhere.selector) : null;
  return {
    found: Boolean(area),
    text: clean(area?.textContent),
    width: box ? Math.round(box.width) : null,
    count: count ? area?.querySelectorAll(count.selector).length ?? 0 : null,
    quotes: area ? [...area.querySelectorAll('[class*="quote"]')].filter(hasText).length : null,
    withheld: area ? [...area.querySelectorAll('.pm-lb-withheld-block')].map((element) => clean(element.textContent)) : [],
    plotNotes: [...document.querySelectorAll('.pm-lb-plot-empty')].map((element) => clean(element.textContent)),
    elsewhereText: other ? clean(other.textContent) : null,
    cut,
    escaped,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    // A button whose right edge runs past the box that clips it (PR #164's review).
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

/** What is wrong with a state's page, as a list; empty when it shows what the host's board says, whole. */
const faults = (seen, expect) => {
  const out = [];
  const clean = (value) => value.replace(/\s+/g, ' ').trim();
  if (!seen.found) { return ['the part of the page the state is about is not there']; }
  for (const text of expect.shows) {
    if (!seen.text.includes(clean(text))) { out.push(`does not show, whole: "${clean(text).slice(0, 60)}…" (${clean(text).length} characters)`); }
  }
  if (expect.count && seen.count !== expect.count.n) { out.push(`${seen.count} ${expect.count.selector}, not ${expect.count.n}`); }
  if (expect.quotes !== undefined && seen.quotes < expect.quotes) { out.push(`${seen.quotes} quotes shown, not ${expect.quotes}`); }
  if (expect.withheld && JSON.stringify(seen.withheld) !== JSON.stringify(expect.withheld)) {
    out.push(`withheld ${JSON.stringify(seen.withheld)}, not ${JSON.stringify(expect.withheld)}`);
  }
  if (expect.plotNote && !seen.plotNotes.includes(expect.plotNote)) {
    out.push(`the ribbon's notes ${JSON.stringify(seen.plotNotes)} do not say "${expect.plotNote}"`);
  }
  if (expect.elsewhere) {
    for (const text of expect.elsewhere.shows) {
      if (!(seen.elsewhereText ?? '').includes(clean(text))) { out.push(`${expect.elsewhere.selector} does not show "${clean(text).slice(0, 60)}…"`); }
    }
  }
  if (seen.cut.length > 0) { out.push(`text cut by its box: ${JSON.stringify(seen.cut)}`); }
  if (seen.escaped.length > 0) { out.push(`text past its box: ${JSON.stringify(seen.escaped)}`); }
  if (seen.horizontalOverflow) { out.push('horizontal overflow'); }
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
      const seen = await tab.evaluate(facts, { within: scenario.within, count: scenario.expect.count, elsewhere: scenario.expect.elsewhere });
      for (const problem of faults(seen, scenario.expect)) {
        errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
      }
      // facts.json keeps what was measured, and the shown text only by its length: the board's text is in states/.
      const { text, elsewhereText, ...kept } = seen;
      all[`${scenario.name}@${viewport.tag}`] = {
        ...kept,
        textCharacters: text.length,
        shownWhole: scenario.expect.shows.length,
        ...(scenario.expect.clippedAtCeiling ? { clippedAtCeiling: scenario.expect.clippedAtCeiling } : {}),
        ...(elsewhereText !== null ? { elsewhereCharacters: elsewhereText.length } : {})
      };
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(all, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see errors.txt)`);
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
