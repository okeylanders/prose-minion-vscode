// Evidence for Reply Edit Actions Slice 3 (ADR 2026-11-10 U1-U6): renders the REAL thread components
// (WorkshopTurnBubble and everything under it) to static markup, under the Workshop's real stylesheets,
// and screenshots each state with Playwright. Text is Alice, never a writer's.
// Run from the repository root: node .todo/epics/epic-workshop-reply-edit-actions-2026-11-10/evidence/render.js
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SRC = path.join(ROOT, 'packages', 'core', 'src');
const WEBVIEW = path.join(SRC, 'presentation', 'webview');

// The aliases of tsconfig.base.json, longest first, so the components load as they are.
const paths = JSON.parse(fs.readFileSync(path.join(ROOT, 'tsconfig.base.json'), 'utf8')).compilerOptions.paths;
const aliases = Object.entries(paths)
  .map(([from, [to]]) => ({ from: from.replace(/\*$/, ''), to: path.join(ROOT, to.replace(/\*$/, '')), exact: !from.endsWith('*') }))
  .sort((a, b) => b.from.length - a.from.length);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const alias = aliases.find((each) => (each.exact ? request === each.from : request.startsWith(each.from)));
  return resolve.call(this, alias ? (alias.exact ? alias.to : path.join(alias.to, request.slice(alias.from.length))) : request, ...rest);
};
require('sucrase/register');

// The Markdown renderer sanitizes with DOMPurify, which needs a DOM to load against.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright');
const { WorkshopTurnBubble } = require(path.join(WEBVIEW, 'components/workshop/WorkshopTurnBubble.tsx'));

const PATH = 'chapters/down-the-rabbit-hole.md';
const BODY = 'The fall works. Three slips first: **“begining”** in the opening line, a doubled **“the the”** before “rabbit-hole”, and **“it’s”** where the well owns its sides.\n\n'
  + 'Two lines I’d rewrite. “Alice was beginning to get very tired” could open on the bank itself, and the fall’s second sentence says “very slowly” twice over.';

const offer = (kind, count, status = { state: 'open' }) => ({ kind, count, target: { kind: 'file', relativePath: PATH }, status });
const reply = (change = {}) => ({
  id: 'turn-2', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message', personaId: 'jill',
  personaLabel: 'Jill', content: BODY, timestamp: 2, excerptVersion: 0, ...change
});
const mine = { turnId: 'turn-2', reaction: 'heart', author: { kind: 'writer' }, label: 'You' };
const jacks = { turnId: 'turn-2', reaction: 'raised-hands', author: { kind: 'personaGuest', personaId: 'jack' }, label: 'Jack', viaTurnId: 'turn-9' };
const recommendation = { widgetId: 'show-vs-tell', seed: { beatText: 'Alice was beginning to get very tired.', subject: '2 passages' } };
const noop = () => undefined;

const bubble = (turn, { offers = {}, reactions = [], bare = false } = {}) => React.createElement(WorkshopTurnBubble, {
  turn,
  quickActionToolId: null,
  onQuickAction: noop,
  onTalkDirectly: noop,
  onCopy: noop,
  onSave: noop,
  onToggleBookmark: noop,
  onOpenWidgetRecommendation: noop,
  rewindability: bare ? undefined : { available: true },
  onRewind: noop,
  branchability: bare ? undefined : { available: true },
  onBranch: noop,
  editOffers: { running: false, locked: false, askingOffers: new Set(), offerFeedback: new Map(), onAsk: noop, onGoToTurn: noop, ...offers },
  reactions: { reactionsOf: () => reactions, disabled: false, onSet: noop, onHide: noop },
  fileEdits: { disabled: false, busyCards: new Set(), cardFeedback: new Map(), previews: new Map(), onApply: noop, onReview: noop, onDecline: noop, onRequestPreview: noop }
});

const ANSWERED = { state: 'answered', answerTurnId: 'turn-4', cards: 1, changes: 3, askAgain: false };
const REWRITES_ANSWERED = { state: 'answered', answerTurnId: 'turn-8', cards: 1, changes: 2, askAgain: false };
const short = (editOffers) => reply({ content: 'The fall works. Three slips first, and two lines I’d rewrite.', editOffers });

