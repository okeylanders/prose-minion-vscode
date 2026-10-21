/*
 * Being-verb contractions and dialogue is voice (epic decision 26): visual
 * evidence, adapted from ../lightbox-slice-4f-visual/harness.js. Renders a
 * built webview bundle in Chromium the way webviewHtml.ts would, as the
 * Lightbox surface, replays the host's board message for each state, and
 * screenshots one element once two consecutive frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/before.json and states/after.json are the board the production
 * LightboxService measured at the base (`27b646a`) and at this branch's
 * head, with group G read by the production codec, verifier and assembly
 * from one answer written for this evidence (tools/build-states.test.ts).
 * The same bundle renders both: the change is in what the host measures and
 * holds, and the webview draws what it is sent.
 *
 * facts.json records, per state, the numbers tile's rows and the steering
 * tile's figures and notes (stance, quote, why, nudge, example, the "In
 * dialogue" line), read from the DOM. errors.txt lists every page error,
 * console error and fault: a missing tile, a note in dialogue that still
 * shows a nudge or an example, or a state whose count of notes in dialogue
 * is not the one it was built with. It fails rather than skips.
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
const state = (name) => JSON.parse(fs.readFileSync(path.join(states, `${name}.json`), 'utf8'));
const before = state('before');
const after = state('after');

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
    window.__pmPosted = [];
    window.__pmVsCodeApi = { postMessage: (m) => { window.__pmPosted.push(m); }, getState: () => undefined, setState: () => {} };
    window.acquireVsCodeApi = () => window.__pmVsCodeApi;
    window.proseMinionAssets = { vhsLoadingGif: '', loadingGifs: [], loadingGifList: [], loadingGifCredits: {}, noticeShots: {} };
  </script>
  <script src="file://${path.resolve(bundle)}"></script>
</body>
</html>`;
const pagePath = path.resolve(outDir, 'lightbox.html');
fs.writeFileSync(pagePath, page);

// The stub model, as the 4F harness has it.
const chrome = [
  { type: 'api_key_status', source: 'extension.configuration', timestamp: 1, payload: { hasSavedKey: true } },
  {
    type: 'model_data', source: 'extension.configuration', timestamp: 1,
    payload: {
      options: [{ id: 'provider/reader-model', label: 'Reader model (stub)', description: '' }],
      selections: { assistant: 'provider/reader-model', widget: 'provider/reader-model' }
    }
  }
];

const NUMBERS = 'section[aria-label="What stands out in the numbers"]';
const STEERING = 'section.pm-lb-tile.is-steering';
const BEING = `${STEERING} section.pm-lb-steer-figure[aria-label="Being verbs"]`;
// The Hare's line, a note in dialogue: pinned for the inspector.
const SPOKEN = 'The Hare scolds through a plain state';

const scenarios = [
  // The numbers row, as the base and this branch measure the same chapter.
  { name: 'numbers-before', messages: before, shoot: { 1440: NUMBERS, 500: NUMBERS }, voiceNotes: 0 },
  { name: 'numbers-after', messages: after, shoot: { 1440: NUMBERS, 500: NUMBERS }, voiceNotes: 3 },
  // Craft steering (the three figures side by side at 1440; being verbs alone at 500): before, the Hare's
  // line carries a nudge and an example; after, it is voice, beside the narration note's nudge and example.
  { name: 'steering-before', messages: before, shoot: { 1440: STEERING, 500: BEING }, voiceNotes: 0 },
  { name: 'steering-after', messages: after, shoot: { 1440: STEERING, 500: BEING }, voiceNotes: 3 },
  // The dialogue note pinned: the inspector's "In dialogue" line.
  {
    name: 'inspector-after', messages: after, shoot: { 1440: '.pm-lb-inspector', 500: '.pm-lb-inspector' }, voiceNotes: 3,
    act: async (tab) => {
      const note = tab.locator(`${BEING} button.pm-lb-steer-note`, { hasText: SPOKEN });
      await note.scrollIntoViewIfNeeded();
      await note.click();
      await tab.mouse.move(4, 4);
    }
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 2600 },
  { tag: '500', width: 500, height: 2600 }
];

// Scroll `selector` to just under the sticky ribbon (or the top of its scroller), as the 4F harness does.
const scrollTo = async (tab, selector) => {
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
// The element's box as it stands in the window, clipped to the window: the sticky ribbon never covers it.
const boxOf = (tab, selector, viewport) => tab.evaluate(([target, height]) => {
  const rect = document.querySelector(target).getBoundingClientRect();
  const top = Math.max(0, rect.top);
  return { x: Math.max(0, rect.left), y: top, width: rect.width, height: Math.min(rect.bottom, height) - top };
}, [selector, viewport.height]);

const lightboxFacts = () => {
  const clean = (value) => value?.trim().replace(/\s+/g, ' ') ?? null;
  const text = (selector, root = document) => clean(root.querySelector(selector)?.textContent);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)].map((element) => clean(element.textContent));
  const numbers = document.querySelector('section[aria-label="What stands out in the numbers"]');
  const tile = document.querySelector('section.pm-lb-tile.is-steering');
  const inspector = document.querySelector('.pm-lb-inspector');
  return {
    numbers: numbers ? [...numbers.querySelectorAll('.pm-lb-number')].map((row) => ({
      name: text('.pm-lb-number-name', row),
      value: text('.pm-lb-number-value', row),
      standout: text('.pm-lb-number-standout', row),
      steered: text('.pm-lb-number-steered', row)
    })) : null,
    steering: tile ? [...tile.querySelectorAll('section.pm-lb-steer-figure')].map((figure) => ({
      label: figure.getAttribute('aria-label'),
      head: all('.pm-lb-steer-head > span', figure),
      rows: all('.pm-lb-steer-row', figure),
      meta: all('.pm-lb-steer-measured .pm-lb-steer-meta', figure),
      reading: text('.pm-lb-steer-reading .pm-lb-craft-note', figure),
      notes: [...figure.querySelectorAll('.pm-lb-steer-note')].map((note) => ({
        stance: text('.pm-lb-craft-tag', note),
        paragraph: text('.pm-lb-craft-para', note),
        quotes: all('q', note),
        why: text('.pm-lb-craft-note', note),
        nudge: text('.pm-lb-steer-nudge', note),
        example: note.querySelector('.pm-lb-steer-example')
          ? `${text('.pm-lb-steer-before', note)} → ${text('.pm-lb-steer-after', note)}` : null,
        exampleWithheld: text('.pm-lb-steer-withheld', note),
        voice: text('.pm-lb-steer-voice', note)
      }))
    })) : null,
    steeringWithheld: tile ? all('.pm-lb-withheld-claims > li', tile) : null,
    inspector: inspector ? {
      title: text('.pm-lb-inspector-title', inspector),
      details: all('dl.pm-lb-details > div', inspector)
    } : null,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
  };
};

/** What is wrong in a state, as a list; empty when it is whole. */
const faults = (facts, scenario) => {
  const out = [];
  if (!facts.numbers || facts.numbers.length !== 6) { out.push(`numbers tile shows ${facts.numbers?.length ?? 'no'} rows, not 6`); }
  if (!facts.steering || facts.steering.length !== 3) { out.push('craft steering does not show its three figures'); }
  const notes = (facts.steering ?? []).flatMap((figure) => figure.notes.map((note) => ({ figure: figure.label, ...note })));
  for (const note of notes) {
    if (note.voice && (note.nudge || note.example)) { out.push(`${note.figure}: a note in dialogue shows a nudge or an example`); }
    if (note.quotes.length !== 1) { out.push(`${note.figure}: a note shows ${note.quotes.length} quotations, not its one`); }
  }
  const voiced = notes.filter((note) => note.voice).length;
  if (voiced !== scenario.voiceNotes) { out.push(`${voiced} notes in dialogue, not ${scenario.voiceNotes}`); }
  if (facts.horizontalOverflow) { out.push('the document overflows horizontally'); }
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const tab = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      tab.on('pageerror', (e) => errors.push(`${scenario.name}@${viewport.tag}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${scenario.name}@${viewport.tag} console: ${m.text()}`); } });
      await tab.goto('file://' + pagePath);
      await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
      for (const entry of [...chrome, ...scenario.messages]) {
        await tab.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await tab.waitForTimeout(300);
      if (scenario.act) {
        await scenario.act(tab);
      }
      const selector = scenario.shoot[viewport.tag];
      if (!(await tab.$(selector))) {
        errors.push(`${scenario.name}@${viewport.tag}: nothing to capture at ${selector}`);
        await tab.close();
        continue;
      }
      await scrollTo(tab, selector);
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(600);
      const clip = await boxOf(tab, selector, viewport);
      const shot = () => tab.screenshot({ animations: 'disabled', caret: 'hide', clip });
      let previous = await shot();
      let stable = false;
      for (let attempt = 0; attempt < 8 && !stable; attempt++) {
        await tab.waitForTimeout(250);
        const next = await shot();
        stable = Buffer.compare(previous, next) === 0;
        previous = next;
      }
      if (!stable) { errors.push(`${scenario.name}@${viewport.tag}: never settled`); }
      fs.writeFileSync(path.join(outDir, `${scenario.name}-${viewport.tag}.png`), previous);
      const pageFacts = await tab.evaluate(lightboxFacts);
      for (const problem of faults(pageFacts, scenario)) {
        errors.push(`${scenario.name}@${viewport.tag}: ${problem}`);
      }
      facts[`${scenario.name}@${viewport.tag}`] = pageFacts;
      await tab.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(facts, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n'));
  console.log(`done; ${errors.length} errors (see errors.txt)`);
})().catch((e) => { console.error(e); process.exit(1); });
