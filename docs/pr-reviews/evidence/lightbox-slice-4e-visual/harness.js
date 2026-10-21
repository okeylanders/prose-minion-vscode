/*
 * Lightbox Slice 4E visual harness, adapted from
 * ../lightbox-slice-4d-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface, replays the
 * host's messages for each state, acts as the writer would (pins a paragraph,
 * a word, a part of speech, a phrase, a style flag, a hapax word), and
 * screenshots each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/chapter.json is real host output: the production LightboxService,
 * LightboxHandler, LightboxReadingHandler (its estimate only) and
 * LightboxPassageHandler built it (see README.md and
 * tools/build-passages.test.ts). The stubbed API answers each
 * `lightbox_request_passage` the tab posts with the host's recorded answer
 * for that board and item, echoing the request's id, and each
 * `lightbox_set_lenses` with the host's recorded estimates (the tab takes
 * only its own board's). A state that holds answers (`hold`) answers none
 * until it releases them (`__pmRelease`), each with its own request's id.
 *
 * It fails rather than skips: a well, list or note a state expects that is
 * missing, a lit count that disagrees with the board's count, a request the
 * recordings cannot answer, a hapax list that is not the stats row's
 * length, horizontal overflow, chapter text in webview state, a page error
 * or a state that never settles is written to errors.txt, and the process
 * exits 1.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const chapter = JSON.parse(fs.readFileSync(path.join(__dirname, 'states', 'chapter.json'), 'utf8'));
const boardOf = (messages) => messages.find((message) => message.type === 'lightbox_board').payload.board;
const chapterBoard = boardOf(chapter.idle);
const changedBoard = boardOf(chapter.changed);
const bookBoard = boardOf(chapter.book);

/** Keys sorted at every level: the builder keyed each answer this way. */
const CANONICAL = `function canonical(value) {
  if (Array.isArray(value)) { return '[' + value.map(canonical).join(',') + ']'; }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}`;

const page = `<!DOCTYPE html>
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
    ${CANONICAL}
    window.__pmPosted = [];
    window.__pmStates = [];
    window.__pmMissing = [];
    window.__pmHeld = [];
    window.__pmHeldRequests = [];
    window.__pmReleased = 0;
    window.__pmHold = false;
    window.__pmEstimates = [];
    window.__pmPassages = {};
    const answer = (message) => setTimeout(() => window.postMessage(message, '*'), 0);
    window.__pmVsCodeApi = {
      postMessage: (m) => {
        window.__pmPosted.push(m);
        if (m.type === 'lightbox_set_lenses') {
          for (const estimate of window.__pmEstimates) {
            answer({ type: 'lightbox_run_estimate', source: 'extension.lightbox', timestamp: 1, payload: Object.assign({}, estimate, { requestId: m.payload.requestId }) });
          }
        }
        if (m.type === 'lightbox_request_passage') {
          if (window.__pmHold) { window.__pmHeld.push(m.payload.boardId + ' ' + canonical(m.payload.item)); window.__pmHeldRequests.push(m.payload); return; }
          window.__pmAnswerPassage(m.payload);
        }
      },
      getState: () => undefined,
      setState: (state) => { window.__pmStates.push(JSON.stringify(state)); }
    };
    window.__pmAnswerPassage = (request) => {
      const key = request.boardId + ' ' + canonical(request.item);
      const recorded = window.__pmPassages[key];
      if (!recorded) { window.__pmMissing.push(key); return; }
      answer({ type: 'lightbox_passage', source: 'extension.lightbox', timestamp: 1, payload: Object.assign({}, recorded, { requestId: request.requestId }) });
    };
    /** Answer every held request now, late, each with its own id. */
    window.__pmRelease = () => {
      for (const request of window.__pmHeldRequests.splice(0)) { window.__pmReleased += 1; window.__pmAnswerPassage(request); }
    };
    window.acquireVsCodeApi = () => window.__pmVsCodeApi;
    window.proseMinionAssets = { vhsLoadingGif: '', loadingGifs: [], loadingGifList: [], loadingGifCredits: {}, noticeShots: {} };
  </script>
  <script src="file://${path.resolve(bundle)}"></script>
</body>
</html>`;
const pageFile = path.resolve(outDir, 'lightbox.html');
fs.writeFileSync(pageFile, page);