const fixesCard = {
  requested: { kind: 'resource', group: 'chapters', path: PATH },
  target: { kind: 'file', relativePath: PATH },
  class: 'prose',
  operations: [
    { op: 'replace', find: 'Alice was begining to get very tired', with: 'Alice was beginning to get very tired' },
    { op: 'replace', find: 'down the the rabbit-hole', with: 'down the rabbit-hole' },
    { op: 'replace', find: 'the well and it’s sides', with: 'the well and its sides' }
  ],
  why: 'The three slips from the reply: a misspelling, a doubled word, and a possessive.',
  baseline: { sha256: 'a'.repeat(64), length: 1200 },
  state: 'pending',
  intent: 'fixes'
};

const frames = [
  {
    id: '1-footer', title: '1 · The footer row',
    note: 'Offers at the left (the lead, fixes, rewrites, then the widget chip, moved in), the reaction corner at the right. Two footer rows: the actions and this one.',
    nodes: [bubble(reply({ editOffers: [offer('fixes', 3), offer('rewrites', 2)], widgetRecommendation: recommendation }), { reactions: [mine] })]
  },
  {
    id: '2-chip-states', title: '2 · A chip’s states',
    note: 'One bubble per state, footer only shown in full. Open; asked (the sibling waits and says why); answered; nothing to change, with the second press plain; ask again.',
    nodes: [
      ['Open', bubble(short([offer('fixes', 3), offer('rewrites', 2)]), { bare: true })],
      ['Asked · a run is going, so the other chip waits', bubble(short([offer('fixes', 3, { state: 'asked' }), offer('rewrites', 2)]), { bare: true, offers: { running: true, locked: true } })],
      ['Answered · the chip is the way to its cards', bubble(short([offer('fixes', 3, ANSWERED), offer('rewrites', 2)]), { bare: true })],
      ['Nothing to change · ask again is a plain second press', bubble(short([offer('fixes', 3, { state: 'nothing-to-change', answerTurnId: 'turn-4', askAgain: true }), offer('rewrites', 2, REWRITES_ANSWERED)]), { bare: true })],
      ['Ask again · every card of the last answer was declined, went stale or was refused', bubble(short([offer('fixes', 3, { state: 'ask-again', answerTurnId: 'turn-4', cards: 1, changes: 3, askAgain: true }), offer('rewrites', 2, REWRITES_ANSWERED)]), { bare: true })],
      ['Blocked · the author left the room', bubble(short([offer('fixes', 3, { state: 'open', blocked: 'author-left' }), offer('rewrites', 2, { state: 'open', blocked: 'author-left' })]), { bare: true })]
    ].map(([label, node]) => React.createElement('div', { key: label }, React.createElement('div', { className: 'ev-tag' }, label), node))
  },
  {
    id: '3-answer', title: '3 · The press and its answer',
    note: 'The press is one divider line in the host’s words (no pronoun). The answer is the host’s sentence and its cards under the kind, each card marked; the persona’s prose never shows.',
    nodes: [
      bubble({ id: 'turn-3', role: 'user', kind: 'message', participant: 'writer', artifact: 'persona_message', timestamp: 3, excerptVersion: 0,
        content: 'Asked Jill to suggest the fixes from their reply as file edits.', editOfferRequest: { sourceTurnId: 'turn-2', kind: 'fixes' } }),
      bubble(reply({ id: 'turn-4', content: `Suggested 3 fixes to ${PATH}, from the 2:02 pm reply.`, editOfferAnswer: { sourceTurnId: 'turn-2', kind: 'fixes', outcome: 'proposed' }, fileEditProposals: [fixesCard] }))
    ]
  },
  {
    id: '4-nothing-to-change', title: '4 · Nothing to change',
    note: 'The host’s line with the persona’s one-line why, and no cards.',
    nodes: [bubble(reply({ id: 'turn-4', content: 'Jill found nothing to change: the chapter already reads “beginning”.', editOfferAnswer: { sourceTurnId: 'turn-2', kind: 'fixes', outcome: 'none', why: 'the chapter already reads “beginning”.' } }))]
  },
  {
    id: '5-narrow', title: '5 · A narrow column', narrow: true,
    note: 'The row wraps: the offers take the first lines and the corner sits under them at the right.',
    nodes: [bubble(short([offer('fixes', 3), offer('rewrites', 2)]).id ? reply({ content: 'The fall works. Three slips first, and two lines I’d rewrite.', editOffers: [offer('fixes', 3), offer('rewrites', 2)], widgetRecommendation: recommendation }) : null, { reactions: [mine, jacks] })]
  },
  {
    id: '6-without', title: '6 · Without offers',
    note: 'A plain reply: the footer is the corner alone, where it sat before. With a widget chip and no edit offer: the chip, no lead.',
    nodes: [
      bubble(reply({ content: 'The fall works as it stands.' }), { bare: true, reactions: [mine] }),
      bubble(reply({ id: 'turn-7', content: 'Try the bank scene shown rather than told.', widgetRecommendation: recommendation }), { bare: true })
    ]
  }
];

