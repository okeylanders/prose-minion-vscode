/**
 * A reply's trailer outcomes across the room (ADR 2026-11-17 D13–D15),
 * through the scripted room's real conversation store, the real coordinator
 * and the session codec:
 *
 * - The frame rides only the persona's next user message; every earlier
 *   message in its retained conversation is byte-identical before and after.
 * - It is derived from the ledger with no delivery record: a Rewind past
 *   the reply removes the line, and a Rewind past the message that carried
 *   it sends it again.
 * - Each participant hears only of its own reply.
 * - A pressed edit offer's request carries no line; its answer leaves
 *   outcomes of its own, a refused card counted.
 * - The codec reads the field strictly; an authentic session from before
 *   the slice still reads; the transcript projection and the webview's
 *   mapping never carry it.
 * *Alice*.
 */

import type { WorkshopTurn } from '@messages';
import type { WorkshopTrailerOutcomes } from '@shared/types/workshopTrailerOutcomes';
import { WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS, WORKSHOP_MEMORY_TRAILER_DROP_REASONS } from '@shared/types/workshopTrailerOutcomes';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { WORKSHOP_TRAILER_OUTCOME_LIMITS } from '@/application/services/workshop/session/WorkshopTrailerOutcomeRecords';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import {
  projectWorkshopTranscript,
  projectWorkshopTranscriptTurn
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { editOfferFrame, fakeFileEditStaging, fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const HOST = { kind: 'host' } as const;
const MARGOT = { kind: 'personaGuest', personaId: 'margot' } as const;
const MALFORMED = '<prose-minion-memory-proposal><title>No kind</title></prose-minion-memory-proposal>';
const NOTES_REPLY = `It is.\n\n${memoryFrame()}\n${memoryFrame({ title: 'Tea is at six' })}\n${MALFORMED}`;
const LINE = 'Your last reply\'s notes: 2 shown as cards, 1 dropped (malformed).';
const FRAME = [
  '<workshop-trailer-outcomes note="From the host: what became of the trailers in your last reply. Counts only.">',
  LINE,
  '</workshop-trailer-outcomes>'
].join('\n');

const hostHistory = (room: ScriptedWorkshopRoom) =>
  room.conversations.getMessages(room.session.getHostConversationId()!);

function openRoom(): ScriptedWorkshopRoom {
  const room = new ScriptedWorkshopRoom().start('Alice was beginning to get very tired of sitting by her sister on the bank.');
  room.memoryContext = { open: true, mode: 'ask', listed: new Map() };
  return room;
}

/** An exchange, a reply with two note cards and a malformed frame, then the message that carries the line. */
function toldRoom() {
  const room = openRoom();
  const first = room.hostMessage('Where did the rabbit go?');
  const second = room.hostMessage('Is the watch settled?', { reply: NOTES_REPLY });
  const before = JSON.stringify(hostHistory(room));
  const third = room.hostMessage('Who is late?');
  return { room, first, second, third, before };
}

describe('the line rides the next message only (D14, D15)', () => {
  it('goes before the writer\'s message, once; earlier retained messages are byte-identical', () => {
    const { room, second, third, before } = toldRoom();
    expect(second.trailerOutcomes).toEqual({ memory: { cards: 2, dropped: [{ reason: 'malformed', count: 1 }] } });
    expect(third).not.toHaveProperty('trailerOutcomes');

    const history = hostHistory(room);
    const beforeMessages = JSON.parse(before) as unknown[];
    expect(JSON.stringify(history.slice(0, beforeMessages.length))).toBe(before);
    const delivered = history.slice(beforeMessages.length);
    expect(delivered.map((entry) => entry.role)).toEqual(['user', 'assistant']);
    expect(delivered[0].content).toBe(`${FRAME}\n[host] Who is late?`);

    // The persona has replied again: its latest reply is the new one, so the line is not repeated.
    room.hostMessage('And the Queen?');
    expect(hostHistory(room).at(-2)!.content).toBe('[host] And the Queen?');
    expect(JSON.stringify(hostHistory(room).slice(0, beforeMessages.length))).toBe(before);
    // No message but the one after the reply ever held the frame.
    expect(hostHistory(room).filter((entry) => String(entry.content).includes('workshop-trailer-outcomes'))).toHaveLength(1);
  });

  it('the record lives on the turn alone: no retained conversation holds it', () => {
    const { room, before } = toldRoom();
    expect(before).not.toContain('trailerOutcomes');
    expect(JSON.stringify(room.archive())).not.toContain('trailerOutcomes');
  });

  it('a reply with no trailer adds nothing to the next message', () => {
    const room = openRoom();
    room.hostMessage('Where did the rabbit go?');
    room.hostMessage('Why the watch?');
    expect(hostHistory(room).at(-2)!.content).toBe('[host] Why the watch?');
    expect(room.session.readRoomLedger().some((turn) => turn.trailerOutcomes)).toBe(false);
  });

  it('memory off: each frame is counted as not open', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Where did the rabbit go?');
    const reply = room.hostMessage('Is the watch settled?', { reply: `It is.\n\n${memoryFrame()}` });
    expect(reply.trailerOutcomes).toEqual({ memory: { cards: 0, dropped: [{ reason: 'off', count: 1 }] } });
    room.hostMessage('Who is late?');
    expect(hostHistory(room).at(-2)!.content).toContain('Your last reply\'s notes: 1 dropped (not open in this conversation just then).');
  });
});

describe('Rewind needs nothing of its own (D15)', () => {
  it('the transform cutting the reply removes the line; cutting the message that carried it makes it owed again', () => {
    const { room, first, second, third } = toldRoom();
    const state = room.session.exportCommittedState();
    // After the third exchange, the latest reply left no outcomes.
    expect(workshopTrailerOutcomesFrameFor(state.turns, HOST)).toBeUndefined();

    const pastReply = rewindWorkshopSession({ workshop: state, conversations: room.archive(), cut: after(first.id) });
    expect(pastReply.workshop.turns.some((turn) => turn.id === second.id)).toBe(false);
    expect(JSON.stringify(pastReply.workshop)).not.toContain('trailerOutcomes');
    expect(workshopTrailerOutcomesFrameFor(pastReply.workshop.turns, HOST)).toBeUndefined();

    const pastCarrier = rewindWorkshopSession({ workshop: state, conversations: room.archive(), cut: after(second.id) });
    expect(pastCarrier.workshop.turns.some((turn) => turn.id === third.id)).toBe(false);
    expect(workshopTrailerOutcomesFrameFor(pastCarrier.workshop.turns, HOST)).toBe(FRAME);
  });

  it('Rewind through the coordinator: past the message that carried it, the line goes out again; past the reply, never', async () => {
    const { room, first, second } = toldRoom();
    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('told', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('told');
    expect(workshopTrailerOutcomesFrameFor(harness.session.readRoomLedger(), HOST)).toBeUndefined();

    await harness.coordinator.rewindTo(after(second.id), { origin: 'writer' });
    expect(workshopTrailerOutcomesFrameFor(harness.session.readRoomLedger(), HOST)).toBe(FRAME);

    await harness.coordinator.rewindTo(after(first.id), { origin: 'writer' });
    expect(workshopTrailerOutcomesFrameFor(harness.session.readRoomLedger(), HOST)).toBeUndefined();
    expect(harness.session.readRoomLedger().some((turn) => turn.trailerOutcomes)).toBe(false);
  });
});

describe('each participant hears only of its own reply (D15)', () => {
  it('a guest\'s outcomes reach only the guest; the host\'s only the host', () => {
    const room = openRoom();
    room.hostMessage('Where did the rabbit go?');
    room.inviteGuest('margot', 'Margot, read this with us.');
    const guestId = room.session.getPersonaGuestConversationId('margot')!;
    const guestReply = room.guestMessage('margot', 'Anything worth keeping?', { reply: `One thing.\n\n${memoryFrame()}\n${MALFORMED}` });
    expect(guestReply.trailerOutcomes).toEqual({ memory: { cards: 1, dropped: [{ reason: 'malformed', count: 1 }] } });

    // The host's next message says nothing of the guest's reply.
    room.hostMessage('What did Margot see?');
    expect(hostHistory(room).at(-2)!.content).not.toContain('workshop-trailer-outcomes');
    expect(workshopTrailerOutcomesFrameFor(room.session.readRoomLedger(), HOST)).toBeUndefined();

    // The guest's own next message carries its line, once.
    room.guestMessage('margot', 'And the ending?');
    expect(room.conversations.getMessages(guestId).at(-2)!.content)
      .toContain('Your last reply\'s notes: 1 shown as a card, 1 dropped (malformed).\n</workshop-trailer-outcomes>\n[guest margot] And the ending?');
    room.guestMessage('margot', 'And the title?');
    expect(room.conversations.getMessages(guestId).at(-2)!.content).toBe('[guest margot] And the title?');
  });

  it('the host\'s outcomes never reach a guest', () => {
    const room = openRoom();
    room.hostMessage('Is the watch settled?', { reply: NOTES_REPLY });
    room.inviteGuest('margot', 'Margot, read this with us.');
    room.guestMessage('margot', 'How does the voice sound?');
    const guestId = room.session.getPersonaGuestConversationId('margot')!;
    expect(JSON.stringify(room.conversations.getMessages(guestId))).not.toContain('workshop-trailer-outcomes');
    expect(workshopTrailerOutcomesFrameFor(room.session.readRoomLedger(), MARGOT)).toBeUndefined();
    expect(workshopTrailerOutcomesFrameFor(room.session.readRoomLedger(), HOST)).toBe(FRAME);
  });
});

describe('a pressed edit offer (D13, D15)', () => {
  const CHAPTER = 'chapters/down-the-rabbit-hole.md';
  const OFFER = editOfferFrame({ kind: 'fixes', count: 2 });
  const fix = (path: string) => fileEditFrame({
    group: 'chapters', path, why: 'The two slips.', body: ['<find>begining</find>', '<replace-with>beginning</replace-with>']
  });

  it('the request carries no line; the answer leaves its own outcomes, a `not-the-offered-file` card counted as refused', async () => {
    const staging = fakeFileEditStaging();
    const room = openRoom();
    room.hostMessage('Is the watch settled?', { reply: NOTES_REPLY });
    const source = await room.withStagedReply(`Two slips on the first page.\n\n${OFFER}`, staging,
      (reply) => room.hostMessage('Read the first page for slips.', { reply }));
    // The message that brought the offer carried the notes' line; the offer itself is no trailer the record counts.
    expect(source).not.toHaveProperty('trailerOutcomes');

    const answer = (await room.editOfferPress(source, 'fixes',
      `${fix(CHAPTER)}\n${fix('chapters/another-chapter.md')}\n${fix('chapters/another-chapter.md')}\n${memoryFrame()}`, staging))!;
    const pressMessage = hostHistory(room).at(-2)!.content as string;
    expect(pressMessage).not.toContain('workshop-trailer-outcomes');
    expect(answer.fileEditProposals!.map((card) => [card.state, card.reason])).toEqual([['pending', undefined], ['refused', 'not-the-offered-file']]);
    expect(answer.trailerOutcomes).toEqual({
      memory: { cards: 0, dropped: [{ reason: 'off', count: 1 }] },
      fileEdits: { cards: 1, refused: 1, dropped: [{ reason: 'duplicate', count: 1 }] }
    });
    expect(JSON.stringify(answer.trailerOutcomes)).not.toContain('not-the-offered-file');

    // The persona hears of the answer with its next writer message.
    room.hostMessage('Thanks.');
    const next = hostHistory(room).at(-2)!.content as string;
    expect(next).toContain('Your last reply\'s notes: 1 dropped (not open in this conversation just then).');
    expect(next).toContain('Your last reply\'s file edits: 1 shown as a card, 1 refused before the writer could apply it, 1 dropped (a repeat of another in the same reply).');
    expect(next).not.toContain('not-the-offered-file');
    expect(next).not.toContain('chapters/');
  });

  it('a `none` answer leaves no record', async () => {
    const staging = fakeFileEditStaging();
    const room = openRoom();
    const source = await room.withStagedReply(`Two slips on the first page.\n\n${OFFER}`, staging,
      (reply) => room.hostMessage('Read the first page for slips.', { reply }));
    const none = (await room.editOfferPress(source, 'fixes',
      '<prose-minion-no-file-edit><why>The chapter already reads beginning.</why></prose-minion-no-file-edit>', staging))!;
    expect(none.editOfferAnswer?.outcome).toBe('none');
    expect(none).not.toHaveProperty('trailerOutcomes');
  });
});

describe('the field in the session codec (optional and additive; ADR 2026-07-30)', () => {
  type RawTurn = Record<string, unknown> & { role: string; participant: string; trailerOutcomes?: Record<string, any> };

  const everyReason: WorkshopTrailerOutcomes = {
    memory: { cards: 3, dropped: WORKSHOP_MEMORY_TRAILER_DROP_REASONS.map((reason, index) => ({ reason, count: index + 1 })) },
    fileEdits: { cards: 0, refused: 2, dropped: WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS.map((reason, index) => ({ reason, count: index + 1 })) }
  };

  /** The told room's checkpoint, with the reply's record changed. */
  const variant = (change: (reply: RawTurn, turns: RawTurn[]) => void) => () => {
    const checkpoint = JSON.parse(JSON.stringify(scriptedCheckpoint('told', toldRoom().room)));
    const turns = checkpoint.workshop.turns as RawTurn[];
    change(turns.find((turn) => turn.trailerOutcomes)!, turns);
    return parseWorkshopPersistedSession(checkpoint);
  };

  it('an authentic session from before the slice reads and saves byte for byte, with no trailerOutcomes key', () => {
    const text = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-trailer-outcomes.json'));
    // What the fixture holds: a reply with a note card and a dropped frame, and one with file-edit cards.
    expect(text).toContain('"memoryProposals"');
    expect(text).toContain('"fileEditProposals"');
    expect(text).not.toContain('trailerOutcomes');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);

    const service = new WorkshopSessionService(() => 3_000);
    service.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(JSON.stringify(service.exportCommittedState())).not.toContain('trailerOutcomes');
    // An older reply says nothing of its trailers: there is no record to derive a line from.
    expect(workshopTrailerOutcomesFrameFor(service.readRoomLedger(), HOST)).toBeUndefined();
  });

  it('round-trips a session with the field byte for byte, with nothing to normalize and no version bump', () => {
    const raw = JSON.stringify(scriptedCheckpoint('told', toldRoom().room));
    expect(raw).toContain('"trailerOutcomes":{"memory":{"cards":2,"dropped":[{"reason":"malformed","count":1}]}}');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(raw)))).toBe(raw);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(raw));
    expect(reopened.normalizations).toEqual([]);
    expect(reopened.session.schemaVersion).toBe(2);
  });

  it('round-trips every reason, each side in its own list\'s order, through the aggregate', () => {
    const parsed = variant((reply) => { reply.trailerOutcomes = everyReason; })();
    const record = parsed.workshop.turns.find((turn) => turn.trailerOutcomes)!.trailerOutcomes;
    expect(record).toEqual(everyReason);

    const service = new WorkshopSessionService(() => 3_000);
    service.hydrateCommittedState(parsed.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(service.exportCommittedState().turns.find((turn) => turn.trailerOutcomes)!.trailerOutcomes).toEqual(everyReason);
  });

  it.each<[string, (reply: RawTurn, turns: RawTurn[]) => void, RegExp]>([
    ['the field on a writer turn', (reply, turns) => {
      turns.find((turn) => turn.role === 'user')!.trailerOutcomes = reply.trailerOutcomes;
    }, /a record on a persona reply/],
    ['the field on a divider', (reply, turns) => {
      turns.find((turn) => turn.participant === 'session')!.trailerOutcomes = reply.trailerOutcomes;
    }, /a record on a persona reply/],
    ['a memory-only reason under fileEdits', (reply) => {
      reply.trailerOutcomes = { fileEdits: { cards: 0, refused: 0, dropped: [{ reason: 'pinned-budget', count: 1 }] } };
    }, /fileEdits\.dropped\[0\]\.reason/],
    ['a file-edit-only reason under memory', (reply) => {
      reply.trailerOutcomes!.memory.dropped = [{ reason: 'oversized', count: 1 }];
    }, /memory\.dropped\[0\]\.reason/],
    ['a repeated reason', (reply) => {
      reply.trailerOutcomes!.memory.dropped = [{ reason: 'malformed', count: 1 }, { reason: 'malformed', count: 1 }];
    }, /each reason once/],
    ['reasons out of the list\'s order', (reply) => {
      reply.trailerOutcomes!.memory.dropped = [{ reason: 'duplicate', count: 1 }, { reason: 'malformed', count: 1 }];
    }, /each reason once, in the reason list's order/],
    ['a zero count', (reply) => { reply.trailerOutcomes!.memory.dropped[0].count = 0; }, /dropped\[0\]\.count/],
    ['a count past the bound', (reply) => { reply.trailerOutcomes!.memory.cards = WORKSHOP_TRAILER_OUTCOME_LIMITS.count + 1; }, /memory\.cards/],
    ['a fractional count', (reply) => { reply.trailerOutcomes!.memory.cards = 1.5; }, /memory\.cards/],
    ['an unknown reason', (reply) => { reply.trailerOutcomes!.memory.dropped[0].reason = 'not-a-reason'; }, /dropped\[0\]\.reason/],
    ['the code\'s own verdict in place of the recorded reason', (reply) => {
      reply.trailerOutcomes!.memory.dropped[0].reason = 'malformed:missing-kind';
    }, /dropped\[0\]\.reason/],
    ['a title on a drop', (reply) => { reply.trailerOutcomes!.memory.dropped[0].title = 'The watch'; }, /unknown field title/],
    ['a note id on a side', (reply) => { reply.trailerOutcomes!.memory.target = 'mem-7f3c2a'; }, /unknown field target/],
    ['`refused` under memory', (reply) => { reply.trailerOutcomes!.memory.refused = 1; }, /unknown field refused/],
    ['fileEdits without `refused`', (reply) => {
      reply.trailerOutcomes = { fileEdits: { cards: 1, dropped: [] } };
    }, /missing required field refused/],
    ['an empty record', (reply) => { reply.trailerOutcomes = {}; }, /at least one of memory and fileEdits/],
    ['a side that counts no frame', (reply) => { reply.trailerOutcomes = { memory: { cards: 0, dropped: [] } }; }, /at least one frame counted/],
    ['an unknown side', (reply) => { reply.trailerOutcomes!.reactions = { cards: 1, dropped: [] }; }, /unknown field reactions/]
  ])('refuses %s', (_case, change, message) => {
    expect(variant(change)).toThrow(message);
  });
});

