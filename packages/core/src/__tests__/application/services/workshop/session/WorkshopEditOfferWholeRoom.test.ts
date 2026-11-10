/**
 * A reply's edit offers across whole-room operations (ADR 2026-11-10 D3,
 * D7; epic Slice 2). Nothing about "used" is stored, so these need no rule
 * of their own: each is the one status function over the room that results.
 *
 * - A cut (Rewind) that removes an answer reopens its offer.
 * - A cut that removes the source reply removes its offers with it.
 * - A branch carries both or neither, and never writes its source.
 * - A saved and reopened session derives the same status.
 * - Two presses on one bubble, turns apart, each name the source and kind.
 * - A guest's reply is answered by that guest, in their own conversation.
 *
 * The room is the scripted one: the real session, the real completion for
 * answers, the real rewind transform and coordinator. Made-up text: Alice.
 */

import type { WorkshopEditOfferKind, WorkshopTurn } from '@messages';
import { workshopEditOfferStatus } from '@/application/services/workshop/fileEdits/WorkshopEditOfferStatus';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { editOfferFrame, fakeFileEditStaging, fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const CHAPTER = 'chapters/down-the-rabbit-hole.md';
const SAID = 'Two slips in the chapter: "begining" and a doubled "the". And the Rabbit\'s line would land harder cut short.';
const OFFERS = `${editOfferFrame({ kind: 'fixes', count: 2 })}\n${editOfferFrame({ kind: 'rewrites', count: 1 })}`;
const FIXES = fileEditFrame({
  group: 'chapters',
  path: CHAPTER,
  why: 'The two slips.',
  body: ['<find>begining</find>', '<replace-with>beginning</replace-with>', '<find>the the</find>', '<replace-with>the</replace-with>']
});
const REWRITE = fileEditFrame({
  group: 'chapters',
  path: CHAPTER,
  why: 'The Rabbit, cut short.',
  body: ['<find>"Oh dear! Oh dear! I shall be late!" said the Rabbit, quite out of breath.</find>', '<replace-with>"Oh dear! I shall be late!"</replace-with>']
});
const NONE = '<prose-minion-no-file-edit><why>The chapter already reads beginning.</why></prose-minion-no-file-edit>';

const status = (turns: readonly WorkshopTurn[], source: WorkshopTurn, kind: WorkshopEditOfferKind) =>
  workshopEditOfferStatus(turns, source.id, kind, { runActive: false });

async function offeredRoom() {
  const staging = fakeFileEditStaging();
  const room = new ScriptedWorkshopRoom().start();
  room.hostMessage('Where does Alice begin?');
  const source = await room.withStagedReply(`${SAID}\n\n${OFFERS}`, staging,
    (reply) => room.hostMessage('Read the first page for slips.', { reply }));
  return { room, staging, source };
}

describe('a reply\'s edit offers across whole-room operations (ADR 2026-11-10 D3)', () => {
  it('keeps both offers on the reply, and both read open before any press', async () => {
    const { room, source } = await offeredRoom();
    expect(source.content).toBe(SAID);
    expect(source.editOffers?.map((offer) => [offer.kind, offer.count])).toEqual([['fixes', 2], ['rewrites', 1]]);
    expect(status(room.session.readRoomLedger(), source, 'fixes')).toEqual({ state: 'open' });
    expect(status(room.session.readRoomLedger(), source, 'rewrites')).toEqual({ state: 'open' });
  });

  it('two presses on one bubble, turns apart, each name the source turn and kind', async () => {
    const { room, staging, source } = await offeredRoom();
    const fixes = (await room.editOfferPress(source, 'fixes', FIXES, staging))!;
    room.hostMessage('And what of the Queen?');
    room.hostMessage('Does the Hatter come back?');
    const rewrites = (await room.editOfferPress(source, 'rewrites', REWRITE, staging))!;

    const turns = room.session.readRoomLedger();
    const requests = turns.filter((turn) => turn.editOfferRequest);
    expect(requests.map((turn) => turn.editOfferRequest)).toEqual([
      { sourceTurnId: source.id, kind: 'fixes' },
      { sourceTurnId: source.id, kind: 'rewrites' }
    ]);
    expect(requests.every((turn) => turn.role === 'user' && turn.participant === 'writer')).toBe(true);
    expect(fixes.editOfferAnswer).toEqual({ sourceTurnId: source.id, kind: 'fixes', outcome: 'proposed' });
    expect(rewrites.editOfferAnswer).toEqual({ sourceTurnId: source.id, kind: 'rewrites', outcome: 'proposed' });
    // Turns apart: the second request stands after two unrelated exchanges.
    expect(turns.indexOf(requests[1]) - turns.findIndex((turn) => turn.id === fixes.id)).toBeGreaterThan(4);
    expect(status(turns, source, 'fixes')).toEqual({ state: 'answered', answerTurnId: fixes.id, cards: 1, changes: 2, askAgain: false });
    expect(status(turns, source, 'rewrites')).toEqual({ state: 'answered', answerTurnId: rewrites.id, cards: 1, changes: 1, askAgain: false });
    // A fixes answer's cards carry the intent; a rewrites answer's take their class policy alone.
    expect(fixes.fileEditProposals?.map((card) => card.intent)).toEqual(['fixes']);
    expect(rewrites.fileEditProposals?.map((card) => card.intent)).toEqual([undefined]);
  });

  it('a cut that removes an answer reopens its offer, with nothing to roll back', async () => {
    const { room, staging, source } = await offeredRoom();
    const answer = (await room.editOfferPress(source, 'fixes', FIXES, staging))!;
    expect(status(room.session.readRoomLedger(), source, 'fixes').state).toBe('answered');

    const cut = rewindWorkshopSession({
      workshop: room.session.exportCommittedState(),
      conversations: room.archive(),
      cut: after(source.id)
    });

    const kept = cut.workshop.turns;
    expect(kept.some((turn) => turn.id === answer.id)).toBe(false);
    expect(kept.some((turn) => turn.editOfferRequest || turn.editOfferAnswer)).toBe(false);
    expect(kept.find((turn) => turn.id === source.id)?.editOffers).toHaveLength(2);
    expect(status(kept, source, 'fixes')).toEqual({ state: 'open' });
  });

  it('a cut that removes the source reply removes its offers, its request and its answer with it', async () => {
    const { room, staging, source } = await offeredRoom();
    await room.editOfferPress(source, 'fixes', FIXES, staging);
    const first = room.session.readRoomLedger().find((turn) => turn.participant === 'host')!;

    const cut = rewindWorkshopSession({
      workshop: room.session.exportCommittedState(),
      conversations: room.archive(),
      cut: after(first.id)
    });

    expect(cut.workshop.turns.some((turn) => turn.id === source.id)).toBe(false);
    expect(cut.workshop.turns.some((turn) => turn.editOffers || turn.editOfferRequest || turn.editOfferAnswer)).toBe(false);
  });

  it('a nothing-to-change answer may be asked again, and a second answer is the one the status reads', async () => {
    const { room, staging, source } = await offeredRoom();
    const none = (await room.editOfferPress(source, 'fixes', NONE, staging))!;
    expect(none.editOfferAnswer).toEqual({
      sourceTurnId: source.id, kind: 'fixes', outcome: 'none', why: 'The chapter already reads beginning.'
    });
    expect(none.fileEditProposals).toBeUndefined();
    expect(status(room.session.readRoomLedger(), source, 'fixes')).toEqual({ state: 'nothing-to-change', answerTurnId: none.id, askAgain: true });

    const again = (await room.editOfferPress(source, 'fixes', FIXES, staging))!;
    expect(status(room.session.readRoomLedger(), source, 'fixes')).toEqual({
      state: 'answered', answerTurnId: again.id, cards: 1, changes: 2, askAgain: false
    });
  });

  it('a guest\'s reply is answered by that guest, in their own conversation', async () => {
    const staging = fakeFileEditStaging();
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Where does Alice begin?');
    room.inviteGuest('margot', 'Margot, read the first page.');
    const source = await room.withStagedReply(`${SAID}\n\n${OFFERS}`, staging,
      (reply) => room.guestMessage('margot', 'Any slips?', { reply }));
    room.session.setChatTarget({ kind: 'host' });
    const hostBefore = room.conversations.getMessages(room.session.getHostConversationId()!).length;
    const guestBefore = room.conversations.getMessages(room.session.getPersonaGuestConversationId('margot')!).length;

    const answer = (await room.editOfferPress(source, 'fixes', FIXES, staging))!;

    expect(source.participant).toBe('guest');
    expect(answer.participant).toBe('guest');
    expect(answer.personaId).toBe('margot');
    expect(room.session.readRoomLedger().find((turn) => turn.editOfferRequest)?.personaId).toBe('margot');
    // The run was the guest's: only their retained history grew, by one exchange.
    expect(room.conversations.getMessages(room.session.getHostConversationId()!)).toHaveLength(hostBefore);
    expect(room.conversations.getMessages(room.session.getPersonaGuestConversationId('margot')!)).toHaveLength(guestBefore + 2);
  });
});

describe('a reply\'s edit offers through Branch and reopen, by the real coordinator', () => {
  async function openAnsweredRoom() {
    const { room, staging, source } = await offeredRoom();
    const answer = (await room.editOfferPress(source, 'fixes', FIXES, staging))!;
    room.hostMessage('And what of the Queen?');
    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('offers', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('offers');
    return { ...harness, room, source, answer, sourcePath: await harness.store.resolveRevealPath('offers') };
  }

  it('a reopened session derives the same status from its turns alone', async () => {
    const { room, session, source, answer } = await openAnsweredRoom();
    const reopened = session.readRoomLedger();
    for (const kind of ['fixes', 'rewrites'] as const) {
      expect(status(reopened, source, kind)).toEqual(status(room.session.readRoomLedger(), source, kind));
    }
    expect(status(reopened, source, 'fixes')).toEqual({ state: 'answered', answerTurnId: answer.id, cards: 1, changes: 2, askAgain: false });
    expect(reopened.find((turn) => turn.id === answer.id)?.fileEditProposals?.[0]?.intent).toBe('fixes');
  });

  it('a branch after the answer carries the offer and its answer; one before it carries the offer alone', async () => {
    const harness = await openAnsweredRoom();
    const before = new TextDecoder().decode(await harness.fs.readFile(harness.sourcePath));

    const withAnswer = await harness.coordinator.branchFrom(after(harness.answer.id));
    const carried = (await harness.store.readNamed(withAnswer.branch.sessionId))!.workshop.turns;
    expect(status(carried, harness.source, 'fixes').state).toBe('answered');
    expect(carried.filter((turn) => turn.editOfferRequest || turn.editOfferAnswer)).toHaveLength(2);

    await harness.coordinator.openNamed('offers');
    const withoutAnswer = await harness.coordinator.branchFrom(after(harness.source.id));
    const alone = (await harness.store.readNamed(withoutAnswer.branch.sessionId))!.workshop.turns;
    expect(alone.find((turn) => turn.id === harness.source.id)?.editOffers).toHaveLength(2);
    expect(alone.some((turn) => turn.editOfferRequest || turn.editOfferAnswer)).toBe(false);
    expect(status(alone, harness.source, 'fixes')).toEqual({ state: 'open' });
    // Branch never writes its source.
    expect(new TextDecoder().decode(await harness.fs.readFile(harness.sourcePath))).toBe(before);
  });
});
