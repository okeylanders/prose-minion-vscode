/**
 * Persona file edits through the real router, room handler and completion
 * (ADR 2026-11-05 D4, D11; epic Slice 3): the setting is read when the reply
 * is read, and while it is `ask` (the default) each frame is staged through
 * the port, so the reply carries its cards; one read after the writer turned
 * the setting off stages nothing and carries none. The webview's turn and
 * snapshot never carry a card's `documentUri`. *Alice*, made-up paths.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import {
  fakeFileEditStaging,
  fileEditFrame,
  URI_SENTINEL
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop routes — file-edit proposals on a reply', () => {
  let harness: WorkshopRouteTestHarness;
  let staging: ReturnType<typeof fakeFileEditStaging>;
  let sent = 0;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  async function reply(content: string): Promise<WorkshopTurn> {
    sent += 1;
    const call = sent === 1 ? harness.service.startWorkshopPersonaConversation : harness.service.continueConversation;
    call.mockResolvedValueOnce(analysisResult(content, { conversationId: 'host-conv' }) as never);
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: `Alice's age? (${sent})` });
    await settle();
    return [...harness.session.readRoomLedger()].reverse().find((turn) => turn.role === 'assistant')!;
  }
  const setFileEdits = (value: unknown) => {
    const get = harness.settings.get.bind(harness.settings);
    (harness.settings as { get: unknown }).get = ((section: string, key: string, fallback?: unknown) =>
      key === 'workshop.fileEdits' ? value : get(section, key, fallback as never)) as typeof harness.settings.get;
  };

  beforeEach(async () => {
    sent = 0;
    staging = fakeFileEditStaging();
    harness = createWorkshopRouteTestHarness({ fileEditStaging: staging });
    await harness.pin();
  });

  it('unset (ask), a reply\'s frame is staged into a pending card and the bubble shows only the prose', async () => {
    const turn = await reply(`She is ten now.\n\n${fileEditFrame()}`);
    expect(staging.calls).toEqual([{ kind: 'resource', group: 'characters', path: 'characters/alice.md' }]);
    expect(turn.content).toBe('She is ten now.');
    expect(turn.fileEditProposals).toEqual([expect.objectContaining({
      requested: { kind: 'resource', group: 'characters', path: 'characters/alice.md' },
      target: expect.objectContaining({ kind: 'file', relativePath: 'characters/alice.md' }),
      class: 'notes',
      state: 'pending'
    })]);
    // Host-side the identity is whole; the webview never sees its URI.
    expect(turn.fileEditProposals?.[0]?.target?.documentUri).toContain(URI_SENTINEL);
    const posted = JSON.stringify([
      ...harness.posted(MessageType.WORKSHOP_TURN),
      ...harness.posted(MessageType.WORKSHOP_SESSION_STATE)
    ]);
    expect(posted).toContain('characters/alice.md');
    expect(posted).not.toContain(URI_SENTINEL);
    expect(posted).not.toContain('documentUri');
  });

  it('turned off before the reply is read, nothing is staged and no card is made', async () => {
    setFileEdits('off');
    const turn = await reply(`She is ten now.\n\n${fileEditFrame()}`);
    expect(staging.calls).toEqual([]);
    expect(turn.content).toBe('She is ten now.');
    expect(turn.fileEditProposals).toBeUndefined();
  });

  it('an unknown setting value fails closed: nothing is staged', async () => {
    setFileEdits('auto');
    await reply(`She is ten now.\n\n${fileEditFrame()}`);
    expect(staging.calls).toEqual([]);
  });
});
