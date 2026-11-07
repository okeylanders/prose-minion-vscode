/**
 * The reaction routes (ADR 2026-11-07 D2, D4, D8) through the real router,
 * the real slice composition and the real session: the writer's add and
 * remove, and Hide on a persona's, reach the ledger inside the
 * session-operation gate and post the room's snapshot. A refusal changes
 * nothing and logs no content. No reaction starts a model call.
 */

import { MessageType, WorkshopTurnReactionSummary } from '@messages';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const roomWithReply = async () => {
  const harness = createWorkshopRouteTestHarness();
  await harness.pin();
  await harness.router.route(message(
    MessageType.WORKSHOP_SEND_MESSAGE,
    { text: 'Alice follows the rabbit. Does the chase land?' }
  ) as never);
  harness.session.recordSessionMarker('resume', 'Session resumed Tuesday after 49h');
  const turns = harness.session.readRoomLedger();
  const writer = turns.find((turn) => turn.participant === 'writer' && turn.kind === 'message')!;
  const reply = turns.find((turn) => turn.participant === 'host')!;
  const divider = turns.find((turn) => turn.kind === 'divider')!;
  harness.postMessage.mockClear();
  (harness.log.appendLine as jest.Mock).mockClear();
  harness.persistence.markDirty.mockClear();
  return { ...harness, writer, reply, divider };
};

type Harness = Awaited<ReturnType<typeof roomWithReply>>;

const react = (harness: Harness, turnId: unknown, reaction: unknown, reacted: unknown = true) =>
  harness.router.route(message(MessageType.WORKSHOP_SET_TURN_REACTION, { turnId, reaction, reacted }) as never);

const hide = (harness: Harness, turnId: unknown, reaction: unknown, author: unknown) =>
  harness.router.route(message(MessageType.WORKSHOP_HIDE_TURN_REACTION, { turnId, reaction, author }) as never);

const lastReactions = (harness: Harness): WorkshopTurnReactionSummary[] =>
  harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session.reactions;

