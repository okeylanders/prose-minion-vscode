/**
 * Persona file edits through the real router, room handler and completion
 * (ADR 2026-11-05 D9; epic Slice 3): the setting is read when the reply is
 * read, so a reply under `ask` (the default) carries its cards, and one
 * read after the writer turned the setting off carries none, its frames
 * stripped from the bubble either way. *Alice*, made-up paths.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import { fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop routes — file-edit proposals on a reply', () => {
  let harness: WorkshopRouteTestHarness;
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
    harness = createWorkshopRouteTestHarness();
    await harness.pin();
  });

  it('unset (ask), a reply\'s frame becomes a pending card and the bubble shows only the prose', async () => {
    const turn = await reply(`She is ten now.\n\n${fileEditFrame()}`);
    expect(turn.content).toBe('She is ten now.');
    expect(turn.fileEditProposals).toEqual([expect.objectContaining({
      target: { kind: 'resource', group: 'characters', path: 'characters/alice.md' },
      state: 'pending'
    })]);
  });

  it('turned off before the reply is read, the frame is stripped and no card is made', async () => {
    setFileEdits('off');
    const turn = await reply(`She is ten now.\n\n${fileEditFrame()}`);
    expect(turn.content).toBe('She is ten now.');
    expect(turn.fileEditProposals).toBeUndefined();
  });
});
