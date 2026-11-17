/**
 * A reply's `trailerOutcomes`, from the reply to the line the persona reads
 * next (ADR 2026-11-17 D13–D15; PR #269 F-01), through the production
 * completion (`completeWorkshopRun`), the real session and the real frame
 * derivation:
 *
 * - one case per recorded reason: a reply that produces it, one drop of
 *   that reason in the field, no card for that frame, and that reason's
 *   phrase in the next message's frame;
 * - every frame is counted once (conservation), for cards, refused cards
 *   and drops of both steps;
 * - a reply with no trailer leaves no field and no frame;
 * - the field and the frame hold counts and fixed words: never a title, a
 *   quote, a path, find text or a note id.
 * *Alice*, made-up ids.
 */

import {
  completeWorkshopRun,
  workshopMessageCompletionCopy,
  type WorkshopRunCompletionEvents
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  resolveWorkshopReplyMemory,
  type WorkshopReplyMemoryContext
} from '@/application/services/workshop/memory/WorkshopReplyMemory';
import { resolveWorkshopReplyEdits, type WorkshopReplyEditsContext } from '@/application/services/workshop/fileEdits/WorkshopReplyEditOffers';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { workshopTrailerDropReason } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerDropReasons';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import type { FileEditStaging } from '@/domain/models/FileEditStaging';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_TRAILER_DROP_REASON_WORDS } from '@shared/constants/workshopTrailerOutcomeWords';
import type { WorkshopTurn } from '@messages';
import type { WorkshopTrailerDropReason } from '@shared/types/workshopTrailerOutcomes';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import {
  fakeFileEditStaging,
  fileEditFrame,
  PASSAGE_SENTINEL,
  QUOTE_SENTINEL,
  sentinelFileEditFrame,
  URI_SENTINEL,
  WHY_SENTINEL,
  WITH_SENTINEL
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { EDIT_NOTE, EDIT_NOTE_LISTED, editFrame, MEMORY_EDIT_DROP_CASES } from './memoryEditDropCases';

const HOST = { kind: 'host' } as const;
const TITLE_SENTINEL = 'ZZQ-TITLE';
/** Text no record and no line may hold: titles, quotes, find text, paths, URIs and note ids. */
const FORBIDDEN = [
  TITLE_SENTINEL, QUOTE_SENTINEL, WITH_SENTINEL, PASSAGE_SENTINEL, WHY_SENTINEL, URI_SENTINEL,
  EDIT_NOTE.id, 'Rabbit', 'tea party', 'the Queen', 'The reader', 'characters/', 'alice', '.md', 'mem-'
];

const OPEN: WorkshopReplyMemoryContext = { open: true, mode: 'ask', listed: new Map(), memories: EDIT_NOTE_LISTED };
const phrase = (reason: WorkshopTrailerDropReason): string => `1 dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS[reason]})`;

describe('what became of a reply\'s trailers, recorded and told (ADR 2026-11-17 D13–D15)', () => {
  let session: WorkshopSessionService;
  let log: jest.Mock;
  let sent = 0;

  const events = (): WorkshopRunCompletionEvents => ({
    streamCompleted: jest.fn(),
    turnCompleted: jest.fn(),
    status: jest.fn(),
    error: jest.fn(),
    widgetRecommendationRejected: jest.fn()
  });

  /** One host exchange, completed as the room completes it. */
  const reply = (content: string, options: { memory?: WorkshopReplyMemoryContext; fileEdits?: WorkshopReplyEditsContext } = {}): WorkshopTurn => {
    sent += 1;
    const requestId = `req-${sent}`;
    session.beginPersonaMessage(requestId, `Message ${sent}.`);
    const turn = completeWorkshopRun({
      session,
      requestId,
      label: 'Jill',
      result: {
        toolName: 'workshop-test',
        content,
        conversationId: 'host-conv',
        timestamp: new Date(0),
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        replySource: 'provider'
      } as AnalysisResult,
      aborted: false,
      createsRetainedConversation: sent === 1,
      copy: workshopMessageCompletionCopy('Jill'),
      discardConversation: jest.fn(),
      readRetainedHistory: jest.fn(() => ({ messageCount: 2 * sent, contextSourceCount: 0 })),
      memory: options.memory,
      ...(options.fileEdits ? { fileEdits: options.fileEdits } : {}),
      log,
      events: events()
    });
    if (!turn) {
      throw new Error('the reply was refused');
    }
    return turn;
  };

  const staged = async (content: string, staging: FileEditStaging = fakeFileEditStaging(), open = true, signal?: AbortSignal) =>
    reply(content, { fileEdits: await resolveWorkshopReplyEdits({ reply: content, open, staging, ...(signal ? { signal } : {}) }) });

  const nextFrame = (): string | undefined => workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST);
  const logged = (): string[] => log.mock.calls.map(([line]) => String(line));

  /** Neither the record nor the line holds any of the reply's text. */
  const expectCountsOnly = (turn: WorkshopTurn): void => {
    const text = `${JSON.stringify(turn.trailerOutcomes)}\n${nextFrame() ?? ''}`;
    for (const forbidden of FORBIDDEN) {
      expect(text).not.toContain(forbidden);
    }
  };

  beforeEach(() => {
    sent = 0;
    session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
    log = jest.fn();
  });

  it('two cards and a malformed frame: the field, then the line in the next message', () => {
    const turn = reply([
      'Good.', '',
      memoryFrame({ title: `Tea ${TITLE_SENTINEL}` }),
      memoryFrame({ title: `Croquet ${TITLE_SENTINEL}` }),
      `<prose-minion-memory-proposal><title>No kind ${TITLE_SENTINEL}</title></prose-minion-memory-proposal>`
    ].join('\n'), { memory: OPEN });
    expect(turn.memoryProposals).toHaveLength(2);
    expect(turn.trailerOutcomes).toEqual({ memory: { cards: 2, dropped: [{ reason: 'malformed', count: 1 }] } });
    expect(nextFrame()).toBe([
      '<workshop-trailer-outcomes note="From the host: what became of the trailers in your last reply. Counts only.">',
      'Your last reply\'s notes: 2 shown as cards, 1 dropped (malformed).',
      '</workshop-trailer-outcomes>'
    ].join('\n'));
    expectCountsOnly(turn);
  });

  it('a reply with no trailer leaves no field and no frame', () => {
    const turn = reply('Just prose.', { memory: OPEN });
    expect(turn).not.toHaveProperty('trailerOutcomes');
    expect(nextFrame()).toBeUndefined();
  });

  it('the line is about the latest reply only: a later reply with no trailer ends it', () => {
    reply(`Good.\n\n${memoryFrame()}`, { memory: OPEN });
    expect(nextFrame()).toContain('1 shown as a card');
    reply('Just prose.', { memory: OPEN });
    expect(nextFrame()).toBeUndefined();
  });

  describe('a memory frame dropped as the reply was read', () => {
    const cap = PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply;
    it.each<[WorkshopTrailerDropReason, string, number, WorkshopReplyMemoryContext]>([
      ['malformed', '<prose-minion-memory-proposal><title>No kind</title></prose-minion-memory-proposal>', 0, OPEN],
      ['misplaced', `${memoryFrame({ title: `Tea ${TITLE_SENTINEL}` })}\n\nAnd one more thought after it.`, 0, OPEN],
      ['duplicate', `${memoryFrame({ title: 'Tea is at six' })}\n${memoryFrame({ title: 'Tea is at six' })}`, 1, OPEN],
      ['over-cap', Array.from({ length: cap + 1 }, (_, index) => memoryFrame({ title: `Croquet rule ${index}` })).join('\n'), cap, OPEN],
      ['off', memoryFrame({ title: `Tea ${TITLE_SENTINEL}` }), 0, { open: false }]
    ])('%s', (reason, trailers, cards, memory) => {
      const turn = reply(`Good.\n\n${trailers}`, { memory });
      expect(turn.trailerOutcomes).toEqual({ memory: { cards, dropped: [{ reason, count: 1 }] } });
      expect(turn.memoryProposals ?? []).toHaveLength(cards);
      expect(nextFrame()).toContain(phrase(reason));
      expectCountsOnly(turn);
    });
  });

  describe('a memory edit that decodes, dropped at settlement (PR #269 F-01)', () => {
    it.each(MEMORY_EDIT_DROP_CASES.map((entry) => [entry.reason, entry] as const))('%s', (code, entry) => {
      const reason = workshopTrailerDropReason(code);
      const turn = reply(`Good.\n\n${editFrame(...entry.elements)}`, {
        memory: { open: true, mode: 'ask', ...(entry.listing ? { memories: entry.listing } : {}) }
      });
      expect(turn.memoryProposals).toBeUndefined();
      expect(turn.trailerOutcomes).toEqual({ memory: { cards: 0, dropped: [{ reason, count: 1 }] } });
      expect(nextFrame()).toBe([
        '<workshop-trailer-outcomes note="From the host: what became of the trailers in your last reply. Counts only.">',
        `Your last reply's notes: ${phrase(reason)}.`,
        '</workshop-trailer-outcomes>'
      ].join('\n'));
      // The log line is today's, written from the typed reason; the target id stays there and nowhere else.
      expect(logged()).toContain(`Memory edit dropped (target=${EDIT_NOTE.id}; reason=${code}) (Jill)`);
      expectCountsOnly(turn);
    });

    it('the cases reach every memory-edit reason the record can hold', () => {
      const reached = new Set(MEMORY_EDIT_DROP_CASES.map((entry) => workshopTrailerDropReason(entry.reason)));
      expect([...reached].sort()).toEqual([
        'edits-conflict', 'find-ambiguous', 'find-not-found', 'no-change', 'notes-unreadable',
        'pinned-budget', 'result-invalid', 'target-busy', 'target-not-found', 'target-not-in-effect'
      ]);
    });
  });

  it('a memory context that failed to resolve reads as closed: `off`', async () => {
    const content = `Good.\n\n${memoryFrame()}`;
    const memory = await resolveWorkshopReplyMemory(
      { replyMemoryContext: async () => { throw new Error('the library could not be read'); } },
      content,
      new AbortController().signal
    );
    const turn = reply(content, { memory });
    expect(turn.memoryProposals).toBeUndefined();
    expect(turn.trailerOutcomes).toEqual({ memory: { cards: 0, dropped: [{ reason: 'off', count: 1 }] } });
    expect(nextFrame()).toContain('1 dropped (not open in this conversation just then)');
  });

  describe('a file-edit frame dropped as the reply was read', () => {
    const cap = PROMPT_BUDGETS.workshopFileEdits.proposalsPerReply;
    it.each<[WorkshopTrailerDropReason, string, number, boolean]>([
      ['malformed', fileEditFrame({ why: null }), 0, true],
      ['misplaced', `${sentinelFileEditFrame()}\n\nAnd one more thought after it.`, 0, true],
      ['duplicate', `${fileEditFrame()}\n${fileEditFrame()}`, 1, true],
      ['over-cap', Array.from({ length: cap + 1 }, (_, index) => fileEditFrame({ path: `characters/p${index}.md` })).join('\n'), cap, true],
      ['off', sentinelFileEditFrame(), 0, false],
      ['oversized', fileEditFrame({ body: [`<append>${PASSAGE_SENTINEL}${'a'.repeat(PROMPT_BUDGETS.workshopFileEdits.frameCharacters)}</append>`] }), 0, true]
    ])('%s', async (reason, trailers, cards, open) => {
      const turn = await staged(`Yes.\n\n${trailers}`, fakeFileEditStaging(), open);
      expect(turn.trailerOutcomes).toEqual({ fileEdits: { cards, refused: 0, dropped: [{ reason, count: 1 }] } });
      expect(turn.fileEditProposals ?? []).toHaveLength(cards);
      expect(nextFrame()).toContain(phrase(reason));
      expectCountsOnly(turn);
    });
  });

  it('two frames staged to one document: the second is a `duplicate`, with no card', async () => {
    const staging = fakeFileEditStaging();
    const stage = staging.stage.bind(staging);
    staging.stage = async (target, options) => {
      const result = await stage(target, options);
      return result.kind === 'staged'
        ? { ...result, target: { ...result.target, documentUri: 'file:///ws/one-file', relativePath: 'characters/alice.md' } }
        : result;
    };
    const turn = await staged(`Yes.\n\n${fileEditFrame({ path: 'characters/alice.md' })}\n${fileEditFrame({ path: 'characters/alice-again.md' })}`, staging);
    expect(turn.fileEditProposals).toHaveLength(1);
    expect(turn.trailerOutcomes).toEqual({ fileEdits: { cards: 1, refused: 0, dropped: [{ reason: 'duplicate', count: 1 }] } });
    expect(nextFrame()).toContain('Your last reply\'s file edits: 1 shown as a card, 1 dropped (a repeat of another in the same reply).');
    expectCountsOnly(turn);
  });

  it('a context resolved for another reply stages nothing here: every frame is `not-staged`, logged as before', async () => {
    const other = await resolveWorkshopReplyEdits({ reply: `Another reply.\n\n${fileEditFrame()}`, open: true, staging: fakeFileEditStaging() });
    const turn = reply(`Yes.\n\n${sentinelFileEditFrame()}\n${fileEditFrame({ why: null })}`, { fileEdits: other });
    expect(turn.fileEditProposals).toBeUndefined();
    expect(turn.trailerOutcomes).toEqual({ fileEdits: { cards: 0, refused: 0, dropped: [{ reason: 'not-staged', count: 2 }] } });
    expect(nextFrame()).toContain('Your last reply\'s file edits: 2 dropped (the host could not prepare it).');
    expect(logged().filter((line) => line.startsWith('File edit proposal'))).toEqual([
      'File edit proposal dropped (reason=not-staged) (Jill)',
      'File edit proposal dropped (reason=not-staged) (Jill)'
    ]);
    expectCountsOnly(turn);
  });

  it('with no context at all, a file-edit frame is `not-staged` too', () => {
    const turn = reply(`Yes.\n\n${fileEditFrame()}`);
    expect(turn.trailerOutcomes).toEqual({ fileEdits: { cards: 0, refused: 0, dropped: [{ reason: 'not-staged', count: 1 }] } });
  });

  it('a staging run stopped before it staged reports each decoded frame as `not-staged`', async () => {
    const controller = new AbortController();
    controller.abort();
    const staging = fakeFileEditStaging();
    const turn = await staged(`Yes.\n\n${fileEditFrame({ why: null })}\n${fileEditFrame()}\n${fileEditFrame({ path: 'characters/c.md' })}`, staging, true, controller.signal);
    expect(staging.calls).toEqual([]);
    expect(turn.fileEditProposals).toBeUndefined();
    expect(turn.trailerOutcomes).toEqual({
      fileEdits: { cards: 0, refused: 0, dropped: [{ reason: 'malformed', count: 1 }, { reason: 'not-staged', count: 2 }] }
    });
    expect(logged().filter((line) => line.startsWith('File edit proposal'))).toEqual([
      'File edit proposal dropped (reason=malformed:missing-why) (Jill)',
      'File edit proposal dropped (reason=not-staged) (Jill)',
      'File edit proposal dropped (reason=not-staged) (Jill)'
    ]);
  });

  it('a card refused at staging is counted as refused, with no reason', async () => {
    const staging = fakeFileEditStaging({ refuse: (target) => target.kind === 'excerpt' ? 'excerpt-not-a-file' : undefined });
    const turn = await staged(`Yes.\n\n${fileEditFrame()}\n${fileEditFrame({ excerpt: true })}`, staging);
    expect(turn.fileEditProposals!.map((card) => card.state)).toEqual(['pending', 'refused']);
    expect(turn.trailerOutcomes).toEqual({ fileEdits: { cards: 1, refused: 1, dropped: [] } });
    const frame = nextFrame()!;
    expect(frame).toContain('Your last reply\'s file edits: 1 shown as a card, 1 refused before the writer could apply it.');
    expect(frame).not.toContain('excerpt-not-a-file');
    expect(JSON.stringify(turn.trailerOutcomes)).not.toContain('excerpt-not-a-file');
  });

  it('conservation: cards, refused cards and drops of both steps count every frame the extractor found, once', async () => {
    const staging = fakeFileEditStaging({ refuse: (target) => target.kind === 'excerpt' ? 'excerpt-not-a-file' : undefined });
    const content = [
      'Here is everything.', '',
      memoryFrame({ title: 'Tea is at six' }),
      memoryFrame({ title: 'Tea is at six' }),
      '<prose-minion-memory-proposal><title>No kind</title></prose-minion-memory-proposal>',
      editFrame('<append>Also at six.</append>'),
      memoryFrame({ title: 'The Queen plays croquet' }),
      fileEditFrame(),
      fileEditFrame(),
      fileEditFrame({ excerpt: true }),
      fileEditFrame({ path: 'characters/hatter.md', why: null }),
      fileEditFrame({ path: 'characters/hatter.md' })
    ].join('\n');
    const memory: WorkshopReplyMemoryContext = { open: true, mode: 'ask', listed: new Map(), memories: MEMORY_EDIT_DROP_CASES[1].listing };
    const turn = reply(content, { memory, fileEdits: await resolveWorkshopReplyEdits({ reply: content, open: true, staging }) });
    const found = extractWorkshopReplyControls(content, { memoryOpen: true, fileEditsOpen: true });
    const memoryFrames = found.memory.kind === 'frames' ? found.memory.proposals.length + found.memory.rejections.length : 0;
    const fileEditFrames = found.fileEdits!.proposals.length + found.fileEdits!.rejections.length;
    expect([memoryFrames, fileEditFrames]).toEqual([5, 5]);

    const outcomes = turn.trailerOutcomes!;
    expect(outcomes).toEqual({
      memory: { cards: 2, dropped: [{ reason: 'malformed', count: 1 }, { reason: 'duplicate', count: 1 }, { reason: 'target-not-found', count: 1 }] },
      fileEdits: { cards: 2, refused: 1, dropped: [{ reason: 'malformed', count: 1 }, { reason: 'duplicate', count: 1 }] }
    });
    const dropped = (side: { dropped: Array<{ count: number }> }) => side.dropped.reduce((sum, drop) => sum + drop.count, 0);
    expect(outcomes.memory!.cards + dropped(outcomes.memory!)).toBe(memoryFrames);
    expect(outcomes.fileEdits!.cards + outcomes.fileEdits!.refused + dropped(outcomes.fileEdits!)).toBe(fileEditFrames);
    expect(outcomes.memory!.cards).toBe(turn.memoryProposals!.length);
    expect(outcomes.fileEdits!.cards + outcomes.fileEdits!.refused).toBe(turn.fileEditProposals!.length);
    expect(nextFrame()).toBe([
      '<workshop-trailer-outcomes note="From the host: what became of the trailers in your last reply. Counts only.">',
      'Your last reply\'s notes: 2 shown as cards, 1 dropped (malformed), 1 dropped (a repeat of another in the same reply), 1 dropped (no readable note has the id it named).',
      'Your last reply\'s file edits: 2 shown as cards, 1 refused before the writer could apply it, 1 dropped (malformed), 1 dropped (a repeat of another in the same reply).',
      '</workshop-trailer-outcomes>'
    ].join('\n'));
    expectCountsOnly(turn);
  });

  it('a saved or dismissed card, and an applied or declined edit, change neither the field nor the line', async () => {
    const content = `Good.\n\n${memoryFrame()}\n${memoryFrame({ title: 'Tea is at six' })}\n${fileEditFrame()}`;
    const turn = reply(content, { memory: OPEN, fileEdits: await resolveWorkshopReplyEdits({ reply: content, open: true, staging: fakeFileEditStaging() }) });
    const before = JSON.stringify(turn.trailerOutcomes);
    const frame = nextFrame();
    session.setMemoryProposalState(turn.id, 0, 'saved', 'mem-0000aa');
    session.setMemoryProposalState(turn.id, 1, 'dismissed');
    session.setFileEditProposalState(turn.id, 0, { state: 'declined' });
    const now = session.readRoomLedger().find((entry) => entry.id === turn.id)!;
    expect(now.memoryProposals!.map((card) => card.state)).toEqual(['saved', 'dismissed']);
    expect(now.fileEditProposals![0].state).toBe('declined');
    expect(JSON.stringify(now.trailerOutcomes)).toBe(before);
    expect(nextFrame()).toBe(frame);
  });

  it('a tool\'s reply never holds the record', () => {
    session.beginToolRun('prose', 'tool-1');
    session.completeToolReport('tool-1', 'A report.', 'tool-conv');
    session.beginDirectToolMessage('prose', 'req-tool', 'Tighten it.');
    const turn = session.completeRun('req-tool', 'Done.', undefined, false, 'tool-conv', [], undefined, undefined, undefined, [], [], [], undefined, undefined,
      { memory: { cards: 0, dropped: [{ reason: 'off', count: 1 }] } })!;
    expect(turn.participant).toBe('tool');
    expect(turn).not.toHaveProperty('trailerOutcomes');
  });
});