const logLines = (harness: Harness): string =>
  (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');

const errors = (harness: Harness) => harness.posted(MessageType.ERROR).map((entry) => entry.payload);

/** The model service's calls that would start or continue a model run. */
const MODEL_CALLS = [
  'analyzeDialogue',
  'analyzeProse',
  'analyzeWritingTools',
  'startWorkshopPersonaConversation',
  'startWorkshopGuestConversation',
  'continueConversation'
] as const;
const modelCalls = (harness: Harness): number =>
  MODEL_CALLS.reduce((total, name) => total + (harness.service[name] as jest.Mock).mock.calls.length, 0);

describe('Workshop reaction routes', () => {
  it('registers both routes', async () => {
    const { router } = await roomWithReply();

    expect(router.hasHandler(MessageType.WORKSHOP_SET_TURN_REACTION)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_HIDE_TURN_REACTION)).toBe(true);
  });

  it('adds the writer\'s reaction to a persona reply, marks the room dirty, and posts the snapshot', async () => {
    const harness = await roomWithReply();

    await react(harness, harness.reply.id, 'mind-blown');

    expect(lastReactions(harness)).toEqual([
      { turnId: harness.reply.id, reaction: 'mind-blown', author: { kind: 'writer' }, label: 'You' }
    ]);
    expect(harness.persistence.markDirty).toHaveBeenCalledWith('reaction committed');
    expect(logLines(harness)).toContain(
      `Reaction add added (turnId=${harness.reply.id}, reaction=mind-blown, author=writer, source=webview.workshop)`
    );
  });

  it('keeps several different reactions on one bubble, each once', async () => {
    const harness = await roomWithReply();

    await react(harness, harness.reply.id, 'fire');
    await react(harness, harness.reply.id, 'heart');
    harness.persistence.markDirty.mockClear();
    await react(harness, harness.reply.id, 'fire');

    expect(lastReactions(harness).map((summary) => summary.reaction)).toEqual(['fire', 'heart']);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
  });

  it('removes the writer\'s reaction, and a second remove changes nothing', async () => {
    const harness = await roomWithReply();
    await react(harness, harness.reply.id, 'fire');

    await react(harness, harness.reply.id, 'fire', false);
    expect(lastReactions(harness)).toEqual([]);
    expect(harness.persistence.markDirty).toHaveBeenLastCalledWith('reaction committed');

    harness.persistence.markDirty.mockClear();
    await react(harness, harness.reply.id, 'fire', false);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
    expect(logLines(harness)).toContain('Reaction remove unchanged');
  });

  it('starts no model call when a reaction is added or removed', async () => {
    const harness = await roomWithReply();
    MODEL_CALLS.forEach((name) => (harness.service[name] as jest.Mock).mockClear());
    const turnsBefore = harness.session.readRoomLedger().map((turn) => turn.id);

    await react(harness, harness.reply.id, 'fire');
    await react(harness, harness.reply.id, 'fire', false);

    expect(modelCalls(harness)).toBe(0);
    expect(harness.session.readRoomLedger().map((turn) => turn.id)).toEqual(turnsBefore);
    expect(harness.posted(MessageType.WORKSHOP_TURN)).toEqual([]);
  });

  it.each([
    ['the writer\'s own message', 'writer'],
    ['a divider', 'divider']
  ] as const)('refuses a reaction on %s, changing nothing', async (_label, which) => {
    const harness = await roomWithReply();

    await react(harness, harness[which].id, 'fire');

    expect(harness.session.readRoomReactions()).toEqual([]);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
    expect(errors(harness).at(-1)).toMatchObject({
      source: 'workshop.reaction',
      message: 'Only a persona\'s reply can take a reaction.'
    });
    expect(logLines(harness)).toContain('reason=ineligible-turn');
  });

  it('refuses a reaction on a turn that is not in the room', async () => {
    const harness = await roomWithReply();

    await react(harness, 'turn-99-assistant-9', 'fire');

    expect(errors(harness).at(-1)?.message).toBe('That message is no longer in this session.');
    expect(logLines(harness)).toContain('reason=unknown-turn');
  });

  it.each([
    ['no turn', { reaction: 'fire', reacted: true }],
    ['an unknown reaction', { turnId: 'x', reaction: 'clapping', reacted: true }],
    ['a glyph for a reaction', { turnId: 'x', reaction: '\u{1F525}', reacted: true }],
    ['no reacted flag', { turnId: 'x', reaction: 'fire' }]
  ])('refuses a malformed change with %s', async (_label, payload) => {
    const harness = await roomWithReply();

    await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_REACTION, payload) as never);

    expect(errors(harness).at(-1)?.message).toMatch(/must name a turn, a known reaction/);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
  });

  it('hides a persona\'s reaction by removing it, and never names the writer as the author', async () => {
    const harness = await roomWithReply();
    // Personas write reactions from Slice 3; one is installed here the way a
    // reopened session would carry it.
    const state = harness.session.exportCommittedState();
    harness.session.hydrateCommittedState(
      {
        ...state,
        reactions: [{
          turnId: harness.writer.id,
          reaction: 'heart',
          author: { kind: 'host' },
          viaTurnId: harness.reply.id,
          createdAt: 5
        }]
      },
      { host: 'host-conversation' },
      harness.session.getSnapshot().conversationBehavior
    );
    expect(harness.session.getSnapshot().reactions).toEqual([
      { turnId: harness.writer.id, reaction: 'heart', author: { kind: 'host' }, label: 'Jill' }
    ]);

    await hide(harness, harness.writer.id, 'heart', { kind: 'writer' });
    expect(errors(harness).at(-1)?.message).toMatch(/the persona who gave it/);
    expect(harness.session.readRoomReactions()).toHaveLength(1);

    await hide(harness, harness.writer.id, 'heart', { kind: 'host' });
    expect(lastReactions(harness)).toEqual([]);
    expect(harness.persistence.markDirty).toHaveBeenCalledWith('reaction committed');
    expect(logLines(harness)).toContain(`Reaction hide removed (turnId=${harness.writer.id}, reaction=heart, author=host`);
  });

  it('logs ids and outcomes only, never the turn\'s words', async () => {
    const harness = await roomWithReply();

    await react(harness, harness.reply.id, 'sad');
    await react(harness, harness.writer.id, 'sad');

    expect(logLines(harness)).not.toContain('rabbit');
    expect(logLines(harness)).not.toContain(harness.reply.content);
  });
});
