/*
 * Lightbox Slice 4L visual harness: renders a built webview bundle in
 * Chromium the way webviewHtml.ts would, as the Lightbox, the sidebar (its
 * Settings overlay) and the Workshop, replays each tab's own host messages,
 * acts as the writer would, and screenshots each state once two consecutive
 * frames are byte-identical.
 *
 *   node harness.js <bundle.js> <outDir>
 *
 * states/models.json is real host output (see README.md and
 * tools/build-models.test.ts), except the Workshop's room, written for this
 * evidence in the host's shape. Each tab hears only its own host:
 *
 * - the Lightbox: its mount's MODEL_DATA and board; each `lightbox_set_lenses`
 *   is answered with the estimate for the model then in use, echoing the
 *   request's id; each `request_model_data` with the MODEL_DATA last sent.
 *   When the writer picks a model, the page's own `set_model_selection` is
 *   looked up in the recorded picks by what it posted (`<scope>:<modelId>`),
 *   and that pick's host answers are played: so a bundle whose picker posts
 *   the assistant scope (cf7f260's) gets the host's answer to that.
 * - the sidebar and the Workshop: their mount's MODEL_DATA, then, in the
 *   "set" and "after" states, what the watcher broadcast them after the pick
 *   the Lightbox page posted at the same width.
 *
 * The page's clock is pinned to 3:00 PM UTC on Oct 24, 2026, the room's
 * cache estimate four minutes on. A state whose page does not show what the
 * host's answers say is written to errors.txt, and the harness exits 1.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [bundle, outDir] = process.argv.slice(2);
for (const folder of ['lightbox', 'settings', 'workshop']) {
  fs.mkdirSync(path.join(outDir, folder), { recursive: true });
}
const states = JSON.parse(fs.readFileSync(path.join(__dirname, 'states', 'models.json'), 'utf8'));
const NOW = new Date('2026-10-24T15:00:00.000Z');
const WORKSHOP = 'placeholder/workshop-model';
const LIGHTBOX = 'placeholder/lightbox-model';

const page = (surface) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prose Minion ${surface}</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body { background: #1e1e1e; --vscode-font-family: sans-serif; --vscode-foreground: #ccc; }
    #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root" ${surface === 'sidebar' ? '' : `data-pm-surface="${surface}" data-pm-frame="fulltab"`}><span style="padding:8px">Loading…</span></div>
  <script>
    window.__pmPosted = [];
    const host = (message) => setTimeout(() => window.postMessage(message, '*'), 0);
    window.__pmVsCodeApi = {
      postMessage: (m) => {
        window.__pmPosted.push(m);
        const scenario = window.__pmScenario;
        if (m.type === 'request_model_data' && window.__pmModelData) {
          host(window.__pmModelData);
        }
        if (m.type === 'lightbox_set_lenses' && window.__pmEstimate) {
          host({ type: 'lightbox_run_estimate', source: 'extension.lightbox', timestamp: 1,
            payload: Object.assign({}, window.__pmEstimate, { requestId: m.payload.requestId }) });
        }
        if (m.type === 'set_model_selection' && scenario.picks) {
          const pick = scenario.picks[m.payload.scope + ':' + m.payload.modelId];
          if (pick) {
            window.__pmEstimate = pick.estimate;
            pick.lightbox.forEach(host);
            window.__pmModelData = pick.lightbox[pick.lightbox.length - 1];
          }
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
const pages = {};
for (const surface of ['lightbox', 'sidebar', 'workshop']) {
  pages[surface] = path.resolve(outDir, `${surface}.html`);
  fs.writeFileSync(pages[surface], page(surface));
}

// The frame's other chips, stubbed as every earlier Lightbox evidence folder does.
const message = (type, payload, source) => ({ type, source, timestamp: 1, payload });
const chrome = [
  message('api_key_status', { hasSavedKey: true }, 'extension.configuration'),
  message('account_balance_data', {
    openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } }, fetchedAt: 1
  }, 'extension.account'),
  message('token_usage_update', { totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }, 'extension.handler')
];
const last = (messages) => messages[messages.length - 1];

const settle = (tab) => tab.waitForTimeout(400);
const openChip = async (tab) => {
  await tab.locator('.pm-ws-header-actions .model-selector-trigger').click();
  await settle(tab);
};
const pickInBrowser = (label) => async (tab) => {
  await tab.getByRole('dialog').getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await tab.waitForTimeout(700);
};
const then = (...steps) => async (tab) => { for (const step of steps) { await step(tab); } };
const showLightboxRow = async (tab) => {
  await tab.evaluate(() => {
    const title = [...document.querySelectorAll('.settings-label-title')].find((node) => node.textContent === 'Lightbox Model');
    title?.closest('label')?.scrollIntoView({ block: 'center' });
  });
  await settle(tab);
};

/** The pick the Lightbox page posted at each width: the sidebar's and Workshop's later states hear its broadcasts. */
const posted = {};
const pickFor = (tag) => states.picks[posted[tag]] ?? null;

