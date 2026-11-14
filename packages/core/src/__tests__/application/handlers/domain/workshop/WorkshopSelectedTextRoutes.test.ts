/**
 * Selected Text through the real composed Workshop routes and the real
 * session (ADR 2026-11-14 D11–D16): the command's seed, the toggle's watch,
 * and the send that names the snapshot its pill showed. The snapshots are
 * the real service over a fake editor port. The selection is from "Alice's
 * Adventures in Wonderland" (1865, public domain).
 */

import {
  MessageType,
  WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE,
  WORKSHOP_SELECTED_TEXT_FULL_REASON
} from '@messages';
import { EditorSelectionSnapshots } from '@/application/services/workshop/selection/EditorSelectionSnapshots';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  ALICE_PATH,
  ALICE_TEXT,
  ALICE_TEXT_MARKS,
  FakeEditorSelection,
  aliceSelection,
  recordingLog
} from '@/__tests__/application/services/workshop/selection/selectedTextFixtures';
import { createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const RECEIVER = 'workshop-receiver-1';
const OTHER_TEXT = 'Who are YOU? said the Caterpillar.';

describe('Workshop routes — Selected Text', () => {
  let harness: WorkshopRouteTestHarness;
  let editor: FakeEditorSelection;
  let snapshots: EditorSelectionSnapshots;
  let serviceLog: ReturnType<typeof recordingLog>;

  beforeEach(() => {
    editor = new FakeEditorSelection();
    serviceLog = recordingLog();
    let minted = 0;
    snapshots = new EditorSelectionSnapshots(editor, serviceLog, { mintId: () => `snap-${++minted}` });
    harness = createWorkshopRouteTestHarness({ selectedText: snapshots });
  });

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const offer = (deliveryId: string, snapshotId: unknown) => route(MessageType.WORKSHOP_STAGE_SELECTED_TEXT, { deliveryId, snapshotId });
  const accept = (deliveryId: string) => route(MessageType.WORKSHOP_ACCEPT_SELECTED_TEXT, { deliveryId, receiver: RECEIVER });
  const watch = (on: boolean) => route(MessageType.WORKSHOP_SELECTED_TEXT_WATCH, { on });
  const send = (text: string, selection?: { selectedTextSnapshotId?: unknown; roomRevision?: unknown }) =>
    route(MessageType.WORKSHOP_SEND_MESSAGE, { text, ...selection });
  const staged = () => harness.posted(MessageType.WORKSHOP_SELECTED_TEXT_STAGED).map((entry) => entry.payload);
  const current = () => harness.posted(MessageType.WORKSHOP_SELECTED_TEXT_CURRENT).map((entry) => entry.payload.selection);
  const pending = () => harness.session.getSnapshot().pendingMessageAttachments;
  const errors = () => harness.posted(MessageType.ERROR).map((entry) => entry.payload.message);
  const restoredDrafts = () => harness.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED).map((entry) => entry.payload.text);
  const writerTurns = () => harness.session.readRoomLedger().filter((turn) => turn.participant === 'writer');
  const revision = () => harness.session.readRoomRevision();
  const handlerLog = () => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => line as string);
  /** The command's gesture: select, then capture. */
  const captureAlice = (over = {}) => {
    editor.select(aliceSelection(over));
    return snapshots.capture()!;
  };

  describe('the command\'s seed', () => {
    it('holds an offer without staging it, and stages the snapshot only when accepted', async () => {
      const snapshot = captureAlice();
      await offer('selected-text-1', snapshot.id);
      expect(harness.posted(MessageType.WORKSHOP_SELECTED_TEXT_OFFERED).map((entry) => entry.payload))
        .toEqual([{ deliveryId: 'selected-text-1' }]);
      expect(pending()).toEqual([]);

      // The selection moves on before the claim is granted: what was captured is what is staged.
      editor.select(aliceSelection({ text: OTHER_TEXT, startLine: 50, endLine: 50 }));
      await accept('selected-text-1');
      expect(staged()).toEqual([{ deliveryId: 'selected-text-1', staged: true, attachmentId: 'ta-1' }]);
      expect(pending()).toEqual([{
        id: 'ta-1',
        label: 'Selected Text',
        words: snapshot.words,
        relativePath: ALICE_PATH,
        selectedText: { snapshotId: 'snap-1', startLine: 40, endLine: 44 }
      }]);
      expect(harness.session.collectMessageAttachments()[0].content).toBe(ALICE_TEXT);
      expect(harness.persistence.markDirty).toHaveBeenCalledWith('selected text staged');
      // The text stays host-side; the webview sees the pill only.
      expect(JSON.stringify(harness.postMessage.mock.calls)).not.toContain('hookah');

      // The offer was consumed: accepting it again stages nothing.
      await accept('selected-text-1');
      expect(staged().at(-1)).toEqual({ deliveryId: 'selected-text-1', staged: false, reason: 'busy' });
      expect(pending()).toHaveLength(1);
    });

    it('answers every accept: nothing held, a replaced offer, a duplicate, an evicted snapshot, a full message', async () => {
      await accept('selected-text-9');
      expect(staged()).toEqual([{ deliveryId: 'selected-text-9', staged: false, reason: 'busy' }]);

      const first = captureAlice();
      await offer('selected-text-1', first.id);
      await offer('selected-text-2', first.id);
      await accept('selected-text-1');
      expect(staged().at(-1)).toMatchObject({ staged: false, reason: 'busy' });
      await accept('selected-text-2');
      expect(staged().at(-1)).toMatchObject({ staged: true });

      await offer('selected-text-3', first.id);
      await accept('selected-text-3');
      expect(staged().at(-1)).toEqual({ deliveryId: 'selected-text-3', staged: false, reason: 'duplicate' });

      await offer('selected-text-4', 'never-minted');
      await accept('selected-text-4');
      expect(staged().at(-1)).toEqual({ deliveryId: 'selected-text-4', staged: false, reason: 'busy' });
      expect(handlerLog().some((line) => line.includes('snapshot never-minted is no longer held'))).toBe(true);

      // Several selections may ride one message, up to the message's bound.
      const limit = PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage;
      for (let line = 2; line <= limit; line += 1) {
        const next = captureAlice({ startLine: line, endLine: line });
        await offer(`selected-text-fill-${line}`, next.id);
        await accept(`selected-text-fill-${line}`);
      }
      expect(pending()).toHaveLength(limit);
      const over = captureAlice({ startLine: 90, endLine: 91 });
      await offer('selected-text-over', over.id);
      await accept('selected-text-over');
      expect(staged().at(-1)).toEqual({ deliveryId: 'selected-text-over', staged: false, reason: 'full' });
      expect(pending()).toHaveLength(limit);
    });

    it('refuses as busy while a session operation is pending, and while a response is running', async () => {
      const snapshot = captureAlice();
      await offer('selected-text-1', snapshot.id);
      harness.persistence.isSessionOperationPending.mockReturnValue(true);
      await accept('selected-text-1');
      expect(staged()).toEqual([{ deliveryId: 'selected-text-1', staged: false, reason: 'busy' }]);
      harness.persistence.isSessionOperationPending.mockReturnValue(false);

      await harness.pin();
      let finish!: (value: unknown) => void;
      harness.service.startWorkshopPersonaConversation.mockImplementationOnce(
        () => new Promise((resolve) => { finish = resolve; }) as never
      );
      const running = send('Does the silence hold?');
      await Promise.resolve();
      await offer('selected-text-2', snapshot.id);
      await accept('selected-text-2');
      expect(staged().at(-1)).toEqual({ deliveryId: 'selected-text-2', staged: false, reason: 'busy' });
      expect(pending()).toEqual([]);
      finish({ content: 'It holds.', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } });
      await running;
    });

    it('drops a malformed offer unclaimed', async () => {
      await offer('selected-text-1', '');
      await offer('selected-text-2', 'x'.repeat(81));
      await offer('selected-text-3', { id: 'snap-1' });
      await offer('x'.repeat(81), 'snap-1');
      expect(harness.posted(MessageType.WORKSHOP_SELECTED_TEXT_OFFERED)).toEqual([]);
    });

    it('sends a staged selection only with the writer\'s message, in a selected-text frame, and leaves the excerpt alone', async () => {
      await harness.pin();
      const excerptBefore = JSON.stringify(harness.session.getExcerpt());
      const snapshot = captureAlice();
      await offer('selected-text-1', snapshot.id);
      await accept('selected-text-1');
      expect(harness.service.startWorkshopPersonaConversation).not.toHaveBeenCalled();

      await send('Is the silence doing enough here?');
      const [input] = harness.service.startWorkshopPersonaConversation.mock.calls[0];
      const frame = input.message.slice(input.message.indexOf('<thread-artifact'), input.message.indexOf('</thread-artifact>'));
      expect(frame.startsWith('<thread-artifact id="ta-1" kind="selected-text">')).toBe(true);
      expect(frame).toContain('Name: Selected Text');
      expect(frame).toContain(`Source: ${ALICE_PATH}`);
      expect(frame).toContain('Text the writer selected in this file, at lines 40–44, when the message was sent.');
      expect(frame).toContain('not the room\'s excerpt');
      expect(frame).toContain(ALICE_TEXT);

      const [turn] = writerTurns();
      expect(turn.messageAttachments).toEqual([
        expect.objectContaining({ id: 'ta-1', label: 'Selected Text', selectedText: { snapshotId: 'snap-1', startLine: 40, endLine: 44 } })
      ]);
      expect(harness.session.getRoomThreadArtifactsForTurn(turn.id)).toEqual([expect.objectContaining({ id: 'ta-1', kind: 'selected-text' })]);
      expect(pending()).toEqual([]);
      // The room's excerpt is exactly what it was: the selection is a message's attachment, never the excerpt.
      expect(JSON.stringify(harness.session.getExcerpt())).toBe(excerptBefore);
    });
  });

  describe('the toggle\'s watch', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('pushes nothing to a tab that is not watching', async () => {
      editor.change(aliceSelection());
      jest.advanceTimersByTime(1_000);
      expect(current()).toEqual([]);
      expect(editor.listeners()).toBe(0);
    });

    it('pushes the current state once on subscribe, then each change as metadata, and stops when unsubscribed', async () => {
      editor.select(aliceSelection());
      await watch(true);
      expect(current()).toEqual([{
        snapshotId: 'snap-1',
        displayName: ALICE_PATH,
        startLine: 40,
        endLine: 44,
        words: ALICE_TEXT.split(/\s+/).length,
        preview: 'The Caterpillar and Alice looked at each other for some time in silence:'
      }]);
      // A deselect clears the pill.
      jest.advanceTimersByTime(PROMPT_BUDGETS.workshopSelectedText.pushIntervalMs);
      editor.change(aliceSelection({ text: '', isEmpty: true }));
      expect(current().at(-1)).toBeNull();

      await watch(false);
      jest.advanceTimersByTime(1_000);
      editor.change(aliceSelection({ startLine: 1, endLine: 2 }));
      jest.advanceTimersByTime(1_000);
      expect(current()).toHaveLength(2);
      expect(editor.listeners()).toBe(0);
      // A watch is never session state.
      expect(harness.persistence.markDirty).not.toHaveBeenCalled();
      expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE)).toEqual([]);
    });

    it('pushes nothing while the tab is hidden, and the current state once when it is visible again', async () => {
      editor.select(aliceSelection());
      await watch(true);
      expect(current()).toHaveLength(1);

      harness.handler.setSurfaceVisible(false);
      jest.advanceTimersByTime(1_000);
      editor.change(aliceSelection({ text: OTHER_TEXT, startLine: 50, endLine: 50 }));
      jest.advanceTimersByTime(1_000);
      expect(current()).toHaveLength(1);
      // Hidden, nothing is captured either: the cache is not churned behind the writer's back.
      expect(snapshots.find('snap-2')).toBeUndefined();

      harness.handler.setSurfaceVisible(true);
      expect(current()).toHaveLength(2);
      expect(current().at(-1)).toMatchObject({ snapshotId: 'snap-2', startLine: 50, preview: OTHER_TEXT });
    });

    it('answers a repeated subscribe with the current state, and drops the watch on dispose', async () => {
      editor.select(aliceSelection());
      await watch(true);
      await watch(true);
      expect(current().map((selection) => selection?.snapshotId)).toEqual(['snap-1', 'snap-1']);
      harness.handler.dispose();
      expect(editor.listeners()).toBe(0);
    });
  });

  describe('the send names the snapshot its pill showed', () => {
    it('the witness: the pill showed snapshot 1, the selection changed, and the send attaches snapshot 1\'s text', async () => {
      await harness.pin();
      editor.select(aliceSelection());
      await watch(true);
      const shown = current().at(-1)!;
      expect(shown.snapshotId).toBe('snap-1');

      // The selection changes after the pill was drawn and before the send lands.
      editor.select(aliceSelection({ text: OTHER_TEXT, startLine: 50, endLine: 50 }));
      await send('Is the silence doing enough here?', { selectedTextSnapshotId: shown.snapshotId, roomRevision: revision() });

      const [input] = harness.service.startWorkshopPersonaConversation.mock.calls[0];
      expect(input.message).toContain('kind="selected-text"');
      expect(input.message).toContain(ALICE_TEXT);
      expect(input.message).toContain('at lines 40–44');
      expect(input.message).not.toContain(OTHER_TEXT);
      expect(writerTurns()[0].messageAttachments).toEqual([
        expect.objectContaining({ selectedText: { snapshotId: 'snap-1', startLine: 40, endLine: 44 } })
      ]);
      expect(pending()).toEqual([]);
      expect(errors()).toEqual([]);
    });

    it('sends nothing and keeps the draft when the snapshot was evicted', async () => {
      await harness.pin();
      const shown = captureAlice();
      for (let line = 1; line <= PROMPT_BUDGETS.workshopSelectedText.snapshots; line += 1) {
        captureAlice({ startLine: line, endLine: line });
      }
      expect(snapshots.find(shown.id)).toBeUndefined();

      await send('Is the silence doing enough here?', { selectedTextSnapshotId: shown.id, roomRevision: revision() });

      expect(harness.service.startWorkshopPersonaConversation).not.toHaveBeenCalled();
      expect(writerTurns()).toEqual([]);
      expect(pending()).toEqual([]);
      expect(errors()).toEqual([WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE]);
      expect(restoredDrafts()).toEqual(['Is the silence doing enough here?']);
    });

    it.each<[string, { selectedTextSnapshotId?: unknown; roomRevision?: unknown }]>([
      ['no room revision', { selectedTextSnapshotId: 'snap-1' }],
      ['a room revision that is not a number', { selectedTextSnapshotId: 'snap-1', roomRevision: '1' }],
      ['an id that is not a string', { selectedTextSnapshotId: 7, roomRevision: 1 }],
      ['an empty id', { selectedTextSnapshotId: '', roomRevision: 1 }]
    ])('refuses the whole send for %s', async (_name, selection) => {
      await harness.pin();
      captureAlice();
      await send('Is the silence doing enough here?', selection);
      expect(harness.service.startWorkshopPersonaConversation).not.toHaveBeenCalled();
      expect(writerTurns()).toEqual([]);
      expect(errors()).toEqual([WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE]);
      expect(restoredDrafts()).toEqual(['Is the silence doing enough here?']);
    });

    it('refuses a send that raced a full message, with the reason, and keeps the draft', async () => {
      await harness.pin();
      const limit = PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage;
      for (let line = 1; line <= limit; line += 1) {
        const next = captureAlice({ startLine: line, endLine: line });
        await offer(`fill-${line}`, next.id);
        await accept(`fill-${line}`);
      }
      const live = captureAlice({ startLine: 90, endLine: 91 });
      await send('One more?', { selectedTextSnapshotId: live.id, roomRevision: revision() });
      expect(harness.service.startWorkshopPersonaConversation).not.toHaveBeenCalled();
      expect(pending()).toHaveLength(limit);
      expect(errors()).toEqual([WORKSHOP_SELECTED_TEXT_FULL_REASON]);
      expect(restoredDrafts()).toEqual(['One more?']);
    });

    it('rides once when its snapshot was already staged by hand, beside another hand-added selection', async () => {
      await harness.pin();
      const first = captureAlice({ startLine: 1, endLine: 2 });
      await offer('hand-1', first.id);
      await accept('hand-1');
      const live = captureAlice();
      await offer('hand-2', live.id);
      await accept('hand-2');

      await send('Both of these.', { selectedTextSnapshotId: live.id, roomRevision: revision() });
      const [input] = harness.service.startWorkshopPersonaConversation.mock.calls[0];
      expect(input.message.match(/<thread-artifact /g)).toHaveLength(2);
      expect(writerTurns()[0].messageAttachments?.map((attachment) => attachment.selectedText?.snapshotId)).toEqual(['snap-1', 'snap-2']);
    });

    it('leaves the pill staged, as an ordinary attachment, when the send rolls back', async () => {
      await harness.pin();
      const live = captureAlice();
      harness.service.startWorkshopPersonaConversation.mockRejectedValueOnce(new Error('provider down'));
      await send('Is the silence doing enough here?', { selectedTextSnapshotId: live.id, roomRevision: revision() });
      expect(pending()).toEqual([expect.objectContaining({ label: 'Selected Text', selectedText: expect.objectContaining({ snapshotId: live.id }) })]);
    });

    it('a send that names no selection is the send it always was', async () => {
      await harness.pin();
      captureAlice();
      await send('No selection with this one.');
      const [input] = harness.service.startWorkshopPersonaConversation.mock.calls[0];
      expect(input.message).not.toContain('<thread-artifact');
      expect(errors()).toEqual([]);
    });
  });

  it('logs kinds, counts and ids, never the selection\'s text, its path or its lines', async () => {
    await harness.pin();
    const snapshot = captureAlice();
    await offer('selected-text-1', snapshot.id);
    await accept('selected-text-1');
    await watch(true);
    await send('Is the silence doing enough here?');
    const live = captureAlice({ text: OTHER_TEXT, startLine: 50, endLine: 52 });
    await send('And this?', { selectedTextSnapshotId: live.id, roomRevision: revision() });
    await send('Stale.', { selectedTextSnapshotId: 'gone', roomRevision: revision() });
    await watch(false);

    const handlerLines = handlerLog().filter((line) => line.includes('[WorkshopSelectedTextHandler]'));
    expect(handlerLines.some((line) => line.includes('kind=selected-text') && line.includes('snapshot snap-1'))).toBe(true);
    expect(handlerLines.some((line) => line.includes('Send refused whole'))).toBe(true);
    expect(serviceLog.lines.length).toBeGreaterThan(0);
    // Every line the Workshop wrote, the room handler's included, and the service's own.
    const logged = [...handlerLog(), ...serviceLog.lines].join('\n');
    for (const mark of [...ALICE_TEXT_MARKS, 'Who are YOU', 'alice-ch3', '40–44', 'lines 40', '50–52']) {
      expect(logged).not.toContain(mark);
    }
  });
});