// The stub model the estimates priced (see README.md).
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
    payload: { openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } }, fetchedAt: 1 }
  },
  { type: 'token_usage_update', source: 'extension.handler', timestamp: 1, payload: { totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } } }
];

const post = async (tab, messages) => {
  for (const entry of messages) {
    await tab.evaluate((m) => window.postMessage(m, '*'), entry);
  }
  await tab.waitForTimeout(250);
};
const click = async (tab, locator) => {
  await locator.first().scrollIntoViewIfNeeded({ timeout: 5000 });
  await locator.first().click({ timeout: 5000 });
  await tab.waitForTimeout(250);
};
/** Scroll `selector` to the top of whichever region scrolls it, below the sticky ribbon when it is on the board. */
const reveal = (selector) => async (tab) => {
  await tab.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) { return; }
    element.scrollIntoView({ block: 'start' });
    const scroller = [...document.querySelectorAll('.pm-lb-scroll, .pm-ws')]
      .find((candidate) => candidate.scrollHeight > candidate.clientHeight + 1 && candidate.contains(element));
    const ribbon = document.querySelector('.pm-lb-ribbon');
    if (scroller && ribbon && scroller.contains(ribbon) && !element.closest('.pm-lb-inspector')) {
      scroller.scrollTop -= Math.max(0, ribbon.getBoundingClientRect().bottom + 12 - element.getBoundingClientRect().top);
    }
  }, selector);
  await tab.mouse.move(4, 4);
};

const measured = chapterBoard.measured;
const countOf = {
  alice: measured.topWords.find((entry) => entry.term === 'alice').count,
  verb: measured.partsOfSpeech.verbs.find((entry) => entry.term === chapter.items.verb).count,
  phrase: [...measured.phrases.bigrams, ...measured.phrases.trigrams].find((entry) => entry.term === chapter.items.phrase).count,
  weakVerbs: measured.styleFlags.find((flag) => flag.id === 'weak-verbs').count,
  bookAlice: bookBoard.measured.topWords.find((entry) => entry.term === 'alice').count
};
const L = chapter.items.longestParagraph;
const INSPECTOR = '.pm-lb-inspector';
const cloudWord = (tab, word, count) => tab.locator(`.pm-lb-cloud-word[title="${word} ×${count}"]`);

