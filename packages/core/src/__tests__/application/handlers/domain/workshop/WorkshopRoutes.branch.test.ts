import { MessageType, WorkshopTurn } from '@messages';
import {
  WorkshopBranchNotOpenedError,
  WorkshopBranchOutcome,
  WorkshopBranchRefusedError,
  WorkshopRewindRefusedError
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

/**
 * The Branch route (ADR 2026-09-30 §7): the bubble maps to its cut, the
 * coordinator refuses an unsaved source, re-checks the cut, saves the branch
 * and opens it, and the webview hears the room, the result naming both
 * sessions, and, for a writer message, the edit.
 */
describe('Workshop Branch route', () => {
  const outcome = (overrides: Partial<WorkshopBranchOutcome> = {}): WorkshopBranchOutcome => ({
    source: { sessionId: 'chapter-3', title: 'Chapter 3 — Felix' },
    branch: {
      sessionId: 'branch-1',
      title: 'Chapter 3 — Felix — branch',
      fileName: '20261001-chapter-3-felix-branch.json'
    } as WorkshopBranchOutcome['branch'],
    summary: {
      keptThroughTurnId: 'turn-1-system-1',
      removedTurnCount: 2,
      droppedConversationKeys: [],
      removedTodoCount: 0,
      releasedWidgetConfigIds: []
    },
    degradedConversationKeys: [],
    degradedConversations: [],
    ...overrides
  });

  const sentRoom = async () => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    await harness.router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Open the room.' }
    ) as any);
    const turns = harness.session.readRoomLedger();
    const writerTurn = turns.find((turn) => turn.participant === 'writer')!;
    const reply = turns.find((turn) => turn.participant === 'host')!;
    harness.postMessage.mockClear();
    return { ...harness, writerTurn, reply };
  };

  const branch = (
    harness: Awaited<ReturnType<typeof sentRoom>>,
    turn: Pick<WorkshopTurn, 'id'>,
    title?: string
  ) => harness.router.route(message(
    MessageType.WORKSHOP_BRANCH_SESSION,
    { turnId: turn.id, ...(title ? { title } : {}) }
  ) as any);

  const lastResult = (harness: Awaited<ReturnType<typeof sentRoom>>) =>
    harness.posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1)?.payload;

  it('branches from an agent reply and names both sessions', async () => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockResolvedValue(outcome());

    await branch(harness, harness.reply);

    expect(harness.persistence.branchFrom).toHaveBeenCalledWith(
      { kind: 'afterTurn', turnId: harness.reply.id },
      {}
    );
    expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE).length).toBeGreaterThan(0);
    expect(harness.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED)).toEqual([]);
    expect(lastResult(harness)).toEqual({
      action: 'branch',
      ok: true,
      message: 'Branched “Chapter 3 — Felix” into “Chapter 3 — Felix — branch”. ' +
        '2 later turns stay in “Chapter 3 — Felix”.'
    });
  });

  it('passes a writer-chosen title through', async () => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockResolvedValue(outcome());

    await branch(harness, harness.reply, 'Felix, take two');

    expect(harness.persistence.branchFrom).toHaveBeenCalledWith(
      { kind: 'afterTurn', turnId: harness.reply.id },
      { title: 'Felix, take two' }
    );
  });

  it('branches from a writer message as an edit in the branch', async () => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockResolvedValue(outcome({
      summary: {
        keptThroughTurnId: 'turn-1-system-1',
        removedTurnCount: 1,
        droppedConversationKeys: ['host'],
        removedTodoCount: 0,
        releasedWidgetConfigIds: []
      },
      composerRestore: {
        text: 'Open the room.',
        attachmentIds: [],
        unrestoredAttachmentLabels: ['draft-notes.md']
      }
    }));

    await branch(harness, harness.writerTurn);

    expect(harness.persistence.branchFrom).toHaveBeenCalledWith(
      { kind: 'beforeTurn', turnId: harness.writerTurn.id },
      {}
    );
    expect(harness.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED).map((entry) => entry.payload))
      .toEqual([{ text: 'Open the room.' }]);
    expect(lastResult(harness)?.message).toBe(
      'Branched “Chapter 3 — Felix” into “Chapter 3 — Felix — branch”. ' +
      '1 later turn stays in “Chapter 3 — Felix”. The host starts fresh from here. ' +
      'Re-attach draft-notes.md before you send it again.'
    );
  });

  it('reopens a widget message\'s widget in the branch', async () => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockResolvedValue(outcome({
      widgetRestore: { widgetConfigId: 'wc-1' }
    }));

    await branch(harness, harness.writerTurn);

    expect(harness.posted(MessageType.WORKSHOP_WIDGET_CONFIG_RESTORED).map((entry) => entry.payload))
      .toEqual([{ widgetConfigId: 'wc-1' }]);
  });

  it.each([
    ['unsaved-session', 'Save this session before branching.'],
    ['unsaved-changes', "Save this session's latest changes before branching."],
    ['source-changed', "This session's saved file is missing or changed on disk. " +
      'Reopen it from Sessions, or use Save as new to keep this room, before branching.']
  ] as const)('refuses an %s source in writer terms and republishes the room', async (reason, text) => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockRejectedValue(new WorkshopBranchRefusedError(reason));

    await branch(harness, harness.reply);

    expect(lastResult(harness)).toEqual({ action: 'branch', ok: false, message: text });
    expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE).length).toBeGreaterThan(0);
  });

  it.each([
    ['before-rewind-support', 'Saved before rewind support.'],
    ['busy', 'Wait for the current response to finish.'],
    ['not-a-rest-point', "Can't branch from this point."]
  ] as const)('reports the host re-check\'s %s refusal in branch terms', async (reason, text) => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockRejectedValue(new WorkshopRewindRefusedError(reason));

    await branch(harness, harness.reply);

    expect(lastResult(harness)).toEqual({ action: 'branch', ok: false, message: text });
  });

  it('says honestly when the branch was saved but could not be opened', async () => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockRejectedValue(new WorkshopBranchNotOpenedError(
      outcome().branch,
      'current.json could not be written'
    ));

    await branch(harness, harness.reply);

    expect(lastResult(harness)).toEqual({
      action: 'branch',
      ok: false,
      message: 'Saved the branch as “Chapter 3 — Felix — branch”, but couldn\'t open it: ' +
        'current.json could not be written. Your room is unchanged. ' +
        'Open the branch from Sessions to continue there.'
    });
    expect(harness.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED)).toEqual([]);
  });

  it('asks the writer to keep the room first when its source changed while branching', async () => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockRejectedValue(new WorkshopBranchNotOpenedError(
      outcome().branch,
      'Workshop branch refused: source-changed',
      'source-changed'
    ));

    await branch(harness, harness.reply);

    // Opening the branch now would replace this room's only complete copy.
    expect(lastResult(harness)).toEqual({
      action: 'branch',
      ok: false,
      message: 'Saved the branch as “Chapter 3 — Felix — branch”, but didn\'t open it: ' +
        "this session's saved file went missing or changed on disk while branching. " +
        'Your room is unchanged. Reopen it from Sessions, or use Save as new to keep this room, ' +
        'before you open the branch.'
    });
  });

  it('refuses a bubble that offers no branch without asking the coordinator', async () => {
    const harness = await sentRoom();
    const marker = harness.session.readRoomLedger().find((turn) => turn.participant === 'session');

    await branch(harness, marker ?? { id: 'turn-unknown' });

    expect(harness.persistence.branchFrom).not.toHaveBeenCalled();
    expect(lastResult(harness)).toEqual({
      action: 'branch',
      ok: false,
      message: "Can't branch from this point."
    });
  });

  it('is gated like every room mutation while another session operation is pending', async () => {
    const harness = await sentRoom();
    harness.persistence.isSessionOperationPending.mockReturnValue(true);

    await branch(harness, harness.reply);

    expect(harness.persistence.branchFrom).not.toHaveBeenCalled();
    expect(lastResult(harness)).toMatchObject({ action: 'branch', ok: false });
  });

  it('surfaces any other failure\'s reason', async () => {
    const harness = await sentRoom();
    harness.persistence.branchFrom.mockRejectedValue(new Error('Could not allocate a collision-free Workshop session filename.'));

    await branch(harness, harness.reply);

    expect(lastResult(harness)).toEqual({
      action: 'branch',
      ok: false,
      message: 'Could not allocate a collision-free Workshop session filename.'
    });
  });
});
