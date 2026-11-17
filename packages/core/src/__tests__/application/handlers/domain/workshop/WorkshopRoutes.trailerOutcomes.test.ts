/**
 * What became of a persona's notes, through the real routes (ADR 2026-11-17
 * D13–D15): the room handler, completion, the session and the project-memory
 * library are real; the provider is the harness's mock.
 *
 * - A reply's memory and file-edit trailers leave `trailerOutcomes` on its
 *   turn, and the persona's next message carries one
 *   `<workshop-trailer-outcomes>` frame before the writer's message.
 * - Once the persona replies again, the line is not repeated.
 * - A tool run's synthesis request carries it too (Okey, 2026-11-17).
 * - It is owed by the ledger, not the provider conversation: a fresh
 *   conversation's first message carries it (PR #276 F-01).
 * - Never on a direct tool message or a pressed edit offer's request.
 * - The record never reaches the webview; the log says only that a line was
 *   added.
 * Made-up text: Alice.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import {
  editOfferFrame,
  fakeFileEditStaging,
  fileEditFrame
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const TITLE_SENTINEL = 'ZZQ-TITLE';
const MALFORMED = `<prose-minion-memory-proposal><title>No kind ${TITLE_SENTINEL}</title></prose-minion-memory-proposal>`;
const NOTES = `${memoryFrame({ title: `Tea ${TITLE_SENTINEL}` })}\n${memoryFrame({ title: `Croquet ${TITLE_SENTINEL}` })}\n${MALFORMED}`;
const FRAME = [
  '<workshop-trailer-outcomes note="From the host: what became of the trailers in your last reply. Counts only.">',
  'Your last reply\'s notes: 2 shown as cards, 1 dropped (malformed).',
  '</workshop-trailer-outcomes>'
].join('\n');

describe('Workshop routes — a persona is told what became of its notes', () => {
  let harness: WorkshopRouteTestHarness;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const send = async (text: string) => {
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text });
    await settle();
  };
  const replyNext = (content: string) =>
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult(content, { conversationId: 'host-conv' }) as never);
  const lastContinued = (): string => (harness.service.continueConversation as jest.Mock).mock.calls.at(-1)[1];
  const hostReplies = (): WorkshopTurn[] =>
    harness.session.readRoomLedger().filter((turn) => turn.role === 'assistant' && turn.participant === 'host');
  const lastStarted = (): string =>
    (harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
  /** The provider no longer holds the host's conversation: the next send finds out, and the one after starts afresh. */
  const loseHostConversation = async () => {
    (harness.service.continueConversation as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('gone'), { name: 'ConversationNotFoundError' })
    );
    await send('Still there?');
    expect(harness.session.getHostConversationId()).toBeUndefined();
  };
  const logs = (): string[] => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));

  beforeEach(async () => {
    harness = createWorkshopRouteTestHarness({ fileEditStaging: fakeFileEditStaging() });
    await harness.pin();
    await send('Alice follows the rabbit. Does the chase land?');
  });

  it('records the outcomes on the reply, and the next message carries the line before the writer\'s, once', async () => {
    replyNext(`It is settled.\n\n${NOTES}`);
    await send('Is the watch settled?');
    const reply = hostReplies().at(-1)!;
    expect(reply.memoryProposals).toHaveLength(2);
    expect(reply.trailerOutcomes).toEqual({ memory: { cards: 2, dropped: [{ reason: 'malformed', count: 1 }] } });
    // The message that got that reply carried no line: there was nothing to tell yet.
    expect(lastContinued()).not.toContain('workshop-trailer-outcomes');

    await send('Who is late?');
    const sent = lastContinued();
    expect(sent).toContain(FRAME);
    expect(sent.indexOf('</workshop-trailer-outcomes>')).toBeLessThan(sent.indexOf('WRITER MESSAGE:'));
    expect(sent.endsWith('WRITER MESSAGE:\nWho is late?')).toBe(true);
    expect(sent).not.toContain(TITLE_SENTINEL);
    expect(logs().filter((line) => line.includes('Trailer outcomes'))).toEqual(['[WorkshopRoomHandler] Trailer outcomes added']);

    await send('And the Queen?');
    expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
    expect(logs().filter((line) => line.includes('Trailer outcomes'))).toHaveLength(1);
  });

  it('tells of file edits too: a card, a refused card and a dropped frame, by count', async () => {
    harness = createWorkshopRouteTestHarness({
      fileEditStaging: fakeFileEditStaging({ refuse: (target) => target.kind === 'excerpt' ? 'excerpt-not-a-file' : undefined })
    });
    await harness.pin();
    await send('Alice follows the rabbit.');
    replyNext(`Three changes.\n\n${fileEditFrame()}\n${fileEditFrame({ excerpt: true })}\n${fileEditFrame({ path: 'characters/hatter.md', why: null })}`);
    await send('Make Alice ten.');
    const reply = hostReplies().at(-1)!;
    expect(reply.fileEditProposals!.map((card) => card.state)).toEqual(['pending', 'refused']);
    expect(reply.trailerOutcomes).toEqual({ fileEdits: { cards: 1, refused: 1, dropped: [{ reason: 'malformed', count: 1 }] } });

    await send('Thanks.');
    const sent = lastContinued();
    expect(sent).toContain('Your last reply\'s file edits: 1 shown as a card, 1 refused before the writer could apply it, 1 dropped (malformed).');
    expect(sent).not.toContain('excerpt-not-a-file');
    expect(sent).not.toContain('characters/');
  });

  it('a reply with no trailer adds nothing', async () => {
    await send('And the falling?');
    await send('Who is late?');
    expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
    expect(harness.session.readRoomLedger().some((turn) => turn.trailerOutcomes)).toBe(false);
    expect(logs().some((line) => line.includes('Trailer outcomes'))).toBe(false);
  });

  it('never posts the record or the line to the webview', async () => {
    replyNext(`It is settled.\n\n${NOTES}`);
    harness.postMessage.mockClear();
    await send('Is the watch settled?');
    await send('Who is late?');
    expect(hostReplies().some((turn) => turn.trailerOutcomes)).toBe(true);
    const posted = JSON.stringify(harness.postMessage.mock.calls);
    expect(posted).not.toContain('trailerOutcomes');
    expect(posted).not.toContain('workshop-trailer-outcomes');
    expect(posted).not.toContain('Your last reply');
    // The cards themselves still reach the webview.
    const snapshot = harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns as WorkshopTurn[];
    expect(snapshot.some((turn) => turn.memoryProposals?.length === 2)).toBe(true);
  });

  it('never rides a direct tool message', async () => {
    replyNext(`It is settled.\n\n${NOTES}`);
    await send('Is the watch settled?');
    await harness.runProse();
    await settle();
    await route(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' });
    await send('Tighten the second paragraph.');
    const toolSent = lastContinued();
    expect(toolSent).toContain('Tighten the second paragraph.');
    expect(toolSent).not.toContain('workshop-trailer-outcomes');
  });

  describe('a tool run before the writer writes again (2026-11-17, Okey)', () => {
    const synthesisAsked = (): string => lastContinued();

    it('the synthesis request carries the line; the writer\'s next message does not repeat it', async () => {
      replyNext(`It is settled.\n\n${NOTES}`);
      await send('Is the watch settled?');
      const before = JSON.stringify((harness.service.continueConversation as jest.Mock).mock.calls);

      await harness.runProse();
      await settle();
      const asked = synthesisAsked();
      expect(asked).toContain('Synthesize Prose');
      expect(asked).toContain(FRAME);
      // The line stands before the request it rides, as on a writer's message.
      expect(asked.indexOf('</workshop-trailer-outcomes>')).toBeLessThan(asked.indexOf('Synthesize Prose'));
      expect(asked).not.toContain(TITLE_SENTINEL);
      expect(logs().filter((line) => line.includes('Trailer outcomes'))).toEqual(['[RunWorkshopToolSidePass] Trailer outcomes added']);
      // Every earlier message is as it was sent.
      expect(JSON.stringify((harness.service.continueConversation as jest.Mock).mock.calls.slice(0, -1))).toBe(before);

      // The synthesis landed and is the host's latest reply: nothing is owed.
      const synthesis = hostReplies().at(-1)!;
      expect(synthesis.artifact).toBe('persona_synthesis');
      expect(synthesis).not.toHaveProperty('trailerOutcomes');
      await send('Who is late?');
      expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
      expect(logs().filter((line) => line.includes('Trailer outcomes'))).toHaveLength(1);
    });

    it('a tool run after a reply with no trailer adds nothing', async () => {
      await send('And the falling?');
      await harness.runProse();
      await settle();
      expect(synthesisAsked()).toContain('Synthesize Prose');
      expect(synthesisAsked()).not.toContain('workshop-trailer-outcomes');
      expect(logs().some((line) => line.includes('Trailer outcomes'))).toBe(false);
    });

    it('the tool sidecar\'s own request never carries it', async () => {
      replyNext(`It is settled.\n\n${NOTES}`);
      await send('Is the watch settled?');
      await harness.runProse();
      await settle();
      expect(JSON.stringify((harness.service.analyzeProse as jest.Mock).mock.calls)).not.toContain('workshop-trailer-outcomes');
    });

    it('a synthesis that starts the host\'s conversation carries the line too, once (PR #276 F-01)', async () => {
      replyNext(`It is settled.\n\n${NOTES}`);
      await send('Is the watch settled?');
      await loseHostConversation();
      await harness.runProse();
      await settle();
      const started = lastStarted();
      expect(started).toContain('Synthesize Prose');
      expect(started.split(FRAME)).toHaveLength(2);
      expect(hostReplies().at(-1)!.artifact).toBe('persona_synthesis');
      await send('Who is late?');
      expect(lastContinued()).toContain('Who is late?');
      expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
      // The send that found the conversation gone was built with the line and reached no one; the synthesis request landed it.
      expect(logs().filter((line) => line.includes('Trailer outcomes'))).toEqual([
        '[WorkshopRoomHandler] Trailer outcomes added',
        '[RunWorkshopToolSidePass] Trailer outcomes added'
      ]);
    });

    it('the mirror: a synthesis that carries trailers is told of them with the writer\'s next message', async () => {
      replyNext(`Here is what Prose found.\n\n${memoryFrame({ title: 'The Hatter keeps the time' })}\n${MALFORMED}`);
      await harness.runProse();
      await settle();
      const synthesis = hostReplies().at(-1)!;
      expect(synthesis.artifact).toBe('persona_synthesis');
      expect(synthesis.trailerOutcomes).toEqual({ memory: { cards: 1, dropped: [{ reason: 'malformed', count: 1 }] } });
      await send('Who is late?');
      expect(lastContinued()).toContain('Your last reply\'s notes: 1 shown as a card, 1 dropped (malformed).');
      await send('And the Queen?');
      expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
    });
  });

  it('a guest hears only of its own reply, and the host only of the host\'s', async () => {
    replyNext(`It is settled.\n\n${NOTES}`);
    await send('Is the watch settled?');
    await route(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' });
    await settle();
    const join = (harness.service.startWorkshopGuestConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
    expect(join).not.toContain('workshop-trailer-outcomes');

    harness.service.continueConversation.mockResolvedValueOnce(
      analysisResult(`One thing.\n\n${memoryFrame({ title: 'The Hatter keeps the time' })}`, { conversationId: 'guest-conv' }) as never
    );
    await send('Margot, anything worth keeping?');
    expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
    await send('Margot, and the ending?');
    const guestSent = lastContinued();
    expect(guestSent).toContain('Your last reply\'s notes: 1 shown as a card.');
    expect(guestSent).not.toContain('2 shown as cards');

    await route(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'host' });
    await send('What did Margot see?');
    const hostSent = lastContinued();
    expect(hostSent).toContain(FRAME);
    expect(hostSent).not.toContain('1 shown as a card.');
  });

  it('a pressed edit offer\'s request carries no line', async () => {
    replyNext(`One slip: "begining".\n\n${memoryFrame()}\n${editOfferFrame({ kind: 'fixes', count: 1 })}`);
    await send('Read the first page for slips.');
    const source = hostReplies().at(-1)!;
    expect(source.editOffers).toHaveLength(1);
    expect(source.trailerOutcomes).toEqual({ memory: { cards: 1, dropped: [] } });

    replyNext(fileEditFrame({ group: 'chapters', path: 'chapters/down-the-rabbit-hole.md', why: 'The slip.', body: ['<find>begining</find>', '<replace-with>beginning</replace-with>'] }));
    await route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
      requestId: 'press-1', roomRevision: harness.session.readRoomRevision(), turnId: source.id, kind: 'fixes'
    });
    await settle();
    const pressed = lastContinued();
    expect(pressed).toContain('<prose-minion-edit-request kind="fixes">');
    expect(pressed).not.toContain('workshop-trailer-outcomes');

    // The answer is the persona's latest reply now: the next writer message tells of it, not of the source reply.
    const answer = hostReplies().at(-1)!;
    expect(answer.editOfferAnswer?.outcome).toBe('proposed');
    expect(answer.trailerOutcomes).toEqual({ fileEdits: { cards: 1, refused: 0, dropped: [] } });
    await send('Thanks.');
    const sent = lastContinued();
    expect(sent).toContain('Your last reply\'s file edits: 1 shown as a card.');
    expect(sent).not.toContain('Your last reply\'s notes');
  });

  it('a lost conversation still owes the line: the fresh conversation\'s first message carries it, once (PR #276 F-01)', async () => {
    replyNext(`It is settled.\n\n${NOTES}`);
    await send('Is the watch settled?');
    const startsBefore = (harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls.length;
    // The conversation is lost; the reply and its record are still the room's.
    await loseHostConversation();
    expect(hostReplies().at(-1)!.trailerOutcomes).toEqual({ memory: { cards: 2, dropped: [{ reason: 'malformed', count: 1 }] } });

    await send('Where were we?');
    expect((harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls).toHaveLength(startsBefore + 1);
    const fresh = lastStarted();
    expect(fresh).toContain('Where were we?');
    expect(fresh.split(FRAME)).toHaveLength(2);
    expect(fresh.indexOf('</workshop-trailer-outcomes>')).toBeLessThan(fresh.indexOf('WRITER MESSAGE:'));
    expect(fresh).not.toContain(TITLE_SENTINEL);
    // The fresh conversation is shown the reply the line is about.
    // The fresh conversation is not shown the reply itself (the host's room offset is already past it): the line
    // is all it hears of it.
    expect(fresh).not.toContain('It is settled.');

    // It replied: nothing is owed on any later send.
    await send('And the Queen?');
    expect(lastContinued()).toContain('And the Queen?');
    expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
    await send('And the Duchess?');
    expect(lastContinued()).not.toContain('workshop-trailer-outcomes');
    // Two messages were built with the line: the send that found the conversation gone (it reached no one, so the
    // line stayed owed) and the one that landed.
    expect(logs().filter((line) => line.includes('Trailer outcomes'))).toEqual(Array(2).fill('[WorkshopRoomHandler] Trailer outcomes added'));
  });

  it('a participant\'s first-ever message carries no line: the ledger holds no reply of its own', () => {
    const first = (harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls[0][0].message as string;
    expect(first).toContain('Does the chase land?');
    expect(first).not.toContain('workshop-trailer-outcomes');
  });
});