const scenarios = [
  // ¶11, the longest paragraph, pinned on the ribbon: its whole text, scrolling in its well.
  {
    name: 'paragraph', messages: chapter.idle,
    act: async (tab) => { await click(tab, tab.getByRole('button', { name: `Paragraph ${L}`, exact: true })); await reveal(INSPECTOR)(tab); },
    expect: { region: `Text of ¶${L}`, lit: 0, scrolls: true }
  },
  // A top word: every sentence holding it, each instance lit.
  {
    name: 'word', messages: chapter.idle,
    act: async (tab) => { await click(tab, cloudWord(tab, 'alice', countOf.alice)); await reveal(INSPECTOR)(tab); },
    expect: { region: 'Sentences holding “alice”', count: countOf.alice }
  },
  // The first sentence's address: its paragraph, the word lit there, and the way back.
  {
    name: 'paragraph-lit', messages: chapter.idle,
    act: async (tab) => {
      await click(tab, cloudWord(tab, 'alice', countOf.alice));
      await click(tab, tab.locator('.pm-lb-well-address'));
      await reveal(INSPECTOR)(tab);
    },
    expect: { region: 'Text of ¶2', litFromAnswer: `${chapterBoard.boardId} {"from":2,"kind":"paragraphs","to":2,"via":{"kind":"word","word":"alice"}}` }
  },
  // A part of speech, a repeated phrase and a style flag: their counts, lit.
  {
    name: 'pos', messages: chapter.idle,
    act: async (tab) => {
      await click(tab, tab.locator('.pm-lb-pos-row').filter({ hasText: new RegExp(`^${chapter.items.verb}${countOf.verb}$`) }));
      await reveal(INSPECTOR)(tab);
    },
    expect: { region: `Sentences holding “${chapter.items.verb}” (verb)`, count: countOf.verb }
  },
  {
    name: 'phrase', messages: chapter.idle,
    act: async (tab) => { await click(tab, tab.locator('.pm-lb-phrase').filter({ hasText: `“${chapter.items.phrase}”` })); await reveal(INSPECTOR)(tab); },
    expect: { region: `Sentences holding “${chapter.items.phrase}”`, count: countOf.phrase }
  },
  {
    name: 'flag', messages: chapter.idle,
    act: async (tab) => { await click(tab, tab.locator('.pm-lb-flag.is-item').filter({ hasText: 'Weak Verbs' })); await reveal(INSPECTOR)(tab); },
    expect: { region: 'Sentences holding Weak Verbs', count: countOf.weakVerbs }
  },
  // The hapax list under the cloud, one word pinned: its one sentence.
  {
    name: 'hapax', messages: chapter.idle,
    act: async (tab) => {
      await click(tab, tab.locator('.pm-lb-hapax-word').filter({ hasText: new RegExp(`^${chapter.items.hapax.written}$`) }));
      await reveal('section.pm-lb-top-words')(tab);
    },
    expect: { region: `Sentences holding “${chapter.items.hapax.written}”`, count: 1, hapax: true }
  },
  // Back to the word before ¶2 answers, then ¶2's answer comes late (PR #159 F-01): the word's sentences stay, and nothing more is asked.
  {
    name: 'back-late', messages: chapter.idle,
    act: async (tab) => {
      await click(tab, cloudWord(tab, 'alice', countOf.alice));
      await tab.evaluate(() => { window.__pmHold = true; });
      await click(tab, tab.locator('.pm-lb-well-address'));
      await click(tab, tab.locator('.pm-lb-passage-back'));
      await tab.evaluate(() => { window.__pmHold = false; window.__pmRelease(); });
      await tab.waitForTimeout(250);
      await reveal(INSPECTOR)(tab);
    },
    expect: { region: 'Sentences holding “alice”', count: countOf.alice, requests: 2, released: 1 }
  },
  // The text changed while ¶11 was pinned: the newer board's answer is held, so the well says so and shows no text.
  {
    name: 'changed', messages: chapter.idle,
    act: async (tab) => {
      await click(tab, tab.getByRole('button', { name: `Paragraph ${L}`, exact: true }));
      await tab.evaluate(() => { window.__pmHold = true; });
      await post(tab, chapter.changed);
      await reveal(INSPECTOR)(tab);
    },
    expect: { changed: true }
  },
  // The whole book: the most frequent word passes the row bound, which the well states.
  {
    name: 'bounded', messages: chapter.book,
    act: async (tab) => { await click(tab, cloudWord(tab, 'alice', countOf.bookAlice)); await reveal(`${INSPECTOR} .pm-lb-passage`)(tab); },
    expect: { region: 'Sentences holding “alice”', count: countOf.bookAlice, bounded: true }
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1600 },
  { tag: '1000', width: 1000, height: 1600 },
  { tag: '500', width: 500, height: 1800 }
];

