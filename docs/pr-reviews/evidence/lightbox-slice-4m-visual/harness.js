/*
 * Lightbox Slice 4M visual harness, adapted from
 * ../lightbox-slice-4j-visual/harness.js: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox surface, replays the
 * host's messages for one board (states/design-fixes.json, real host output:
 * see README.md and tools/build-design-fixes.test.ts), and checks the slice's
 * two design fixes with a real pointer.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * 1. Hover never changes layout. For six items (the counted word that
 *    stands in the most paragraphs, a ribbon column, the Dialogue and
 *    Sections lanes, a section on the Sections lane, the writer's case, and
 *    a read motif), the pointer rests on a spot that hovers nothing,
 *    then moves to 3 px inside the item's top edge and holds still for 1.2 s.
 *    The ribbon's box, its top area's box, the focus line's box and the
 *    item's box must be the same before and during the hover; the focus line
 *    may change once (idle to the item) and the ribbon's height never; the
 *    item must still be hovered at the end. Then every control in the
 *    board's column is hovered in turn, and the box of every element of the
 *    Lightbox must be the same before and during (the focus line's own box
 *    included; only the words inside it may change).
 * 2. Re-analyze all beside Finish. The run line must show Finish (orange,
 *    the sparkle) and Re-analyze all (secondary) right after it, each with
 *    its cost, each named by its visible label first, inside the toolbar at
 *    every width; without an API key both are disabled, described by one
 *    reason said once.
 *
 * Each runs at 1440, 1000 and 500 px, and again at 125% zoom (VS Code's
 * zoom, which the writer's larger font is: the same windows at 1.25 device
 * pixels per CSS pixel, so 1152, 800 and 400 CSS px wide), with the root
 * font and VS Code's font-size variables raised to 18 px. A state whose page
 * breaks a rule is written to errors.txt, and the harness exits 1.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();
const probes = require('./checks');

const [bundle, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const { oneFailed } = JSON.parse(fs.readFileSync(path.join(__dirname, 'states', 'design-fixes.json'), 'utf8'));
const board = oneFailed.messages.find((message) => message.type === 'lightbox_board').payload.board;

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

/** The chrome a Lightbox tab hears first, with or without a saved API key. */
const chrome = (hasSavedKey) => [
  { type: 'api_key_status', source: 'extension.configuration', timestamp: 1, payload: { hasSavedKey } },
  {
    type: 'model_data', source: 'extension.configuration', timestamp: 1,
    payload: {
      options: [{ id: 'provider/model-v1', label: 'Reader model (stub)', description: '' }],
      selections: { assistant: 'provider/model-v1', widget: 'provider/model-v1', lightbox: 'provider/model-v1' }
    }
  },
  {
    type: 'account_balance_data', source: 'extension.account', timestamp: 1,
    payload: { openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } }, fetchedAt: 1 }
  },
  { type: 'token_usage_update', source: 'extension.handler', timestamp: 1, payload: { totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } } }
];

const sizes = [
  { tag: '1440', width: 1440, height: 1100 },
  { tag: '1000', width: 1000, height: 1100 },
  { tag: '500', width: 500, height: 1400 }
];
const ZOOM = 1.25;
const configs = sizes.flatMap((size) => [
  { ...size, zoom: 1, name: size.tag },
  { ...size, zoom: ZOOM, name: `${size.tag}-zoom125` }
]);
// The writer's larger text: VS Code's zoom (the configs' 1.25), and the root and VS Code font sizes raised.
const LARGE_FONT = 'html { font-size: 18px; } body { --vscode-font-size: 18px; --vscode-editor-font-size: 18px; }';

/** The counted word that stands in the most paragraphs: the item whose focus line is longest. */
const widest = [...board.measured.topWords].sort((a, b) => b.paragraphs.length - a.paragraphs.length)[0];
const TARGETS = [
  { name: 'word', find: { kind: 'word', term: widest.term }, says: widest.paragraphs.length },
  { name: 'column', find: { kind: 'column', index: Math.floor(board.ribbon.length / 2) } },
  { name: 'dialogue-lane', find: { kind: 'lane', label: 'Dialogue' }, says: board.paragraphs.filter((paragraph) => paragraph.dialogueWords > 0).length },
  { name: 'sections-lane', find: { kind: 'lane', label: 'Sections' } },
  // The writer's case: "hovering over a section". The middle section's band on the Sections lane.
  { name: 'section', find: { kind: 'section', index: Math.floor((board.measured.sections?.sections.length ?? 0) / 2) } },
  // A reading: the first motif call A read (its paragraphs are where its quotes stand).
  { name: 'motif', find: { kind: 'selector', selector: 'section[aria-label="Motifs · where they recur"] .pm-lb-motif' } }
];