const css = [
  'styles/fulltab/tokens.css', 'styles/fulltab/shell.css', 'styles/workshop/tokens.css', 'styles/workshop/shell.css',
  'styles/workshop/fileEdits.css', 'styles/workshop/reactions.css', 'styles/workshop/editOffers.css', 'components/workshop/standingDirectiveRail.css'
].map((file) => fs.readFileSync(path.join(WEBVIEW, file), 'utf8')).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Reply Edit Actions Slice 3: evidence</title><style>${css}
body { margin: 0; padding: 28px 32px 40px; background: var(--pm-bg, #15110d); }
.ev-frame { margin: 0 0 34px; max-width: 900px; }
.ev-frame.ev-narrow { max-width: 430px; }
.ev-frame > h2 { font: 600 11px ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: #ee7d49; margin: 0 0 4px; }
.ev-frame > p { color: #a4937f; font: 13px system-ui, sans-serif; margin: 0 0 12px; line-height: 1.5; }
.ev-stack { display: flex; flex-direction: column; gap: 14px; }
.ev-tag { font: 600 10px ui-monospace, Menlo, monospace; letter-spacing: .06em; text-transform: uppercase; color: #7a6c5b; margin: 0 0 6px; }
</style></head><body data-pm-frame="fulltab" data-pm-surface="workshop">
${frames.map((frame) => `<section class="ev-frame${frame.narrow ? ' ev-narrow' : ''}" id="f-${frame.id}"><h2>${frame.title}</h2><p>${frame.note}</p><div class="ev-stack">${
  frame.nodes.map((node) => renderToStaticMarkup(node)).join('\n')}</div></section>`).join('\n')}
</body></html>`;

(async () => {
  const out = path.join(__dirname, 'reply-offers-evidence.html');
  fs.writeFileSync(out, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`file://${out}`);
  for (const frame of frames) {
    await page.locator(`#f-${frame.id}`).screenshot({ path: path.join(__dirname, `${frame.id}.png`) });
  }
  // A chip with keyboard focus, and the footer's measured layout: one row wide, wrapped when narrow.
  await page.locator('#f-1-footer [data-pm-offer="fixes"]').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.locator('#f-1-footer .pm-ws-turn-foot').screenshot({ path: path.join(__dirname, '7-chip-focus.png') });
  const measure = (selector) => page.evaluate((sel) => {
    const foot = document.querySelector(`${sel} .pm-ws-turn-foot`);
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
    return { foot: box(foot), offers: box(foot.querySelector('.pm-ws-turn-offers')), corner: box(foot.querySelector('.pm-ws-reaction-corner')), scrolls: document.documentElement.scrollWidth > window.innerWidth };
  }, selector);
  const wide = await measure('#f-1-footer');
  const narrow = await measure('#f-5-narrow');
  const report = {
    wide: { ...wide, oneRow: wide.corner.top < wide.offers.bottom && wide.offers.top < wide.corner.bottom, cornerAtRight: wide.foot.right - wide.corner.right <= 1 },
    narrow: { ...narrow, cornerUnderOffers: narrow.corner.top >= narrow.offers.bottom, cornerAtRight: narrow.foot.right - narrow.corner.right <= 1 }
  };
  fs.writeFileSync(path.join(__dirname, 'layout.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  await browser.close();
})();
