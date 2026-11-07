/**
 * Persona reactions through the real routes (ADR 2026-11-07 D5, R1, Q8, D8):
 * a host or guest reply's `<prose-minion-reaction>` trailer becomes a chip on
 * the writer message it answers, committed in the reply's settlement (the
 * writer's run-busy refusal, PR #245 M2, is for the writer's routes only).
 * A synthesis is `no-target`; a run that is cancelled or overtaken writes
 * nothing; with the setting off, nothing is stored.
 */

import { MessageType } from '@messages';
import { analysisResult, createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

type Harness = ReturnType<typeof createWorkshopRouteTestHarness>;

const send = (harness: Harness, text: string) =>
  harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text }) as never);
const trailer = (id: string) => `<prose-minion-reaction>${id}</prose-minion-reaction>`;
const lines = (harness: Harness): string[] =>
  (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
const writerMessages = (harness: Harness) =>
  harness.session.readRoomLedger().filter((turn) => turn.role === 'user' && turn.kind === 'message');
const nextReply = (harness: Harness, content: string) =>
  (harness.service.continueConversation as jest.Mock).mockImplementationOnce(async (conversationId: string) =>
    analysisResult(content, { conversationId }));

async function hostRoom(): Promise<Harness> {
  const harness = createWorkshopRouteTestHarness();
  await harness.pin();
  await send(harness, 'Alice follows the rabbit. Does the chase land?');
  return harness;
}

describe('persona reactions through the room handler (ADR 2026-11-07 D5)', () => {
  it('a host reply\'s trailer is a chip on the writer\'s message, in the snapshot, and the trailer is nowhere in a post', async () => {
    const harness = await hostRoom();
    harness.postMessage.mockClear();
    nextReply(harness, `The falling earns it.\n\n${trailer('fire')}`);
    await send(harness, 'And the falling?');

    const writer = writerMessages(harness).at(-1)!;
    const reply = harness.session.readRoomLedger().at(-1)!;
    expect(reply.content).toBe('The falling earns it.');
    expect(harness.session.readRoomReactions()).toEqual([
      expect.objectContaining({ turnId: writer.id, reaction: 'fire', author: { kind: 'host' }, viaTurnId: reply.id })
    ]);
    const posts = JSON.stringify(harness.postMessage.mock.calls);
    expect(posts).not.toContain('prose-minion-reaction');
    const snapshot = harness.postMessage.mock.calls.map(([posted]) => posted)
      .filter((posted) => posted.type === MessageType.WORKSHOP_SESSION_STATE).at(-1)!;
    expect(snapshot.payload.session.reactions).toEqual([
      expect.objectContaining({ turnId: writer.id, reaction: 'fire', author: { kind: 'host' }, viaTurnId: reply.id })
    ]);
    expect(lines(harness)).toContain('[WorkshopRoomHandler] Persona reaction kept (reaction=fire; Jill)');
  });

  it('R1: a reaction-only reply posts a turn with the host line and its mark', async () => {
    const harness = await hostRoom();
    harness.postMessage.mockClear();
    nextReply(harness, trailer('thanks'));
    await send(harness, 'Thank you!');

    const turnPost = harness.postMessage.mock.calls.map(([posted]) => posted)
      .filter((posted) => posted.type === MessageType.WORKSHOP_TURN).at(-1)!;
    expect(turnPost.payload.turn).toEqual(expect.objectContaining({ content: 'Reacted with thanks.', reactionOnly: 'thanks', participant: 'host' }));
    const stream = harness.postMessage.mock.calls.map(([posted]) => posted)
      .filter((posted) => posted.type === MessageType.STREAM_COMPLETE).at(-1)!;
    expect(stream.payload.content).toBe('Reacted with thanks.');
  });

  it('a guest\'s reply reacts too, as that guest', async () => {
    const harness = await hostRoom();
    (harness.service.startWorkshopGuestConversation as jest.Mock).mockResolvedValueOnce(
      analysisResult(`Glad to read along.\n\n${trailer('thanks')}`, { conversationId: 'guest-conv' })
    );
    await harness.router.route(message(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' }) as never);
    const opening = writerMessages(harness).at(-1)!;
    expect(harness.session.readRoomReactions()).toEqual([
      expect.objectContaining({ turnId: opening.id, reaction: 'thanks', author: { kind: 'personaGuest', personaId: 'margot' } })
    ]);

    nextReply(harness, `Yes.\n${trailer('eyes')}`);
    await send(harness, 'Margot, does the voice hold?');
    const asked = writerMessages(harness).at(-1)!;
    expect(harness.session.readRoomReactions().filter((entry) => entry.turnId === asked.id)).toEqual([
      expect.objectContaining({ reaction: 'eyes', author: { kind: 'personaGuest', personaId: 'margot' } })
    ]);
  });

  it('a tool report\'s synthesis answers no writer message: no-target, nothing stored', async () => {
    const harness = await hostRoom();
    nextReply(harness, `The report is right.\n\n${trailer('hundred')}`);
    await harness.runProse();
    const synthesis = harness.session.readRoomLedger().filter((turn) => turn.artifact === 'persona_synthesis').at(-1)!;
    expect(synthesis.content).toBe('The report is right.');
    expect(harness.session.readRoomReactions()).toEqual([]);
    expect(lines(harness)).toContain('[RunWorkshopToolSidePass] Persona reaction dropped (reason=no-target; reaction=hundred) (Jill synthesis)');
  });

  it('off (Q8): the trailer is dropped as reactions-off and nothing is stored; the writer still reacts', async () => {
    const harness = await hostRoom();
    const get = harness.settings.get;
    harness.settings.get = ((section: string, key: string, fallback?: unknown) =>
      key === 'workshop.reactions.personas' ? false : get(section, key, fallback)) as typeof get;
    nextReply(harness, `Agreed.\n${trailer('thumbs-up')}`);
    await send(harness, 'Cut the last line?');

    expect(harness.session.readRoomReactions()).toEqual([]);
    expect(lines(harness).some((line) => line.includes('Persona reaction dropped (reason=reactions-off; reaction=thumbs-up)'))).toBe(true);
    const reply = harness.session.readRoomLedger().at(-1)!;
    await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_REACTION, { turnId: reply.id, reaction: 'heart', reacted: true }) as never);
    expect(harness.session.readRoomReactions()).toEqual([expect.objectContaining({ turnId: reply.id, author: { kind: 'writer' } })]);
  });

  it('a run overtaken before its reply lands writes no reaction', async () => {
    const harness = await hostRoom();
    (harness.service.continueConversation as jest.Mock).mockImplementationOnce(
      (conversationId: string, _message: string, options: { signal: AbortSignal }) => new Promise((resolve) => {
        options.signal.addEventListener('abort', () => resolve(analysisResult(trailer('heart'), { conversationId })));
      })
    );
    const overtaken = send(harness, 'Who is late?');
    await new Promise((resolve) => setImmediate(resolve));
    await send(harness, 'Never mind.');
    await overtaken;
    expect(harness.session.readRoomReactions()).toEqual([]);
    expect(harness.session.readRoomLedger().some((turn) => turn.reactionOnly)).toBe(false);
  });

  it('the writer cannot react to a reaction-only reply (Q10)', async () => {
    const harness = await hostRoom();
    nextReply(harness, trailer('heart'));
    await send(harness, 'Thanks!');
    const reply = harness.session.readRoomLedger().at(-1)!;
    expect(reply.reactionOnly).toBe('heart');
    harness.postMessage.mockClear();
    await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_REACTION, { turnId: reply.id, reaction: 'fire', reacted: true }) as never);
    expect(harness.session.readRoomReactions().filter((entry) => entry.author.kind === 'writer')).toEqual([]);
  });
});
