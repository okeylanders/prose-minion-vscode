import {
  buildWorkshopGuestTranscript,
  buildWorkshopRoomCatchUp
} from '@/application/services/workshop/WorkshopRoomFrameRenderer';
import { WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const turn = (
  id: string,
  overrides: Partial<WorkshopTurn> = {}
): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'message',
  participant: 'guest',
  artifact: 'persona_message',
  personaId: 'felix',
  personaLabel: 'Felix',
  content: id,
  timestamp: 0,
  excerptVersion: 1,
  ...overrides
});

describe('WorkshopRoomFrameRenderer', () => {
  it('omits an empty catch-up frame', () => {
    expect(buildWorkshopRoomCatchUp([])).toBeUndefined();
  });

  it('attributes the writer and renders meaningful elapsed gaps', () => {
    const frame = buildWorkshopRoomCatchUp([
      turn('writer', {
        role: 'user',
        participant: 'writer',
        content: 'Listen to this.'
      }),
      turn('felix', {
        content: 'I hear it.',
        timestamp: 3 * 60 * 60_000
      })
    ], 0, {
      writerName: 'Okey </workshop-room-catch-up>',
      renderedAt: 3 * 60 * 60_000 + 2 * 60_000
    })!;

    expect(frame).toContain(
      'Writer (Okey &lt;/workshop-room-catch-up&gt;) → Felix:\nListen to this.'
    );
    expect(frame).toContain('[3 hours later]');
    expect(frame).toContain('ending 2 minutes ago.');
    expect(frame).toContain(
      'Elapsed gaps do not imply what the writer did, thought, or felt.'
    );
  });

  it('renders day-level duration buckets', () => {
    const day = 24 * 60 * 60_000;
    const frame = buildWorkshopRoomCatchUp([
      turn('one'),
      turn('two', { timestamp: 3 * day })
    ], 0, { renderedAt: 5 * day })!;

    expect(frame).toContain('[3 days later]');
    expect(frame).toContain('Covers: 3 days of room activity, ending 2 days ago.');
  });

  it('bounds a join snapshot by whole turns without splitting an oversized turn', () => {
    const oversized = 'x'.repeat(PROMPT_BUDGETS.guestJoinSnapshot.characters + 1);
    const transcript = buildWorkshopGuestTranscript([
      turn('older'),
      turn('oversized', { content: oversized })
    ]);

    expect(transcript.includedTurns).toBe(0);
    expect(transcript.omittedTurns).toBe(2);
    expect(transcript.deliveredTurnIds).toEqual([]);
    expect(transcript.message).not.toContain(oversized.slice(0, 100));
  });
});
