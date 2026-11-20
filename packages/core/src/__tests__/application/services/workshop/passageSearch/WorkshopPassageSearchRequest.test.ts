/**
 * A persona's passage-search request, from the reply to the card and the
 * line the persona reads next (ADR 2026-11-20 D17, D19, D19a), through the
 * production extractor, settlement, completion, the session, the outcome
 * record and its frame; then the codec, the status and the transcript.
 * Made-up text: Alice.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { completeWorkshopRun, workshopMessageCompletionCopy } from '@/application/services/workshop/WorkshopRunCompletion';
import {
  resolveWorkshopReplyPassageSearch,
  settleWorkshopReplyPassageSearch,
  type WorkshopPassageSearchDropCode,
  type WorkshopPassageSearchListing
} from '@/application/services/workshop/passageSearch/WorkshopReplyPassageSearch';
import { workshopPassageSearchStatus } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchStatus';
import { workshopTrailerDropReason } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerDropReasons';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { WORKSHOP_TRAILER_DROP_REASON_WORDS } from '@shared/constants/workshopTrailerOutcomeWords';
import { WORKSHOP_PASSAGE_SEARCH_TRAILER_DROP_REASONS } from '@shared/types/workshopTrailerOutcomes';
import type { WorkshopPassageSearchDelivery, WorkshopTurn } from '@messages';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';

const FIXTURE = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-passage-search.json'));
const HOST = { kind: 'host' } as const;
const QUESTION = 'Find every time the White Rabbit checks his watch ZZQ-QUESTION.';
const frame = (inner: string): string => `<prose-minion-passage-search>\n${inner}\n</prose-minion-passage-search>`;
const ask = (scopes: string): string => frame(`<question>${QUESTION}</question>\n${scopes}`);

const LISTED = [
  { group: 'chapters' as const, relativePath: 'chapters/Rabbit-Hole.md' },
  { group: 'chapters' as const, relativePath: 'chapters/twin.md' },
  { group: 'chapters' as const, relativePath: 'chapters/twin.md' },
  { group: 'characters' as const, relativePath: 'cast/alice.md' }
];
const listing = (files = LISTED): WorkshopPassageSearchListing & { listGroupFiles: jest.Mock } => ({ listGroupFiles: jest.fn(async () => files) });

let sent = 0;

function room() {
  let clock = 1_000;
  const session = new WorkshopSessionService(() => clock++);
  session.setExcerpt({ text: 'Alice was beginning to get very tired of sitting by her sister.', source: { kind: 'manual' } });
  return session;
}

const complete = (session: WorkshopSessionService, requestId: string, content: string, extra: Partial<Parameters<typeof completeWorkshopRun>[0]> = {}) =>
  completeWorkshopRun({
    session,
    requestId,
    label: 'Jill',
    result: { toolName: 'workshop-test', content, conversationId: 'host-conv', timestamp: new Date(0), replySource: 'provider' } as AnalysisResult,
    aborted: false,
    createsRetainedConversation: false,
    copy: workshopMessageCompletionCopy('Jill'),
    discardConversation: jest.fn(),
    readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
    log: jest.fn(),
    events: { streamCompleted: jest.fn(), turnCompleted: jest.fn(), status: jest.fn(), error: jest.fn(), widgetRecommendationRejected: jest.fn() },
    ...extra
  });

async function replyWith(session: WorkshopSessionService, content: string, files = listing(), hasExcerpt = true, log = jest.fn()) {
  const context = await resolveWorkshopReplyPassageSearch(content, { hasExcerpt, listing: files, signal: new AbortController().signal });
  sent += 1;
  const requestId = `ps-req-${sent}`;
  session.beginPersonaMessage(requestId, `Message ${sent}.`);
  const turn = complete(session, requestId, content, { ...(context ? { passageSearch: context } : {}), log })!;
  return { turn, files, log };
}

function conserved(turn: WorkshopTurn, frames: number): void {
  const side = turn.trailerOutcomes?.passageSearch;
  expect((side?.cards ?? 0) + (side?.dropped ?? []).reduce((sum, drop) => sum + drop.count, 0)).toBe(frames);
}

describe('settling a reply\'s passage-search request', () => {
  it('commits one card with the reply, by catalog key, and tells the persona next message', async () => {
    const session = room();
    const { turn, files, log } = await replyWith(session,
      `Let me look.\n\n${ask('<group>chapters</group>\n<path group="chapters">chapters/rabbit-hole.md</path>\n<path group="characters">cast/alice.md</path>\n<excerpt/>')}`);
    expect(turn.content).toBe('Let me look.');
    expect(turn.passageSearchRequest).toEqual({
      question: QUESTION,
      scopes: [
        { kind: 'group', group: 'chapters' },
        // Stored as the listing spells it: the catalog key.
        { kind: 'file', group: 'chapters', path: 'chapters/Rabbit-Hole.md' },
        { kind: 'file', group: 'characters', path: 'cast/alice.md' },
        { kind: 'excerpt' }
      ]
    });
    // One listing for the whole request, of the groups it names.
    expect(files.listGroupFiles).toHaveBeenCalledTimes(1);
    expect(files.listGroupFiles).toHaveBeenCalledWith(['chapters', 'characters']);
    expect(turn.trailerOutcomes?.passageSearch).toEqual({ cards: 1, dropped: [] });
    conserved(turn, 1);
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST))
      .toContain('Your last reply\'s passage-search request: shown as a card for the writer to price and run; its results arrive later.');
    const logged = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logged).toContain('Passage search request shown (scopes=4) (dropped=0)');
    expect(logged).not.toContain('ZZQ-QUESTION');
    expect(logged).not.toContain('rabbit-hole');
  });

  it('a reply of nothing else reads "Asked for a passage search."', async () => {
    const { turn } = await replyWith(room(), ask('<excerpt/>'));
    expect(turn.content).toBe('Asked for a passage search.');
    expect(turn.passageSearchRequest?.scopes).toEqual([{ kind: 'excerpt' }]);
    expect(turn.model).toBeUndefined();
  });

  it.each<[string, string, WorkshopPassageSearchDropCode, string]>([
    ['a group that is no context group', '<group>people</group>', 'unknown-group', 'unknown-group'],
    ['a file not in its group', '<path group="chapters">chapters/no-such.md</path>', 'unknown-file', 'unknown-file'],
    ['a file two workspace folders both hold', '<path group="chapters">chapters/twin.md</path>', 'ambiguous-file', 'ambiguous-file'],
    ['a malformed frame', '<path>chapters/twin.md</path>', 'malformed:missing-group', 'malformed']
  ])('drops %s whole, with its reason, and gives no card', async (_what, scopes, code, reason) => {
    const session = room();
    const { turn } = await replyWith(session, `Looking.\n\n${ask(scopes)}`);
    expect(turn.passageSearchRequest).toBeUndefined();
    expect(workshopTrailerDropReason(code)).toBe(reason);
    expect(turn.trailerOutcomes?.passageSearch).toEqual({ cards: 0, dropped: [{ reason, count: 1 }] });
    conserved(turn, 1);
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain(`1 dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS[reason as 'malformed']})`);
  });

  it('drops an excerpt request in a room with none, and one whose listing could not be read', async () => {
    const noExcerpt = await replyWith(room(), `Looking.\n\n${ask('<excerpt/>')}`, listing(), false);
    expect(noExcerpt.turn.trailerOutcomes?.passageSearch).toEqual({ cards: 0, dropped: [{ reason: 'no-excerpt', count: 1 }] });
    // No listing is read for a request that names no group.
    expect(noExcerpt.files.listGroupFiles).not.toHaveBeenCalled();

    const failing = { listGroupFiles: jest.fn(async () => { throw new Error('scan failed'); }) };
    const unreadable = await replyWith(room(), `Looking.\n\n${ask('<group>chapters</group>')}`, failing);
    expect(unreadable.turn.passageSearchRequest).toBeUndefined();
    expect(unreadable.turn.trailerOutcomes?.passageSearch).toEqual({ cards: 0, dropped: [{ reason: 'catalog-unreadable', count: 1 }] });
  });

  it('counts every frame once: a card, an extra and a misplaced one', async () => {
    const reply = `${ask('<excerpt/>')}\n\nA thought in between.\n\n${ask('<group>chapters</group>')}\n${ask('<group>characters</group>')}`;
    const { turn } = await replyWith(room(), reply);
    expect(turn.passageSearchRequest?.scopes).toEqual([{ kind: 'group', group: 'chapters' }]);
    expect(turn.trailerOutcomes?.passageSearch).toEqual({ cards: 1, dropped: [{ reason: 'misplaced', count: 1 }, { reason: 'extra', count: 1 }] });
    conserved(turn, 3);
  });

  it('a request checked for another reply, or never checked, is dropped as not listed', () => {
    const control = extractWorkshopReplyControls(ask('<group>chapters</group>'), { memoryOpen: false }).passageSearch;
    for (const context of [undefined, { reply: 'another reply', check: { kind: 'none' as const } }]) {
      const settled = settleWorkshopReplyPassageSearch(control, context);
      expect(settled.card).toBeUndefined();
      expect(settled.drops).toEqual(['listing-not-read']);
      expect(workshopTrailerDropReason('listing-not-read')).toBe('catalog-unreadable');
    }
  });

  it('gives every recorded reason one fixed phrase', () => {
    for (const reason of WORKSHOP_PASSAGE_SEARCH_TRAILER_DROP_REASONS) {
      expect(WORKSHOP_TRAILER_DROP_REASON_WORDS[reason].length).toBeGreaterThan(0);
    }
  });

  it('reads no file and prices nothing: a reply with no tag costs no await of the listing', async () => {
    const files = listing();
    expect(await resolveWorkshopReplyPassageSearch('No request here.', { hasExcerpt: true, listing: files, signal: new AbortController().signal })).toBeUndefined();
    expect(files.listGroupFiles).not.toHaveBeenCalled();
  });
});

describe('ordinary completion still abandons', () => {
  it('a stopped message keeps its writer turn unless the caller asks for a rollback', () => {
    const keep = room();
    const writer = keep.beginPersonaMessage('keep-1', 'A message the writer typed.');
    expect(complete(keep, 'keep-1', 'ignored', { aborted: true })).toBeUndefined();
    expect(keep.readRoomLedger().map((turn) => turn.id)).toContain(writer.id);
    expect(keep.getSnapshot().activeRequestId).toBeUndefined();

    const roll = room();
    const provisional = roll.beginPersonaMessage('roll-1', 'A host line.');
    expect(complete(roll, 'roll-1', 'ignored', { aborted: true, notAdopted: 'rollback' })).toBeUndefined();
    expect(roll.readRoomLedger().map((turn) => turn.id)).not.toContain(provisional.id);
    expect(roll.getSnapshot().activeRequestId).toBeUndefined();
  });
});

describe('a card\'s status is derived from the ledger', () => {
  const card: WorkshopTurn['passageSearchRequest'] = { question: QUESTION, scopes: [{ kind: 'excerpt' }] };
  const receipt: WorkshopPassageSearchDelivery = {
    cardTurnId: 't-card', instances: 14, files: 6, labels: 3, dropped: 1,
    calls: { planned: 23, answered: 23, failed: 0, cut: 0, unsent: 0 }, ended: 'complete', organized: true, shown: 14
  };
  const turns = {
    card: { id: 't-card', passageSearchRequest: card },
    request: { id: 't-request', passageSearchResults: { cardTurnId: 't-card' } },
    reply: { id: 't-reply', passageSearchDelivery: receipt }
  };
  const idle = { running: false, held: false };

  it('reads pending, running, ready, delivered and cancelled', () => {
    expect(workshopPassageSearchStatus([turns.card], 't-card', idle)).toBe('pending');
    expect(workshopPassageSearchStatus([turns.card], 't-card', { running: true, held: false })).toBe('running');
    expect(workshopPassageSearchStatus([turns.card], 't-card', { running: false, held: true })).toBe('ready');
    expect(workshopPassageSearchStatus([turns.card, turns.request, turns.reply], 't-card', idle)).toBe('delivered');
    expect(workshopPassageSearchStatus([{ id: 't-card', passageSearchRequest: { ...card!, answer: 'cancelled' } }], 't-card', idle)).toBe('cancelled');
    expect(workshopPassageSearchStatus([{ id: 't-other' }], 't-other', idle)).toBeUndefined();
  });

  it('a request turn with no receipt after it is never delivered', () => {
    // A crash between the two commits, or a session reopened with the orphan.
    expect(workshopPassageSearchStatus([turns.card, turns.request], 't-card', idle)).toBe('pending');
    expect(workshopPassageSearchStatus([turns.card, turns.request], 't-card', { running: false, held: true })).toBe('ready');
    // A receipt naming another card proves nothing about this one.
    const other = { id: 't-reply', passageSearchDelivery: { ...receipt, cardTurnId: 't-elsewhere' } };
    expect(workshopPassageSearchStatus([turns.card, turns.request, other], 't-card', idle)).toBe('pending');
  });

  it('a cut needs no rule of its own', () => {
    const ledger = [turns.card, turns.request, turns.reply];
    // A cut that removes the request removes its card.
    expect(workshopPassageSearchStatus(ledger.slice(1), 't-card', idle)).toBeUndefined();
    // A cut that removes only the persona's reply to the results: pending again, or ready while this window holds them.
    expect(workshopPassageSearchStatus(ledger.slice(0, 2), 't-card', idle)).toBe('pending');
    expect(workshopPassageSearchStatus(ledger.slice(0, 1), 't-card', { running: false, held: true })).toBe('ready');
  });

  it('the webview gets the host\'s view, and never the receipt', () => {
    const reply = { id: 't-reply', role: 'assistant', participant: 'host', passageSearchDelivery: receipt, content: 'Fourteen.' } as WorkshopTurn;
    const cardTurn = { id: 't-card', role: 'assistant', participant: 'host', passageSearchRequest: card, content: 'Asking.' } as WorkshopTurn;
    const roomView = {
      fileEditsOpen: true, runActive: false, ledger: () => [cardTurn, reply], authorPresent: () => true,
      passageSearch: () => undefined
    };
    expect(workshopTurnForWebview(reply, roomView)).not.toHaveProperty('passageSearchDelivery');
    expect(workshopTurnForWebview(cardTurn, roomView).passageSearchRequest?.view).toEqual({
      status: 'delivered',
      counts: { instances: 14, files: 6, labels: 3, dropped: 1, calls: receipt.calls, ended: 'complete', organized: true },
      shown: 14,
      reportHeld: false
    });
    expect(workshopTurnForWebview(cardTurn, { ...roomView, ledger: () => [cardTurn], authorPresent: () => false }).passageSearchRequest?.view)
      .toEqual({ status: 'pending', authorLeft: true });
  });
});

describe('the session codec', () => {
  it('still reads the session from before the fields existed', () => {
    expect(FIXTURE).not.toContain('passageSearch');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(FIXTURE)))).toBe(FIXTURE);
    expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(FIXTURE))).not.toThrow();
  });

  const withTurns = (edit: (turns: Array<Record<string, unknown>>) => void): string => {
    const session = JSON.parse(FIXTURE) as { workshop: { turns: Array<Record<string, unknown>> } };
    edit(session.workshop.turns);
    return JSON.stringify(session);
  };
  const reply = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.role === 'assistant' && turn.participant === 'host')!;
  const writer = (turns: Array<Record<string, unknown>>) => turns.find((turn) => turn.role === 'user' && turn.participant === 'writer')!;
  const delivery = {
    cardTurnId: 't-1', instances: 3, files: 1, labels: 1, dropped: 0,
    calls: { planned: 4, answered: 4, failed: 0, cut: 0, unsent: 0 }, ended: 'complete', organized: false, shown: 3
  };

  it('round-trips the card, the request turn\'s mark and the receipt', () => {
    const request = { question: 'Where does Alice cry?', scopes: [{ kind: 'group', group: 'chapters' }, { kind: 'file', group: 'chapters', path: 'chapters/pool.md' }, { kind: 'excerpt' }], answer: 'cancelled' };
    const stored = withTurns((turns) => {
      reply(turns).passageSearchRequest = request;
      reply(turns).passageSearchDelivery = delivery;
      writer(turns).passageSearchResults = { cardTurnId: 't-1' };
    });
    // Exact both ways: what is stored is what is read, and written back byte for byte.
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(stored)))).toBe(stored);
    const turns = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(stored)).session.workshop.turns as WorkshopTurn[];
    expect(turns.find((turn) => turn.passageSearchRequest)?.passageSearchRequest).toEqual(request);
    expect(turns.find((turn) => turn.passageSearchDelivery)?.passageSearchDelivery).toEqual(delivery);
    expect(turns.find((turn) => turn.passageSearchResults)?.passageSearchResults).toEqual({ cardTurnId: 't-1' });
  });

  it.each<[string, (turns: Array<Record<string, unknown>>) => void]>([
    ['a card with the host\'s view', (turns) => { reply(turns).passageSearchRequest = { question: 'Q?', scopes: [{ kind: 'excerpt' }], view: { status: 'pending' } }; }],
    ['a card with a pattern scope', (turns) => { reply(turns).passageSearchRequest = { question: 'Q?', scopes: [{ kind: 'pattern', pattern: '**/*.md' }] }; }],
    ['a card with a free path', (turns) => { reply(turns).passageSearchRequest = { question: 'Q?', scopes: [{ kind: 'file', group: 'chapters', path: '/etc/passwd' }] }; }],
    ['a card with no scope', (turns) => { reply(turns).passageSearchRequest = { question: 'Q?', scopes: [] }; }],
    ['a card on a writer turn', (turns) => { writer(turns).passageSearchRequest = { question: 'Q?', scopes: [{ kind: 'excerpt' }] }; }],
    ['a receipt with an unknown ending', (turns) => { reply(turns).passageSearchDelivery = { ...delivery, ended: 'paused' }; }],
    ['a receipt with an extra field', (turns) => { reply(turns).passageSearchDelivery = { ...delivery, quote: 'the watch' }; }],
    ['a receipt on a writer turn', (turns) => { writer(turns).passageSearchDelivery = delivery; }],
    ['a results mark on a reply', (turns) => { reply(turns).passageSearchResults = { cardTurnId: 't-1' }; }]
  ])('refuses %s', (_what, edit) => {
    expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(withTurns(edit)))).toThrow();
  });
});

