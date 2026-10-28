/*
 * Lightbox source picker visual harness, adapted from
 * ../lightbox-launch-entry-points/harness.js: renders a built webview bundle
 * in Chromium the way webviewHtml.ts would, behind a stubbed VS Code API,
 * and screenshots each state once two consecutive frames are byte-identical.
 *
 *   node harness.js <head webview.js> <outDir> [<base webview.js>]
 *
 * The Lightbox (head bundle): the project picker opened from the source
 * panel, browsing, inside a category and searching names and content; then
 * the context list's attach picker over a counted board, and the rail after
 * the host's answer. The harness plays the host: it answers the catalog and
 * search requests the page posts with synthetic entries, echoing each
 * request's id as the host does (PR #154 F-01), gives each file a stand-in
 * for the host's opaque file key (PR #154 F-02), and records what the page
 * posted. The Workshop (base and head bundles): the excerpt card's "Choose
 * from project…", browsing and searching at 1440, 1000 and 500 px, with the
 * dialog's markup recorded so the two bundles can be compared. Every shot
 * with a dialog also records whether the modal's backdrop is the top element
 * outside the dialog (`document.elementFromPoint`) and covers the viewport.
 *
 * The model is the Slice 3 harness's stub, so no real model's name is drawn;
 * nothing is sent to a provider. File names are synthetic or from Lewis
 * Carroll's "Alice's Adventures in Wonderland" (1865, public domain); the
 * board is the Slice 4 evidence's counted Alice chapter, read from there.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Resolve Playwright from the project, then PLAYWRIGHT_MODULE, then this
// container's global install. Chromium comes from CHROMIUM_PATH or the
// container's /opt/pw-browsers/chromium.
const { chromium } = (() => {
  try { return require('playwright'); } catch { /* fall through */ }
  return require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
})();

const [headBundle, outDir, baseBundle] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const states = path.join(__dirname, '..', 'lightbox-slice-4-visual', 'states');
const chapter = JSON.parse(fs.readFileSync(path.join(states, 'chapter.json'), 'utf8'));
const countedBoard = chapter.idle.filter((message) => message.type === 'lightbox_board').at(-1).payload.board;