/** Tag the target so it can be found again (`data-pm-target`); null when it is not on the page. */
function tagTarget(find) {
  let element = null;
  if (find.kind === 'word') {
    element = [...document.querySelectorAll('.pm-lb-cloud-word')].find((chip) => chip.firstChild?.textContent === find.term) ?? null;
  } else if (find.kind === 'column') {
    element = document.querySelectorAll('.pm-lb-ribbon-cols > button')[find.index] ?? null;
  } else if (find.kind === 'section') {
    element = document.querySelectorAll('.pm-lb-band.is-section')[find.index] ?? null;
  } else if (find.kind === 'selector') {
    element = document.querySelector(find.selector);
  } else {
    element = [...document.querySelectorAll('.pm-lb-ribbon-labels button')]
      .find((button) => button.textContent.replace(/\s+/g, ' ').trim().startsWith(find.label)) ?? null;
  }
  document.querySelectorAll('[data-pm-target]').forEach((other) => other.removeAttribute('data-pm-target'));
  if (!element) { return null; }
  element.setAttribute('data-pm-target', '');
  // A word or a motif sits in a tile under the ribbon: bring it to the middle. The ribbon's own items: the board's top.
  if (find.kind === 'word' || find.kind === 'selector') {
    element.scrollIntoView({ block: 'center' });
  } else {
    // The board as it opens, at its top, when the ribbon shows there; otherwise scrolled to the ribbon.
    document.querySelector('.pm-lb-scroll').scrollTo(0, 0);
    document.scrollingElement.scrollTo(0, 0);
    if (document.querySelector('.pm-lb-ribbon').getBoundingClientRect().bottom > window.innerHeight) {
      document.querySelector('.pm-lb-ribbon').scrollIntoView({ block: 'start' });
    }
  }
  document.scrollingElement.scrollLeft = 0;
  return true;
}

const sameBox = (a, b) => a && b && ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) <= 0.5);
const frames = (tab, count = 3) => tab.evaluate((n) => new Promise((done) => {
  const step = (left) => (left === 0 ? done() : requestAnimationFrame(() => step(left - 1)));
  step(n);
}), count);

async function open(browser, config, hasSavedKey) {
  const context = await browser.newContext({
    viewport: { width: Math.round(config.width / config.zoom), height: Math.round(config.height / config.zoom) },
    deviceScaleFactor: config.zoom,
    timezoneId: 'UTC',
    locale: 'en-US'
  });
  const tab = await context.newPage();
  await tab.addInitScript((data) => { window.__pmScenario = JSON.parse(JSON.stringify(data)); }, oneFailed);
  await tab.goto('file://' + pagePath);
  if (config.zoom !== 1) {
    await tab.addStyleTag({ content: LARGE_FONT });
  }
  await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => {});
  for (const entry of [...chrome(hasSavedKey), ...oneFailed.messages]) {
    await tab.evaluate((m) => window.postMessage(m, '*'), entry);
  }
  await tab.waitForTimeout(500);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForSelector('.pm-lb-ribbon-cols', { timeout: 10000 });
  return { context, tab };
}

/** Rest the pointer where it hovers nothing; `quick` waits frames only (the audit's many controls). */
async function rest(tab, quick = false) {
  const point = await tab.evaluate(probes.neutralPoint);
  await tab.mouse.move(point.x, point.y);
  if (!quick) {
    await tab.waitForTimeout(250);
  }
  await frames(tab);
}

