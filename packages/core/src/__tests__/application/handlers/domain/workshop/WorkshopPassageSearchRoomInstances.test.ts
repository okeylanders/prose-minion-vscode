/**
 * A passage search's work across real room replacements (ADR 2026-11-20
 * D19, D20; PR #296 F3). One aggregate is shared by the real persistence
 * coordinator, which opens, reloads, rewinds and resets over session files in
 * memory, and the real composed routes, whose engine is a fake that makes no
 * call.
 *
 * - A running search's calls are aborted as the replacement lands: nothing
 *   is drawn and no call answers first.
 * - A held result survives only a Rewind of the same open room, and only
 *   while the cut keeps its card as it was searched. Reopening the same named
 *   session, whose id, turn ids and card are the same, drops it; so does a
 *   reload of it from disk with the card's scope changed, so the old report is
 *   never shown for the new card.
 * Made-up text: Alice.
 */

import { MessageType, type WorkshopPassageSearchRequest, type WorkshopTurn } from '@messages';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';
import { aliceResult, QUESTION } from './passageSearchRouteFixtures';
import { passageSearchRouteDriver } from './passageSearchRouteDriver';

const SESSION = 'caterpillar';
const CARD: WorkshopPassageSearchRequest = { question: QUESTION, scopes: [{ kind: 'excerpt' }] };

/** The scripted room as saved, with the first reply carrying the card as its commit would have stamped it. */
function withCard(checkpoint: WorkshopPersistedSessionV2, cardTurnId: string, card: WorkshopPassageSearchRequest): WorkshopPersistedSessionV2 {
  const turns = (checkpoint.workshop as { turns: WorkshopTurn[] }).turns
    .map((turn) => (turn.id === cardTurnId ? { ...turn, passageSearchRequest: card } : turn));
  return { ...checkpoint, workshop: { ...(checkpoint.workshop as object), turns } } as WorkshopPersistedSessionV2;
}

async function roomWithAHeldResult() {
  const scripted = new ScriptedWorkshopRoom().start('Alice saw the White Rabbit take a watch out of its waistcoat-pocket.');
  const cardReply = scripted.hostMessage('Where does the Rabbit check his watch?');
  scripted.hostMessage('And after the hall of doors?');
  scripted.hostMessage('What about the trial?');
  const writerTurns = scripted.session.readRoomLedger().filter((turn) => turn.participant === 'writer' && turn.role === 'user');
  const saved = withCard(scriptedCheckpoint(SESSION, scripted), cardReply.id, CARD);

  const real = setupCoordinator();
  await real.store.saveNamed(saved);
  await real.store.saveNamed(scriptedCheckpoint('elsewhere', new ScriptedWorkshopRoom().start('Somewhere else entirely.')));
  await real.coordinator.initialize();
  await real.coordinator.openNamed(SESSION);

  const driver = await passageSearchRouteDriver({
    session: real.session,
    persistence: { openRoomInstance: real.coordinator.openRoomInstance, onRoomReplaced: real.coordinator.onRoomReplaced }
  }, cardReply.id);
  return { real, driver, writerTurns, cardReply };
}

/** Run the card's search to a stopped result: held, never sent by the host. */
async function heldStopped(driver: Awaited<ReturnType<typeof passageSearchRouteDriver>>): Promise<void> {
  driver.search.result = aliceResult(2, { ended: 'stopped' });
  const answers = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
  expect(answers.map((answer) => answer.outcome)).toEqual(['started', 'finished']);
  expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
}