const lightboxScenario = (name, act, expect) => ({
  name, surface: 'lightbox', folder: 'lightbox', act, expect,
  data: () => ({ modelData: last(states.mount.lightbox), estimate: states.mount.estimate, picks: states.picks }),
  messages: () => [...chrome, ...states.mount.lightbox, ...states.mount.board]
});
const UNSET_CHIP = 'Browse lightbox model options. Current model: Same as Workshop (Workshop placeholder)';
const SET_CHIP = 'Browse lightbox model options. Current model: Lightbox placeholder';
const scenarios = [
  lightboxScenario('unset', async () => {}, { chip: UNSET_CHIP, browser: null, model: WORKSHOP }),
  lightboxScenario('unset-browser', openChip, {
    chip: UNSET_CHIP,
    browser: { follow: { label: 'Same as Workshop (Workshop placeholder)', selected: true }, selectedModels: [] },
    model: WORKSHOP
  }),
  lightboxScenario('set', then(openChip, pickInBrowser('Lightbox placeholder')), {
    chip: SET_CHIP, browser: null, model: LIGHTBOX, picked: `lightbox:${LIGHTBOX}`
  }),
  lightboxScenario('set-browser', then(openChip, pickInBrowser('Lightbox placeholder'), openChip), {
    chip: SET_CHIP,
    browser: { follow: { label: 'Same as Workshop (Workshop placeholder)', selected: false }, selectedModels: ['Lightbox placeholder'] },
    model: LIGHTBOX, picked: `lightbox:${LIGHTBOX}`
  }),
  {
    name: 'unset', surface: 'sidebar', folder: 'settings', act: showLightboxRow,
    data: () => ({ modelData: last(states.mount.sidebar) }),
    messages: () => [...chrome, ...states.mount.sidebar, message('open_settings', {}, 'extension.command')],
    expect: { row: { value: '', selected: 'Same as Workshop (Workshop placeholder)' } }
  },
  {
    name: 'set', surface: 'sidebar', folder: 'settings', act: showLightboxRow,
    data: (tag) => ({ modelData: last(pickFor(tag)?.sidebar ?? states.mount.sidebar) }),
    messages: (tag) => [...chrome, ...states.mount.sidebar, message('open_settings', {}, 'extension.command'), ...(pickFor(tag)?.sidebar ?? [])],
    // A model outside the curated list reads as "(Custom)" in every row of the overlay, as it did before.
    expect: { row: { value: LIGHTBOX, selected: `${LIGHTBOX} (Custom)` } }
  },
  {
    name: 'before', surface: 'workshop', folder: 'workshop', act: async () => {},
    data: () => ({ modelData: last(states.mount.workshop) }),
    messages: () => [...chrome, ...states.mount.workshop, states.workshopRoom],
    expect: { cache: 'Est. Cache Time Remaining: 4 min', workshopChip: 'Browse assistant model options. Current model: Workshop placeholder' }
  },
  {
    name: 'after', surface: 'workshop', folder: 'workshop', act: async () => {},
    data: (tag) => ({ modelData: last(pickFor(tag)?.workshop ?? states.mount.workshop) }),
    messages: (tag) => [...chrome, ...states.mount.workshop, states.workshopRoom, ...(pickFor(tag)?.workshop ?? [])],
    expect: { cache: 'Est. Cache Time Remaining: 4 min', workshopChip: 'Browse assistant model options. Current model: Workshop placeholder' }
  }
];

const viewports = [
  { tag: '1440', width: 1440, height: 1000 },
  { tag: '1000', width: 1000, height: 1000 },
  { tag: '500', width: 500, height: 1100 }
];

const facts = () => {
  const clean = (value) => value?.trim().replace(/\s+/g, ' ') ?? null;
  const chip = document.querySelector('.pm-ws-header-actions .model-selector-trigger');
  const dialog = document.querySelector('[role="dialog"][aria-label$="Model browser"]');
  const follow = dialog?.querySelector('.mb-follow .mb-card');
  const rowTitle = [...document.querySelectorAll('.settings-label-title')].find((node) => node.textContent === 'Lightbox Model');
  const row = rowTitle?.closest('label');
  const select = row?.querySelector('select');
  return {
    chip: chip?.getAttribute('aria-label') ?? null,
    chipText: clean(chip?.textContent),
    browser: dialog ? {
      title: clean(dialog.querySelector('.pm-eyebrow')?.textContent),
      follow: follow ? { label: clean(follow.querySelector('.tm-n')?.textContent), selected: follow.classList.contains('selected'), description: clean(follow.querySelector('.mb-desc')?.textContent) } : null,
      selectedModels: [...dialog.querySelectorAll('.mb-grid:not(.mb-follow) .mb-card.selected .tm-n')].map((node) => clean(node.textContent))
    } : null,
    runLine: clean(document.querySelector('.pm-lb-run')?.textContent),
    row: select ? {
      value: select.value,
      selected: clean(select.selectedOptions[0]?.textContent),
      options: [...select.options].map((option) => clean(option.textContent)),
      help: clean(row.querySelector('.settings-description')?.textContent)
    } : null,
    cache: clean(document.querySelector('.pm-ws-comp-cache')?.textContent),
    workshopChip: document.querySelector('[data-pm-surface="workshop"]') ? chip?.getAttribute('aria-label') ?? null : null,
    picks: window.__pmPosted.filter((m) => m.type === 'set_model_selection').map((m) => m.payload),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
  };
};