describe('the transcript', () => {
  it('shows the card and the results turn as one event line each, counts only', async () => {
    const session = room();
    const { turn } = await replyWith(session, `Let me look.\n\n${ask('<group>chapters</group>\n<path group="characters">cast/alice.md</path>')}`);
    session.beginPersonaMessage('ps-delivery', 'Passage search finished: 14 instances in 6 files.');
    const requestTurn = session.readRoomLedger().at(-1)!;
    session.markPassageSearchResultsTurn(requestTurn.id, turn.id);
    complete(session, 'ps-delivery', 'Fourteen moments, mostly early.', {
      passageSearchDelivery: {
        cardTurnId: turn.id, instances: 14, files: 6, labels: 3, dropped: 0,
        calls: { planned: 23, answered: 23, failed: 0, cut: 0, unsent: 0 }, ended: 'complete', organized: true, shown: 14
      }
    });
    const transcript = projectWorkshopTranscript(session.readRoomLedger(), { title: 'Alice', exportedAt: 0, timezone: 'UTC' } as never);
    const events = transcript.entries.filter((entry) => entry.kind === 'event').map((entry) => (entry as { text: string }).text);
    expect(events).toContain('Asked for a passage search of 2 scopes.');
    expect(events).toContain('Passage search finished: 14 instances in 6 files.');
    // The results turn is never a writer entry, and nothing projects a scope, the question or the receipt.
    expect(transcript.entries.filter((entry) => entry.kind === 'writer').map((entry) => (entry as { content: string }).content))
      .not.toContain('Passage search finished: 14 instances in 6 files.');
    const projected = JSON.stringify(transcript);
    expect(projected).not.toContain('ZZQ-QUESTION');
    expect(projected).not.toContain('cast/alice.md');
    expect(projected).not.toContain('passageSearchDelivery');
    expect(projected).not.toContain('cardTurnId');
  });
});
