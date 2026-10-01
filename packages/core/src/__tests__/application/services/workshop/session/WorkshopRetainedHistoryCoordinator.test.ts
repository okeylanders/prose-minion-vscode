import {
  scriptedCheckpoint,
  setupCoordinator as setup
} from './WorkshopCoordinatorHarness';

describe('retained-history marks through the persistence coordinator (ADR 2026-09-30 §3)', () => {
  it('opens a saved session with its marks exactly as written', async () => {
    const { store, session, coordinator } = setup();
    const checkpoint = scriptedCheckpoint('scripted');
    await store.saveNamed(checkpoint);
    await coordinator.initialize();

    await coordinator.openNamed('scripted');

    expect(session.exportCommittedState().retainedHistoryMarks)
      .toEqual(checkpoint.workshop.retainedHistoryMarks);
  });

  it('baselines a session saved before rewind support from the archive it imported', async () => {
    const { store, session, coordinator } = setup();
    const legacy = scriptedCheckpoint('legacy');
    delete legacy.workshop.retainedHistoryMarks;
    await store.saveNamed(legacy);
    await coordinator.initialize();

    await coordinator.openNamed('legacy');

    const head = legacy.workshop.turns.at(-1)!.id;
    expect(session.exportCommittedState().retainedHistoryMarks).toEqual(
      legacy.conversations.map((entry) => expect.objectContaining({
        turnId: head,
        conversationKey: entry.key,
        messageCount: entry.messages.length,
        contextSourceCount: entry.contextSources.length,
        origin: 'baseline'
      }))
    );
  });

  it('does not preserve a "local recovery" copy when baselines are the only difference', async () => {
    const { store, coordinator } = setup();
    const legacy = scriptedCheckpoint('shared-id');
    delete legacy.workshop.retainedHistoryMarks;
    // Restored from current.json alone: the room carries unsaved-work status
    // and freshly recorded baselines.
    await store.writeCurrent(legacy);
    await coordinator.initialize();
    // The same session then arrives as a named file (for example, Git sync).
    await store.saveNamed(legacy);

    await coordinator.openNamed('shared-id');

    const listed = await coordinator.list();
    expect(listed.sessions.map((summary) => summary.title))
      .not.toContainEqual(expect.stringContaining('(local recovery)'));
    expect(coordinator.consumeRecoveryNotices()).toEqual([]);
  });
});