/** What the page shows, read from the DOM. */
const pageFacts = () => {
  const clean = (value) => (value == null ? null : value.trim().replace(/\s+/g, ' '));
  const text = (selector, root = document) => clean(root?.querySelector(selector)?.textContent);
  const inspector = document.querySelector('.pm-lb-inspector');
  const passage = inspector?.querySelector('.pm-lb-passage');
  const well = passage?.querySelector('.pm-lb-well');
  const marks = [...(well?.querySelectorAll('mark.pm-lb-mark') ?? [])];
  const ids = new Set(marks.flatMap((mark) => (mark.getAttribute('data-instances') || '').split(' ').filter(Boolean)));
  const box = (selector) => {
    const element = document.querySelector(selector);
    if (!element) { return null; }
    const r = element.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height) };
  };
  const hapaxWell = document.querySelector('.pm-lb-hapax-well');
  const statsHapax = [...document.querySelectorAll('.pm-lb-chip')].map((chip) => clean(chip.textContent)).find((chip) => / hapax · /.test(chip));
  // Snippets of every text a well shows: none may reach webview state.
  const snippets = [...(well?.querySelectorAll('.pm-lb-well-paragraph, .pm-lb-well-text') ?? [])]
    .map((element) => clean(element.textContent).slice(0, 30)).filter((snippet) => snippet.length >= 20);
  return {
    inspector: inspector ? {
      title: text('.pm-lb-inspector-title', inspector),
      where: text('.pm-lb-inspector-where', inspector),
      claim: text('.pm-lb-inspector-claim', inspector)
    } : null,
    passage: passage ? {
      label: text('.pm-lb-label', passage),
      notes: [...passage.querySelectorAll('.pm-lb-passage-note')].map((note) => clean(note.textContent)),
      lit: text('.pm-lb-passage-lit > span', passage),
      back: text('.pm-lb-passage-back', passage),
      region: well?.getAttribute('aria-label') ?? null,
      role: well?.getAttribute('role') ?? null,
      tabindex: well?.getAttribute('tabindex') ?? null,
      ariaLive: well?.getAttribute('aria-live') ?? null,
      rows: well ? well.querySelectorAll('li.pm-lb-well-row').length : null,
      marks: marks.length,
      litInstances: ids.size,
      wellHeight: well ? well.clientHeight : null,
      wellScrolls: well ? well.scrollHeight > well.clientHeight + 1 : null,
      firstWords: well ? clean(well.textContent).slice(0, 80) : null
    } : null,
    hapax: {
      head: text('.pm-lb-hapax-head'),
      words: document.querySelectorAll('.pm-lb-hapax-word').length,
      firstWords: [...document.querySelectorAll('.pm-lb-hapax-word')].slice(0, 6).map((button) => button.textContent),
      more: text('.pm-lb-hapax-more'),
      region: hapaxWell?.getAttribute('aria-label') ?? null,
      wellHeight: hapaxWell ? hapaxWell.clientHeight : null,
      wellScrolls: hapaxWell ? hapaxWell.scrollHeight > hapaxWell.clientHeight + 1 : null,
      statsChip: statsHapax ?? null
    },
    tiles: { topWords: box('section.pm-lb-top-words'), partsOfSpeech: box('section[aria-label="Parts of speech · repetition"]') },
    flags: [...document.querySelectorAll('.pm-lb-flag')].map((flag) => `${flag.tagName.toLowerCase()} ${clean(flag.textContent)}`),
    runLine: text('.pm-lb-run'),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    requests: window.__pmPosted.filter((m) => m.type === 'lightbox_request_passage').map((m) => `${m.payload.boardId} ${canonical(m.payload.item)}`),
    held: window.__pmHeld,
    released: window.__pmReleased,
    missing: window.__pmMissing,
    statesWithText: window.__pmStates.filter((state) => snippets.some((snippet) => state.includes(snippet))).length,
    statesSaved: window.__pmStates.length
  };
};

