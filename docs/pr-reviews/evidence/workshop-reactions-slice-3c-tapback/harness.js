/*
 * Workshop Message Reactions Slice 3c visual harness: renders a built webview
 * bundle in Chromium as the Workshop surface (the way webviewHtml.ts stamps
 * #root), replays one session snapshot, captures the writer's tapback and
 * measures it.
 *
 *   node harness.js <bundle.js> <outDir> [prefix]
 *
 * The room (made-up, Alice-style text):
 *   turn-1 the writer: Jill's heart (one persona reaction)
 *   turn-2 Jill: the writer's fire, Margot's eyes, Theo's thinking (persona bubble, 3b's corner)
 *   turn-3 the writer, a short message: Jill's, Margot's and Theo's reactions
 *   turn-4 the writer: no reactions (no room reserved)
 * Captures, at deviceScaleFactor 2:
 *   <prefix>writer-one.png      turn-1 with its action row
 *   <prefix>writer-three.png    turn-3 with its action row
 *   <prefix>persona.png         turn-2, the persona bubble
 *   <prefix>thread-900.png      the whole room at 900 px
 *   <prefix>thread-narrow.png   the room with each turn held to 260 px (the tab
 *                               does not reflow below ~900 px, so a phone-ish
 *                               bubble is simulated by width)
 *   <prefix>writer-wrap.png     turn-3 held to 170 px: the cluster wraps inside
 *                               the bubble rather than spilling past it
 * It prints, per writer bubble, where the cluster stands against the bubble
 * and the action row, and whether the thread scrolls sideways.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const [bundle, outDir, prefix = ''] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const writer = (id, timestamp, content) => ({
  id, role: 'user', kind: 'message', participant: 'writer', artifact: 'persona_message', content, timestamp, excerptVersion: 0
});
const turns = [
  writer('turn-1', 1, 'Does the moment Alice finds the little golden key land, or does it rush past?'),
  {
    id: 'turn-2', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message',
    personaId: 'jill', personaLabel: 'Jill',
    content: 'It lands, but only just. Let her hold the key one line longer before she tries the doors: the hall is long and low, and the reader should feel every one of those locks refuse her before the little curtain gives.',
    timestamp: 2, excerptVersion: 0
  },
  writer('turn-3', 3, 'Too slow now?'),
  writer('turn-4', 4, 'And the bottle marked DRINK ME: too convenient?')
];
const guest = (personaId) => ({ kind: 'personaGuest', personaId });
const reactions = [
  { turnId: 'turn-1', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' },
  { turnId: 'turn-2', reaction: 'fire', author: { kind: 'writer' }, label: 'You' },
  { turnId: 'turn-2', reaction: 'eyes', author: guest('margot'), label: 'Margot' },
  { turnId: 'turn-2', reaction: 'thinking', author: guest('theo'), label: 'Theo' },
  { turnId: 'turn-3', reaction: 'heart', author: { kind: 'host' }, label: 'Jill' },
  { turnId: 'turn-3', reaction: 'eyes', author: guest('margot'), label: 'Margot' },
  { turnId: 'turn-3', reaction: 'thinking', author: guest('theo'), label: 'Theo' }
];
const snapshot = {
  type: 'workshop_session_state', source: 'extension.workshop', timestamp: 1,
  payload: {
    session: {
      scope: 'open', participantSubjectReady: true, excerptVersion: 0, replacementCount: 0, roomRevision: 1,
      contextRevision: 0, contextAttachments: [], pendingMessageAttachments: [], widgetConfigs: [],
      standingDirectives: [], todos: [], bookmarks: [], reactions, turns,
      turnRewindability: {}, totalTurns: turns.length, truncatedTurns: 0, roomHasMemory: true,
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

const turnBox = (page, id) => page.evaluate((turnId) => {
  const turn = document.querySelector(`[data-pm-turn-id="${turnId}"]`) ?? document.querySelectorAll('.pm-ws-turn')[Number(turnId.split('-')[1]) - 1];
  const box = turn.getBoundingClientRect();
  return { x: box.left - 16, y: box.top - 12, right: box.right + 16, bottom: box.bottom + 12 };
}, id);

const shoot = async (page, file, box) => {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  await page.screenshot({ path: path.join(outDir, `${prefix}${file}`), clip: { x, y, width: box.right - x, height: box.bottom - y } });
};

/** Where each writer bubble's cluster stands, in CSS px. */
const measure = (page) => page.evaluate(() => {
  const thread = document.querySelector('.pm-ws-thread');
  const rows = [...document.querySelectorAll('.pm-ws-turn-user')].map((turn) => {
    const bubble = turn.querySelector('.pm-ws-turn-message').getBoundingClientRect();
    const text = (() => {
      const range = document.createRange();
      range.selectNodeContents(turn.querySelector('.pm-ws-turn-message'));
      const rects = [...range.getClientRects()];
      return rects.length ? Math.max(...rects.map((rect) => rect.bottom)) : bubble.top;
    })();
    const cluster = turn.querySelector('.pm-ws-reaction-cluster')?.getBoundingClientRect();
    const actions = turn.querySelector('.pm-ws-turn-actions-writer')?.getBoundingClientRect();
    const row = {
      text: turn.querySelector('.pm-ws-turn-message').textContent.slice(0, 24),
      tapback: turn.querySelector('[data-pm-reaction-tapback]') !== null,
      bubbleHeight: Math.round(bubble.height),
      gapToActions: actions ? Math.round(actions.top - bubble.bottom) : null
    };
    if (cluster) {
      Object.assign(row, {
        overhangBelowBubble: Math.round(cluster.bottom - bubble.bottom),
        onBubble: Math.round(bubble.bottom - cluster.top),
        clearsText: Math.round(cluster.top - text),
        insideBubbleLeft: Math.round(cluster.left - bubble.left),
        insideBubbleRight: Math.round(bubble.right - cluster.right),
        clearsActions: actions ? Math.round(actions.top - cluster.bottom) : null
      });
    }
    return row;
  });
  return { horizontalScroll: thread.scrollWidth > thread.clientWidth, rows };
});

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [narrow, width] of [[false, 0], [true, 260], [true, 170]]) {
    const page = await browser.newPage({ viewport: { width: 900, height: narrow ? 1800 : 1300 }, deviceScaleFactor: 2 });
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(`file://${pagePath}`);
    await page.waitForTimeout(400);
    await page.evaluate((message) => window.postMessage(message, '*'), snapshot);
    await page.waitForSelector('.pm-ws-turn-assistant');
    if (narrow) {
      await page.addStyleTag({ content: `[data-pm-surface="workshop"] .pm-ws-turn { max-width: ${width}px; }` });
    }
    await page.evaluate(() => { document.querySelector('.pm-ws-thread').scrollTop = 0; });
    await page.waitForTimeout(300);
    const first = await turnBox(page, 'turn-1');
    const last = await turnBox(page, 'turn-4');
    const persona = await turnBox(page, 'turn-2');
    const room = { x: Math.min(first.x, persona.x), y: first.y, right: Math.max(first.right, persona.right), bottom: last.bottom };
    if (width === 170) {
      await shoot(page, 'writer-wrap.png', await turnBox(page, 'turn-3'));
    } else {
      await shoot(page, `thread-${narrow ? 'narrow' : '900'}.png`, room);
    }
    if (!narrow) {
      await shoot(page, 'writer-one.png', first);
      await shoot(page, 'writer-three.png', await turnBox(page, 'turn-3'));
      await shoot(page, 'persona.png', persona);
    }
    console.log(`${narrow ? width : 900}:`, JSON.stringify(await measure(page), null, 1));
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
})();