describe('a passage search across real room replacements', () => {
  it.each([
    ['Open', (real: ReturnType<typeof setupCoordinator>) => real.coordinator.openNamed('elsewhere')],
    ['a reopen of the same session', (real: ReturnType<typeof setupCoordinator>) => real.coordinator.openNamed(SESSION)],
    ['New', (real: ReturnType<typeof setupCoordinator>) => real.coordinator.resetSession({ start: 'carry' })]
  ])('%s aborts a running search as it lands, before anything is drawn or a call answers', async (_name, replace) => {
    const { real, driver } = await roomWithAHeldResult();
    driver.search.hold = true;
    const { requestId, running } = await driver.act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await driver.settle();
    const signal = (driver.search.run.mock.calls[0][1] as { signal: AbortSignal }).signal;
    expect(signal.aborted).toBe(false);

    await replace(real);
    expect(signal.aborted).toBe(true);
    await running;
    await driver.settle();
    expect(driver.answersOf(requestId).at(-1)).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'room-changed' }));
    expect(driver.harness.service.continueConversation).not.toHaveBeenCalled();
    expect(driver.requestTurns()).toHaveLength(0);
  });

  it('a Rewind that keeps the card keeps its result: ready, and Send delivers it with no second search', async () => {
    const { real, driver, writerTurns } = await roomWithAHeldResult();
    await heldStopped(driver);
    const before = real.session.readRoomRevision();

    await real.coordinator.rewindTo({ kind: 'beforeTurn', turnId: writerTurns[2].id }, { origin: 'writer' });
    expect(real.session.readRoomRevision()).not.toBe(before);
    expect(driver.ledger().some((turn) => turn.id === writerTurns[2].id)).toBe(false);
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));
    expect(driver.logs()).toContain('room rewound kept=1 dropped=0');

    const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent.outcome).toBe('done');
    expect(driver.search.run).toHaveBeenCalledTimes(1);
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'delivered', reportHeld: true }));
  });

  it('a Rewind past the card takes its result with it', async () => {
    const { real, driver, writerTurns } = await roomWithAHeldResult();
    await heldStopped(driver);
    await real.coordinator.rewindTo({ kind: 'beforeTurn', turnId: writerTurns[0].id }, { origin: 'writer' });
    expect(await driver.view()).toBeUndefined();
    expect(driver.logs()).toContain('room rewound kept=0 dropped=1');
  });

  it('reopening the same named session drops it, though its id, turn ids and card are the same', async () => {
    const { real, driver } = await roomWithAHeldResult();
    await heldStopped(driver);
    const identity = real.coordinator.openRoomIdentity().sessionId;
    const instance = real.coordinator.openRoomInstance();

    await real.coordinator.openNamed(SESSION);
    expect(real.coordinator.openRoomIdentity().sessionId).toBe(identity);
    expect(real.coordinator.openRoomInstance()).not.toBe(instance);
    expect(driver.ledger().find((turn) => turn.id === driver.card.id)?.passageSearchRequest).toEqual(CARD);
    expect(await driver.view()).toEqual({ status: 'pending' });
    const [report] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
    expect(report).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-held' }));
    expect(driver.logs()).toContain('room replaced dropped=1');
    expect(driver.logs()).not.toContain('room rewound');
  });

  it('a reload of the same session whose card now names other places never shows the old report', async () => {
    const { real, driver } = await roomWithAHeldResult();
    await heldStopped(driver);
    const onDisk = (await real.store.readNamed(SESSION))!;
    const changed: WorkshopPassageSearchRequest = { ...CARD, scopes: [{ kind: 'group', group: 'chapters' }] };
    await real.store.updateNamed(SESSION, withCard(onDisk, driver.card.id, changed), onDisk);

    expect(await real.coordinator.refreshNamedSession()).toBe(true);
    const reloaded = driver.ledger().find((turn) => turn.id === driver.card.id)!.passageSearchRequest!;
    expect(reloaded.question).toBe(CARD.question);
    expect(reloaded.scopes).toEqual(changed.scopes);
    expect(await driver.view()).toEqual({ status: 'pending' });
    const [report] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
    expect(report).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-held' }));
    const [sent] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-ready' }));
    expect(driver.search.save).not.toHaveBeenCalled();
    expect(driver.harness.service.continueConversation).not.toHaveBeenCalled();
  });
});