describe('host-only: the projections never carry it (D13)', () => {
  it('the shared transcript projection omits the field: the room projects as one without it', () => {
    const { room } = toldRoom();
    const turns = room.session.readRoomLedger();
    const stripped = turns.map(({ trailerOutcomes: _record, ...turn }) => turn);
    const meta = { title: 'Rabbit hole', exportedAt: 0 };
    expect(turns.some((turn) => turn.trailerOutcomes)).toBe(true);
    expect(projectWorkshopTranscript(turns, meta)).toEqual(projectWorkshopTranscript(stripped, meta));
    turns.forEach((turn, index) => expect(projectWorkshopTranscriptTurn(turn)).toEqual(projectWorkshopTranscriptTurn(stripped[index])));
    const projected = JSON.stringify(projectWorkshopTranscript(turns, meta));
    expect(projected).not.toContain('trailerOutcomes');
    expect(projected).not.toContain('workshop-trailer-outcomes');
    expect(projected).not.toContain('dropped');
  });

  it('`workshopTurnForWebview` removes the field, and leaves the turn\'s cards as they were', () => {
    const { room, second } = toldRoom();
    const stored = room.session.readRoomLedger().find((turn) => turn.id === second.id) as WorkshopTurn;
    expect(stored.trailerOutcomes).toBeDefined();
    const posted = workshopTurnForWebview(stored);
    expect(posted).not.toHaveProperty('trailerOutcomes');
    const { trailerOutcomes: _record, ...rest } = stored;
    expect(posted).toEqual(rest);
    // The host's own copy is untouched.
    expect(stored.trailerOutcomes).toEqual({ memory: { cards: 2, dropped: [{ reason: 'malformed', count: 1 }] } });
  });
});
