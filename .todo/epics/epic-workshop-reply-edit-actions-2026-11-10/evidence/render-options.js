// Evidence for Reply Edit Actions Slice 3b (ADR 2026-11-10, second addendum: a chip per alternative version): renders the REAL thread components
// (WorkshopTurnBubble and everything under it) to static markup, under the Workshop's real stylesheets,
// and screenshots each state with Playwright. Text is Alice, never a writer's.
// Run from the repository root: node .todo/epics/epic-workshop-reply-edit-actions-2026-11-10/evidence/render-options.js
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
const LABELS = ['Version 1', 'Version 2', 'A third option'];
const BODY = 'One slip first: **“begining”** in the opening line.\n\nThen three ways the Rabbit’s line could go.\n\n'
  + '**Version 1.** “Oh dear! I shall be late!”\n\n**Version 2.** “Late, late, late,” the Rabbit muttered, and was gone.\n\n'
  + '**A third option.** The Rabbit said nothing at all; it only looked at its watch and ran.';
const OPEN = { state: 'open' };
const ANSWERED = { state: 'answered', answerTurnId: 'turn-4', cards: 1, changes: 1, askAgain: false };

const fixes = (status = OPEN) => ({ kind: 'fixes', count: 1, target: { kind: 'file', relativePath: PATH }, status });
const versions = (optionStatuses = [OPEN, OPEN, OPEN]) => ({ kind: 'rewrites', target: { kind: 'file', relativePath: PATH }, options: LABELS, optionStatuses });
const reply = (change = {}) => ({
  id: 'turn-2', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message', personaId: 'jill',
  personaLabel: 'Jill', content: BODY, timestamp: 2, excerptVersion: 0, ...change
});
const short = (editOffers) => reply({ content: 'One slip first, then three ways the Rabbit’s line could go.', editOffers });
const mine = { turnId: 'turn-2', reaction: 'heart', author: { kind: 'writer' }, label: 'You' };
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

const versionCard = {
  requested: { kind: 'resource', group: 'chapters', path: PATH },
  target: { kind: 'file', relativePath: PATH },
  class: 'prose',
  operations: [{ op: 'replace', find: '“Oh dear! Oh dear! I shall be late!”', with: '“Late, late, late,” the Rabbit muttered, and was gone.' }],
  why: 'Version 2 from the reply: the Rabbit mutters and goes.',
  baseline: { sha256: 'a'.repeat(64), length: 1200 },
  state: 'pending'
};
const tagged = (pairs) => pairs.map(([label, node]) => React.createElement('div', { key: label }, React.createElement('div', { className: 'ev-tag' }, label), node));

const frames = [
  {
    id: '8-options', title: '8 · A chip per alternative version',
    note: 'The reply wrote out three versions of one line and named one slip. The footer: the lead, the fixes chip first, then one chip per version, labeled with the reply’s own words. The corner stays at the right.',
    nodes: [bubble(reply({ editOffers: [versions(), fixes()] }), { reactions: [mine] })]
  },
  {
    id: '9-options-answered', title: '9 · One version asked, then answered',
    note: 'Each version has its own state. Asking one makes its siblings wait and say why; an answered version is the way to its edit, and the others can still be asked. Below: the press’s line and the answer, each naming the version.',
    nodes: [
      ...tagged([
        ['Asked · Version 2 is out; the other chips wait', bubble(short([fixes(), versions([OPEN, { state: 'asked' }, OPEN])]), { bare: true, offers: { running: true, locked: true } })],
        ['Answered · Version 2 goes to its edit; the others still ask', bubble(short([fixes(), versions([OPEN, ANSWERED, OPEN])]), { bare: true })],
        ['Nothing to change for one, ask again for another', bubble(short([fixes(), versions([{ state: 'nothing-to-change', answerTurnId: 'turn-6', askAgain: true }, ANSWERED, { state: 'ask-again', answerTurnId: 'turn-8', cards: 1, changes: 1, askAgain: true }])]), { bare: true })]
      ]),
      bubble({ id: 'turn-3', role: 'user', kind: 'message', participant: 'writer', artifact: 'persona_message', timestamp: 3, excerptVersion: 0,
        content: 'Asked Jill for an edit · Version 2, from that reply.', editOfferRequest: { sourceTurnId: 'turn-2', kind: 'rewrites', option: 1 } }),
      bubble(reply({ id: 'turn-4', content: `Suggested Version 2 as an edit to ${PATH}, from the 2:02 pm reply.`,
        editOfferAnswer: { sourceTurnId: 'turn-2', kind: 'rewrites', option: 1, outcome: 'proposed' }, fileEditProposals: [versionCard] }))
    ]
  },
  {
    id: '10-options-narrow', title: '10 · A narrow column', narrow: true,
    note: 'Four chips wrap inside their group; the corner sits under them at the right.',
    nodes: [bubble(short([fixes(), versions([OPEN, ANSWERED, OPEN])]), { reactions: [mine] })]
  }
];

const css = [
  'styles/fulltab/tokens.css', 'styles/fulltab/shell.css', 'styles/workshop/tokens.css', 'styles/workshop/shell.css',
  'styles/workshop/fileEdits.css', 'styles/workshop/reactions.css', 'styles/workshop/editOffers.css', 'components/workshop/standingDirectiveRail.css'
].map((file) => fs.readFileSync(path.join(WEBVIEW, file), 'utf8')).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Reply Edit Actions Slice 3b: evidence</title><style>${css}
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
  const out = path.join(__dirname, 'reply-offer-options-evidence.html');
  fs.writeFileSync(out, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`file://${out}`);
  for (const frame of frames) {
    await page.locator(`#f-${frame.id}`).screenshot({ path: path.join(__dirname, `${frame.id}.png`) });
  }
  // The measured layout: chips in declared order after the fixes chip, one row when wide, wrapped when narrow, no horizontal scroll.
  const measure = (selector) => page.evaluate((sel) => {
    const foot = document.querySelector(`${sel} .pm-ws-turn-foot`);
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
    const chips = Array.from(foot.querySelectorAll('[data-pm-offer]'));
    return {
      foot: box(foot),
      offers: box(foot.querySelector('.pm-ws-turn-offers')),
      corner: box(foot.querySelector('.pm-ws-reaction-corner')),
      chips: chips.map((chip) => ({ label: chip.textContent, ...box(chip) })),
      scrolls: document.documentElement.scrollWidth > window.innerWidth
    };
  }, selector);
  const wide = await measure('#f-8-options');
  const narrow = await measure('#f-10-options-narrow');
  const leftToRight = (chips) => chips.every((chip, index) => index === 0 || chip.top > chips[index - 1].top || chip.left >= chips[index - 1].right);
  const report = {
    wide: { ...wide, chipsInOrder: leftToRight(wide.chips), oneRow: wide.corner.top < wide.offers.bottom && wide.offers.top < wide.corner.bottom, cornerAtRight: wide.foot.right - wide.corner.right <= 1 },
    narrow: { ...narrow, chipsInOrder: leftToRight(narrow.chips), chipsWithinFoot: narrow.chips.every((chip) => chip.right <= narrow.foot.right + 1), cornerAtRight: narrow.foot.right - narrow.corner.right <= 1 }
  };
  fs.writeFileSync(path.join(__dirname, 'layout-options.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  await browser.close();
})();
