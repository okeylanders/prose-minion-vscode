/**
 * A file-edit card's routes through the real router, room handler and slice
 * composition (ADR 2026-11-05 D8, D9; epic Slice 4a): Apply checkpoints,
 * applies through the port with the stored card and the live setting, and
 * answers by request id; Decline settles; the action route sits behind the
 * session-operation gate and is answered there; nothing posted to the
 * webview carries a card's URI. *Alice*, made-up paths.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import {
  fakeFileEditApply,
  fakeFileEditStaging,
  fileEditFrame,
  URI_SENTINEL
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop routes — a file-edit card\'s actions', () => {
  let harness: WorkshopRouteTestHarness;
  let apply: ReturnType<typeof fakeFileEditApply>;
  let turn: WorkshopTurn;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const act = async (action: string, requestId: string) => {
    await route(MessageType.WORKSHOP_FILE_EDIT_ACTION, { requestId, roomRevision: harness.session.readRoomRevision(), turnId: turn.id, index: 0, action });
    await settle();
  };
  const results = () => harness.posted(MessageType.WORKSHOP_FILE_EDIT_RESULT).map((each) => (each as { payload: Record<string, unknown> }).payload);
  const card = () => harness.session.readRoomLedger().find((each) => each.id === turn.id)?.fileEditProposals?.[0];

  beforeEach(async () => {
    apply = fakeFileEditApply();
    harness = createWorkshopRouteTestHarness({ fileEditStaging: fakeFileEditStaging(), fileEditApply: apply });
    await harness.pin();
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`She is ten now.\n\n${fileEditFrame()}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Alice\'s age?' });
    await settle();
    turn = [...harness.session.readRoomLedger()].reverse().find((each) => each.fileEditProposals?.length)!;
  });

  it('Apply checkpoints the card, applies its stored operations through the port, and answers applied', async () => {
    await act('apply', 'r1');
    expect(harness.persistence.checkpointFileEdit).toHaveBeenCalledWith(harness.session.readRoomRevision(), turn.id, 0);
    expect(apply.applies).toHaveLength(1);
    expect(apply.applies[0].staged.operations).toEqual([{ op: 'replace', find: 'Alice is seven', with: 'Alice is ten' }]);
    expect(apply.applies[0].options.stillCurrent()).toBe(false); // the claim is released once settled
    expect(card()?.state).toBe('applied');
    expect(results()).toEqual([expect.objectContaining({ requestId: 'r1', answer: 'settled', state: 'applied' })]);
  });

  it('Decline settles the card declined', async () => {
    await act('decline', 'r1');
    expect(card()?.state).toBe('declined');
    expect(apply.applies).toHaveLength(0);
  });

  it('is behind the session-operation gate, and answers the request there', async () => {
    harness.persistence.isSessionOperationPending.mockReturnValue(true);
    await act('apply', 'r1');
    expect(apply.applies).toHaveLength(0);
    expect(results()).toEqual([expect.objectContaining({ requestId: 'r1', answer: 'refused', reason: 'session-operation' })]);
  });

  it('the setting off at Apply refuses before any checkpoint', async () => {
    const get = harness.settings.get.bind(harness.settings);
    (harness.settings as { get: unknown }).get = ((section: string, key: string, fallback?: unknown) =>
      key === 'workshop.fileEdits' ? 'off' : get(section, key, fallback as never)) as typeof harness.settings.get;
    await act('apply', 'r1');
    expect(harness.persistence.checkpointFileEdit).not.toHaveBeenCalled();
    expect(results()[0]).toMatchObject({ answer: 'refused', reason: 'file-edits-off' });
  });

  it('posts nothing that carries the card\'s URI', async () => {
    await act('apply', 'r1');
    await route(MessageType.WORKSHOP_FILE_EDIT_PREVIEW, { requestId: 'p1', roomRevision: harness.session.readRoomRevision(), turnId: turn.id, index: 0 });
    await settle();
    const posted = JSON.stringify(harness.postMessage.mock.calls);
    expect(posted).not.toContain(URI_SENTINEL);
    expect(posted).not.toContain('documentUri');
  });
});