/** The host's document for a full tab: #root stamps its surface and the frame. */
const page = (bundle, surface, title) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    html, body { height: 100%; margin: 0; }
    body { background: #1e1e1e; --vscode-font-family: sans-serif; --vscode-foreground: #ccc; }
    #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root" data-pm-surface="${surface}" data-pm-frame="fulltab"><span style="padding:8px">Loading…</span></div>
  <script>
    window.__pmPosted = [];
    window.__pmVsCodeApi = {
      postMessage: (m) => { window.__pmPosted.push(m); },
      getState: () => undefined,
      setState: () => {}
    };
    window.acquireVsCodeApi = () => window.__pmVsCodeApi;
    window.proseMinionAssets = { vhsLoadingGif: '', loadingGifs: [], loadingGifList: [], loadingGifCredits: {}, noticeShots: {} };
  </script>
  <script src="file://${path.resolve(bundle)}"></script>
</body>
</html>`;

const STUB_MODEL = 'provider/reader-model';
const message = (type, payload, source = 'extension.lightbox') => ({ type, source, timestamp: 1, payload });
const chrome = [
  message('api_key_status', { hasSavedKey: true }, 'extension.configuration'),
  message('model_data', {
    options: [{ id: STUB_MODEL, label: 'Reader model (stub)', description: '' }],
    selections: { assistant: STUB_MODEL, dictionary: STUB_MODEL, context: STUB_MODEL, category: STUB_MODEL, widget: STUB_MODEL }
  }, 'extension.configuration'),
  message('account_balance_data', {
    openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } },
    fetchedAt: 1
  }, 'extension.account'),
  message('token_usage_update', { totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }, 'extension.handler')
];

/** A stand-in for the host's opaque file key: 32 hex characters, the same for the same file. */
const fileKey = (entryPath) => crypto.createHash('sha256').update(`synthetic:${entryPath}`).digest('hex').slice(0, 32);

/** The configured catalog the host would send: chapters, a manuscript, characters, places, themes. */
const CATALOG = [
  ['chapters', 'Chapters/01-down-the-rabbit-hole.md', 12_480],
  ['chapters', 'Chapters/02-the-pool-of-tears.md', 11_960],
  ['chapters', 'Chapters/03-a-caucus-race.md', 10_240],
  ['chapters', 'Chapters/04-the-rabbit-sends-in-a-little-bill.md', 14_020],
  ['manuscript', 'Manuscript/wonderland-draft.md', 152_300],
  ['characters', 'Characters/alice.md', 1_840],
  ['characters', 'Characters/white-rabbit.md', 1_210],
  ['characters', 'Characters/cheshire-cat.md', 1_530],
  ['locations', 'Places/the-long-hall.md', 980],
  ['themes', 'Themes/curiosity.md', 760]
].map(([group, entryPath, sizeBytes]) => ({
  group,
  path: entryPath,
  label: path.basename(entryPath, '.md').replace(/-/g, ' '),
  sizeBytes,
  fileKey: fileKey(entryPath)
}));
/** The Workshop's catalog carries no file key. */
const WORKSHOP_CATALOG = CATALOG.map(({ fileKey: _key, ...entry }) => entry);
const workshopSession = message('workshop_session_state', {
  session: {
    scope: null, participantSubjectReady: true, excerptVersion: 0, replacementCount: 0, roomRevision: 1, contextRevision: 0,
    contextAttachments: [], pendingMessageAttachments: [], widgetConfigs: [], standingDirectives: [], todos: [], turns: [],
    turnRewindability: {}, totalTurns: 0, truncatedTurns: 0, roomHasMemory: false,
    participants: { host: { personaId: 'jill', hasConversation: false }, toolSidecars: [], personaGuests: [], chatTarget: { kind: 'host' } }
  },
  persistence: { available: true, degradedConversationKeys: [] }
}, 'extension.workshop');

const LIGHTBOX_WIDTHS = [
  { tag: '1440', width: 1440, height: 1000 },
  { tag: '1000', width: 1000, height: 1000 },
  { tag: '500', width: 500, height: 1200 }
];
const WORKSHOP_WIDTHS = LIGHTBOX_WIDTHS;

/** Steps run in the page; each returns after the page has had a moment to render. */
const post = async (tab, entry) => { await tab.evaluate((m) => window.postMessage(m, '*'), entry); await tab.waitForTimeout(150); };
const posted = (tab) => tab.evaluate(() => window.__pmPosted.length);
const postedSince = (tab, from) => tab.evaluate(
  (start) => window.__pmPosted.slice(start).map((m) => ({ type: m.type, source: m.source, payload: m.payload })),
  from
);
const clickText = async (tab, scope, text) => {
  await tab.locator(scope).getByRole('button', { name: text }).first().click();
  await tab.waitForTimeout(150);
};
/** The host's answer to the page's latest request of `requestType`, echoing that request's id (PR #154 F-01). */
const answer = async (tab, requestType, type, payload) => {
  const requestId = await tab.evaluate(
    (wanted) => window.__pmPosted.filter((m) => m.type === wanted).at(-1)?.payload?.requestId,
    requestType
  );
  await post(tab, message(type, { ...payload, requestId }));
};
const catalogArrives = (tab) =>
  answer(tab, 'lightbox_request_project_catalog', 'lightbox_project_catalog', { entries: CATALOG });
const search = async (tab, query) => {
  await tab.fill('.pm-ws-ctxsel-search input', query);
  await clickText(tab, '.pm-ws-ctxsel-modes', 'Names + content');
  await tab.waitForTimeout(450);
};

const lightboxStart = (board, contextFiles) => [
  ...chrome,
  message('lightbox_board', { board, refusal: null }),
  message('lightbox_context_files', {
    files: contextFiles,
    totalWords: contextFiles.reduce((sum, file) => sum + file.wordCount, 0),
    ceilingWords: 50_000
  })
];
const shelfFile = (id, displayPath, wordCount) => ({ id, displayPath, wordCount, fileKey: fileKey(displayPath) });
const RABBIT = shelfFile('ctx-1', 'Characters/white-rabbit.md', 196);

const shots = [
  {
    name: 'lightbox/source-browse', surface: 'lightbox', widths: LIGHTBOX_WIDTHS, start: lightboxStart(null, []),
    act: async (tab) => {
      await clickText(tab, '.pm-lb-source', 'Choose from project…');
      await catalogArrives(tab);
    }
  },
  {
    name: 'lightbox/source-chapters', surface: 'lightbox', widths: LIGHTBOX_WIDTHS, start: lightboxStart(null, []),
    act: async (tab) => {
      await clickText(tab, '.pm-lb-source', 'Choose from project…');
      await catalogArrives(tab);
      await clickText(tab, '.pm-ws-ctxsel-cats', /Chapters & Scenes/);
    }
  },
  {
    name: 'lightbox/source-search', surface: 'lightbox', widths: LIGHTBOX_WIDTHS, start: lightboxStart(null, []),
    act: async (tab) => {
      await clickText(tab, '.pm-lb-source', 'Choose from project…');
      await catalogArrives(tab);
      await search(tab, 'rabbit');
      // The host's content answer: a theme whose text mentions the Rabbit.
      await answer(tab, 'lightbox_search_project_catalog', 'lightbox_project_catalog_search_results', {
        query: 'rabbit',
        matches: [{ group: 'chapters', path: 'Chapters/02-the-pool-of-tears.md' }, { group: 'themes', path: 'Themes/curiosity.md' }],
        bounded: false
      });
    }
  },
  {
    // Ends inside Characters: the shelf's White Rabbit reads "attached", the Cheshire Cat is checked.
    name: 'lightbox/context-attach', surface: 'lightbox', widths: LIGHTBOX_WIDTHS, start: lightboxStart(countedBoard, [RABBIT]),
    act: async (tab) => {
      await clickText(tab, '.pm-lb-context', 'Add from project…');
      await catalogArrives(tab);
      await clickText(tab, '.pm-ws-ctxsel-cats', /Locations/);
      await tab.locator('.pm-ws-ctxsel-body').getByRole('checkbox', { name: /the-long-hall/ }).click();
      await clickText(tab, '.pm-ws-ctxsel-body', /Back/);
      await clickText(tab, '.pm-ws-ctxsel-cats', /Characters/);
      await tab.locator('.pm-ws-ctxsel-body').getByRole('checkbox', { name: /cheshire-cat/ }).click();
      await tab.waitForTimeout(150);
    }
  },
  {
    name: 'lightbox/context-rail', surface: 'lightbox', widths: LIGHTBOX_WIDTHS, start: lightboxStart(countedBoard, [RABBIT]),
    act: async (tab, facts) => {
      await clickText(tab, '.pm-lb-context', 'Add from project…');
      await catalogArrives(tab);
      await clickText(tab, '.pm-ws-ctxsel-cats', /Characters/);
      await tab.locator('.pm-ws-ctxsel-body').getByRole('checkbox', { name: /cheshire-cat/ }).click();
      await clickText(tab, '.pm-ws-ctxsel-body', /Back/);
      await clickText(tab, '.pm-ws-ctxsel-cats', /Locations/);
      await tab.locator('.pm-ws-ctxsel-body').getByRole('checkbox', { name: /the-long-hall/ }).click();
      const before = await posted(tab);
      await clickText(tab, '.pm-ws-ctxsel-foot', /Add 2 files/);
      facts.postedOnAdd = await postedSince(tab, before);
      // The host's answer: the shelf with both added.
      await post(tab, message('lightbox_context_files', {
        files: [RABBIT, shelfFile('ctx-2', 'Characters/cheshire-cat.md', 241), shelfFile('ctx-3', 'Places/the-long-hall.md', 158)],
        totalWords: 595,
        ceilingWords: 50_000
      }));
      facts.postedAfterAnswer = (await postedSince(tab, before)).map((entry) => entry.type);
    }
  },
  {
    name: 'workshop/excerpt-browse', surface: 'workshop', widths: WORKSHOP_WIDTHS, bundles: ['base', 'head'],
    start: [...chrome, workshopSession],
    act: async (tab) => {
      await clickText(tab, '.pm-ws-rail', 'Choose from project…');
      await post(tab, message('workshop_context_catalog', { entries: WORKSHOP_CATALOG }, 'extension.workshop'));
    }
  },
  {
    name: 'workshop/excerpt-search', surface: 'workshop', widths: WORKSHOP_WIDTHS, bundles: ['base', 'head'],
    start: [...chrome, workshopSession],
    act: async (tab) => {
      await clickText(tab, '.pm-ws-rail', 'Choose from project…');
      await post(tab, message('workshop_context_catalog', { entries: WORKSHOP_CATALOG }, 'extension.workshop'));
      await search(tab, 'rabbit');
      await post(tab, message('workshop_context_search_results', {
        query: 'rabbit',
        matches: [{ group: 'chapters', path: 'Chapters/02-the-pool-of-tears.md' }, { group: 'themes', path: 'Themes/curiosity.md' }],
        bounded: false
      }, 'extension.workshop'));
    }
  }
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
  const bundles = { head: headBundle, base: baseBundle };
  const errors = [];
  const facts = {};
  for (const shot of shots) {
    for (const which of shot.bundles ?? ['head']) {
      if (!bundles[which]) {
        continue;
      }
      const html = path.resolve(outDir, `${shot.surface}-${which}.html`);
      fs.writeFileSync(html, page(bundles[which], shot.surface, `Prose Minion ${shot.surface}`));
      for (const viewport of shot.widths) {
        const suffix = shot.bundles ? `-${which === 'base' ? 'before' : 'after'}` : '';
        const key = `${shot.name}${suffix}@${viewport.tag}`;
        const tab = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        tab.on('pageerror', (e) => errors.push(`${key}: ${e.message}`));
        tab.on('console', (m) => { if (m.type() === 'error') { errors.push(`${key} console: ${m.text()}`); } });
        await tab.goto('file://' + html);
        await tab.waitForSelector('.pm-ws', { timeout: 10000 }).catch(() => errors.push(`${key}: .pm-ws never rendered`));
        for (const entry of shot.start) {
          await tab.evaluate((m) => window.postMessage(m, '*'), entry);
        }
        await tab.waitForTimeout(300);
        const seen = { };
        const from = await posted(tab);
        try {
          await shot.act(tab, seen);
        } catch (error) {
          errors.push(`${key}: ${error.message.split('\n')[0]}`);
        }
        await tab.mouse.move(4, 4);
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
        if (!stable) { errors.push(`${key}: never settled`); }
        const file = path.join(outDir, `${shot.name}${suffix}-${viewport.tag}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, previous);

        const page_ = await tab.evaluate(() => {
          const squash = (text) => (text || '').replace(/\s+/g, ' ').trim();
          const dialog = document.querySelector('[role="dialog"]');
          const box = dialog?.getBoundingClientRect();
          return {
            dialog: dialog ? {
              eyebrow: squash(dialog.querySelector('.pm-ws-eyebrow')?.textContent),
              description: squash(dialog.querySelector('.pm-ws-tools-modal-head p')?.textContent),
              rows: [...dialog.querySelectorAll('.pm-ws-ctxsel-file')].map((row) => ({
                role: row.getAttribute('role'),
                text: squash(row.textContent),
                disabled: row.disabled
              })),
              categories: [...dialog.querySelectorAll('.pm-ws-ctxsel-cat')].map((cat) => squash(cat.textContent)),
              pills: [...dialog.querySelectorAll('.pm-ws-ctxsel-pill')].map((pill) => squash(pill.textContent)),
              footer: squash(dialog.querySelector('.pm-ws-ctxsel-foot')?.textContent),
              box: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
              styled: getComputedStyle(dialog).position !== 'static' || getComputedStyle(dialog.parentElement).position === 'fixed',
              html: dialog.outerHTML
            } : null,
            // The modal's backdrop: the top element at probes outside the dialog, and as large as the viewport.
            backdrop: (() => {
              const backdrop = document.querySelector('.pm-ws-modal-backdrop');
              if (!backdrop || !dialog) { return null; }
              const edge = backdrop.getBoundingClientRect();
              const inset = 4;
              const w = window.innerWidth;
              const h = window.innerHeight;
              const probes = [[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset],
                [w / 2, inset], [w / 2, h - inset], [inset, h / 2], [w - inset, h / 2]]
                .filter(([x, y]) => x < box.left || x > box.right || y < box.top || y > box.bottom);
              const hits = probes.map(([x, y]) => document.elementFromPoint(x, y));
              return {
                probesOutsideDialog: probes.length,
                onTop: probes.length > 0 && hits.every((hit) => hit === backdrop),
                coversViewport: edge.left <= 0 && edge.top <= 0 && edge.right >= w && edge.bottom >= h
              };
            })(),
            sourceEmpty: squash(document.querySelector('.pm-lb-source-empty')?.textContent) || null,
            welcome: squash(document.querySelector('.pm-lb-sub')?.textContent) || null,
            context: [...document.querySelectorAll('.pm-lb-context-item')].map((item) => squash(item.textContent)),
            // The source panel's buttons stay inside it (the longer "Choose from project…" label wraps the row).
            sourceButtonsInside: (() => {
              const panel = document.querySelector('.pm-lb-source');
              if (!panel) { return null; }
              const edge = panel.getBoundingClientRect().right;
              return [...panel.querySelectorAll('.pm-lb-button')].every((button) => button.getBoundingClientRect().right <= edge + 0.5);
            })(),
            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
          };
        });
        const dialogHtml = page_.dialog?.html;
        if (page_.dialog) {
          page_.dialog.htmlSha256 = crypto.createHash('sha256').update(dialogHtml).digest('hex');
          delete page_.dialog.html;
        }
        facts[key] = { ...page_, ...seen, posted: (await postedSince(tab, from)).map((entry) => entry.type) };
        await tab.close();
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'facts.json'), JSON.stringify(facts, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'errors.txt'), errors.join('\n') + (errors.length ? '\n' : ''));
  console.log(`done; ${errors.length} page errors`);
})().catch((e) => { console.error(e); process.exit(1); });