async function settledShot(tab, file) {
  let previous = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
  let stable = false;
  for (let attempt = 0; attempt < 8 && !stable; attempt++) {
    await tab.waitForTimeout(250);
    const next = await tab.screenshot({ animations: 'disabled', caret: 'hide' });
    stable = Buffer.compare(previous, next) === 0;
    previous = next;
  }
  fs.writeFileSync(file, previous);
  return stable;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const facts = {};
  const fail = (where, problem) => errors.push(`${where}: ${problem}`);

  for (const config of configs) {
    const { context, tab } = await open(browser, config, true);
    tab.on('pageerror', (e) => fail(config.name, e.message));
    tab.on('console', (m) => { if (m.type() === 'error') { fail(config.name, `console: ${m.text()}`); } });

    // ---- 1. Hover never changes layout: four items, a still pointer. ----
    for (const target of TARGETS) {
      const where = `hover-${target.name}@${config.name}`;
      const found = await tab.evaluate(tagTarget, target.find);
      if (!found) { fail(where, 'the item is not on the page'); continue; }
      await rest(tab);
      const before = await tab.evaluate(probes.boxes, '[data-pm-target]');
      await tab.evaluate(probes.startWatch);
      const at = before.target;
      await tab.mouse.move(at.x + at.width / 2, at.y + Math.min(3, at.height / 2));
      await tab.waitForTimeout(1200);
      const watched = await tab.evaluate(probes.stopWatch);
      const during = await tab.evaluate(probes.boxes, '[data-pm-target]');
      fs.writeFileSync(path.join(outDir, `ribbon-${target.name}-${config.name}.png`), await tab.screenshot({ animations: 'disabled', caret: 'hide' }));
      facts[where] = { before, during, watched };
      for (const part of ['ribbon', 'top', 'focusLine', 'target']) {
        if (!sameBox(before[part], during[part])) {
          fail(where, `the ${part}'s box changed on hover: ${JSON.stringify(before[part])} → ${JSON.stringify(during[part])}`);
        }
      }
      if (watched.changes > 1) {
        fail(where, `the focus line changed ${watched.changes} times while the pointer held still: ${JSON.stringify(watched.texts.slice(0, 4))}`);
      }
      if (watched.heightChanges > 0) {
        fail(where, `the ribbon's height changed ${watched.heightChanges} times while the pointer held still: ${JSON.stringify(watched.heights.slice(0, 8))}`);
      }
      if (!during.hot) { fail(where, 'the item is no longer hovered: the board moved out from under the pointer'); }
      if (during.focusText === before.focusText) { fail(where, 'the focus line did not name the hovered item'); }
      if (!/· [\d,]+ ¶$/.test(during.focusText ?? '')) {
        fail(where, `the focus line does not end with the item's paragraph count: "${(during.focusText ?? '').slice(-40)}"`);
      } else if (target.says !== undefined && !during.focusText.endsWith(`· ${target.says.toLocaleString('en-US')} ¶`)) {
        fail(where, `the focus line does not end with the item's count, "· ${target.says} ¶": "${during.focusText.slice(-40)}"`);
      }
    }

    // ---- 1b. Every control in the board's column, hovered in turn. ----
    await tab.evaluate(() => document.querySelector('.pm-lb-scroll').scrollTo(0, 0));
    const labels = await tab.evaluate(probes.tagControls);
    const moved = [];
    let skipped = 0;
    for (let index = 0; index < labels.length; index++) {
      const point = await tab.evaluate(probes.showControl, index);
      if (!point) { skipped++; continue; }
      await rest(tab, true);
      const before = await tab.evaluate(probes.layoutSignature);
      await tab.mouse.move(point.x, point.y);
      await frames(tab, 4);
      const after = await tab.evaluate(probes.layoutSignature);
      if (before !== after) {
        const difference = await tab.evaluate(probes.layoutDifference, { before, after });
        moved.push({ control: labels[index], ...difference });
      }
    }
    facts[`audit@${config.name}`] = { controls: labels.length, hovered: labels.length - skipped, skipped, moved: moved.slice(0, 12), movedCount: moved.length };
    if (moved.length > 0) {
      fail(`audit@${config.name}`, `${moved.length} of ${labels.length - skipped} controls change the layout on hover, e.g. ${JSON.stringify(moved.slice(0, 2))}`);
    }

    // ---- 2. Re-analyze all beside Finish. ----
    await tab.evaluate(() => {
      document.querySelector('.pm-lb-scroll').scrollTo(0, 0);
      document.querySelector('.pm-lb-toolbar')?.scrollIntoView({ block: 'start' });
      document.scrollingElement.scrollLeft = 0;
    });
    await rest(tab);
    const runLine = await tab.evaluate(probes.runLineFacts);
    if (!(await settledShot(tab, path.join(outDir, `runline-${config.name}.png`)))) { fail(`runline@${config.name}`, 'never settled'); }
    facts[`runline@${config.name}`] = runLine;
    const finishNamed = await tab.getByRole('button', { name: /^Finish/ }).count();
    const allNamed = await tab.getByRole('button', { name: /^Re-analyze all/ }).count();
    const where = `runline@${config.name}`;
    if (!runLine.primary || !runLine.primary.text.startsWith('Finish') || !runLine.primary.className.includes('pm-lb-primary') || !runLine.primary.icon) {
      fail(where, `Finish is not the orange press with its sparkle: ${JSON.stringify(runLine.primary)}`);
    }
    if (!runLine.secondary) {
      fail(where, 'no Re-analyze all beside Finish');
    } else {
      if (!runLine.secondary.text.startsWith('Re-analyze all') || !runLine.secondary.className.includes('pm-lb-button')) {
        fail(where, `Re-analyze all is not a secondary press: ${JSON.stringify(runLine.secondary)}`);
      }
      if (!/^7 calls · /.test(runLine.secondary.cost) || !/^1 call · /.test(runLine.primary?.cost ?? '')) {
        fail(where, `each press does not carry its own cost: Finish "${runLine.primary?.cost}", Re-analyze all "${runLine.secondary.cost}"`);
      }
      if (!runLine.besidePrimary) { fail(where, 'Re-analyze all is not right beside Finish'); }
      if (runLine.sideBySide?.roomForBoth && !runLine.sideBySide.sameRow) { fail(where, 'Re-analyze all wrapped away from Finish though the line has room for both'); }
      if (runLine.secondary.disabled || runLine.primary?.disabled) { fail(where, 'a press is disabled with a key and every call fitting'); }
      if (!runLine.secondary.inToolbar || !runLine.primary?.inToolbar) { fail(where, 'a press runs past the toolbar'); }
      if (allNamed !== 1 || finishNamed !== 1) { fail(where, `the presses are not named by their visible labels first (Finish ${finishNamed}, Re-analyze all ${allNamed})`); }
    }
    if (runLine.escaped.length > 0) { fail(where, `text past the toolbar: ${JSON.stringify(runLine.escaped)}`); }
    if (runLine.horizontalOverflow) { fail(where, 'horizontal overflow'); }
    await context.close();

    // ---- 2b. Without an API key: both disabled, one reason said once. ----
    const noKey = await open(browser, config, false);
    noKey.tab.on('pageerror', (e) => fail(`${config.name} (no key)`, e.message));
    await noKey.tab.evaluate(() => {
      document.querySelector('.pm-lb-toolbar')?.scrollIntoView({ block: 'start' });
      document.scrollingElement.scrollLeft = 0;
    });
    await rest(noKey.tab);
    const keyless = await noKey.tab.evaluate(probes.runLineFacts);
    if (!(await settledShot(noKey.tab, path.join(outDir, `runline-nokey-${config.name}.png`)))) { fail(`runline-nokey@${config.name}`, 'never settled'); }
    facts[`runline-nokey@${config.name}`] = keyless;
    const reason = 'Add an OpenRouter API key in Settings to run AI analyses.';
    if (!keyless.primary?.disabled || !keyless.secondary?.disabled) { fail(`runline-nokey@${config.name}`, 'a press is enabled without a key'); }
    if (keyless.primary?.description !== reason || keyless.secondary?.description !== reason) {
      fail(`runline-nokey@${config.name}`, `a press is not described by the key's reason: ${JSON.stringify([keyless.primary?.description, keyless.secondary?.description])}`);
    }
    if (keyless.reasons.length !== 1) { fail(`runline-nokey@${config.name}`, `the reason is said ${keyless.reasons.length} times`); }
    if (keyless.escaped.length > 0 || keyless.horizontalOverflow) { fail(`runline-nokey@${config.name}`, 'text past the toolbar, or horizontal overflow'); }
    await noKey.context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(facts, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see errors.txt)`);
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