/** What is wrong with a state's page, as a list; empty when it shows what the host's answers say. */
const faults = (scenario, seen, tag) => {
  const out = [];
  const expect = scenario.expect;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (scenario.surface === 'lightbox') {
    if (seen.chip !== expect.chip) { out.push(`the chip says "${seen.chip}", not "${expect.chip}"`); }
    const browserSeen = seen.browser && {
      follow: seen.browser.follow && { label: seen.browser.follow.label, selected: seen.browser.follow.selected },
      selectedModels: seen.browser.selectedModels
    };
    if (!same(browserSeen, expect.browser)) {
      out.push(`the browser ${JSON.stringify(seen.browser)}, not ${JSON.stringify(expect.browser)}`);
    }
    const priced = scenario.name.startsWith('set') ? pickFor(tag)?.estimate : states.mount.estimate;
    if (priced?.estimate?.model !== expect.model) { out.push(`the estimate priced ${priced?.estimate?.model}, not ${expect.model}`); }
    if (expect.picked && !same(seen.picks.at(-1), { scope: 'lightbox', modelId: LIGHTBOX })) {
      out.push(`the picker posted ${JSON.stringify(seen.picks.at(-1))}, not the Lightbox's own scope`);
    }
  }
  if (scenario.surface === 'sidebar' && !same(seen.row && { value: seen.row.value, selected: seen.row.selected }, expect.row)) {
    out.push(`the Lightbox Model row ${JSON.stringify(seen.row)}, not ${JSON.stringify(expect.row)}`);
  }
  if (scenario.surface === 'workshop') {
    if (seen.cache !== expect.cache) { out.push(`the composer's cache estimate is "${seen.cache}", not "${expect.cache}"`); }
    if (seen.workshopChip !== expect.workshopChip) { out.push(`the Workshop's chip says "${seen.workshopChip}", not "${expect.workshopChip}"`); }
  }
  if (seen.horizontalOverflow) { out.push('horizontal overflow'); }
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const all = {};
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const id = `${scenario.folder}-${scenario.name}`;
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, timezoneId: 'UTC', locale: 'en-US' });
      await context.clock.setFixedTime(NOW);
      const tab = await context.newPage();
      tab.on('pageerror', (e) => errors.push(`${id}@${viewport.tag}: ${e.message}`));
      tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${id}@${viewport.tag} console: ${m.text()}`); } });
      const data = scenario.data(viewport.tag);
      await tab.addInitScript((seed) => {
        window.__pmScenario = seed;
        window.__pmModelData = seed.modelData;
        window.__pmEstimate = seed.estimate;
      }, data);
      await tab.goto('file://' + pages[scenario.surface]);
      await tab.waitForTimeout(300);
      for (const entry of scenario.messages(viewport.tag)) {
        await tab.evaluate((m) => window.postMessage(m, '*'), entry);
      }
      await tab.waitForTimeout(500);
      try {
        await scenario.act(tab);
        // The pointer leaves the page, so no hover lights the ribbon where a click landed.
        await tab.mouse.move(0, 0);
      } catch (error) {
        errors.push(`${id}@${viewport.tag}: could not act: ${error.message.split('\n')[0]}`);
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
      if (!stable) { errors.push(`${id}@${viewport.tag}: never settled`); }
      fs.writeFileSync(path.join(outDir, scenario.folder, `${scenario.folder}-${scenario.name}-${viewport.tag}.png`), previous);
      const seen = await tab.evaluate(facts);
      if (scenario.surface === 'lightbox' && scenario.expect.picked) {
        const pick = seen.picks.at(-1);
        posted[viewport.tag] = pick ? `${pick.scope}:${pick.modelId}` : undefined;
      }
      for (const problem of faults(scenario, seen, viewport.tag)) {
        errors.push(`${id}@${viewport.tag}: ${problem}`);
      }
      all[`${id}@${viewport.tag}`] = seen;
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(all, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.length > 0 ? `${errors.join('\n')}\n` : '');
  console.log(`done; ${errors.length} errors (see errors.txt)`);
  process.exit(errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