/** What is wrong with a state, as a list; empty when it shows what it should. */
const faults = (facts, expect) => {
  const out = [];
  const passage = facts.passage;
  if (facts.horizontalOverflow) { out.push('the document overflows horizontally'); }
  if (facts.missing.length > 0) { out.push(`no recorded answer for ${facts.missing.join('; ')}`); }
  if (facts.statesWithText > 0) { out.push(`${facts.statesWithText} saved states hold a well's text`); }
  // The hapax list is the stats row's length (to its first page) in every state.
  const counted = Number((facts.hapax.statsChip || '').split(' ')[0].replace(/,/g, ''));
  if (![chapterBoard, changedBoard, bookBoard].some((board) => board.measured.headline.hapaxCount === counted)) {
    out.push(`the stats row says "${facts.hapax.statsChip}"`);
  }
  if (facts.hapax.words !== Math.min(300, counted)) { out.push(`the hapax list holds ${facts.hapax.words} words for ${counted} counted`); }
  if (facts.hapax.region !== `Words used once: ${counted.toLocaleString('en-US')}`) { out.push(`the hapax well is named "${facts.hapax.region}"`); }
  const { topWords, partsOfSpeech } = facts.tiles;
  if (!topWords || !partsOfSpeech) { out.push('the Top Words or Parts of speech panel is missing'); }
  if (topWords && partsOfSpeech && topWords.top === partsOfSpeech.top && topWords.height !== partsOfSpeech.height) {
    out.push(`side by side, Top Words is ${topWords.height}px and Parts of speech ${partsOfSpeech.height}px`);
  }
  if (facts.hapax.wellHeight !== null && facts.hapax.wellHeight < 150) { out.push(`the hapax well is ${facts.hapax.wellHeight}px tall`); }
  if (expect.changed) {
    if (!passage || !passage.notes.includes('The text changed since this was shown. Reading it again from the board as it stands…')) { out.push('no "text changed" note'); }
    if (passage && passage.region) { out.push(`a well is shown: ${passage.region}`); }
    if (!facts.held.some((key) => key.startsWith(`${changedBoard.boardId} `))) { out.push('the changed board\'s passage was not asked for'); }
    return out;
  }
  if (!passage || !passage.region) { return [...out, `no well (expected "${expect.region}")`]; }
  if (passage.region !== expect.region) { out.push(`the well is "${passage.region}", not "${expect.region}"`); }
  if (passage.role !== 'region' || passage.tabindex !== '0' || passage.ariaLive !== 'off') { out.push(`the well is role=${passage.role} tabindex=${passage.tabindex} aria-live=${passage.ariaLive}`); }
  if (expect.count !== undefined) {
    const more = expect.bounded ? Number((/(\d[\d,]*) instances? (?:is|are) not listed/.exec(passage.notes.join(' ')) || [])[1]?.replace(/,/g, '')) : 0;
    if (passage.litInstances + more !== expect.count) { out.push(`${passage.litInstances} lit + ${more} past the bound for a count of ${expect.count}`); }
    if (expect.bounded && passage.rows !== 50) { out.push(`${passage.rows} rows under a bound of 50`); }
    if (!expect.bounded && passage.notes.length > 0) { out.push(`notes: ${passage.notes.join(' ')}`); }
  }
  if (expect.lit !== undefined && passage.litInstances !== expect.lit) { out.push(`${passage.litInstances} lit, expected ${expect.lit}`); }
  if (expect.litFromAnswer) {
    const lit = chapter.passages[expect.litFromAnswer]?.passage?.lit;
    if (lit === undefined || passage.litInstances !== lit || passage.lit !== `Lit: “alice”, ${lit} instance${lit === 1 ? '' : 's'} here.`) {
      out.push(`lit ${passage.litInstances}, note "${passage.lit}", for ${lit} recorded`);
    }
    if (passage.back !== '← Back to “alice”') { out.push(`the way back reads "${passage.back}"`); }
  }
  if (expect.scrolls && !passage.wellScrolls) { out.push('the paragraph well does not scroll'); }
  if (expect.requests !== undefined && facts.requests.length !== expect.requests) { out.push(`${facts.requests.length} passage requests, expected ${expect.requests}: ${facts.requests.join('; ')}`); }
  if (expect.released !== undefined && facts.released !== expect.released) { out.push(`${facts.released} held answers released late, expected ${expect.released}`); }
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const label = `${scenario.name}@${viewport.tag}`;
      const tab = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      tab.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${label} console: ${m.text()}`); } });
      await tab.goto('file://' + pageFile);
      await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => errors.push(`${label}: the frame never rendered`));
      await tab.evaluate(({ estimates, passages }) => {
        window.__pmEstimates = estimates;
        window.__pmPassages = passages;
      }, { estimates: chapter.estimates, passages: chapter.passages });
      await post(tab, [...chrome, ...scenario.messages]);
      try {
        await scenario.act(tab);
      } catch (error) {
        errors.push(`${label}: ${error.message.split('\n')[0]}`);
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
      if (!stable) { errors.push(`${label}: never settled`); }
      fs.writeFileSync(path.join(outDir, `lightbox-${scenario.name}-${viewport.tag}.png`), previous);
      const found = await tab.evaluate(pageFacts);
      for (const problem of faults(found, scenario.expect)) {
        errors.push(`${label}: ${problem}`);
      }
      facts[label] = found;
      await tab.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(facts, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see errors.txt)`);
  process.exitCode = errors.length > 0 ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
