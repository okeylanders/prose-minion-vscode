/*
 * Workshop Message Reactions Slice 3b visual harness: renders a built webview
 * bundle in Chromium as the Workshop surface (the way webviewHtml.ts stamps
 * #root), replays one session snapshot, and captures the reaction corner.
 *
 *   node harness.js <bundle.js> <outDir> [prefix]
 *
 * The room (made-up, Alice-style text): the writer's message carries Jill's
 * heart; Jill's reply carries three reactions (the writer's fire, Margot's
 * eyes, Tobin's thinking). Captures, at deviceScaleFactor 2:
 *   <prefix>thread-900.png       the two bubbles at 900 px
 *   <prefix>thread-narrow.png    the same with the bubbles held to 300 px (the tab
 *                               itself does not reflow below ~900 px, so a
 *                               phone-ish bubble is simulated by width)
 *   <prefix>palette-open.png     the palette open from Jill's corner (opens up)
 *   <prefix>palette-flip.png     the same bubble scrolled near the top (opens down)
 * The Workshop has one palette (the warm dark full-tab tokens), so there is no
 * light-theme capture.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const [bundle, outDir, prefix = ''] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const writerTurn = {
  id: 'turn-1', role: 'user', kind: 'message', participant: 'writer', artifact: 'persona_message',
  content: 'Does the moment Alice finds the little golden key land, or does it rush past?', timestamp: 1, excerptVersion: 0
};
const hostTurn = {
  id: 'turn-2', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message',
  personaId: 'jill', personaLabel: 'Jill',
  content: 'It lands, but only just. Let her hold the key one line longer before she tries the doors: the hall is long and low, and the reader should feel every one of those locks refuse her before the little curtain gives.',
  timestamp: 2, excerptVersion: 0
};
const reactions = [
  { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' },
  { turnId: 'turn-2', reaction: 'fire', author: { kind: 'writer' }, label: 'You' },
  { turnId: 'turn-2', reaction: 'eyes', author: { kind: 'personaGuest', personaId: 'margot' }, label: 'Margot' },
  { turnId: 'turn-2', reaction: 'thinking', author: { kind: 'personaGuest', personaId: 'tobin' }, label: 'Tobin' }
];
const snapshot = {
  type: 'workshop_session_state', source: 'extension.workshop', timestamp: 1,
  payload: {
    session: {
      scope: 'open', participantSubjectReady: true, excerptVersion: 0, replacementCount: 0, roomRevision: 1,
      contextRevision: 0, contextAttachments: [], pendingMessageAttachments: [], widgetConfigs: [],
      standingDirectives: [], todos: [], bookmarks: [], reactions, turns: [writerTurn, hostTurn],
      turnRewindability: {}, totalTurns: 2, truncatedTurns: 0, roomHasMemory: true,
      participants: { host: { personaId: 'jill', hasConversation: true }, toolSidecars: [], personaGuests: [], chatTarget: { kind: 'host' } },
      conversationBehavior: { mode: 'workshop' }
    },
    writerProfile: {},
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  }
};

const pageHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>html, body { height: 100%; margin: 0; } body { background: #1e1e1e; --vscode-font-family: sans-serif; } #root { height: 100%; }</style>
</head><body>
<div id="root" data-pm-surface="workshop" data-pm-frame="fulltab"></div>
<script>
  window.__pmVsCodeApi = { postMessage: () => {}, getState: () => undefined, setState: () => {} };
  window.acquireVsCodeApi = () => window.__pmVsCodeApi;
  window.proseMinionAssets = { vhsLoadingGif: '', loadingGifs: [], loadingGifList: [], loadingGifCredits: {}, noticeShots: {} };
</script>
<script src="file://${path.resolve(bundle)}"></script>
</body></html>`;
const pagePath = path.resolve(outDir, `${prefix}workshop.html`);
fs.writeFileSync(pagePath, pageHtml);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [width, narrow] of [[900, false], [900, true]]) {
    const page = await browser.newPage({ viewport: { width, height: narrow ? 1500 : 1250 }, deviceScaleFactor: 2 });
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(`file://${pagePath}`);
    await page.waitForTimeout(400);
    // The default snapshot's conversationBehavior is filled by the real defaults where the app needs them.
    await page.evaluate((message) => window.postMessage(message, '*'), snapshot);
    await page.waitForSelector('.pm-ws-turn-assistant');
    if (narrow) {
      await page.addStyleTag({ content: '[data-pm-surface="workshop"] .pm-ws-turn { max-width: 300px; }' });
    }
    await page.evaluate(() => { document.querySelector('.pm-ws-thread').scrollTop = 0; });
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const first = document.querySelector('.pm-ws-turn-user').getBoundingClientRect();
      const second = document.querySelector('.pm-ws-turn-assistant').getBoundingClientRect();
      return { x: Math.min(first.left, second.left) - 12, y: first.top - 12, right: Math.max(first.right, second.right) + 12, bottom: second.bottom + 12 };
    });
    const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.right - Math.max(0, box.x), height: box.bottom - Math.max(0, box.y) };
    if (process.env.FULL) { await page.screenshot({ path: path.join(outDir, `${prefix}full-${narrow ? 'narrow' : width}.png`), fullPage: true }); }
    await page.screenshot({ path: path.join(outDir, `${prefix}thread-${narrow ? 'narrow' : width}.png`), clip });
    if (!narrow) {
      // The before bundle has no corner button; only the after bundle's palette is captured.
      const add = page.locator('.pm-ws-turn-assistant .pm-ws-reaction-corner .pm-ws-reaction-add').first();
      if (await add.count()) {
        await add.click();
        await page.waitForTimeout(200);
        const open = await page.evaluate(() => {
          const palette = document.querySelector('.pm-ws-reaction-palette').getBoundingClientRect();
          const bubble = document.querySelector('.pm-ws-turn-assistant').getBoundingClientRect();
          return { x: Math.min(palette.left, bubble.left) - 12, y: Math.min(palette.top, bubble.top) - 12, right: Math.max(palette.right, bubble.right) + 12, bottom: Math.max(palette.bottom, bubble.bottom) + 12 };
        });
        await page.screenshot({ path: path.join(outDir, `${prefix}palette-open.png`), clip: { x: Math.max(0, open.x), y: Math.max(0, open.y), width: open.right - Math.max(0, open.x), height: open.bottom - Math.max(0, open.y) } });
        await page.keyboard.press('Escape');
        // Later turns in the room, then Jill's bubble scrolled to the top of the
        // thread, so there is no room above its corner.
        const later = [3, 4, 5, 6, 7, 8, 9].map((n) => ({
          ...(n % 2 ? writerTurn : hostTurn), id: `turn-${n}`, timestamp: n,
          content: n % 2 ? 'And the bottle marked DRINK ME: too convenient?' : 'Not if she hesitates. Give the label a second look.'
        }));
        const longer = JSON.parse(JSON.stringify(snapshot));
        longer.payload.session.turns.push(...later);
        longer.payload.session.totalTurns = 9;
        longer.payload.session.roomRevision = 2;
        await page.evaluate((message) => window.postMessage(message, '*'), longer);
        await page.waitForSelector('[data-pm-turn-id="turn-9"], .pm-ws-turn-assistant >> nth=2').catch(() => undefined);
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          const thread = document.querySelector('.pm-ws-thread');
          const corner = document.querySelectorAll('.pm-ws-turn-assistant .pm-ws-reaction-add')[0];
          thread.scrollTop += corner.getBoundingClientRect().top - thread.getBoundingClientRect().top - 24;
        });
        await page.waitForTimeout(300);
        console.log('corner top before reopening:', await page.evaluate(() => Math.round(document.querySelector('.pm-ws-turn-assistant .pm-ws-reaction-add').getBoundingClientRect().top - document.querySelector('.pm-ws-thread').getBoundingClientRect().top)));
        await add.click();
        await page.waitForTimeout(200);
        const flip = await page.evaluate(() => {
          const palette = document.querySelector('.pm-ws-reaction-palette');
          const box = palette.getBoundingClientRect();
          return { placement: palette.dataset.placement, x: box.left - 160, y: Math.max(0, box.top - 120), width: box.width + 172, height: box.height + 132 };
        });
        console.log(`palette after scroll: ${flip.placement}`, JSON.stringify(flip), await page.evaluate(() => JSON.stringify(document.querySelector('.pm-ws-thread').getBoundingClientRect())));
        await page.screenshot({ path: path.join(outDir, `${prefix}palette-flip.png`), clip: { x: Math.max(0, flip.x), y: flip.y, width: flip.width, height: flip.height } });
      }
    }
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
})();
